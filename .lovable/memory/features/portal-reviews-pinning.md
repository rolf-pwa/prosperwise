---
name: Portal Reviews Pinning
description: Quarterly Review PDFs in the contact's Sovereignty Charter Sources Drive folder auto-pin to Portal > Reviews tab and spawn an internal Asana action task with one subtask per priority
type: feature
---
When the drive-watch sync ingests a file from a contact's "Sovereignty Charter Sources" Drive folder whose name contains "quarterly", "governance review", or "qsr", it tags the row with `source_kind = 'quarterly_review'` in `sovereignty_charter_sources`.

`portal-validate` and `portal-otp` collect those rows for the contact + household members and return them as `quarterly_reviews`, with a 24h signed URL from the private `charter-source-uploads` bucket plus the Drive `webViewLink` as fallback.

The Portal Reviews tab (`src/pages/Portal.tsx`) renders the list newest-first with member attribution; clicking opens the signed URL (or Drive link). Empty state explains the auto-pin behavior.

When the same file is freshly imported, drive-watch's `processCharterFolderSync` also looks up the contact's most recent `quarterly_system_reviews` row and creates an internal Asana subtask under the contact's parent task (from `contacts.asana_url`) titled `Quarterly Governance Review priorities — {review_date}`. Each non-empty `priority_1`..`priority_5` becomes a sub-subtask. The parent task is marked Internal Only via the `PW_Visibility` custom field. Idempotency: the function first checks for an existing subtask with the same name and skips creation if found, so re-syncs do not duplicate tasks.
