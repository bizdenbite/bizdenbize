// supabase/functions/waitlist/index.ts
// Deploy: supabase functions deploy waitlist

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://bizdenbize.com",
  "Access-Control-Allow-Headers": "content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { first_name, last_name, email, city, country, connection, invite_code } = await req.json();

    if (!first_name || !email) {
      return new Response(
        JSON.stringify({ error: "first_name and email required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Check if already on waitlist
    const { data: existing } = await supabase
      .from("waitlist")
      .select("id, status")
      .eq("email", email)
      .single();

    if (existing) {
      return new Response(
        JSON.stringify({ error: "already_registered", status: existing.status }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate invite code if provided
    let hasValidInvite = false;
    if (invite_code) {
      const { data: invite } = await supabase
        .from("invite_codes")
        .select("id, used_by")
        .eq("code", invite_code.toUpperCase())
        .is("used_by", null)
        .single();
      hasValidInvite = !!invite;
    }

    // Insert into waitlist
    const { data: entry, error: insertError } = await supabase
      .from("waitlist")
      .insert({
        first_name,
        last_name,
        email,
        city,
        country,
        connection,
        invite_code: invite_code?.toUpperCase() ?? null,
        status: hasValidInvite ? "approved" : "pending",
      })
      .select("id, position, status")
      .single();

    if (insertError) throw insertError;

    // Send confirmation email via Resend
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey) {
      const emailBody = hasValidInvite
        ? `
          <h2>Hoş geldin ${first_name}! 🎉</h2>
          <p>Davetiye kodun onaylandı. BizdenBize'ye direkt katılabilirsin.</p>
          <p><a href="https://bizdenbize.com/login.html?tab=register" style="background:#1B3A8C;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Hesap Oluştur →</a></p>
          <p style="color:#6B5E4E;font-size:13px;">Gurbet Hayatını Kolaylaştırıyoruz 🇹🇷</p>
        `
        : `
          <h2>Başvurun alındı, ${first_name}! ✓</h2>
          <p>Bekleme listesindeki sıran: <strong>#${entry.position}</strong></p>
          <p>Topluluğun onayından sonra e-posta ile bilgilendireceğiz (genellikle 24-48 saat).</p>
          <p>Arkadaşlarını davet ederek sıranı yükseltebilirsin.</p>
          <p style="color:#6B5E4E;font-size:13px;">Gurbet Hayatını Kolaylaştırıyoruz 🇹🇷</p>
        `;

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "BizdenBize <noreply@bizdenbize.com>",
          to: email,
          subject: hasValidInvite
            ? "BizdenBize — Hoş geldin! Hesabını oluştur"
            : `BizdenBize — Başvurun alındı (#${entry.position})`,
          html: emailBody,
        }),
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        position: entry.position,
        status: entry.status,
        has_invite: hasValidInvite,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Waitlist function error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
