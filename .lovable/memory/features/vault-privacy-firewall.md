---
name: Vault Privacy Firewall
description: Per-contact vault_root_folder_id ancestry firewall + collaborator grant model for in-portal Drive-backed Vault
type: feature
---
**Goal:** Clients see only their own vault folder; outside professionals (lawyer/accountant/executor/POA) get scoped, time-boxed, fully-audited access. Drive itself is never exposed.

**Per-contact root:** `contacts.vault_root_folder_id` is the only Drive folder a portal client (or their collaborators) can ever reach. Every `vault-service` action runs `ensureAccess(actor, driveId)` which walks the file's ancestor chain (cached in `vault_files.ancestor_folder_ids`) and confirms the actor's allowed root appears as an ancestor. Mismatch → 403 + `vault_audit_log` entry with `action='firewall_block'`.

**Actor types resolved server-side:**
- `staff` — Bearer JWT (`auth.getUser()`); no firewall, full access.
- `client` — `x-portal-token` header → `portal_tokens` row → `contacts.vault_root_folder_id`. Also enforces `vault_files.client_visible=true` on individual files (default false; staff toggles via `setVisibility` action).
- `collaborator` — `x-vault-guest-token` + `x-vault-unlock-code` (first call) → `vault_guest_tokens` → `vault_collaborators` → active `vault_collaborator_grants` (not revoked, not expired). Bound to user-agent after unlock.

**Collaborator model:**
- `vault_collaborators(contact_id, email, full_name, role, revoked_at)` — outside professional invited to one client.
- `vault_collaborator_grants(collaborator_id, scope_type 'folder'|'file', drive_id, permission 'view'|'upload', expires_at default+30d, revoked_at)`.
- `vault_guest_tokens(token, unlock_code, expires_at default+24h, bound_user_agent, revoked)` — magic link + 6-digit code, single device after first unlock.
- Landing page: `/vault/guest/:token` → unlock screen → `myGrants` action returns root folder names → standard listFolder/streamFile through proxy.

**Audit:** `vault_audit_log(actor_type, actor_id, action, drive_id, ip, user_agent, metadata)` — every list/preview/download/upload/grant/revoke/firewall_block writes a row. Service-role insert only; staff read.

**Uploads:** Collaborators with `permission='upload'` may add files. Inserted with `client_visible=false` and `staff_reviewed=false` — HITL gate.

**Revocation = instant:** flip `revoked_at` on collaborator or grant; next request 403s. Drive ACLs never granted to outside parties, so nothing to revoke on Google's side.

**PIPEDA:** Drive bytes only ever decrypted inside Montreal Edge Function. No Drive URLs leave the server.
