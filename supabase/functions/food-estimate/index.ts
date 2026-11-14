// Estimates calories and protein from a photo and/or a short note, for the signed-in person.
//
// Off until the owner adds the key (README, "Optional features"):
//   ANTHROPIC_API_KEY   required. Without it, {"ping":true} answers {"ready":false} and the app hides the feature.
//   FOOD_MODEL          optional, the model to use.
//   FOOD_DAILY_LIMIT    optional, estimates per person per day (default 20).
// The key never leaves this function. Supabase checks the caller's sign-in before this code runs (verify_jwt).
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = Deno.env.get("FOOD_MODEL") ?? "claude-haiku-5-5";
const DAILY_LIMIT = Number(Deno.env.get("FOOD_DAILY_LIMIT") ?? "20");
const MAX_IMAGE_CHARS = 2_800_000; // about 2 MB of JPEG as base64

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const RULES = `You estimate nutrition for a personal food log.
Rules:
- List each distinct food or drink as its own item.
- For chain restaurant orders, use the chain's published nutrition numbers. For build-your-own places (Cava, Sweetgreen, Chipotle), add up the published numbers for each listed component and return the bowl as one item. Only mention uncertainty when a portion or ingredient isn't visible or listed.
- For a nutrition label, use the per-serving numbers; assume 1 serving unless the note says otherwise.
- For home food, estimate typical portions from what's visible. Count tortillas individually.
- c is calories for ONE unit, p is protein grams for ONE unit, q is how many units.
- Reply with only JSON in this shape: {"items":[{"n":"short name","c":60,"p":1.5,"q":6}],"note":"one short sentence, only if something was assumed"}
- If there is no food or nutrition info, reply {"items":[],"note":"short reason"}.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  const body = await req.json().catch(() => ({}));
  if (body?.ping) return json({ ready: !!key });
  if (!key) return json({ error: "not_configured" }, 503);

  const note = typeof body.note === "string" ? body.note.slice(0, 500) : "";
  const who = typeof body.who === "string" ? body.who.slice(0, 300) : "";
  const image = typeof body.image === "string" ? body.image : "";
  if (!note && !image) return json({ error: "empty" }, 400);
  if (image.length > MAX_IMAGE_CHARS || (image && !/^[A-Za-z0-9+/=]+$/.test(image))) return json({ error: "image_rejected" }, 400);

  // Act as the caller, so the usage counter is theirs and row-level security applies.
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY") ?? req.headers.get("apikey") ?? "",
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
  );
  const { data: allowed, error: limitErr } = await sb.rpc("use_ai", { p_kind: "food", p_limit: DAILY_LIMIT });
  if (limitErr) return json({ error: "session_expired" }, 401);
  if (!allowed) return json({ error: "rate_limited" }, 429);

  const content: unknown[] = [];
  if (image) content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: image } });
  content.push({
    type: "text",
    text: `${RULES}\n\nAbout the person: ${who || "(not given)"}\n${image ? "The image shows their food, a receipt, an order screen, or a nutrition label." : "There is no image; use only the note."}\nTheir note: "${note.replace(/"/g, "'") || "(none)"}"`,
  });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 1000, messages: [{ role: "user", content }] }),
  });
  if (!res.ok) {
    console.error("anthropic", res.status, (await res.text()).slice(0, 300));
    return json({ error: res.status === 429 ? "rate_limited" : "upstream" }, 502);
  }
  const out = await res.json();
  const text: string = (out?.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
  const a = text.indexOf("{"), z = text.lastIndexOf("}");
  try {
    const parsed = JSON.parse(text.slice(a, z + 1));
    return json({ items: Array.isArray(parsed.items) ? parsed.items : [], note: String(parsed.note ?? "") });
  } catch {
    return json({ error: "invalid_json" }, 502);
  }
});
