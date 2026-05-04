
# The Vault — In-Portal Document Workspace (Drive-Backed, Invisible to Client)

Yes — we can do this cleanly. Google Drive becomes the **storage backend** only. Clients never see Drive, never get a Drive link, never need a Google account. The portal renders a fully custom "Vault" experience that looks and feels native to the Sanctuary.

## Client-facing experience (Portal)

A new portal section: **Vault** (or "My Documents"). Pure Sanctuary aesthetic — Vellum cards, amber accents, Noto Serif headings.

```text
+--------------------------------------------------------------+
|  Vault                                          [ Upload ]   |
|  Your secure document workspace                              |
+--------------------------------------------------------------+
|  > Identity & Legal                              4 files     |
|  > Estate (Wills, POA, Trusts)                   7 files     |
|  v Tax                                           3 files     |
|        2024 T1 Return.pdf            2.1 MB   Mar 14         |
|        Notice of Assessment.pdf      180 KB   May 02 [view] |
|        Capital Gains Schedule.xlsx   45 KB    May 02 [dl]    |
|  > Insurance                                     2 files     |
|  > Investment Statements                        18 files     |
+--------------------------------------------------------------+
```

Behaviour:
- **Folder tree**: collapsible accordions; folder names come from a configurable template, not exposed Drive paths.
- **Inline preview**: click a file → opens a modal/side-sheet with PDF/image preview rendered in the portal (PDF.js for PDFs, `<img>` for images, "Download" fallback for everything else). No new tab, no Drive UI.
- **Upload**: drag-and-drop or button. Goes to portal → edge function → Drive (client never touches Drive).
- **Search**: top-bar search across file names + tags (powered by our cached `vault_files` table, not Drive search).
- **No external links anywhere.** "Open in Drive" does not exist in the portal.

Staff side keeps the same Vault page on the CRM, with extra controls (rename, move, delete, set client visibility per file/folder).

## How "no Drive exposure" works technically

The trick: every file the client sees is **streamed through our edge function**, not served from a Drive URL.

1. Portal asks `vault-service.listFolder({ folderId })` → returns metadata only (file id, name, size, mime, modified). **No Drive webViewLink ever leaves the server.**
2. Client clicks a file → portal calls `vault-service.streamFile({ fileId })`.
3. Edge function:
   - Validates the portal session and confirms the file's parent folder is within this client's allowed vault scope (privacy firewall — same pattern as `mem://features/privacy-firewall`).
   - Calls Drive API `files.get?alt=media` using the firm's Workspace OAuth token (Ghost User pattern, `mem://architecture/ghost-user-protocol`).
   - Streams bytes back with the right `Content-Type` and `Content-Disposition: inline`.
4. Portal renders the response in a `<iframe srcDoc>` / PDF.js viewer / `<img>` — all in-app.

Result: client sees `app.prosperwise.ca/portal/vault/...`. Drive is a black-box backend.

## Folder structure (configurable template)

Default per contact:
```text
ProsperWise Vault/
  {Family Name}/
    01 Identity & Legal/
    02 Estate (Wills, POA, Trusts)/
    03 Tax/
    04 Insurance/
    05 Investment Statements/
    06 Real Estate & Mortgages/
    07 Business Entities/
    08 Sovereignty Charter Sources/   (already exists)
    09 Quarterly Reviews/
    10 Correspondence (Signed Docs)/
```
New `vault_folder_templates` table lets staff edit this without a deploy. Client-displayed names are stored separately from Drive folder names so we can rename without touching Drive.

## Privacy & visibility model

New table `vault_file_visibility` (mirrors how `PW_Visibility` works for Asana tasks):

| field | purpose |
|---|---|
| `file_drive_id` | Drive file id (cached) |
| `contact_id` / `household_id` / `family_id` | who can see it |
| `visibility` | `private` / `household` / `family` |
| `client_visible` | bool — gate for portal |

Default: every file uploaded by staff is `private` (staff-only) until someone toggles `client_visible`. Mirrors the HITL gate pattern (`mem://features/hitl-review-queue`) so we never accidentally leak a sensitive draft.

## Data model

