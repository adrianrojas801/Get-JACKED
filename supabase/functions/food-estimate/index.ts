// Estimates calories and protein from a photo and/or a short note, for the signed-in person.
//
// Off until the owner adds the key (README, "Optional features"):
//   ANTHROPIC_API_KEY   required. Without it, {"ping":true} answers {"ready":false} and the app hides the feature.
//   FOOD_MODEL          optional, the model to use.
//   FOOD_DAILY_LIMIT    optional, estimates per person per day (default 20).
// The key never leaves this function. Supabase checks the caller's sign-in before this code runs (verify_jwt).
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = Deno.env.get("FOOD_MODEL") ?? "claude-sonnet-5-5";
// Lets the model look up a company's published nutrition numbers instead of recalling them. Set FOOD_SEARCH to "off" to disable.
const SEARCH = (Deno.env.get("FOOD_SEARCH") ?? "on") !== "off";
const MAX_SEARCHES = 3;
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
- For any named menu item or packaged product from a restaurant or company (a chain, a brand, a receipt or order screen line), use that company's published nutrition numbers for that exact item and size. Do not guess higher or lower than the published figure. If you have a web search tool, search for the company's current nutrition guide and use the numbers you find for each named item (one search per restaurant is usually enough), rather than relying on memory. If the menu lists an item by count (4, 5 or 6 pieces) and the person had a different number, use the per-piece figure. For fountain drinks, use the restaurant's regular cup unless a size is given. If you can't find the published number, estimate from the closest published item and say which one in the note.
- For build-your-own places (Cava, Sweetgreen, Chipotle), add up the published numbers for each listed component and return the bowl as one item. Only mention uncertainty when a portion or ingredient isn't visible or listed.
- Sides and extras that come with an entree are part of the order: list them as their own items with their published numbers.
- If the note says something was shared or split (for example "shared between 4 of us"), return only the person's own share: divide that item's c and p by the number of people, and say so in the note. Never log a whole shared plate as one person's food. If they didn't say how it was split, assume an even split.
- For a nutrition label, use the per-serving numbers; assume 1 serving unless the note says otherwise.
- For home food, estimate typical portions from what's visible. Count tortillas individually.
- c is calories for ONE unit, p is protein grams for ONE unit, q is how many units.
- Your final message must be only JSON, with no other text before or after it, in this shape: {"items":[{"n":"short name","c":60,"p":1.5,"q":6}],"note":"one short sentence, only if something was assumed"}
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

  const call = (messages: unknown[], search: boolean) =>
    fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2500,
        messages,
        ...(search ? { tools: [{ type: "web_search_20250305", name: "web_search", max_uses: MAX_SEARCHES }] } : {}),
      }),
    });

  const messages: unknown[] = [{ role: "user", content }];
  let search = SEARCH;
  let res = await call(messages, search);
  if (!res.ok && search && res.status === 400) {
    // Web search can be turned off for the organization, or not supported by the chosen model. Fall back to no search.
    console.error("anthropic search off", (await res.text()).slice(0, 300));
    search = false;
    res = await call(messages, search);
  }
  if (!res.ok) {
    console.error("anthropic", res.status, (await res.text()).slice(0, 300));
    return json({ error: res.status === 429 ? "rate_limited" : "upstream" }, 502);
  }
  let out = await res.json();
  // A long search turn can pause. Send the partial answer back unchanged to let it finish.
  for (let i = 0; i < 2 && out?.stop_reason === "pause_turn"; i++) {
    messages.push({ role: "assistant", content: out.content });
    res = await call(messages, search);
    if (!res.ok) {
      console.error("anthropic", res.status, (await res.text()).slice(0, 300));
      return json({ error: res.status === 429 ? "rate_limited" : "upstream" }, 502);
    }
    out = await res.json();
  }
  const text: string = (out?.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
  const cleaned = text.replace(/```(?:json)?/gi, "");
  // With search on, the answer can follow some working text, so start at the last {"items" if there is one.
  const starts = [...cleaned.matchAll(/\{\s*"items"/g)];
  const a = starts.length ? starts[starts.length - 1].index! : cleaned.indexOf("{");
  const z = cleaned.lastIndexOf("}");
  try {
    if (a < 0 || z < a) throw new Error("no json");
    const parsed = JSON.parse(cleaned.slice(a, z + 1));
    return json({ items: Array.isArray(parsed.items) ? parsed.items : [], note: String(parsed.note ?? "") });
  } catch {
    // Log what came back so a failed estimate can be diagnosed from the function logs.
    console.error("invalid_json", out?.stop_reason, cleaned.slice(0, 600));
    return json({ error: "invalid_json" }, 502);
  }
});
