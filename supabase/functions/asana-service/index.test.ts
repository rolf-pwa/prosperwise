import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

Deno.test("asana-service rejects unauthenticated requests", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/asana-service`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ action: "getDashboardTasks" }),
  });
  const body = await res.text();
  assertEquals(res.status, 401);
  console.log("Unauthenticated → 401 ✅", body);
});

Deno.test("asana-service rejects invalid portal token", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/asana-service`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ action: "getDashboardTasks", portal_token: "fake-token-12345" }),
  });
  const body = await res.text();
  assertEquals(res.status, 401);
  console.log("Invalid portal token → 401 ✅", body);
});
