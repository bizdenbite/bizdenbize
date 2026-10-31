// ============================================================
// Supabase Edge Function: estimate-price
// Fassung vom 31.10.2026 — in den Dashboard-Editor einfügen.
// (Die Dashboard-Kopie ist maßgeblich, nicht über CLI einsetzen.)
//
// WAS SICH GEGENÜBER DER ALTEN FASSUNG ÄNDERT UND WARUM
//
// Die alte Fassung prüfte den Aufrufer überhaupt nicht. Zusammen
// mit "Verify JWT = AN" sah das nach Schutz aus, war aber keiner:
// diese Einstellung akzeptiert laut Supabase-Doku auch den
// Veröffentlichungsschlüssel ("publishable and secret keys ...
// are not JWTs, but the check still accepts them"). Der steht im
// Quelltext von emlak.html und ist damit öffentlich. Dazu
// Access-Control-Allow-Origin "*". Jeder im Internet konnte also
// Gemini-Aufrufe auf unsere Rechnung auslösen, mit bis zu drei
// Bildern pro Aufruf.
//
// Vier Änderungen, sonst nichts:
//
// 1. ECHTE PRÜFUNG DES AUFRUFERS. Es muss ein Sitzungs-Token
//    eines angemeldeten Mitglieds kommen. Der Veröffentlichungs-
//    schlüssel reicht nicht mehr.
//
// 2. CORS auf die eigenen Adressen. Vorher "*".
//
// 3. BILDADRESSEN NUR AUS DEM EIGENEN SPEICHER. Vorher lud die
//    Funktion jede URL herunter, die im Aufruf stand (Zeile 51
//    der alten Fassung). Die Antwort ging zwar nur an Gemini,
//    nicht zurück — missbrauchbar als Weiterleitung war es
//    trotzdem.
//
// 4. BREMSE: höchstens 10 Schätzungen je Mitglied und Stunde.
//    Im Speicher, nicht in der Datenbank — das reicht gegen
//    eine Schleife und kostet nichts.
//
// Die Preislogik, der Prompt und die Antwortform sind
// unverändert. Wer vorher eine Schätzung bekam, bekommt
// dieselbe.
//
// REIHENFOLGE: Erst emlak.html hochladen (schickt den Token),
// DANN diese Funktion einsetzen. Andersherum bricht die
// Schätzung für die Zeit dazwischen.
// ============================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── 2) CORS: nur die eigenen Adressen ───────────────────────
// abibot.eu steht hier NICHT: die Domain wird nicht verlaengert
// (Entscheidung 31.10.2026). Eine Freigabe fuer eine Adresse, die
// spaeter jemand anderem gehoeren kann, ist keine Freigabe.
const ERLAUBTE_HERKUNFT = [
  "https://bizdenbize.com",
  "https://www.bizdenbize.com",
];

