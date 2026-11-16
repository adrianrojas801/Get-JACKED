// Pushes "Rest done" to a phone when the rest timer ends while the app is in the background.
// The app calls this when you leave it mid-rest, with your push endpoint and the time the timer ends.
// It answers right away, waits in the background, then sends only if push_subs.rest_until still holds that time.
// Coming back to the app clears rest_until, so nothing is sent while you are looking at the timer.
//
// Needs the same secrets as send-reminders: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (and optionally VAPID_SUBJECT).
// Supabase checks the caller's sign-in token before this runs. Only the caller's own subscription can be armed.
// A wait is capped at 10 minutes, and Supabase may stop background work sooner (about 2.5 minutes on the free plan).
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

const MAX_WAIT_MS = 10 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("no", { status: 405 });
  const pub = Deno.env.get("VAPID_PUBLIC_KEY"), priv = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!pub || !priv) return Response.json({ error: "not_configured" }, { status: 503 });

  let endpoint = "", at = 0;
  try {
    const body = await req.json();
    endpoint = String(body.endpoint ?? "");
    at = Number(body.at);
  } catch { return Response.json({ error: "bad_request" }, { status: 400 }); }
  const wait = at - Date.now();
  if (!endpoint || !Number.isFinite(wait) || wait < 1000 || wait > MAX_WAIT_MS) return Response.json({ error: "bad_request" }, { status: 400 });

  const url = Deno.env.get("SUPABASE_URL")!;
  // The caller's own client: row security means this only finds the caller's own subscription.
  const mine = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: owned } = await mine.from("push_subs").select("endpoint").eq("endpoint", endpoint).maybeSingle();
  if (!owned) return Response.json({ error: "not_found" }, { status: 404 });

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const due = new Date(at).toISOString();
  const { error } = await admin.from("push_subs").update({ rest_until: due }).eq("endpoint", endpoint);
  if (error) return Response.json({ error: "failed" }, { status: 500 });

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
  return Response.json({ ok: true });
});
