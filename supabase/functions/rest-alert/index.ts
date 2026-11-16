// Also answers `{endpoint, test: true}` by pushing a test notification to the caller's own device right away
// and returning the push service's answer, so a person can see why notifications aren't arriving.
//
// Pushes "Rest done" to a phone when the rest timer ends while the app is in the background.
// The app calls this when you leave it mid-rest, with your push endpoint and the time the timer ends.
// It answers right away, waits in the background, then sends only if push_subs.rest_until still holds that time.
// Coming back to the app clears rest_until, so nothing is sent while you are looking at the timer.
//
// Needs the same secrets as send-reminders: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (and optionally VAPID_SUBJECT).
// Supabase checks the caller's sign-in token before this runs, and the function checks it again to find the caller.
// Only the caller's own subscription can be armed or tested.
// A wait is capped at 10 minutes, and Supabase may stop background work sooner (about 2.5 minutes on the free plan).
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

const MAX_WAIT_MS = 10 * 60 * 1000;

// The app calls this from the browser, so every answer, including errors, needs these headers
// or the browser hides the response and reports a network failure.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function handle(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("no", { status: 405, headers: cors });
  const pub = Deno.env.get("VAPID_PUBLIC_KEY"), priv = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!pub || !priv) return json({ error: "not_configured" }, 503);

  let endpoint = "", at = 0, test = false;
  try {
    const body = await req.json();
    endpoint = String(body.endpoint ?? "");
    at = Number(body.at);
    test = body.test === true;
  } catch { return json({ error: "bad_request" }, 400); }
  const wait = at - Date.now();
  if (!endpoint || (!test && (!Number.isFinite(wait) || wait < 1000 || wait > MAX_WAIT_MS))) return json({ error: "bad_request" }, 400);

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  // Who is calling: check their sign-in token, then only touch a subscription that belongs to them.
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: who, error: whoErr } = await admin.auth.getUser(token);
  if (whoErr || !who?.user) { console.error("rest-alert: bad token", whoErr?.message); return json({ error: "unauthorized" }, 401); }
  const { data: owned, error: ownErr } = await admin.from("push_subs").select("endpoint").eq("endpoint", endpoint).eq("user_id", who.user.id).maybeSingle();
  if (ownErr) { console.error("rest-alert: lookup failed", ownErr.message); return json({ error: "failed", detail: ownErr.message }, 500); }
  if (!owned) return json({ error: "not_found" }, 404);

  if (test) {
    webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com", pub, priv);
    const { data: s } = await admin.from("push_subs").select("endpoint,p256dh,auth").eq("endpoint", endpoint).maybeSingle();
    if (!s) return json({ error: "not_found" }, 404);
    try {
      const r = await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title: "Get Jacked", body: "Test notification. Notifications are working.", url: "/" }));
      return json({ ok: true, status: r.statusCode });
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode ?? 0;
      if (code === 404 || code === 410) await admin.from("push_subs").delete().eq("endpoint", endpoint);
      return json({ error: "push_failed", status: code });
    }
  }
  const due = new Date(at).toISOString();
  const { error } = await admin.from("push_subs").update({ rest_until: due }).eq("endpoint", endpoint);
  if (error) { console.error("rest-alert: could not store the time", error.message); return json({ error: "failed", detail: error.message }, 500); }

  webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com", pub, priv);
  EdgeRuntime.waitUntil((async () => {
    await new Promise((r) => setTimeout(r, wait));
    const { data: s } = await admin.from("push_subs").select("endpoint,p256dh,auth,rest_until").eq("endpoint", endpoint).maybeSingle();
    // Skip if the person came back (cleared), the timer was changed (a newer time), or the device was removed.
    if (!s?.rest_until || Math.abs(Date.parse(s.rest_until) - at) > 1500) return;
    await admin.from("push_subs").update({ rest_until: null }).eq("endpoint", endpoint);
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title: "Rest done", body: "Time for your next set.", url: "/" }));
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await admin.from("push_subs").delete().eq("endpoint", endpoint);
    }
  })());
  return json({ ok: true });
}

Deno.serve(async (req) => {
  try {
    return await handle(req);
  } catch (e) {
    // Say what broke (for example a malformed push key) so the app's test button can show it. No user data is in these messages.
    const detail = String((e as Error)?.message ?? e).slice(0, 200);
    console.error("rest-alert: unexpected error", detail);
    return json({ error: "server_error", detail }, 500);
  }
});
