## Goal

Replace the `PlaceholderCard` ("Coming Soon") in `TodayActivities` on the Dashboard with a widget showing tasks from a **specific pinned Asana project**, filtered to those due within the next 7 days.

## How to pin the project

The project GID will be stored as a constant in the widget file (simplest, no UI/DB needed). If you'd prefer to make it configurable later (env var or per-user setting), we can move it.

**You'll need to provide the Asana project GID.** You can grab it from the project URL in Asana: `https://app.asana.com/0/{PROJECT_GID}/list`. I'll add a `PINNED_PROJECT_GID` constant at the top of the file — paste yours in.

## Implementation

### 1. `supabase/functions/asana-service/index.ts`
Add a lightweight `getProjectUpcomingTasks` action (or reuse logic) that, given `project_gid`, fetches tasks from that project with `opt_fields=gid,name,completed,due_on,permalink_url,assignee.name` and returns incomplete tasks where `due_on` is within today..today+7. Filtering done server-side to keep payload small. No `PW_Visibility` filter — this is a staff dashboard widget.

### 2. `src/components/TodayActivities.tsx`
Replace `PlaceholderCard` with a new `PinnedProjectTasks` component:
- `PINNED_PROJECT_GID` constant at top of file
- Calls `supabase.functions.invoke("asana-service", { body: { action: "getProjectUpcomingTasks", project_gid: PINNED_PROJECT_GID } })`
- Renders up to ~6 tasks with name + due date, sorted by `due_on` ascending
- Each task is a button that dispatches the existing `open-my-task` event (same pattern as `TodayTasks`) so it opens in the task drawer
- Card title shows the project name (fetched once, or hardcoded alongside the GID)
- Loading / empty states matching existing widget style

### 3. Header / icon
Use a `Pin` (or `Briefcase`) lucide icon and replace "Coming Soon" with the project name (e.g. "Operations" or whatever you pin).

## Open question

What's the Asana project GID (and a short display label) you'd like pinned?