New columns on `contacts`:
- `vault_folder_id text` — Drive folder id of the contact's root vault folder
- (we keep `sidedrawer_url` read-only for one release, then drop)

New tables:
- `vault_folder_templates(id, position, display_name, slug)`
- `vault_files(drive_id pk, parent_folder_id, contact_id, name, mime, size, modified_at, tag, client_visible bool)` — cache populated by `drive-watch` cron (already runs hourly) so the portal reads from Postgres, not Drive, on every page load.
- `vault_file_visibility(...)` as above.

Storage bucket `vault-thumbnails` for cached PDF first-page previews (generated server-side once per file).

## Edge functions

**`vault-service`** (replaces `sidedrawer-service`):
- `provisionVault({ contactId })` — create root + template subfolders, store ids
- `listFolder({ folderId })` — folder + file metadata, scoped to caller
- `streamFile({ fileId })` — proxy stream with auth + visibility check
- `uploadFile({ folderId, fileName, base64 })` — accepts portal upload, writes to Drive, inserts `vault_files` row
- `renameFile`, `deleteFile`, `moveFile` — staff only
- `setVisibility({ fileId, client_visible })` — staff toggle

**`drive-watch`** (existing): extend to keep `vault_files` cache fresh hourly. Already iterates Drive folders, so it's an additive change.

**`portal-validate`** / `portal-otp`: add `vault_folder_id` to the contact projection so the portal knows which root to render.

## Frontend

New components:
- `src/components/portal/PortalVault.tsx` — accordion tree + file rows
- `src/components/portal/PortalVaultFilePreview.tsx` — modal with PDF.js / image / download fallback
- `src/components/portal/PortalVaultUpload.tsx` — drag/drop + progress
- `src/pages/Vault.tsx` (staff) — same UI plus rename/move/delete/visibility toggle

Drop legacy:
- `src/pages/SideDrawer.tsx` and the "Open in SideDrawer" button on `ContactDetail.tsx`
- `link_type === "sidedrawer"` mapping in `Portal.tsx`
- `sidedrawer-service` edge function (after cutover)

## PIPEDA / residency

Drive Workspace data residency is set to Canada at the firm tenant level → satisfies `mem://compliance/data-residency`. Files in transit are decrypted only inside our Montreal-pinned Edge Functions before being streamed to the client. PII Shield continues to gate any AI prompts against vault content. No change to Vertex pinning.

## Risks / mitigations

| Risk | Mitigation |
|---|---|
| Edge function bandwidth — every download flows through Supabase | Add 24 h signed URL cache table; serve repeat downloads from CDN-cached signed redirects only when user is on staff side. Portal always proxies. |
| Large files (>50 MB) | Stream with chunked transfer; cap portal upload at 100 MB; staff uploads >100 MB go straight to Drive Web app and just appear in vault. |
| Single firm Google token revoked | Same blast radius as current Charter ingestion. Add health-check + Slack alert. |
| File preview formats Drive renders natively (Docs, Sheets) | For Google-native files, export to PDF on the fly via Drive `export?mimeType=application/pdf` and serve through the same `streamFile`. |
| Search relevance | Postgres `tsvector` over `vault_files.name` + tags. Re-indexed by `drive-watch`. |

## Rollout

1. Migration: new tables, columns, storage bucket, RLS.
2. Build `vault-service` + extend `drive-watch` cache.
3. Build staff `Vault.tsx`; pilot on one family.
4. Build `PortalVault.tsx` behind a feature flag for the same pilot.
5. Provision vaults for all existing contacts (script).
6. Switch portal "My Documents" link to in-app Vault; remove `link_type === "sidedrawer"`.
7. Hide SideDrawer page; 30-day grace period.
8. Drop `sidedrawer-service`, `sidedrawer_url` column, archive `mem://integrations/sidedrawer`, add `mem://features/vault`.

## Effort

- Migration + `vault-service` + `drive-watch` extension: ~1.5 days
- Staff Vault page (clone of SideDrawer.tsx with new wiring + visibility toggles): ~1 day
- Portal Vault + inline preview (PDF.js, modal, upload): ~1.5 days
- Provisioning script + pilot + cutover: ~1 day

**Total: ~5 working days** for the full in-portal, Drive-invisible vault.
