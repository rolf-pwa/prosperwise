import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const ASANA_BASE_URL = "https://app.asana.com/api/1.0";
const CHARTER_SUBFOLDER_NAME = "Sovereignty Charter Sources";
const CHARTER_BUCKET = "charter-source-uploads";
const CHARTER_TEXT_LIMIT = 20000;

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

function extractFolderId(driveUrl: string): string | null {
  const match = driveUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

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

function extractProjectGid(asanaUrl: string | null): string | null {
  if (!asanaUrl) return null;
  const newMatch = asanaUrl.match(/\/project\/(\d+)/);
  if (newMatch) return newMatch[1];
  const oldMatch = asanaUrl.match(/app\.asana\.com\/0\/(\d+)/);
  return oldMatch ? oldMatch[1] : null;
}

async function listDriveFilesRecursively(
  accessToken: string,
  folderId: string,
  afterTime: string,
  options?: { pdfsOnly?: boolean },
): Promise<Array<{ id: string; name: string; createdTime: string; modifiedTime?: string; mimeType?: string; webViewLink?: string }>> {
  const files: Array<{ id: string; name: string; createdTime: string; modifiedTime?: string; mimeType?: string; webViewLink?: string }> = [];
  const pdfsOnly = options?.pdfsOnly ?? false;
  const fileFilters = [
    `'${folderId}' in parents`,
    `modifiedTime > '${afterTime}'`,
    `trashed=false`,
  ];

  if (pdfsOnly) {
    fileFilters.push(`mimeType='application/pdf'`, `name contains 'signed'`);
  } else {
    fileFilters.push(`mimeType!='application/vnd.google-apps.folder'`);
  }

  const fileQuery = fileFilters.join(" and ");
  const fileUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(fileQuery)}&fields=files(id,name,createdTime,modifiedTime,mimeType,webViewLink)&orderBy=modifiedTime`;

  const fileRes = await fetch(fileUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const fileData = await fileRes.json();
  if (fileData.files) files.push(...fileData.files);

  const folderQuery = `'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const folderUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(folderQuery)}&fields=files(id,name)`;
  const folderRes = await fetch(folderUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const folderData = await folderRes.json();
  if (folderData.files) {
    for (const subfolder of folderData.files) {
      const nestedFiles = await listDriveFilesRecursively(accessToken, subfolder.id, afterTime, options);
      files.push(...nestedFiles);
    }
  }

  return files;
}

async function findChildFolder(accessToken: string, parentFolderId: string, folderName: string) {
  const query = `'${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and name='${folderName.replace(/'/g, "\'")}' and trashed=false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,modifiedTime)`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Failed to query Drive folders');
  return data.files?.[0] || null;
}

async function downloadDriveFile(accessToken: string, fileId: string, mimeType?: string) {
  const isGoogleDoc = mimeType?.startsWith("application/vnd.google-apps");
  const url = isGoogleDoc
    ? `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`
    : `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to download Drive file [${res.status}]: ${text}`);
  }
  return res.blob();
}

