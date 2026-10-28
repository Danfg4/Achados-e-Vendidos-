import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL");
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !key) throw new Error("Missing Supabase configuration");
const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

function publicHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password) return null;
    return parsed.toString();
  } catch { return null; }
}

Deno.serve(async (req: Request) => {
  if (req.headers.get("authorization") !== "Bearer " + key) {
    return new Response(JSON.stringify({ ok: false, error: "Service authorization required" }), {
      status: 401, headers: { "content-type": "application/json" }
    });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const body = await req.json().catch(() => ({}));
  const jobId = body?.job_id;
  if (typeof jobId !== "string" || !jobId) return json({ error: "job_id is required" }, 400);

  const { data: job, error: jobError } = await db.from("automation_jobs")
    .select("id, product_id, job_type, status, payload").eq("id", jobId).maybeSingle();
  if (jobError || !job) return json({ error: jobError?.message ?? "Job not found" }, 404);
  if (job.job_type !== "generate_content") return json({ error: "Unsupported job type" }, 400);
  if (job.status !== "queued" && job.status !== "processing") {
    return json({ error: "Job is not ready for content generation", status: job.status }, 409);
  }

  const product = job.payload && typeof job.payload === "object" ? job.payload : {};
  const title = String(product.title ?? "").trim();
  const affiliateUrl = publicHttpsUrl(product.affiliate_url);
  if (!title) return json({ error: "Product title is required" }, 422);
  if (!affiliateUrl) return json({ error: "A valid HTTPS affiliate URL is required" }, 422);

  const imageCandidates = Array.isArray(product.image_urls) ? product.image_urls : [];
  const imageUrls = [...new Set(imageCandidates.map(publicHttpsUrl).filter((item): item is string => item !== null))];
  if (imageUrls.length === 0) {
    const fallbackImage = publicHttpsUrl(product.image_url);
    if (fallbackImage) imageUrls.push(fallbackImage);
  }
  if (imageUrls.length === 0) return json({ error: "At least one publicly accessible HTTPS product image is required" }, 422);

  const priceNumber = product.price == null ? null : Number(product.price);
  const price = priceNumber !== null && Number.isFinite(priceNumber) && priceNumber >= 0
    ? `💰 R$ ${priceNumber.toFixed(2).replace(".", ",")}` : null;
  const discountNumber = product.discount_percent == null ? null : Number(product.discount_percent);
  const discount = discountNumber !== null && Number.isFinite(discountNumber) && discountNumber > 0 && discountNumber <= 100
    ? `🏷️ ${discountNumber.toFixed(0)}% OFF` : null;
  const disclosure = "Aviso: este é um link de afiliado; posso receber comissão pela compra, sem custo adicional para você.";
  const description = String(product.description ?? "").trim().slice(0, 350);
  const caption = [
    `🛍️ ${title}`, price, discount, "",
    description || "Confira os detalhes e a disponibilidade da oferta.", "",
    `🔗 Confira a oferta: ${affiliateUrl}`, "", disclosure, "",
    "#AchadosEVendidos #Ofertas #BoasCompras"
  ].filter((line) => line !== null).join("\n").slice(0, 2200);

  const now = new Date().toISOString();
  const platforms = ["facebook", "instagram"];
  const drafts = platforms.map((platform) => ({
    product_id: job.product_id, platform, post_type: "photo", title, content: caption,
    status: "draft", media_urls: [imageUrls[0]], media_kind: "product_image",
    target_url: affiliateUrl, source: "automation",
    payload: { product, generated: { method: "template-social-v3-neutral", generated_at: now },
      disclosure_included: true, publish_ready: true },
    idempotency_key: `affiliate:${job.product_id}:${platform}:photo:v3`
  }));

  const { data: created, error: postError } = await db.from("posts")
    .upsert(drafts, { onConflict: "idempotency_key" }).select("id,status,title,platform");
  if (postError) return json({ error: postError.message }, 500);

  const { error: updateError } = await db.from("automation_jobs").update({
    status: "completed", completed_at: now, updated_at: now,
    payload: { ...product, generated_post_ids: (created ?? []).map((post) => post.id),
      content_generation: "template-social-v3-neutral" },
    error_message: null
  }).eq("id", jobId);
  if (updateError) return json({ error: updateError.message, created_posts: created }, 500);

  return json({ ok: true, status: "drafts_created", posts: created ?? [], publishing_enabled: false });
});
