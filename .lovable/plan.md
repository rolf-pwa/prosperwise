# Click-to-Call from Contacts

Make the phone number on each row in `/contacts` clickable so staff can place a call through Quo (OpenPhone) without copy/pasting.

## Approach

OpenPhone (Quo) does not expose a public "place an outbound call" REST endpoint we can trigger from the browser. The supported pattern is a **deep link** that hands the number off to the OpenPhone desktop/web app, which then dials using the staff member's logged-in Quo identity (so the call is correctly logged and uses our Canadian number).

Two link strategies, used together:

1. **Primary**: `openphone://call?to=+15551234567` — opens the OpenPhone desktop app directly to a pre-filled call screen.
2. **Fallback**: `https://my.openphone.com/calls?to=+15551234567` — opens OpenPhone Web in a new tab if the desktop app isn't installed.

We'll wire the desktop scheme as the click target and open the web URL in a new tab as a fallback after a short delay if the protocol handler doesn't fire.

## Changes

**`src/pages/Contacts.tsx`**
- Wrap the existing phone span in a button/anchor.
- `onClick`: stop propagation (so the row's contact link doesn't fire), normalize the number to E.164 (strip spaces/dashes/parens, ensure leading `+1` for 10-digit NA numbers), then `window.location.href = "openphone://call?to=..."` and schedule a `window.open("https://my.openphone.com/calls?to=...", "_blank")` fallback ~400ms later.
- Add hover styling (underline + `hover:text-foreground`) and a Phone-icon tooltip hint "Call via Quo".

**`src/pages/ContactDetail.tsx`** (same treatment, for consistency)
- Apply the same click-to-call behaviour wherever the contact's phone is displayed on the detail page.

**Small helper** `src/lib/quo-dial.ts`
- Export `dialViaQuo(phone: string)` containing the normalization + deep-link + fallback logic so both pages share one implementation.

## Out of scope

- No backend / edge function changes — calls are placed by the OpenPhone client, not by our server.
- No changes to the inbound call/SMS pipeline (`quo-webhook`, `quo_calls` table). Outbound calls placed this way will still be captured by the existing webhook because OpenPhone logs them server-side.
- We are not adding in-browser WebRTC dialing (would require Twilio or a different provider — explicitly rejected earlier).

## Notes

- Numbers stored without country code are assumed Canadian/US and prefixed with `+1`.
- If a contact has no phone, the field stays plain text (no link).
- PII Shield is unaffected — we're only opening a URL, not transmitting content.
