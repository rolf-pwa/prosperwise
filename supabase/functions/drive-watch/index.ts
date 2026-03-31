import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * drive-watch – Hourly cron function
 * Polls each contact's linked Google Drive folder (recursively) for new PDFs.
 * When found: creates an Asana subtask under the contact's parent task + staff notification.
 * Deduplicates when multiple contacts share the same Drive folder.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const ASANA_BASE_URL = "https://app.asana.com/api/1.0";

// ---------------------------------------------------------------------------
// Google token management
// ---------------------------------------------------------------------------
async function getValidGoogleToken(supabaseAdmin: any): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("google_tokens")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    console.error("[DriveWatch] No Google tokens found:", error);
    return null;
  }

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
// ---------------------------------------------------------------------------
function extractFolderId(driveUrl: string): string | null {
  const match = driveUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

// ---------------------------------------------------------------------------
// Extract Asana task GID from contact's asana_url (parent task link)
// ---------------------------------------------------------------------------
function extractTaskGid(asanaUrl: string | null): string | null {
  if (!asanaUrl) return null;
  const newTaskMatch = asanaUrl.match(/\/task\/(\d+)/);
  if (newTaskMatch) return newTaskMatch[1];
  const listTaskMatch = asanaUrl.match(/\/project\/\d+\/list\/(\d+)/);
  if (listTaskMatch) return listTaskMatch[1];
  const twoSegment = asanaUrl.match(/app\.asana\.com\/0\/\d+\/(\d+)/);
  if (twoSegment) return twoSegment[1];
  return null;
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
): Promise<Array<{ id: string; name: string; createdTime: string; webViewLink?: string }>> {
  const pdfs: Array<{ id: string; name: string; createdTime: string; webViewLink?: string }> = [];

  const pdfQuery = `'${folderId}' in parents and mimeType='application/pdf' and name contains 'signed' and createdTime > '${afterTime}' and trashed=false`;
  const pdfUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(pdfQuery)}&fields=files(id,name,createdTime,webViewLink)&orderBy=createdTime`;

  const pdfRes = await fetch(pdfUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const pdfData = await pdfRes.json();
  if (pdfData.files) {
    pdfs.push(...pdfData.files);
  }

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
// Lookup PW_Visibility field from a task's custom fields
// ---------------------------------------------------------------------------
async function lookupVisibilityField(
  taskGid: string,
  asanaToken: string,
): Promise<{ fieldGid: string; internalOnlyGid: string } | null> {
  const res = await fetch(`${ASANA_BASE_URL}/tasks/${taskGid}?opt_fields=custom_fields`, {
    headers: { Authorization: `Bearer ${asanaToken}`, "Content-Type": "application/json" },
  });
  if (!res.ok) return null;
  const json = await res.json();
  const cfs = json.data?.custom_fields || [];
  const visField = cfs.find(
    (cf: any) => cf.name === "PW_Visibility" || cf.name?.toLowerCase().includes("visibility"),
  );
  if (!visField || !visField.enum_options) return null;
  const internalOpt = visField.enum_options.find((o: any) => o.name === "Internal Only");
  if (!internalOpt) return null;
  return { fieldGid: visField.gid, internalOnlyGid: internalOpt.gid };
}

// ---------------------------------------------------------------------------
// Create Asana subtask under a parent task
// ---------------------------------------------------------------------------
async function createAsanaSubtask(
  parentTaskGid: string,
  projectGid: string | null,
  contactName: string,
  fileName: string,
  fileUrl: string,
  asanaToken: string,
): Promise<boolean> {
  const today = new Date().toISOString().split("T")[0];
  const notes = `A signed PDF "${fileName}" was detected in ${contactName}'s Google Drive folder on ${today}.\n\nDocument: ${fileUrl}\n\nNext steps:\n- Review the document\n- File to SideDrawer (when ready)\n- Confirm with client`;

  try {
    // Step 1: Create subtask
    const taskData = { data: { name: `Signed document received: ${fileName}`, notes, due_on: today } };
    console.log("[DriveWatch] Subtask request body:", JSON.stringify(taskData));
    const res = await fetch(`${ASANA_BASE_URL}/tasks/${parentTaskGid}/subtasks`, {
      method: "POST",
      headers: { Authorization: `Bearer ${asanaToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(taskData),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[DriveWatch] Subtask creation failed [${res.status}]:`, err);
      return false;
    }
    const subtask = (await res.json()).data;
    if (!subtask?.gid) return false;

    console.log(`[DriveWatch] Created subtask ${subtask.gid} under parent ${parentTaskGid}`);

    // Step 2: Add to project so custom fields are available
    if (projectGid) {
      const addRes = await fetch(`${ASANA_BASE_URL}/tasks/${subtask.gid}/addProject`, {
        method: "POST",
        headers: { Authorization: `Bearer ${asanaToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ data: { project: projectGid } }),
      });
      if (addRes.ok) {
        console.log(`[DriveWatch] Subtask added to project ${projectGid}`);
      } else {
        console.warn(`[DriveWatch] Failed to add subtask to project:`, await addRes.text());
      }
    }

    // Step 3: Set PW_Visibility to Internal Only
    const visInfo = await lookupVisibilityField(parentTaskGid, asanaToken);
    if (visInfo) {
      const cfRes = await fetch(`${ASANA_BASE_URL}/tasks/${subtask.gid}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${asanaToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ data: { custom_fields: { [visInfo.fieldGid]: visInfo.internalOnlyGid } } }),
      });
      if (cfRes.ok) {
        console.log(`[DriveWatch] Set visibility to Internal Only on subtask ${subtask.gid}`);
      } else {
        console.warn(`[DriveWatch] Failed to set visibility:`, await cfRes.text());
      }
    } else {
      console.warn(`[DriveWatch] Could not find PW_Visibility field on parent ${parentTaskGid}`);
    }

    return true;
  } catch (e) {
    console.error("[DriveWatch] Subtask creation error:", e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
serve(async (req) => {
  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const accessToken = await getValidGoogleToken(supabaseAdmin);
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "No valid Google token available" }), {
        status: 500, headers: { "Content-Type": "application/json" },
      });
    }

    const asanaToken = Deno.env.get("ASANA_ACCESS_TOKEN");
    if (!asanaToken) {
      return new Response(JSON.stringify({ error: "ASANA_ACCESS_TOKEN not configured" }), {
        status: 500, headers: { "Content-Type": "application/json" },
      });
    }

    // Get all contacts with a google_drive_url
    const { data: contacts, error: contactsError } = await supabaseAdmin
      .from("contacts")
      .select("id, full_name, google_drive_url, asana_url")
      .not("google_drive_url", "is", null)
      .neq("google_drive_url", "");

    if (contactsError) {
      console.error("[DriveWatch] Error fetching contacts:", contactsError);
      return new Response(JSON.stringify({ error: "Failed to fetch contacts" }), {
        status: 500, headers: { "Content-Type": "application/json" },
      });
    }

    if (!contacts || contacts.length === 0) {
      return new Response(JSON.stringify({ message: "No contacts with Drive folders" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    // -----------------------------------------------------------------------
    // Deduplicate: group contacts by folder ID so shared folders are scanned once
    // -----------------------------------------------------------------------
    const folderMap = new Map<string, typeof contacts>();
    for (const contact of contacts) {
      const folderId = extractFolderId(contact.google_drive_url);
      if (!folderId) {
        console.warn(`[DriveWatch] Could not extract folder ID for ${contact.full_name}: ${contact.google_drive_url}`);
        continue;
      }
      if (!folderMap.has(folderId)) {
        folderMap.set(folderId, []);
      }
      folderMap.get(folderId)!.push(contact);
    }

    let totalNewFiles = 0;
    const results: Array<{ contact: string; newFiles: number }> = [];

    for (const [folderId, folderContacts] of folderMap.entries()) {
      // Use the earliest last_checked_at among contacts sharing this folder
      let earliestChecked = new Date().toISOString();
      const watchStates: Record<string, any> = {};

      for (const contact of folderContacts) {
        const { data: ws } = await supabaseAdmin
          .from("drive_watch_state")
          .select("*")
          .eq("contact_id", contact.id)
          .maybeSingle();
        watchStates[contact.id] = ws;
        const lastChecked = ws?.last_checked_at || new Date(Date.now() - 60 * 60 * 1000).toISOString();
        if (lastChecked < earliestChecked) earliestChecked = lastChecked;
      }

      try {
        const newPdfs = await listPdfsRecursively(accessToken, folderId, earliestChecked);

        if (newPdfs.length > 0) {
          console.log(`[DriveWatch] Found ${newPdfs.length} new PDF(s) in folder ${folderId} (shared by ${folderContacts.map(c => c.full_name).join(", ")})`);

          // Pick one primary contact for the subtask (first one with a valid task GID)
          let primaryContact = folderContacts.find(c => extractTaskGid(c.asana_url));
          if (!primaryContact) primaryContact = folderContacts[0];

          const parentTaskGid = extractTaskGid(primaryContact.asana_url);
          const projectGid = extractProjectGid(primaryContact.asana_url);

          for (const pdf of newPdfs) {
            const fileUrl = pdf.webViewLink || `https://drive.google.com/file/d/${pdf.id}/view`;

            // Create ONE Asana subtask (not per-contact)
            if (parentTaskGid) {
              await createAsanaSubtask(parentTaskGid, projectGid, primaryContact.full_name, pdf.name, fileUrl, asanaToken);
            } else {
              console.warn(`[DriveWatch] No Asana parent task for ${primaryContact.full_name}, skipping subtask`);
            }

            // Create ONE staff notification (for primary contact)
            await supabaseAdmin.from("staff_notifications").insert({
              title: `📄 Signed document: ${pdf.name}`,
              body: `New PDF detected in ${primaryContact.full_name}'s Google Drive folder.`,
              source_type: "drive_watch",
              contact_id: primaryContact.id,
              link: `/contacts/${primaryContact.id}`,
            });
          }

          totalNewFiles += newPdfs.length;
          results.push({ contact: primaryContact.full_name, newFiles: newPdfs.length });
        }

        // Update watch state for ALL contacts sharing this folder
        for (const contact of folderContacts) {
          await supabaseAdmin
            .from("drive_watch_state")
            .upsert(
              {
                contact_id: contact.id,
                last_checked_at: new Date().toISOString(),
                last_file_found_at: newPdfs.length > 0 ? new Date().toISOString() : (watchStates[contact.id]?.last_file_found_at || null),
                updated_at: new Date().toISOString(),
              },
              { onConflict: "contact_id" },
            );
        }
      } catch (driveErr) {
        console.error(`[DriveWatch] Error scanning folder ${folderId}:`, driveErr);
      }
    }

    console.log(`[DriveWatch] Scan complete. ${totalNewFiles} new file(s) found across ${folderMap.size} folders.`);

    return new Response(
      JSON.stringify({ success: true, foldersScanned: folderMap.size, contactsScanned: contacts.length, totalNewFiles, results }),
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
