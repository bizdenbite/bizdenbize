import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-notify-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SITE = "https://bizdenbize.com";
const FROM = "BizdenBize <noreply@bizdenbize.com>";
const ADMIN_EMAIL = "nazvannorel@gmail.com";
const SUPPORT_EMAIL = "support@bizdenbize.com";

const CAT_NAMES: Record<string, string> = {
  legal: "Hukuki", visa: "Vize & Oturma", medical: "Tıbbi",
  tax: "Vergi & Finans", housing: "Konut & Kira", employment: "İş & Çalışma",
  school: "Okul & Yardımlar", insurance: "Sigorta & Araç", migration: "Avrupa'ya Göç",
};

// ── SAFETY HELPERS ──────────────────────────────────────────────
// This endpoint runs with "Verify JWT" OFF, because the contact form and the
// signup flow both have to reach it without a session. That means anyone who
// finds the URL can POST to it, so nothing from the request body may ever be
// trusted: every value is escaped before it touches the email HTML, links are
// restricted to our own domain, and lengths are capped.

function escC(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escape + length-cap in one step. Use for EVERY caller-supplied value. */
function E(v: unknown, max = 300): string {
  return escC(String(v ?? "").slice(0, max));
}

/**
 * Only ever produce a link to our own site. A caller-supplied href would
 * otherwise let a stranger send a phishing link from our verified sending
 * domain, which sails past spam filters on our reputation.
 */
function safeLink(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  if (s.startsWith("/")) return SITE + s.replace(/["'<>\s]/g, "");
  try {
    const u = new URL(s);
    if (u.protocol === "https:" && (u.hostname === "bizdenbize.com" || u.hostname === "www.bizdenbize.com")) {
      return u.toString();
    }
  } catch { /* not a URL at all */ }
  console.warn("notify-user: rejected off-site link:", s.slice(0, 120));
  return SITE;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function uuidOrEmpty(v: unknown): string {
  const s = String(v ?? "");
  return UUID_RE.test(s) ? s : "";
}

/**
 * Best-effort flood control for the two types anyone can trigger. Edge
 * isolates are ephemeral and there may be several at once, so this is a
 * speed bump, not a real rate limiter — it stops a naive script hammering
 * the inbox, not a determined attacker. A durable limit would need a table.
 */
const HITS = new Map<string, number[]>();
function rateOk(key: string, limit = 5, windowMs = 10 * 60 * 1000): boolean {
  const now = Date.now();
  const recent = (HITS.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) return false;
  recent.push(now);
  HITS.set(key, recent);
  return true;
}

// ── BASE EMAIL WRAPPER ───────────────────────────────────────────
function wrap(inner: string): string {
  // Email-safe version of the brand.css bb-logo badge. A table cell rather than
  // a styled span, because Outlook desktop drops padding on inline elements.
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:'Helvetica Neue',Arial,sans-serif;background:#FAF7F2;margin:0;padding:40px 20px;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #D4C5A9;">
  <div style="background:#FAF7F2;padding:28px 32px 24px;text-align:center;border-bottom:1px solid #EDE4D8;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
      <tr><td style="background:#003399;border-radius:6px;padding:9px 18px;font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:26px;letter-spacing:-.3px;color:#ffffff;line-height:1.1;"><span style="color:#FFCC00;">Bizden</span>Bize</td></tr>
    </table>
    <div style="font-size:12px;color:#6B5E4E;margin-top:12px;letter-spacing:.2px;">Gurbetteki İyilerin Dijital Mahallesi</div>
  </div>
  <div style="padding:32px;">${inner}</div>
  <div style="padding:20px 32px;background:#FAF7F2;text-align:center;border-top:1px solid #EDE4D8;">
    <div style="font-size:12px;color:#8a7f70;">© 2026 BizdenBize · <a href="${SITE}" style="color:#8a7f70;">bizdenbize.com</a></div>
  </div>
</div>
</body></html>`;
}

function btn(text: string, url: string): string {
  return `<div style="text-align:center;margin:24px 0;">
    <a href="${url}" style="display:inline-block;background:#D42B2B;color:#fff;text-decoration:none;padding:14px 32px;border-radius:9px;font-size:15px;font-weight:600;">${text}</a>
  </div>`;
}

function highlight(label: string, content: string, color = "#1A1208"): string {
  return `<div style="background:#FAF7F2;border-left:3px solid ${color};border-radius:4px 8px 8px 4px;padding:14px 16px;margin-bottom:16px;">
    <div style="font-size:10px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:#6B5E4E;margin-bottom:6px;">${label}</div>
    <div style="font-size:14px;color:#1A1208;line-height:1.7;">${content}</div>
  </div>`;
}

/** Category label — falls back to the caller's value, so it must be escaped. */
function catLabel(raw: unknown): string {
  const key = String(raw ?? "");
  return CAT_NAMES[key] ? escC(CAT_NAMES[key]) : (E(key, 60) || "Genel");
}

// ── TEMPLATES ───────────────────────────────────────────────────
function expertAnswerEmail(d: Record<string, unknown>): { subject: string; html: string } {
  const catName = catLabel(d.category);
  const rawQ = String(d.question ?? "");
  const shortQ = E(rawQ.length > 120 ? rawQ.substring(0, 120) + "..." : rawQ, 200);
  const reviewId = uuidOrEmpty(d.review_id);
  const answerUrl = reviewId ? `${SITE}/abibot.html?review=${reviewId}` : `${SITE}/abibot.html`;
  const answer = E(d.expert_response, 4000).replace(/\n/g, "<br>");
  return {
    subject: "Uzman yanıtınız hazır! ✅",
    html: wrap(`
      <div style="font-size:22px;font-weight:700;color:#1A1208;margin-bottom:8px;">Uzman yanıtınız hazır! ✅</div>
      <p style="font-size:15px;color:#6B5E4E;line-height:1.6;margin-bottom:20px;">
        Merhaba ${E(d.user_name, 80) || "değerli üyemiz"}, <strong>${catName}</strong> kategorisindeki sorunuz yanıtlandı.
      </p>
      ${shortQ ? highlight("Sorunuz", shortQ) : ""}
      ${answer ? highlight("Uzman Yanıtı", answer, "#1E7B4B") : ""}
      ${btn("AbiBOT'ta Görüntüle →", answerUrl)}
    `)
  };
}

function directQuestionEmail(d: Record<string, unknown>): { subject: string; html: string } {
  const catName = catLabel(d.category);
  return {
    subject: "✉️ Sorunuz uzmana iletildi — BizdenBize",
    html: wrap(`
      <div style="font-size:22px;font-weight:700;color:#1A1208;margin-bottom:8px;">Sorunuz iletildi ✉️</div>
      <p style="font-size:15px;color:#6B5E4E;line-height:1.6;margin-bottom:20px;">
        Merhaba ${E(d.user_name, 80) || "değerli üyemiz"}, doğrudan uzman sorunuz başarıyla gönderildi.
      </p>
      ${highlight("Detaylar", `<strong>Uzman:</strong> ${E(d.expert_name, 80) || "—"}<br><strong>Kategori:</strong> ${catName}<br><strong>Tahmini Süre:</strong> 24–48 saat`)}
      ${btn("Yanıtlarımı Görüntüle →", `${SITE}/abibot.html`)}
      <p style="font-size:13px;color:#6B5E4E;text-align:center;">Yanıtınız hazır olduğunda tekrar e-posta ile bilgilendireceğiz.</p>
    `)
  };
}

// Notifies the EXPERT (not the asker) that a direct paid question is waiting.
// Distinct from directQuestionEmail() above, which confirms submission to the
// asker. See Backlog #22 / TC-036.
function directQuestionExpertEmail(d: Record<string, unknown>): { subject: string; html: string } {
  const catName = catLabel(d.category);
  const rowId = uuidOrEmpty(d.expert_row_id);
  const panelUrl = rowId ? `${SITE}/expert-profile.html?id=${rowId}` : `${SITE}/expert-profile.html`;
  return {
    subject: "📩 Yeni bir doğrudan soru aldınız — BizdenBize",
    html: wrap(`
      <div style="font-size:22px;font-weight:700;color:#1A1208;margin-bottom:8px;">Yeni bir soru sizi bekliyor 📩</div>
      <p style="font-size:15px;color:#6B5E4E;line-height:1.6;margin-bottom:20px;">
        Merhaba ${E(d.user_name, 80) || "değerli uzmanımız"}, bir üye size doğrudan bir soru yöneltti.
      </p>
      ${highlight("Detaylar", `<strong>Gönderen:</strong> ${E(d.asker_name, 80) || "Bir üye"}<br><strong>Kategori:</strong> ${catName}`)}
      ${btn("Soruyu Görüntüle →", panelUrl)}
      <p style="font-size:13px;color:#6B5E4E;text-align:center;">"Sorularım" panelinizden görüntüleyip yanıtlayabilirsiniz.</p>
    `)
  };
}

// Free-form email. Because the caller controls the title, body and link, this
// type is gated behind NOTIFY_SECRET in the handler below — it is the one
// template that could otherwise be turned into a phishing message.
function adminNotifEmail(d: Record<string, unknown>): { subject: string; html: string } {
  const title = E(d.title, 120);
  const body = E(d.body, 2000).replace(/\n/g, "<br>");
  const link = safeLink(d.link);
  return {
    subject: `🔔 ${title || "BizdenBize'den bildirim"}`,
    html: wrap(`
      <div style="font-size:22px;font-weight:700;color:#1A1208;margin-bottom:8px;">${title || "Platform Bildirimi"}</div>
      <p style="font-size:15px;color:#6B5E4E;line-height:1.6;margin-bottom:20px;">
        Merhaba ${E(d.user_name, 80) || "değerli üyemiz"},
      </p>
      <p style="font-size:15px;color:#1A1208;line-height:1.7;margin-bottom:20px;">${body}</p>
      ${link ? btn("Görüntüle →", link) : ""}
    `)
  };
}

// Sent right after signup — acknowledges the request and sets the
// approval-pending expectation. The welcome email comes later, on approval.
function signupPendingEmail(d: Record<string, unknown>): { subject: string; html: string } {
  return {
    subject: "Kaydın alındı — onay bekliyor ⏳ · BizdenBize",
    html: wrap(`
      <div style="font-size:22px;font-weight:700;color:#1A1208;margin-bottom:8px;">Kaydın alındı! ⏳</div>
      <p style="font-size:15px;color:#6B5E4E;line-height:1.6;margin-bottom:20px;">
        Merhaba ${E(d.user_name, 80) || "değerli üyemiz"}, BizdenBize'ye kaydolduğun için teşekkürler.
      </p>
      <p style="font-size:15px;color:#1A1208;line-height:1.7;margin-bottom:20px;">
        Hesabın şu anda ekibimiz tarafından inceleniyor. Topluluğu güvende tutmak için her yeni üyeyi kısa bir onaydan geçiriyoruz. Onaylandığında sana ayrı bir "Hoş geldin" e-postası göndereceğiz — sonra giriş yapıp keşfetmeye başlayabilirsin.
      </p>
      ${highlight("Sırada ne var?", "1) Ekibimiz hesabını inceler<br>2) Onaylandığında \"Hoş geldin\" e-postanı alırsın<br>3) Giriş yapıp topluluğa katılırsın")}
      <p style="font-size:13px;color:#6B5E4E;text-align:center;">Sabrın için teşekkürler! 🌍</p>
    `)
  };
}

// Sent on approval — the real welcome, with a log-in button.
function welcomeEmail(d: Record<string, unknown>): { subject: string; html: string } {
  return {
    subject: `🎉 Onaylandın — BizdenBize'ye hoş geldin!`,
    html: wrap(`
      <div style="font-size:22px;font-weight:700;color:#1A1208;margin-bottom:8px;">Onaylandın, hoş geldin! 🎉</div>
      <p style="font-size:15px;color:#6B5E4E;line-height:1.6;margin-bottom:20px;">
        Merhaba ${E(d.user_name, 80) || "değerli üyemiz"}, hesabın onaylandı — artık BizdenBize topluluğunun bir parçasısın!
      </p>
      ${highlight("Platformda neler var?",
        "🏘️ <strong>Mahallem</strong> — Topluluğunla bağlantıda kal, soru sor, paylaş<br>" +
        "🤖 <strong>AbiBOT</strong> — Almanya'daki hayata dair sorularına anında yanıt<br>" +
        "🛍️ <strong>İlanlar</strong> — Al, sat, takas et<br>" +
        "🎓 <strong>Uzmanlar</strong> — Uzmanlara doğrudan danış"
      )}
      ${btn("Giriş Yap →", `${SITE}/login.html`)}
    `)
  };
}

function adminNewSignupEmail(d: Record<string, unknown>): { subject: string; html: string } {
  const subject = `\u{1F195} Yeni kayıt (onay bekliyor): ${E(d.name, 80) || "İsimsiz"}`;
  const html = wrap(`
    <h2 style="font-family:Georgia,serif;font-size:20px;color:#1A1208;margin:0 0 16px;">\u{1F195} Yeni Üye Kaydı — Onay Bekliyor</h2>
    <p style="font-size:14px;color:#3a342c;line-height:1.6;margin:0 0 6px;"><strong>Ad:</strong> ${E(d.name, 120)}</p>
    <p style="font-size:14px;color:#3a342c;line-height:1.6;margin:0 0 6px;"><strong>E-posta:</strong> ${E(d.email, 160)}</p>
    ${d.challenges ? `<p style="font-size:14px;color:#3a342c;line-height:1.6;margin:0 0 6px;"><strong>Zorluklar:</strong> ${E(d.challenges, 1000)}</p>` : ""}
    ${d.reason ? `<p style="font-size:14px;color:#3a342c;line-height:1.6;margin:0 0 6px;"><strong>Neden katılmak istiyor:</strong> ${E(d.reason, 1000)}</p>` : ""}
    ${d.source ? `<p style="font-size:14px;color:#3a342c;line-height:1.6;margin:0 0 6px;"><strong>Nereden duydu:</strong> ${E(d.source, 300)}</p>` : ""}
    <p style="margin:18px 0 0;"><a href="${SITE}/admin.html" style="display:inline-block;background:#D42B2B;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;">Admin panelinde onayla →</a></p>
  `);
  return { subject, html };
}

function contactNotifEmail(d: Record<string, unknown>): { subject: string; html: string } {
  const subject = `\u{1F4EC} Yeni iletişim mesajı: ${E(d.name, 80) || "İsimsiz"}`;
  const html = wrap(`
    <h2 style="font-family:Georgia,serif;font-size:20px;color:#1A1208;margin:0 0 16px;">\u{1F4EC} Yeni İletişim Mesajı</h2>
    <p style="font-size:14px;color:#3a342c;line-height:1.6;margin:0 0 6px;"><strong>Ad:</strong> ${E(d.name, 120)}</p>
    <p style="font-size:14px;color:#3a342c;line-height:1.6;margin:0 0 6px;"><strong>E-posta:</strong> ${E(d.email, 160)}</p>
    <p style="font-size:14px;color:#3a342c;line-height:1.6;margin:0 0 6px;"><strong>Konu:</strong> ${E(d.subject, 200) || "—"}</p>
    <div style="margin:14px 0;padding:14px 16px;background:#FAF7F2;border-left:3px solid #D42B2B;border-radius:6px;font-size:14px;color:#1A1208;line-height:1.6;white-space:pre-wrap;">${E(d.message, 5000)}</div>
    <p style="font-size:12px;color:#8a7f70;margin-top:16px;">Bu mesaj bizdenbize.com iletişim formundan geldi. Yanıtlamak için doğrudan gönderenin e-posta adresine yazabilirsin.</p>
  `);
  return { subject, html };
}

// ── SEND VIA RESEND ─────────────────────────────────────────────
async function sendEmail(to: string | string[], subject: string, html: string): Promise<boolean> {
  const recipients = Array.isArray(to) ? to : [to];
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: recipients, subject, html }),
  });
  if (!res.ok) {
    console.error(`SEND FAIL -> ${recipients.join(", ")} | Resend ${res.status}: ${await res.text()}`);
    return false;
  }
  console.log(`SEND OK -> ${recipients.join(", ")} | "${subject}"`);
  return true;
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

