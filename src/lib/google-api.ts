import { supabase } from "@/integrations/supabase/client";

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    Authorization: `Bearer ${session?.access_token}`,
    "Content-Type": "application/json",
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
}

// --- Google Auth ---

export async function getGoogleAuthUrl() {
  const headers = await getAuthHeaders();
  const redirectUri = `${window.location.origin}/google-callback`;
  const res = await fetch(`${FUNCTIONS_URL}/google-auth?action=auth-url`, {
    method: "POST",
    headers,
    body: JSON.stringify({ redirect_uri: redirectUri }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to get auth URL");
  return data.url as string;
}

export async function exchangeGoogleCode(code: string) {
  const headers = await getAuthHeaders();
  const redirectUri = `${window.location.origin}/google-callback`;
  const res = await fetch(`${FUNCTIONS_URL}/google-auth?action=callback`, {
    method: "POST",
    headers,
    body: JSON.stringify({ code, redirect_uri: redirectUri }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to exchange code");
  return data;
}

export async function getGoogleConnectionStatus() {
  const headers = await getAuthHeaders();
  const res = await fetch(`${FUNCTIONS_URL}/google-auth?action=status`, {
    method: "POST",
    headers,
  });
  return res.json();
}

export async function disconnectGoogle() {
  const headers = await getAuthHeaders();
  const res = await fetch(`${FUNCTIONS_URL}/google-auth?action=disconnect`, {
    method: "POST",
    headers,
  });
  return res.json();
}

// --- Calendar ---

export async function listCalendarEvents(timeMin?: string, timeMax?: string) {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams({ action: "list" });
  if (timeMin) params.set("timeMin", timeMin);
  if (timeMax) params.set("timeMax", timeMax);
  const res = await fetch(`${FUNCTIONS_URL}/google-calendar?${params}`, { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to list events");
  return data;
}

export async function createCalendarEvent(event: {
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
  attendees?: { email: string }[];
}) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${FUNCTIONS_URL}/google-calendar?action=create`, {
    method: "POST",
    headers,
    body: JSON.stringify(event),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to create event");
  return data;
}

// --- Gmail ---

export async function listGmailMessages(query?: string) {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams({ action: "list" });
  if (query) params.set("q", query);
  const res = await fetch(`${FUNCTIONS_URL}/google-gmail?${params}`, { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to list messages");
  return data;
}

export async function readGmailMessage(messageId: string) {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams({ action: "read", messageId });
  const res = await fetch(`${FUNCTIONS_URL}/google-gmail?${params}`, { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to read message");
  return data;
}

export async function sendGmailMessage(to: string, subject: string, body: string) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${FUNCTIONS_URL}/google-gmail?action=send`, {
    method: "POST",
    headers,
    body: JSON.stringify({ to, subject, body }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to send message");
  return data;
}

export async function createGmailDraft(to: string, subject: string, body: string) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${FUNCTIONS_URL}/google-gmail?action=draft`, {
    method: "POST",
    headers,
    body: JSON.stringify({ to, subject, body }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to create draft");
  return data;
}

