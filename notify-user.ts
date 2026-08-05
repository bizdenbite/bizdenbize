import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SITE = "https://bizdenbize.com";
const FROM = "BizdenBize <noreply@bizdenbize.com>";

const CAT_NAMES: Record<string, string> = {
  legal: "Hukuki", visa: "Vize & Oturma", medical: "Tıbbi",
  tax: "Vergi & Finans", housing: "Konut & Kira", employment: "İş & Çalışma",
  school: "Okul & Yardımlar", insurance: "Sigorta & Araç", migration: "Avrupa'ya Göç",
};

// ── BASE EMAIL WRAPPER ───────────────────────────────────────────
function wrap(inner: string): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:'Helvetica Neue',Arial,sans-serif;background:#FAF7F2;margin:0;padding:40px 20px;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #D4C5A9;">
  <div style="background:#1A1208;padding:26px 32px 22px;text-align:center;">
    <div style="font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:28px;letter-spacing:-.3px;color:#ffffff;">Bizden<span style="color:#D42B2B;">Bize</span></div>
    <div style="font-size:12px;color:#8a7f70;margin-top:6px;letter-spacing:.3px;">İyilerle Birlikte Gurbet Hayatını Kolaylaştırıyoruz</div>
  </div>
  <div style="padding:32px;">${inner}</div>
  <div style="padding:20px 32px;background:#FAF7F2;text-align:center;">
    <div style="font-size:12px;color:#D4C5A9;">© 2026 BizdenBize · <a href="${SITE}" style="color:#D4C5A9;">${SITE}</a></div>
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

// ── TEMPLATES ───────────────────────────────────────────────────
function expertAnswerEmail(d: Record<string, string>): { subject: string; html: string } {
  const catName = CAT_NAMES[d.category] || d.category || "Genel";
  const shortQ  = d.question?.length > 120 ? d.question.substring(0, 120) + "..." : d.question;
  const answerUrl = d.review_id ? `${SITE}/abibot.html?review=${d.review_id}` : `${SITE}/abibot.html`;
  return {
    subject: "Uzman yanıtınız hazır! ✅",
    html: wrap(`
      <div style="font-size:22px;font-weight:700;color:#1A1208;margin-bottom:8px;">Uzman yanıtınız hazır! ✅</div>
      <p style="font-size:15px;color:#6B5E4E;line-height:1.6;margin-bottom:20px;">
        Merhaba ${d.user_name || "değerli üyemiz"}, <strong>${catName}</strong> kategorisindeki sorunuz yanıtlandı.
      </p>
      ${shortQ ? highlight("Sorunuz", shortQ) : ""}
      ${d.expert_response ? highlight("Uzman Yanıtı", d.expert_response.replace(/\n/g, "<br>"), "#1E7B4B") : ""}
      ${btn("AbiBOT'ta Görüntüle →", answerUrl)}
    `)
  };
}

function directQuestionEmail(d: Record<string, string>): { subject: string; html: string } {
  const catName = CAT_NAMES[d.category] || d.category || "Genel";
  return {
    subject: "✉️ Sorunuz uzmana iletildi — BizdenBize",
    html: wrap(`
      <div style="font-size:22px;font-weight:700;color:#1A1208;margin-bottom:8px;">Sorunuz iletildi ✉️</div>
      <p style="font-size:15px;color:#6B5E4E;line-height:1.6;margin-bottom:20px;">
        Merhaba ${d.user_name || "değerli üyemiz"}, doğrudan uzman sorunuz başarıyla gönderildi.
      </p>
      ${highlight("Detaylar", `<strong>Uzman:</strong> ${d.expert_name || "—"}<br><strong>Kategori:</strong> ${catName}<br><strong>Tahmini Süre:</strong> 24–48 saat`)}
      ${btn("Yanıtlarımı Görüntüle →", `${SITE}/abibot.html`)}
      <p style="font-size:13px;color:#6B5E4E;text-align:center;">Yanıtınız hazır olduğunda tekrar e-posta ile bilgilendireceğiz.</p>
    `)
  };
}

// NEW — notifies the EXPERT (not the asker) that a direct paid question is
// waiting for them. Distinct from directQuestionEmail() above, which
// confirms submission to the asker. See Backlog #22 / TC-036.
function directQuestionExpertEmail(d: Record<string, string>): { subject: string; html: string } {
  const catName = CAT_NAMES[d.category] || d.category || "Genel";
  const panelUrl = d.expert_row_id ? `${SITE}/expert-profile.html?id=${d.expert_row_id}` : `${SITE}/expert-profile.html`;
  return {
    subject: "📩 Yeni bir doğrudan soru aldınız — BizdenBize",
    html: wrap(`
      <div style="font-size:22px;font-weight:700;color:#1A1208;margin-bottom:8px;">Yeni bir soru sizi bekliyor 📩</div>
      <p style="font-size:15px;color:#6B5E4E;line-height:1.6;margin-bottom:20px;">
        Merhaba ${d.user_name || "değerli uzmanımız"}, bir üye size doğrudan bir soru yöneltti.
      </p>
      ${highlight("Detaylar", `<strong>Gönderen:</strong> ${d.asker_name || "Bir üye"}<br><strong>Kategori:</strong> ${catName}`)}
      ${btn("Soruyu Görüntüle →", panelUrl)}
      <p style="font-size:13px;color:#6B5E4E;text-align:center;">"Sorularım" panelinizden görüntüleyip yanıtlayabilirsiniz.</p>
    `)
  };
}

