## Save conversation context to memory

No code changes. Only writes a memory file so this analysis is available if the topic comes back up.

### Create `mem://decisions/quo-vs-google-voice`

Captures:

- **Decision**: Stay on Quo for SMS/voice. Migration to Google Voice deferred.
- **Why Google Voice doesn't fit**: no public API for SMS/voice, no webhooks, no programmatic send/receive.
- **Embed feasibility per surface**:
  - Gmail — cannot iframe (`X-Frame-Options` blocks it)
  - Google Voice — cannot iframe, no API
  - Google Calendar — yes, official embed iframe available (read-only)
- **Twilio**: ruled out — Canadian Quo number already in place.
- **Revival blueprint** (if revisited later):
  1. New `google-voice` edge function parsing Voice→Gmail forwarded notifications
  2. Communications tab becomes read-only Gmail-backed timeline
  3. Deep-link out to `voice.google.com` for replies
  4. Retire `quo-service`, `quo-webhook`, `QuoCommunications`, `PortalMessages` composer
  5. Clients shift to Portal Requests instead of portal SMS
  6. Per-staff onboarding step: enable Voice → Gmail forwarding
  7. Update Charter; replace `mem://integrations/quo` with `mem://integrations/google-voice`
- **Accepted tradeoffs if revived**: no in-app send, no portal SMS, no delivery receipts, parser fragility.

### Update `mem://index.md`

Add reference line under Memories:
- `[Quo vs Google Voice Decision](mem://decisions/quo-vs-google-voice) — Migration deferred May 2026; Voice has no API, Gmail/Voice not iframeable, Calendar is`

No other files touched.