async function uploadBlobToStorage(supabaseAdmin: any, contactId: string, fileName: string, mimeType: string, blob: Blob) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 180) || "charter-source";
  const path = `${contactId}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabaseAdmin.storage
    .from(CHARTER_BUCKET)
    .upload(path, blob, { contentType: mimeType || "application/octet-stream", upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

async function extractTextFromDriveBlob(blob: Blob, mimeType?: string, fileName?: string) {
  const type = mimeType || blob.type || "application/octet-stream";
  if (type.includes("pdf")) {
    return `[Imported PDF: ${fileName || "Drive file"}. Use this as a supporting source document. Detailed PDF parsing is not yet enabled in this step.]`;
  }
  return (await blob.text()).slice(0, CHARTER_TEXT_LIMIT);
}

function inferSourceKind(name: string, mimeType?: string): "statement" | "meeting_transcript" | "stabilization_session" | "note" | "link" {
  const normalized = `${name} ${mimeType || ""}`.toLowerCase();
  if (normalized.includes("transcript") || normalized.includes("meeting")) return "meeting_transcript";
  if (normalized.includes("stabilization") || normalized.includes("session")) return "stabilization_session";
  if (normalized.includes("statement") || normalized.includes("account") || normalized.includes("pdf")) return "statement";
  return "note";
}

async function lookupVisibilityField(taskGid: string, asanaToken: string): Promise<{ fieldGid: string; internalOnlyGid: string } | null> {
  const res = await fetch(`${ASANA_BASE_URL}/tasks/${taskGid}?opt_fields=custom_fields`, {
    headers: { Authorization: `Bearer ${asanaToken}`, "Content-Type": "application/json" },
  });
  if (!res.ok) return null;
  const json = await res.json();
  const cfs = json.data?.custom_fields || [];
  const visField = cfs.find((cf: any) => cf.name === "PW_Visibility" || cf.name?.toLowerCase().includes("visibility"));
  if (!visField || !visField.enum_options) return null;
  const internalOpt = visField.enum_options.find((o: any) => o.name === "Internal Only");
  if (!internalOpt) return null;
  return { fieldGid: visField.gid, internalOnlyGid: internalOpt.gid };
}

async function createAsanaSubtask(parentTaskGid: string, projectGid: string | null, contactName: string, fileName: string, fileUrl: string, asanaToken: string): Promise<boolean> {
  const today = new Date().toISOString().split("T")[0];
  const notes = `A signed PDF "${fileName}" was detected in ${contactName}'s Google Drive folder on ${today}.

Document: ${fileUrl}

Next steps:
- Review the document
- File to SideDrawer (when ready)
- Confirm with client`;

  try {
    const taskData = { data: { name: `Signed document received: ${fileName}`, notes, due_on: today } };
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

    if (projectGid) {
      const addRes = await fetch(`${ASANA_BASE_URL}/tasks/${subtask.gid}/addProject`, {
        method: "POST",
        headers: { Authorization: `Bearer ${asanaToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ data: { project: projectGid } }),
      });
      if (!addRes.ok) console.warn(`[DriveWatch] Failed to add subtask to project:`, await addRes.text());
    }

    const visInfo = await lookupVisibilityField(parentTaskGid, asanaToken);
    if (visInfo) {
      const cfRes = await fetch(`${ASANA_BASE_URL}/tasks/${subtask.gid}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${asanaToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ data: { custom_fields: { [visInfo.fieldGid]: visInfo.internalOnlyGid } } }),
      });
      if (!cfRes.ok) console.warn(`[DriveWatch] Failed to set visibility:`, await cfRes.text());
    }

    return true;
  } catch (e) {
    console.error("[DriveWatch] Subtask creation error:", e);
    return false;
  }
}

async function processSignedDocsWatch(supabaseAdmin: any, accessToken: string, asanaToken: string) {
  const { data: contacts, error: contactsError } = await supabaseAdmin
    .from("contacts")
    .select("id, full_name, google_drive_url, asana_url")
    .not("google_drive_url", "is", null)
    .neq("google_drive_url", "");

  if (contactsError) throw new Error("Failed to fetch contacts");
  if (!contacts || contacts.length === 0) {
    return { success: true, foldersScanned: 0, contactsScanned: 0, totalNewFiles: 0, results: [] };
  }

  const folderMap = new Map<string, typeof contacts>();
  for (const contact of contacts) {
    const folderId = extractFolderId(contact.google_drive_url);
    if (!folderId) continue;
    if (!folderMap.has(folderId)) folderMap.set(folderId, []);
    folderMap.get(folderId)!.push(contact);
  }

  let totalNewFiles = 0;
  const results: Array<{ contact: string; newFiles: number }> = [];

  for (const [folderId, folderContacts] of folderMap.entries()) {
    let earliestChecked = new Date().toISOString();
    const watchStates: Record<string, any> = {};

    for (const contact of folderContacts) {
      const { data: ws } = await supabaseAdmin.from("drive_watch_state").select("*").eq("contact_id", contact.id).maybeSingle();
      watchStates[contact.id] = ws;
      const lastChecked = ws?.last_checked_at || new Date(Date.now() - 60 * 60 * 1000).toISOString();
      if (lastChecked < earliestChecked) earliestChecked = lastChecked;
    }

    try {
      const newPdfs = await listDriveFilesRecursively(accessToken, folderId, earliestChecked, { pdfsOnly: true });
      if (newPdfs.length > 0) {
        let primaryContact = folderContacts.find((c) => extractTaskGid(c.asana_url));
        if (!primaryContact) primaryContact = folderContacts[0];

        const parentTaskGid = extractTaskGid(primaryContact.asana_url);
        const projectGid = extractProjectGid(primaryContact.asana_url);

        for (const pdf of newPdfs) {
          const fileUrl = pdf.webViewLink || `https://drive.google.com/file/d/${pdf.id}/view`;
          if (parentTaskGid) {
            await createAsanaSubtask(parentTaskGid, projectGid, primaryContact.full_name, pdf.name, fileUrl, asanaToken);
          }
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

      for (const contact of folderContacts) {
        await supabaseAdmin.from("drive_watch_state").upsert({
          contact_id: contact.id,
          last_checked_at: new Date().toISOString(),
          last_file_found_at: newPdfs.length > 0 ? new Date().toISOString() : (watchStates[contact.id]?.last_file_found_at || null),
          updated_at: new Date().toISOString(),
        }, { onConflict: "contact_id" });
      }
    } catch (driveErr) {
      console.error(`[DriveWatch] Error scanning folder ${folderId}:`, driveErr);
    }
  }

  return { success: true, foldersScanned: folderMap.size, contactsScanned: contacts.length, totalNewFiles, results };
}

