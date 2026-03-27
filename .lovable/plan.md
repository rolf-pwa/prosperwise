

## Daily Recap Journal — `/recaps`

### Overview

A dedicated page where you (or your admin assistant) can log daily recap entries. Each entry combines an AI-generated draft summary of the day's activity with free-form text editing. Only admin/assistant users can create entries; other staff can view them.

### Database

**New table: `daily_recaps`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | default gen_random_uuid() |
| recap_date | date NOT NULL | unique per author |
| author_id | uuid NOT NULL | references auth.users |
| body | text | the recap content (markdown) |
| ai_draft | text | the raw AI-generated draft |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

RLS: authenticated users can SELECT all rows; INSERT/UPDATE restricted to the author.

### AI-Assisted Draft

**New edge function: `recap-draft`**

Queries the day's activity from the database (tasks completed, requests handled, pipeline changes, holding tank activity, contacts modified) and sends it to the Lovable AI Gateway to produce a structured daily summary. The user can then edit before saving.

### UI Components

**Page: `/recaps`**

- Date-ordered list of past recaps (card per day, showing date + preview)
- "New Recap" button at top — defaults to today's date
- On click, fires the AI draft edge function, populates a textarea with the generated summary
- User edits freely, then saves
- Past entries are viewable and editable by the original author
- Search/filter by date range

**Dashboard widget (optional follow-up)**: A small "Today's Recap" card on the dashboard linking to the full page.

### Navigation

Add `/recaps` route (protected) and a sidebar link labeled "Daily Recaps" with a `NotebookPen` icon.

### Technical Steps

1. Create `daily_recaps` table with migration + RLS policies + updated_at trigger
2. Create `recap-draft` edge function that aggregates today's activity and calls Lovable AI
3. Build the `/recaps` page with list view and editor
4. Add route to App.tsx and sidebar link