function adminNotifEmail(d: Record<string, string>): { subject: string; html: string } {
  return {
    subject: `🔔 ${d.title || "BizdenBize'den bildirim"}`,
    html: wrap(`
      <div style="font-size:22px;font-weight:700;color:#1A1208;margin-bottom:8px;">${d.title || "Platform Bildirimi"}</div>
      <p style="font-size:15px;color:#6B5E4E;line-height:1.6;margin-bottom:20px;">
        Merhaba ${d.user_name || "değerli üyemiz"},
      </p>
      <p style="font-size:15px;color:#1A1208;line-height:1.7;margin-bottom:20px;">${d.body || ""}</p>
      ${d.link ? btn("Görüntüle →", d.link.startsWith("http") ? d.link : SITE + d.link) : ""}
    `)
  };
}

// Sent right after signup — acknowledges the request and sets the
// approval-pending expectation. The welcome email comes later, on approval.
function signupPendingEmail(d: Record<string, string>): { subject: string; html: string } {
  return {
    subject: "Kaydın alındı — onay bekliyor ⏳ · BizdenBize",
    html: wrap(`
      <div style="font-size:22px;font-weight:700;color:#1A1208;margin-bottom:8px;">Kaydın alındı! ⏳</div>
      <p style="font-size:15px;color:#6B5E4E;line-height:1.6;margin-bottom:20px;">
        Merhaba ${d.user_name || "değerli üyemiz"}, BizdenBize'ye kaydolduğun için teşekkürler.
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
function welcomeEmail(d: Record<string, string>): { subject: string; html: string } {
  return {
    subject: `🎉 Onaylandın — BizdenBize'ye hoş geldin!`,
    html: wrap(`
      <div style="font-size:22px;font-weight:700;color:#1A1208;margin-bottom:8px;">Onaylandın, hoş geldin! 🎉</div>
      <p style="font-size:15px;color:#6B5E4E;line-height:1.6;margin-bottom:20px;">
        Merhaba ${d.user_name || "değerli üyemiz"}, hesabın onaylandı — artık BizdenBize topluluğunun bir parçasısın!
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

// ── SEND VIA RESEND ─────────────────────────────────────────────
function escC(s: string): string {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function contactNotifEmail(d: Record<string, string>): { subject: string; html: string } {
  const subject = `\u{1F4EC} Yeni iletişim mesajı: ${d.name || "İsimsiz"}`;
  const html = wrap(`
    <h2 style="font-family:Georgia,serif;font-size:20px;color:#1A1208;margin:0 0 16px;">\u{1F4EC} Yeni İletişim Mesajı</h2>
    <p style="font-size:14px;color:#3a342c;line-height:1.6;margin:0 0 6px;"><strong>Ad:</strong> ${escC(d.name)}</p>
    <p style="font-size:14px;color:#3a342c;line-height:1.6;margin:0 0 6px;"><strong>E-posta:</strong> ${escC(d.email)}</p>
    <p style="font-size:14px;color:#3a342c;line-height:1.6;margin:0 0 6px;"><strong>Konu:</strong> ${escC(d.subject) || "—"}</p>
    <div style="margin:14px 0;padding:14px 16px;background:#FAF7F2;border-left:3px solid #D42B2B;border-radius:6px;font-size:14px;color:#1A1208;line-height:1.6;white-space:pre-wrap;">${escC(d.message)}</div>
    <p style="font-size:12px;color:#8a7f70;margin-top:16px;">Bu mesaj bizdenbize.com iletişim formundan geldi. Yanıtlamak için doğrudan gönderenin e-posta adresine yazabilirsin.</p>
  `);
  return { subject, html };
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  });
  if (!res.ok) { console.error("Resend error:", await res.text()); return false; }
  return true;
}

// ── MAIN HANDLER ────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();

    // Support both old format (review_id, expert_response) and new format (type, user_id, data)
    const isLegacy = !!body.review_id;
    const type     = isLegacy ? "expert_answer" : body.type;
    const user_id  = body.user_id;
    const data     = isLegacy ? {
      category: body.category,
      question: body.question,
      expert_response: body.expert_response,
      review_id: body.review_id,
    } : (body.data || {});

    // Contact-form notification: no user involved; email goes to the support inbox.
    if (type === "contact_notification") {
      const { subject, html } = contactNotifEmail(body.data || {});
      const sent = await sendEmail("support@bizdenbize.com", subject, html);
      return new Response(JSON.stringify({ success: sent }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!type || !user_id) {
      return new Response(JSON.stringify({ error: "type and user_id are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Get user email + name
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SERVICE_ROLE_KEY") ?? "");
    const { data: { user }, error } = await supabase.auth.admin.getUserById(user_id);
    if (error || !user?.email) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { data: profile } = await supabase.from("profiles").select("first_name,last_name").eq("id", user_id).single();
    const userName = `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim();
    const enriched = { ...data, user_name: userName };

    // Build email
    let subject = "", html = "";
    switch (type) {
      case "expert_answer":    ({ subject, html } = expertAnswerEmail(enriched));  break;
      case "direct_question":  ({ subject, html } = directQuestionEmail(enriched)); break;
      case "direct_question_expert": ({ subject, html } = directQuestionExpertEmail(enriched)); break;
      case "admin_notification": ({ subject, html } = adminNotifEmail(enriched));  break;
      case "welcome":          ({ subject, html } = welcomeEmail(enriched));       break;
      case "signup_pending":   ({ subject, html } = signupPendingEmail(enriched)); break;
      default:
        return new Response(JSON.stringify({ error: `Unknown type: ${type}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }

    const sent = await sendEmail(user.email, subject, html);
    return new Response(JSON.stringify({ success: sent, to: user.email, type }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("notify-user error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