// ── MAIN HANDLER ────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";

  try {
    const body = await req.json();

    // Support both old format (review_id, expert_response) and new format (type, user_id, data)
    const isLegacy = !!body.review_id;
    const type: string = isLegacy ? "expert_answer" : String(body.type ?? "");
    const user_id: string = String(body.user_id ?? "");
    const data = isLegacy ? {
      category: body.category,
      question: body.question,
      expert_response: body.expert_response,
      review_id: body.review_id,
    } : (body.data || {});

    console.log(`REQ type=${type || "(none)"} user_id=${user_id ? user_id.slice(0, 8) + "…" : "(none)"} ip=${ip}`);

    // ── Public types: no session required, so recipients are HARD-CODED here.
    // A caller can never influence who receives these.
    if (type === "admin_new_signup") {
      if (!rateOk(`signup:${ip}`)) {
        console.warn(`RATE LIMITED admin_new_signup ip=${ip}`);
        return json({ error: "Too many requests" }, 429);
      }
      const { subject, html } = adminNewSignupEmail(data);
      const sent = await sendEmail(ADMIN_EMAIL, subject, html);
      return json({ success: sent }, sent ? 200 : 502);
    }

    if (type === "contact_notification") {
      if (!rateOk(`contact:${ip}`)) {
        console.warn(`RATE LIMITED contact_notification ip=${ip}`);
        return json({ error: "Too many requests" }, 429);
      }
      const { subject, html } = contactNotifEmail(data);
      const sent = await sendEmail(SUPPORT_EMAIL, subject, html);
      return json({ success: sent }, sent ? 200 : 502);
    }

    // ── Free-form email is secret-gated. Nothing on the site calls it today;
    // leaving it publicly reachable would let a stranger send arbitrary text
    // from our verified sending domain.
    if (type === "admin_notification") {
      const expected = Deno.env.get("NOTIFY_SECRET");
      if (!expected || req.headers.get("x-notify-secret") !== expected) {
        console.warn(`BLOCKED admin_notification (bad or missing secret) ip=${ip}`);
        return json({ error: "Forbidden" }, 403);
      }
    }

    if (!type || !user_id) {
      console.warn(`REJECTED missing type or user_id (type=${type || "-"})`);
      return json({ error: "type and user_id are required" }, 400);
    }

    if (!UUID_RE.test(user_id)) {
      console.warn(`REJECTED malformed user_id ip=${ip}`);
      return json({ error: "Invalid user_id" }, 400);
    }

    // ── Member types: the recipient is looked up server-side from the user id.
    // The caller supplies only the id, never an address.
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SERVICE_ROLE_KEY") ?? "");
    const { data: userRes, error } = await supabase.auth.admin.getUserById(user_id);
    const user = userRes?.user;
    if (error || !user?.email) {
      console.warn(`USER NOT FOUND ${user_id.slice(0, 8)}… (${error?.message ?? "no email"})`);
      return json({ error: "User not found" }, 404);
    }

    const { data: profile } = await supabase.from("profiles").select("first_name,last_name").eq("id", user_id).single();
    // Profile names are member-editable, so they get escaped like anything else.
    const userName = `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim();
    const enriched = { ...data, user_name: userName };

    let subject = "", html = "";
    switch (type) {
      case "expert_answer":          ({ subject, html } = expertAnswerEmail(enriched));        break;
      case "direct_question":        ({ subject, html } = directQuestionEmail(enriched));      break;
      case "direct_question_expert": ({ subject, html } = directQuestionExpertEmail(enriched)); break;
      case "admin_notification":     ({ subject, html } = adminNotifEmail(enriched));          break;
      case "welcome":                ({ subject, html } = welcomeEmail(enriched));             break;
      case "signup_pending":         ({ subject, html } = signupPendingEmail(enriched));       break;
      default:
        console.warn(`UNKNOWN TYPE "${type}" ip=${ip}`);
        return json({ error: `Unknown type: ${type}` }, 400);
    }

    const sent = await sendEmail(user.email, subject, html);
    return json({ success: sent, type }, sent ? 200 : 502);

  } catch (err) {
    console.error("notify-user error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