function corsFür(req: Request) {
  const o = req.headers.get("origin") || "";
  // Unbekannte Herkunft bekommt die Hauptadresse — der Browser
  // lehnt die Antwort dann selbst ab.
  const erlaubt = ERLAUBTE_HERKUNFT.includes(o) ? o : ERLAUBTE_HERKUNFT[0];
  return {
    "Access-Control-Allow-Origin": erlaubt,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

// ── 3) Bildadressen: nur aus dem eigenen Speicher ───────────
const SB_URL = Deno.env.get("SUPABASE_URL") || "https://wxjudojlwksivhzjnmim.supabase.co";

function bildAdresseErlaubt(roh: unknown): boolean {
  if (typeof roh !== "string") return false;
  let u: URL;
  try { u = new URL(roh); } catch { return false; }
  if (u.protocol !== "https:") return false;
  // Nur der eigene Speicher. Kein fremder Host, keine interne Adresse.
  const eigener = new URL(SB_URL).host;
  if (u.host !== eigener) return false;
  return u.pathname.startsWith("/storage/v1/object/public/");
}

// ── 4) Bremse: 10 je Mitglied und Stunde ────────────────────
// Im Speicher. Eine Edge Function kann mehrfach laufen, also ist
// das keine harte Grenze — gegen eine Schleife reicht es.
const zaehler = new Map<string, { n: number; bis: number }>();
const GRENZE = 10;
const FENSTER_MS = 60 * 60 * 1000;

function darfNoch(wer: string): boolean {
  const jetzt = Date.now();
  const e = zaehler.get(wer);
  if (!e || jetzt > e.bis) {
    zaehler.set(wer, { n: 1, bis: jetzt + FENSTER_MS });
    return true;
  }
  if (e.n >= GRENZE) return false;
  e.n++;
  return true;
}

serve(async (req) => {
  const cors = corsFür(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  try {
    // ── 1) Wer fragt? ───────────────────────────────────────
    // Ein Sitzungs-Token muss her. Der Veroeffentlichungs-
    // schluessel faengt mit sb_ an und ist kein Token — er wird
    // hier ausdruecklich abgewiesen, auch wenn "Verify JWT" ihn
    // durchlaesst.
    const auth = req.headers.get("Authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";

    if (!token || token.startsWith("sb_") || token.split(".").length !== 3) {
      return json({ error: "Bu işlem için giriş yapmış olman gerekiyor." }, 401);
    }

    const sb = createClient(
      SB_URL,
      Deno.env.get("SUPABASE_ANON_KEY") || "",
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: userData, error: userErr } = await sb.auth.getUser();
    const user = userData?.user;
    if (userErr || !user) {
      return json({ error: "Oturumun geçerli değil. Lütfen tekrar giriş yap." }, 401);
    }

    if (!darfNoch(user.id)) {
      return json(
        { error: "Saatte en fazla 10 fiyat tahmini alabilirsin. Biraz sonra tekrar dene." },
        429
      );
    }

    // ── Ab hier unveraendert gegenueber der alten Fassung ────
    const { title, description, category, condition, city, photoUrls, photoBase64, domain } =
      await req.json();

    if (!title || typeof title !== "string") {
      return json({ error: "title is required" }, 400);
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return json({ error: "server not configured" }, 500);
    }

    let photosSent = 0;
    const PHOTO_CAP = 3;
    const photoParts: any[] = [];

    if (Array.isArray(photoUrls)) {
      for (const url of photoUrls) {
        if (photosSent >= PHOTO_CAP) break;
        // NEU: fremde Adressen werden gar nicht erst geholt.
        if (!bildAdresseErlaubt(url)) continue;
        try {
          const imgRes = await fetch(url, { signal: AbortSignal.timeout(5000) });
          if (!imgRes.ok) continue;
          const contentType = imgRes.headers.get("content-type") || "image/jpeg";
          if (!contentType.startsWith("image/")) continue;
          const buf = new Uint8Array(await imgRes.arrayBuffer());
          if (buf.length > 6 * 1024 * 1024) continue;   // 6 MB je Bild reicht
          let binary = "";
          for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
          const base64 = btoa(binary);
          photoParts.push({ inline_data: { mime_type: contentType, data: base64 } });
          photosSent++;
        } catch (_e) {
          // one bad photo shouldn't kill the whole estimate
        }
      }
    }

    if (Array.isArray(photoBase64)) {
      for (const p of photoBase64) {
        if (photosSent >= PHOTO_CAP) break;
        if (p && typeof p.data === "string") {
          photoParts.push({ inline_data: { mime_type: p.mime || "image/jpeg", data: p.data } });
          photosSent++;
        }
      }
    }

    const isRealEstate = domain === 'real_estate';

    const persona = isRealEstate
      ? `Sen Almanya'daki emlak piyasasında (ImmoScout24 / WG-Gesucht benzeri) deneyimli bir emlak danışmanısın. ` +
        `Aşağıdaki ev/daire ilanı için MAKUL BİR FİYAT ARALIĞI öner — ilan tipi kiralıksa AYLIK KİRA, satılıksa SATIŞ FİYATI olarak.\n\n`
      : `Sen ikinci el eşya alım-satımı konusunda deneyimli bir uzmansın. ` +
        `Almanya'daki ikinci el piyasasını (Kleinanzeigen benzeri) baz alarak, ` +
        `aşağıdaki ilan için MAKUL BİR FİYAT ARALIĞI öner.\n\n`;

    const conditionLine = (!isRealEstate)
      ? `Durum: ${condition || "belirtilmemiş"}\n`
      : '';

    const visualNote = photosSent > 0
      ? `Önemli: Bu tahmin ürünün fotoğraflarından ve senin genel bilginden yapılıyor; ` +
        `gerçek zamanlı piyasa verisi kullanmıyorsun. Emin değilsen daha geniş bir aralık ver.`
      : `Önemli: Bu ilan için FOTOĞRAF PAYLAŞILMADI — tahmini sadece yazılı bilgiden ve senin genel ` +
        `piyasa bilginden yapıyorsun. Ürünün gerçek durumunu göremediğin için normalden DAHA GENİŞ bir ` +
        `aralık ver ve gerekce alanında fotoğraf olmadığını kısaca belirt.`;

    const parts: any[] = [
      {
        text:
          persona +
          `Başlık: ${title}\n` +
          `Kategori: ${category || "belirtilmemiş"}\n` +
          conditionLine +
          `Açıklama: ${description || "yok"}\n` +
          `Şehir: ${city || "belirtilmemiş"}\n\n` +
          `Sadece şu JSON formatında yanıt ver, başka hiçbir şey yazma:\n` +
          `{"min": <sayı>, "max": <sayı>, "gerekce": "<1-2 cümlelik kısa açıklama, Türkçe>"}\n\n` +
          visualNote,
      },
      ...photoParts,
    ];

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 300 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return json({ error: "estimate failed", detail: errText }, 502);
    }

    const data = await geminiRes.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const cleaned = raw.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (_e) {
      return json({ error: "could not parse estimate", raw: cleaned }, 502);
    }

    if (typeof parsed.min !== "number" || typeof parsed.max !== "number") {
      return json({ error: "invalid estimate shape", raw: cleaned }, 502);
    }

    return json({
      min: Math.round(parsed.min),
      max: Math.round(parsed.max),
      gerekce: parsed.gerekce || "",
    });
  } catch (e) {
    return json({ error: "unexpected error", detail: String(e) }, 500);
  }
});