async function processCharterFolderSync(supabaseAdmin: any, accessToken: string, contactId: string) {
  const { data: contact, error: contactError } = await supabaseAdmin
    .from("contacts")
    .select("id, full_name, google_drive_url")
    .eq("id", contactId)
    .maybeSingle();

  if (contactError || !contact) throw new Error("Contact not found for charter sync");
  if (!contact.google_drive_url) throw new Error("No Google Drive folder is linked to this contact");

  const rootFolderId = extractFolderId(contact.google_drive_url);
  if (!rootFolderId) throw new Error("Invalid Google Drive folder URL on contact");

  const charterFolder = await findChildFolder(accessToken, rootFolderId, CHARTER_SUBFOLDER_NAME);
  const now = new Date().toISOString();
  if (!charterFolder?.id) {
    await supabaseAdmin.from("drive_watch_state").upsert({
      contact_id: contactId,
      charter_last_checked_at: now,
      charter_folder_id: null,
      charter_sync_status: "missing_folder",
      updated_at: now,
    }, { onConflict: "contact_id" });

    return {
      success: true,
      status: "missing_folder",
      folderId: null,
      importedCount: 0,
      charterLastCheckedAt: now,
      message: `Create the ${CHARTER_SUBFOLDER_NAME} subfolder inside the contact's Drive folder to enable sync.`,
      sources: [],
    };
  }

  const { data: watchState } = await supabaseAdmin
    .from("drive_watch_state")
    .select("charter_last_checked_at")
    .eq("contact_id", contactId)
    .maybeSingle();

  const afterTime = watchState?.charter_last_checked_at || new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const changedFiles = await listDriveFilesRecursively(accessToken, charterFolder.id, afterTime);

  let importedCount = 0;
  const importedIds = new Set<string>();
  for (const file of changedFiles) {
    try {
      const blob = await downloadDriveFile(accessToken, file.id, file.mimeType);
      const mimeType = file.mimeType?.startsWith("application/vnd.google-apps") ? "text/plain" : (file.mimeType || blob.type || "application/octet-stream");
      const storagePath = await uploadBlobToStorage(supabaseAdmin, contactId, file.name, mimeType, blob);
      const extractedText = await extractTextFromDriveBlob(blob, mimeType, file.name);
      const sourceKind = inferSourceKind(file.name, file.mimeType);

      await supabaseAdmin.from("sovereignty_charter_sources").delete().eq("contact_id", contactId).eq("external_file_id", file.id);
      const { error } = await supabaseAdmin.from("sovereignty_charter_sources").insert({
        charter_id: null,
        contact_id: contactId,
        source_kind: sourceKind,
        input_mode: "upload",
        title: file.name,
        source_url: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
        content_text: null,
        extracted_text: extractedText,
        storage_bucket: CHARTER_BUCKET,
        storage_path: storagePath,
        file_name: file.name,
        mime_type: mimeType,
        sort_order: 0,
        created_by: (await supabaseAdmin.from("google_tokens").select("user_id").limit(1).maybeSingle()).data?.user_id,
        import_origin: "google_drive_sync",
        external_file_id: file.id,
        external_modified_at: file.modifiedTime || file.createdTime,
        external_folder_id: charterFolder.id,
        sync_error: null,
      });
      if (error) throw error;
      importedCount += 1;
      importedIds.add(file.id);
    } catch (error) {
      console.error(`[DriveWatch] Charter sync failed for ${file.name}:`, error);
      await supabaseAdmin.from("sovereignty_charter_sources").upsert({
        contact_id: contactId,
        charter_id: null,
        source_kind: inferSourceKind(file.name, file.mimeType),
        input_mode: "upload",
        title: file.name,
        source_url: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
        content_text: null,
        extracted_text: null,
        storage_bucket: null,
        storage_path: null,
        file_name: file.name,
        mime_type: file.mimeType || null,
        sort_order: 0,
        created_by: (await supabaseAdmin.from("google_tokens").select("user_id").limit(1).maybeSingle()).data?.user_id,
        import_origin: "google_drive_sync",
        external_file_id: file.id,
        external_modified_at: file.modifiedTime || file.createdTime,
        external_folder_id: charterFolder.id,
        sync_error: error instanceof Error ? error.message : "Unknown sync error",
      }, { onConflict: "contact_id,external_file_id" as any });
    }
  }

  const { data: syncedSources } = await supabaseAdmin
    .from("sovereignty_charter_sources")
    .select("*")
    .eq("contact_id", contactId)
    .order("sort_order");

  await supabaseAdmin.from("drive_watch_state").upsert({
    contact_id: contactId,
    charter_last_checked_at: now,
    charter_last_synced_at: importedCount > 0 ? now : null,
    charter_folder_id: charterFolder.id,
    charter_sync_status: importedCount > 0 ? "synced" : "idle",
    updated_at: now,
  }, { onConflict: "contact_id" });

  return {
    success: true,
    status: importedCount > 0 ? "synced" : "idle",
    folderId: charterFolder.id,
    importedCount,
    charterLastCheckedAt: now,
    charterLastSyncedAt: importedCount > 0 ? now : null,
    message: importedCount > 0 ? `${importedCount} Drive file(s) imported for charter drafting.` : "No new or updated charter files were found.",
    sources: syncedSources || [],
    importedFileIds: Array.from(importedIds),
  };
}

serve(async (req) => {
  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const accessToken = await getValidGoogleToken(supabaseAdmin);
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "No valid Google token available" }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    let body: any = {};
    if (req.method !== "GET") {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
    }

    if (body?.mode === "charter-sync") {
      const authHeader = req.headers.get("Authorization") || "";
      const jwt = authHeader.replace(/^Bearer\s+/i, "");
      if (!jwt) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
      }
      const authClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
      });
      const { data: authData, error: authError } = await authClient.auth.getUser();
      const user = authData?.user;
      if (authError || !user || !user.email?.toLowerCase().endsWith("@prosperwise.ca")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
      }
      if (!body?.contactId) {
        return new Response(JSON.stringify({ error: "contactId is required" }), { status: 400, headers: { "Content-Type": "application/json" } });
      }
      const result = await processCharterFolderSync(supabaseAdmin, accessToken, body.contactId);
      return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    const asanaToken = Deno.env.get("ASANA_ACCESS_TOKEN");
    if (!asanaToken) {
      return new Response(JSON.stringify({ error: "ASANA_ACCESS_TOKEN not configured" }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    const result = await processSignedDocsWatch(supabaseAdmin, accessToken, asanaToken);
    return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[DriveWatch] Fatal error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
