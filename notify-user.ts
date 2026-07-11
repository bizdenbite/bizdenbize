// supabase/functions/notify-user/index.ts
// Deploy: supabase functions deploy notify-user

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CAT_NAMES: Record<string, string> = {
  legal: "Hukuki", visa: "Vize & Oturma", medical: "Tıbbi",
  tax: "Vergi & Finans", housing: "Konut & Kira", employment: "İş & Çalışma",
  school: "Okul & Yardımlar", insurance: "Sigorta & Araç",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { review_id, user_id, category, question, expert_response } = await req.json();

    if (!review_id || !user_id) {
      return new Response(
        JSON.stringify({ error: "review_id and user_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user email using service role
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SERVICE_ROLE_KEY") ?? ""
    );

    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(user_id);
    if (userError || !userData?.user?.email) {
      console.error("User fetch error:", userError);
      return new Response(
        JSON.stringify({ error: "Could not fetch user email" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userEmail = userData.user.email;
    const catName = CAT_NAMES[category] || category;
    const shortQuestion = question?.length > 120 ? question.substring(0, 120) + "..." : question;

    // Send email via Resend
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "BizdenBize <noreply@bizdenbize.com>",
        to: [userEmail],
        subject: "Uzman yanıtınız hazır! ✅",
        html: `
          <!DOCTYPE html>
          <html>
          <head><meta charset="UTF-8"></head>
          <body style="font-family:'Helvetica Neue',Arial,sans-serif;background:#FAF7F2;margin:0;padding:40px 20px;">
            <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #D4C5A9;">
              
              <!-- Header -->
              <div style="background:#1A1208;padding:28px 32px;text-align:center;">
                <div style="font-family:Georgia,serif;font-size:26px;font-weight:900;color:#fff;">
                  Bizden<span style="color:#D42B2B;">Bize</span>
                </div>
                <div style="font-size:12px;color:rgba(255,255,255,.5);margin-top:4px;letter-spacing:.06em;text-transform:uppercase;">Uzman Yanıtı</div>
              </div>

              <!-- Body -->
              <div style="padding:32px;">
                <div style="font-size:22px;font-weight:700;color:#1A1208;margin-bottom:8px;">
                  Uzman yanıtınız hazır! ✅
                </div>
                <div style="font-size:15px;color:#6B5E4E;line-height:1.6;margin-bottom:24px;">
                  <strong>${catName}</strong> kategorisindeki sorunuz bir uzman tarafından incelendi ve yanıtlandı.
                </div>

                <!-- Question -->
                <div style="background:#FAF7F2;border-left:3px solid #1A1208;border-radius:4px 8px 8px 4px;padding:14px 16px;margin-bottom:16px;">
                  <div style="font-size:10px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:#6B5E4E;margin-bottom:6px;">Sorunuz</div>
                  <div style="font-size:14px;color:#1A1208;line-height:1.6;">${shortQuestion}</div>
                </div>

                <!-- Expert Response -->
                <div style="background:rgba(30,123,75,.05);border-left:3px solid #1E7B4B;border-radius:4px 8px 8px 4px;padding:14px 16px;margin-bottom:28px;">
                  <div style="font-size:10px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:#1E7B4B;margin-bottom:6px;">Uzman Yanıtı</div>
                  <div style="font-size:14px;color:#1A1208;line-height:1.7;">${expert_response?.replace(/\n/g, "<br>") || ""}</div>
                </div>

                <!-- CTA Button -->
                <div style="text-align:center;margin-bottom:24px;">
                  <a href="https://bizdenbize.com/abibot.html" 
                     style="display:inline-block;background:#D42B2B;color:#fff;text-decoration:none;padding:14px 32px;border-radius:9px;font-size:15px;font-weight:600;">
                    AbiBOT'a Git →
                  </a>
                </div>

                <div style="font-size:12px;color:#6B5E4E;text-align:center;line-height:1.6;">
                  Bu e-posta BizdenBize platformu tarafından otomatik olarak gönderilmiştir.<br>
                  Yanıtlamayınız — <a href="https://bizdenbize.com" style="color:#D42B2B;text-decoration:none;">bizdenbize.com</a>
                </div>
              </div>

            </div>
          </body>
          </html>
        `,
      }),
    });

    if (!emailRes.ok) {
      const err = await emailRes.text();
      console.error("Resend error:", err);
      return new Response(
        JSON.stringify({ error: "Email send failed", detail: err }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Email sent to ${userEmail} for review ${review_id}`);
    return new Response(
      JSON.stringify({ success: true, email: userEmail }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("notify-user error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
