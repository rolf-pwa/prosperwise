import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * drive-watch – Hourly cron function
 * Polls each contact's linked Google Drive folder (recursively) for new PDFs.
 * When found: creates an Asana task + staff notification.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const ASANA_BASE_URL = "https://app.asana.com/api/1.0";

// ---------------------------------------------------------------------------
// Google token management (reused from google-gmail pattern)
// ---------------------------------------------------------------------------
async function getValidGoogleToken(supabaseAdmin: any): Promise<string | null> {
  // Get the first available Google token (staff user)
  const { data, error } = await supabaseAdmin
    .from("google_tokens")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    console.error("[DriveWatch] No Google tokens found:", error);
    return null;
  }

  // Refresh if expired
  if (new Date(data.token_expiry) <= new Date()) {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: data.refresh_token,
        grant_type: "refresh_token",
      }),
    });
    const tokens = await res.json();
    if (tokens.error) {
      console.error("[DriveWatch] Token refresh failed:", tokens.error);
      return null;
    }

    const newExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    await supabaseAdmin
      .from("google_tokens")
      .update({ access_token: tokens.access_token, token_expiry: newExpiry })
      .eq("user_id", data.user_id);

    return tokens.access_token;
  }

  return data.access_token;
}

// ---------------------------------------------------------------------------
// Extract Google Drive folder ID from URL
// Supports: https://drive.google.com/drive/folders/FOLDER_ID
//           https://drive.google.com/drive/u/0/folders/FOLDER_ID
// ---------------------------------------------------------------------------
function extractFolderId(driveUrl: string): string | null {
  const match = driveUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

// ---------------------------------------------------------------------------
// Extract Asana project GID from contact's asana_url
// ---------------------------------------------------------------------------
function extractProjectGid(asanaUrl: string | null): string | null {
  if (!asanaUrl) return null;
  const newMatch = asanaUrl.match(/\/project\/(\d+)/);
  if (newMatch) return newMatch[1];
  const oldMatch = asanaUrl.match(/app\.asana\.com\/0\/(\d+)/);
  return oldMatch ? oldMatch[1] : null;
}

// ---------------------------------------------------------------------------
// Recursively list all PDF files in a folder and subfolders
// ---------------------------------------------------------------------------
async function listPdfsRecursively(
  accessToken: string,
  folderId: string,
  afterTime: string,
): Promise<Array<{ id: string; name: string; createdTime: string }>> {
  const pdfs: Array<{ id: string; name: string; createdTime: string }> = [];

  // Find PDFs directly in this folder created after our last check
  const pdfQuery = `'${folderId}' in parents and mimeType='application/pdf' and createdTime > '${afterTime}' and trashed=false`;
  const pdfUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(pdfQuery)}&fields=files(id,name,createdTime)&orderBy=createdTime`;

  const pdfRes = await fetch(pdfUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const pdfData = await pdfRes.json();
  if (pdfData.files) {
    pdfs.push(...pdfData.files);
  }

  // Find subfolders and recurse
  const folderQuery = `'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const folderUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(folderQuery)}&fields=files(id,name)`;

  const folderRes = await fetch(folderUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const folderData = await folderRes.json();
  if (folderData.files) {
    for (const subfolder of folderData.files) {
      const subPdfs = await listPdfsRecursively(accessToken, subfolder.id, afterTime);
      pdfs.push(...subPdfs);
    }
  }

  return pdfs;
}

// ---------------------------------------------------------------------------
// Create Asana task for a signed document
// ---------------------------------------------------------------------------
async function createAsanaTask(
  projectGid: string,
  contactName: string,
  fileName: string,
): Promise<boolean> {
  const asanaToken = Deno.env.get("ASANA_ACCESS_TOKEN");
  if (!asanaToken) {
    console.error("[DriveWatch] ASANA_ACCESS_TOKEN not configured");
    return false;
  }

  const today = new Date().toISOString().split("T")[0];

  try {
    const res = await fetch(`${ASANA_BASE_URL}/tasks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${asanaToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          name: `📄 Signed document received: ${fileName}`,
          notes: `A signed PDF "${fileName}" was detected in ${contactName}'s Google Drive folder on ${today}.\n\nNext steps:\n- Review the document\n- File to SideDrawer (when ready)\n- Confirm with client`,
          projects: [projectGid],
          due_on: today,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[DriveWatch] Asana task creation failed [${res.status}]:`, err);
      return false;
    }
    await res.json();
    return true;
  } catch (e) {
    console.error("[DriveWatch] Asana task creation error:", e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
serve(async (req) => {
  // This is a cron-invoked function, no CORS needed
  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get a valid Google access token
    const accessToken = await getValidGoogleToken(supabaseAdmin);
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "No valid Google token available" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get all contacts that have a google_drive_url set
    const { data: contacts, error: contactsError } = await supabaseAdmin
      .from("contacts")
      .select("id, full_name, google_drive_url, asana_url")
      .not("google_drive_url", "is", null)
      .neq("google_drive_url", "");

    if (contactsError) {
      console.error("[DriveWatch] Error fetching contacts:", contactsError);
      return new Response(JSON.stringify({ error: "Failed to fetch contacts" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!contacts || contacts.length === 0) {
      return new Response(JSON.stringify({ message: "No contacts with Drive folders" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    let totalNewFiles = 0;
    const results: Array<{ contact: string; newFiles: number }> = [];

    for (const contact of contacts) {
      const folderId = extractFolderId(contact.google_drive_url);
      if (!folderId) {
        console.warn(`[DriveWatch] Could not extract folder ID for ${contact.full_name}: ${contact.google_drive_url}`);
        continue;
      }

      // Get or create watch state for this contact
      const { data: watchState } = await supabaseAdmin
        .from("drive_watch_state")
        .select("*")
        .eq("contact_id", contact.id)
        .maybeSingle();

      const lastChecked = watchState?.last_checked_at || new Date(Date.now() - 60 * 60 * 1000).toISOString();

      try {
        // Recursively find new PDFs
        const newPdfs = await listPdfsRecursively(accessToken, folderId, lastChecked);

        if (newPdfs.length > 0) {
          console.log(`[DriveWatch] Found ${newPdfs.length} new PDF(s) for ${contact.full_name}`);

          const projectGid = extractProjectGid(contact.asana_url);

          for (const pdf of newPdfs) {
            // Create Asana task if contact has an Asana project
            if (projectGid) {
              await createAsanaTask(projectGid, contact.full_name, pdf.name);
            }

            // Create staff notification
            await supabaseAdmin.from("staff_notifications").insert({
              title: `📄 Signed document: ${pdf.name}`,
              body: `New PDF detected in ${contact.full_name}'s Google Drive folder.`,
              source_type: "drive_watch",
              contact_id: contact.id,
              link: `/contacts/${contact.id}`,
            });
          }

          totalNewFiles += newPdfs.length;
          results.push({ contact: contact.full_name, newFiles: newPdfs.length });
        }

        // Update watch state
        await supabaseAdmin
          .from("drive_watch_state")
          .upsert(
            {
              contact_id: contact.id,
              last_checked_at: new Date().toISOString(),
              last_file_found_at: newPdfs.length > 0 ? new Date().toISOString() : (watchState?.last_file_found_at || null),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "contact_id" }
          );
      } catch (driveErr) {
        console.error(`[DriveWatch] Error scanning Drive for ${contact.full_name}:`, driveErr);
        // Continue with next contact
      }
    }

    console.log(`[DriveWatch] Scan complete. ${totalNewFiles} new file(s) found across ${contacts.length} contacts.`);

    return new Response(
      JSON.stringify({
        success: true,
        contactsScanned: contacts.length,
        totalNewFiles,
        results,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[DriveWatch] Fatal error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
