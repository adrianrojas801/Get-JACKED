// Sends the two reminders: a morning weigh-in nudge and an evening "you haven't trained yet" nudge.
// Meant to be called once an hour by a database cron job (README, "Optional features").
//
// Off until the owner sets these secrets:
//   CRON_SECRET                         required. The caller must send it in the x-cron-secret header.
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY required. The public one also goes in config.js.
//   VAPID_SUBJECT                       optional, a mailto: address push services can contact.
// It uses the service role to read, for each subscribed person, only: whether today has a weight,
// today's scheduled session, and whether a workout was logged today. Nothing is returned to the caller but counts.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

type Sub = { endpoint: string; user_id: string; p256dh: string; auth: string; tz: string; morning: number; evening: number };

// The date, hour and weekday (0 = Sunday) right now in a time zone.
function localNow(tz: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", weekday: "short",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
    weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday")),
  };
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) return new Response("no", { status: 401 });
  const pub = Deno.env.get("VAPID_PUBLIC_KEY"), priv = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!pub || !priv) return Response.json({ error: "not_configured" }, { status: 503 });
  webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com", pub, priv);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: subs, error } = await sb.from("push_subs").select("*");
  if (error) return Response.json({ error: error.message }, { status: 500 });

  let sent = 0, removed = 0;
  for (const s of (subs ?? []) as Sub[]) {
    let now;
    try { now = localNow(s.tz); } catch { continue; }
    const kind = now.hour === s.morning ? "weigh" : now.hour === s.evening ? "train" : null;
    if (!kind) continue;

    const doc = async (coll: string, id: string) =>
      (await sb.from("docs").select("data").eq("user_id", s.user_id).eq("coll", coll).eq("id", id).maybeSingle()).data?.data;
    let message: { title: string; body: string } | null = null;

    if (kind === "weigh") {
      const day = await doc("days", now.date);
      if (day?.weight == null) message = { title: "Morning weigh-in", body: "Step on the scale before you eat and log it." };
    } else {
      const settings = await doc("settings", "main");
      const key = settings?.program?.sched?.[now.weekday];
      const title = key && key !== "rest" ? settings?.program?.days?.[key]?.t : null;
      if (title) {
        const { data: logged } = await sb.from("docs").select("data").eq("user_id", s.user_id).eq("coll", "workouts").like("id", `${now.date}_%`);
        const trained = (logged ?? []).some((w) => (w.data?.ex ?? []).some((e: { sets?: { d?: boolean }[] }) => (e.sets ?? []).some((x) => x.d)));
        if (!trained) message = { title: `${title} today`, body: "You haven't logged it yet. Your targets are ready." };
      }
    }
    if (!message) continue;

    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ ...message, url: "/" }));
      sent++;
    } catch (e) {
      // 404 and 410 mean the phone dropped the subscription, so forget it.
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) { await sb.from("push_subs").delete().eq("endpoint", s.endpoint); removed++; }
    }
  }
  return Response.json({ sent, removed });
});
