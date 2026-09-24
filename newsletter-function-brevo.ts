// supabase/functions/newsletter/index.ts
//
// BizdenBize · Bülten — über Brevo (Double-Opt-In)
//
// BEIM ANLEGEN: "Verify JWT" AUSSCHALTEN.
// Das Formular ruft die Funktion ohne Anmeldung auf.
//
// Secrets (sind gesetzt):
//   BREVO_API_KEY, BREVO_LIST_ID = 3, BREVO_DOI_TEMPLATE_ID = 1
//   BREVO_REDIRECT_URL = optional
//
// Warum überhaupt eine Funktion und nicht direkt aus der Seite:
// Der Brevo-Schlüssel darf nie im Browser landen. Wer ihn hat,
// kann die ganze Kontaktliste auslesen, löschen und in deinem
// Namen senden — für beide Marken.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SITE = "https://bizdenbize.com";

const cors = {
  "Access-Control-Allow-Origin": SITE,
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function validEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(e) && e.length <= 254;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = new URL(req.url);
  if (url.searchParams.get("action") !== "subscribe" || req.method !== "POST") {
    return json({ error: "unknown_action" }, 400);
  }

  let email = "";
  try {
    const body = await req.json();
    email = String(body?.email ?? "").trim().toLowerCase();
  } catch (_) {
    return json({ error: "bad_request" }, 400);
  }
  if (!validEmail(email)) return json({ error: "invalid_email" }, 400);

  const key = Deno.env.get("BREVO_API_KEY");
  const listId = Number(Deno.env.get("BREVO_LIST_ID") ?? "0");
  const templateId = Number(Deno.env.get("BREVO_DOI_TEMPLATE_ID") ?? "0");
  const redirect = Deno.env.get("BREVO_REDIRECT_URL") ?? `${SITE}/blog.html?bulten=onaylandi`;

  // Fehlende Einrichtung ist ein Serverfehler, kein Nutzerfehler:
  // ehrlich 500 melden, damit es im Protokoll auffällt statt
  // monatelang still ins Leere zu laufen.
  if (!key || !listId || !templateId) {
    console.error("Brevo-Konfiguration unvollständig:", {
      key: !!key, listId, templateId,
    });
    return json({ error: "not_configured" }, 500);
  }

  try {
    // Brevo verschickt die Bestätigungsmail selbst und trägt den
    // Kontakt ERST nach dem Klick in die Liste ein. Bis dahin ist
    // niemand Abonnent — genau das verlangt das Double-Opt-In.
    //
    // Kein "attributes"-Feld: Brevo lehnt den ganzen Aufruf ab,
    // wenn ein Attribut im Konto nicht angelegt ist.
    const r = await fetch("https://api.brevo.com/v3/contacts/doubleOptinConfirmation", {
      method: "POST",
      headers: {
        "api-key": key,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        email,
        includeListIds: [listId],
        templateId,
        redirectionUrl: redirect,
      }),
    });

    // 201/204 = Bestätigungsmail unterwegs.
    if (r.status === 201 || r.status === 204) return json({ ok: true });

    const text = await r.text();

    // Schon bestätigter Kontakt: Brevo meldet ein Duplikat. Nach
    // außen sagen wir dasselbe wie sonst — sonst verrät das
    // Formular, welche Adressen bereits in der Liste stehen.
    if (r.status === 400 && /duplicate|already/i.test(text)) {
      console.log("bereits vorhanden:", email);
      return json({ ok: true });
    }

    console.error("Brevo-Fehler", r.status, text.slice(0, 300));
    return json({ error: "upstream" }, 502);
  } catch (e) {
    console.error("Brevo-Aufruf fehlgeschlagen:", e instanceof Error ? e.message : e);
    return json({ error: "upstream" }, 502);
  }
});
