

# Sovereignty CRM — Phase 1: Core CRM + Authentication

## Visual Identity
- **"Sanctuary" aesthetic**: Deep navy/slate color palette, clean sans-serif typography, generous whitespace
- Minimal, high-trust design — no dashboards that look like retail banking
- Subtle accent colors (muted gold or teal) for status indicators and CTAs

## 1. Authentication & Access Control
- Google OAuth sign-in via Supabase Auth
- **Domain restriction**: Only @prosperwise.ca emails can access the system
- Simple user table (1-3 advisors, no complex roles needed for now)
- Redirect unauthorized domains to an "Access Denied" page

## 2. Contact Management (The Sovereignty Engine)
Each contact record includes:
- **Standard Fields**: Full name, email, phone, address, household members list, professional team (lawyer name/firm, accountant name/firm)
- **Governance Status Toggle**: "Stabilization Phase (Pre-Charter)" vs. "Sovereign Phase (Ratified Charter)" — prominently displayed on each record
- **Fiduciary Isolation Flag**: Each record tagged as either PWS (Strategy/Architect) or PWA (Advisors/Builder) to maintain legal separation
- **The Vineyard (Entity Data)**: EBITDA, Operating Income, and Balance Sheet summary fields for peer-to-peer business owner conversations
- **The 4 Storehouses (Liquidity Vessels)**: Four collapsible modules per contact, each with asset type, risk cap, and Charter alignment status
- **Resource Sidebar**: Persistent links on each contact for SideDrawer (document vault), Asana (task board), and IA Financial (insurance portal) — these open external URLs

## 3. The "Quiet Period" Workflow
- 90-day countdown timer displayed on all Pre-Charter contact records
- Timer starts from a configurable "Quiet Period Start Date"
- Visual progress bar showing days remaining
- "Zero Sales Pressure" badge visible during the Quiet Period
- Automatic transition prompt when the 90 days complete

## 4. Dashboard
- **Global Summary Cards**: Count of "Active Quiet Periods" vs. "Ratified Charters"
- **Recent Contacts**: Quick-access list of recently viewed or updated contacts
- **Upcoming Milestones**: List of contacts approaching Quiet Period completion
- **Google Integration Placeholder**: A "Command Center" section with a clear indicator that Google Calendar and Gmail integration is coming in Phase 2

## 5. Backend (Lovable Cloud + Supabase)
- Supabase database for all contact and entity data
- Row-Level Security ensuring all advisors on the team can access all contacts (small team, shared access)
- Placeholder server-side functions for "Settlement Bridge" and "Poverty Gap" calculations (formulas to be provided later)
- Data architecture designed for Canadian data residency compliance

## Future Phases (Not in this build)
- **Phase 2**: Full Google Workspace integration (Calendar read/write, Gmail thread display and sending)
- **Phase 3**: Settlement Bridge & Poverty Gap server-side calculations with actual formulas
- **Phase 4**: Advanced reporting and Charter document generation

