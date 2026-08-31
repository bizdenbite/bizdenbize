// abibot-chat — BizdenBize / AbiBOT
// ADIM 1: sistem promptları sunucuda, oturum zorunlu, limit sunucuda.
//
// İstemci ARTIK systemPrompt GÖNDEREMEZ. Gönderirse yok sayılır.
// Prompt değişikliği = bu dosyayı düzenle + Deploy. GitHub'a gerek yok.

// Girdi tavanları — sınırsız metin = sınırsız token = sınırsız fatura.
const MAX_TRANSLATE_CHARS = 8000;
const MAX_BODY_CHARS      = 24000;
const MAX_MESSAGES        = 30;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

// ──────────────────────────────────────────────────────────────
// ORTAK KURALLAR — her kategoriye eklenir.
// Landing page sözü: "AbiBOT bilmediğini uydurmaz; ne zaman gerçek
// bir uzmana danışman gerektiğini açıkça söyler."
// ──────────────────────────────────────────────────────────────
const BASE_RULES = `
SCOPE — GERMANY ONLY:
You cover GERMANY only. You do NOT advise on Dutch, Belgian, Austrian, or general EU law.
If asked about another country, say so plainly in Turkish and do not guess.
Turkish law only where it directly touches life in Germany (e.g. consulate procedures), with the same caution.

LANGUAGE:
Always answer in TURKISH (Türkçe), no matter what language the question is in.
Use clear, warm, plain Turkish. Put the German term in brackets where it helps — e.g. "oturma izni (Aufenthaltstitel)".

NUMBERS — TWO HARD BANS AND ONE RULE:

BAN 1 — NEVER write a money amount. No euro figure, no range, no "roughly", no "around", no "civarı", no "arası". Not for fees, salaries, benefits, membership costs, deposits, fines, court costs or anything else. If you catch yourself typing a € sign or a number followed by "euro", stop and describe the rule qualitatively instead.

BAN 2 — NEVER write a percentage. Percentages in German law are almost always regional or conditional (for example the rent-increase cap differs between ordinary areas and designated tight housing markets), so a flat percentage is usually wrong somewhere. Describe that a cap exists and that its level depends on the Bundesland and whether the area is designated, then say the current figure must be checked.

RULE — durations, deadlines and counts (notice periods, waiting times, how many months' rent a deposit may be) may be described, but always as "genellikle" / "kural olarak", never as a guaranteed current value, and always with a line telling the person to confirm it for their own contract and Bundesland.

Amounts and thresholds that change and must NEVER be stated: the dövizle askerlik fee, Kindergeld and Elterngeld amounts and income limits, Bürgergeld rates, the residence duration required for citizenship (changed by the 2024 reform), visa and Einbürgerung fees, and any membership or professional fee.

NEVER INVENT THE NAME OF A LAW:
Only name a statute if you are certain it exists under that name today. Many plausible-sounding German law names are wrong or long repealed — there is, for example, no current "Mieterschutzgesetz"; tenancy law sits in the BGB. If you are not certain of the name, do not invent one: refer to the area of law in plain Turkish ("kira hukuku"), or name the responsible institution instead. A wrong law name is worse than no law name, because people repeat it to landlords, employers and officials.

BEFORE YOU SEND — check your own answer:
Scan what you have written for (a) any € amount, (b) any percentage, (c) any law name you are not certain of. Remove or rephrase each one. This check is not optional.

"HOW MUCH DOES IT COST" QUESTIONS — answer them, don't dodge them:
When someone asks what something costs (a lawyer, a tax advisor, a permit, a translation, an insurance policy), do NOT refuse and do NOT invent a figure. Explain instead:
- how the pricing works (e.g. whether a statutory fee schedule applies, whether it depends on income, complexity or the value in dispute),
- what makes it cheaper or more expensive,
- cheaper legitimate alternatives where they exist (e.g. Lohnsteuerhilfeverein for employees, Beratungshilfe/Prozesskostenhilfe for legal costs, Verbraucherzentrale, Mieterverein) — name them WITHOUT stating what they charge,
- and how to find the actual current price — ask for a written quote or fee agreement (Honorarvereinbarung) before agreeing to anything.
Then say the exact amount changes and must be confirmed directly with the provider or the official source.

NEVER INVENT LINKS:
Do NOT produce government or institutional URLs from memory — you will get them wrong and people act on them.
Name the institution instead (Ausländerbehörde, Bundesagentur für Arbeit, Familienkasse, Finanzamt, Krankenkasse...) and tell the person to look it up officially or to use the BizdenBize Kütüphane section, where the links are verified.

HONESTY & ESCALATION — apply in every answer:
1. NEVER invent facts, laws, numbers, deadlines or procedures you are not confident about. If it depends on details you don't have (city, visa type, contract), say so plainly in Turkish instead of guessing.
2. When a question has real legal, medical, financial or immigration consequences — something that could cost the person money, their residence status, their health, or a legal deadline — explicitly recommend BizdenBize's expert review ("Uzmana Gönder") for a final check, even after your best answer. Say it directly.
3. Prefer "emin değilim" over sounding confident when you are not. Honest uncertainty helps this community more than a confident wrong answer.
4. You are never a substitute for a lawyer, doctor, tax advisor or immigration official. You are a starting point, not the final word.
5. If the question fits one of the platform's other categories better than your own, still answer it as helpfully as you can, and mention in one short sentence which category is a better fit for follow-up questions. Do not refuse to help just because the category is a poor match.
`;

const CATEGORY_PROMPTS = {
  legal: `You specialise in LEGAL matters in GERMANY — German law as it applies to Turkish immigrants and the Turkish community. You understand the specific situations of 1st, 2nd and 3rd generation Turkish Germans.`,
  medical: `You specialise in MEDICAL and HEALTHCARE topics in GERMANY — the German healthcare system, Krankenkasse, GP/specialist referrals, medication, and navigating care as a Turkish person in Germany. Never diagnose; describe how the system works and when to see a doctor.`,
  tax: `You specialise in TAX and FINANCE in GERMANY — Steuererklärung, income tax, Kindergeld, Wohngeld, social benefits, and financial basics for Turkish families in Germany.`,
  visa: `You specialise in VISA and RESIDENCE in GERMANY — Aufenthaltstitel, Niederlassungserlaubnis, family reunification (Familienzusammenführung), and citizenship (Einbürgerung) for Turkish citizens.`,
  housing: `You specialise in HOUSING and TENANCY in GERMANY — Mietrecht, rental contracts, deposit (Kaution), Nebenkosten, tenant rights, and Anmeldung.`,
  employment: `You specialise in EMPLOYMENT and LABOUR LAW in GERMANY — Kündigung, Arbeitsvertrag, sick leave (Krankmeldung), workplace discrimination, unemployment benefit (ALG), and workers' rights.`,
  school: `You specialise in SCHOOLS, CHILDREN and FAMILY BENEFITS in GERMANY — Kindergeld, Elterngeld, school enrolment, Kita, Bafög, and family support.`,
  insurance: `You specialise in INSURANCE and VEHICLES in GERMANY — Kfz-Versicherung, Haftpflicht, vehicle registration, accidents and claims.`,
  migration: `You help Turkish people IN TURKEY who want to work and move to GERMANY. Your audience is working-class: factory workers, drivers, healthcare workers, tradespeople, construction workers. They are not necessarily highly educated and are vulnerable to unqualified "danışman" who take their money and deliver nothing.

Your role:
1. Explain the LEGITIMATE route to working in Germany from Turkey.
2. Explain what a real job offer looks like, and the red flags.
3. Warn clearly about common scams — fake contracts, upfront payment demands, invented employer names.
4. Point only to official channels: Make it in Germany, Bundesagentur für Arbeit, the German consulate's official visa process.
5. Explain the work visa routes: Fachkräfteeinwanderungsgesetz, Blaue Karte, sector-specific permits.
6. Help them understand their rights BEFORE they sign anything or pay anyone.

ALWAYS include when relevant: Hiçbir meşru işveren veya danışman sizden önceden para talep etmez. Para isteyen kişilerden uzak durun.

Be simple, direct and protective. These users may be desperate, and that makes them vulnerable — your job is to protect them, not only to inform them.`,
};

// Sınıflandırıcı için konu tanımları (platform-config.js ile aynı yapı,
// ama istemciden GELMEZ — sunucuda tutulur).
const CATEGORY_TOPICS = {
  legal: 'legal matters in Germany, German law, rights, contracts, courts, lawyers',
  visa: 'visa, residence permits, Aufenthaltstitel, immigration to Germany, citizenship',
  medical: 'medical topics, health, symptoms, doctors, Krankenkasse, medications',
  tax: 'tax, finance, Steuer, Kindergeld, Wohngeld, income, social benefits',
  housing: 'housing, rental, Mietrecht, tenancy, deposit, Nebenkosten, landlord',
  employment: 'employment, work, Kündigung, Arbeitsvertrag, salary, unemployment',
  school: 'school, children, Kita, Kindergeld, Elterngeld, education, Bafög',
  insurance: 'insurance, Kfz-Versicherung, car, vehicle, accident, claims',
  migration: 'legitimate work migration from Turkey to Germany, work visas, job offers, avoiding scams',
};

const ALL_TOPICS = Object.values(CATEGORY_TOPICS).join('; ');

// tr HEDEFİ ŞART: üye içeriğinin çoğu Almanca gelir ve en çok ihtiyaç
// duyulan yön Almanca → Türkçe'dir. Önceki sürümde tr hiç yoktu, bu yüzden
// mahallem/messages/translate-widget 'tr' isteyince sunucu sessizce 'de'ye
// düşüyordu. fr/nl kaldırıldı — platform Almanya odaklı.
const LANG_INSTRUCTS = {
  tr: 'Translate the following text into Turkish. Keep the formatting, bold text and structure. Reply ONLY with the translation, no preamble, no quotes.',
  de: 'Translate the following text into German. Keep the formatting, bold text and structure. Reply ONLY with the translation, no preamble, no quotes.',
  en: 'Translate the following text into English. Keep the formatting, bold text and structure. Reply ONLY with the translation, no preamble, no quotes.',
};

function buildSystemPrompt(category, brand) {
  const cat = CATEGORY_PROMPTS[category] ? category : 'legal';
  // abibot.eu'da AbiBOT kendini "BizdenBize platformunda" diye tanıtmaz.
  const intro = brand === 'abibot'
    ? `You are AbiBOT — Dijital Abiniz, a careful guide for the Turkish community living in Germany.`
    : `You are AbiBOT — Dijital Abiniz, a careful guide for the Turkish community living in Germany, on the BizdenBize platform.`;
  return intro + '\n' + BASE_RULES + '\n' + CATEGORY_PROMPTS[cat];
}

// messages dizisindeki son kullanıcı mesajının düz metnini çıkarır
// (fotoğraf/PDF gönderiminde içerik bir dizi olabilir).
function lastUserText(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m || m.role !== 'user') continue;
    if (typeof m.content === 'string') return m.content;
    if (Array.isArray(m.content)) {
      const t = m.content.find((b) => b && b.type === 'text');
      return t?.text || '';
    }
    return '';
  }
  return '';
}

// Günlük hak kontrolü. p_consume=false sadece bakar, true harcar.
async function checkQuota(baseUrl, serviceKey, userId, consume) {
  const res = await fetch(baseUrl + '/rest/v1/rpc/abibot_consume_prompt', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceKey,
      Authorization: 'Bearer ' + serviceKey,
    },
    body: JSON.stringify({ p_user: userId, p_consume: !!consume }),
  });
  if (!res.ok) return null;
  const rows = await res.json();
  const row = Array.isArray(rows) ? rows[0] : rows;
  return row || null;
}

// Her istek için sayaç — konu dışı ve çeviri dahil, SONUÇTAN BAĞIMSIZ.
// Amaç: cevaplanmayan ama yine de Anthropic'e giden çağrıları sınırlamak.
async function consumeRequest(baseUrl, serviceKey, userId) {
  const res = await fetch(baseUrl + '/rest/v1/rpc/abibot_consume_request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceKey,
      Authorization: 'Bearer ' + serviceKey,
    },
    body: JSON.stringify({ p_user: userId }),
  });
  if (!res.ok) return null;
  const rows = await res.json();
  const row = Array.isArray(rows) ? rows[0] : rows;
  return row || null;
}

async function callAnthropic(key, system, messages, maxTokens) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: maxTokens,
      system,
      messages,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Anthropic API error');
  }
  return data.content?.[0]?.text || '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY');

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_KEY) {
      return json({ error: 'auth not configured' }, 500);
    }
    if (!ANTHROPIC_KEY) {
      return json({ error: 'API key not configured' }, 500);
    }

    // ── 1. OTURUM ZORUNLU ──────────────────────────────────────
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token || token === SUPABASE_ANON_KEY || token.startsWith('sb_publishable_')) {
      return json({ error: 'Oturum gerekli.' }, 401);
    }

    const userRes = await fetch(SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token },
    });
    if (!userRes.ok) {
      return json({ error: 'Oturum geçersiz.' }, 401);
    }
    const user = await userRes.json();
    if (!user?.id) {
      return json({ error: 'Oturum geçersiz.' }, 401);
    }

    const body = await req.json();
    const mode = body?.mode === 'translate' ? 'translate' : 'chat';
    const brand = body?.brand === 'abibot' ? 'abibot' : 'bizdenbize';

    // ── 1b. İSTEK SAYACI — HER MOD İÇİN, HER ZAMAN ─────────────
    // Bu blok mode dallanmasından ÖNCE gelir. Daha önce çeviri modu
    // buranın tamamen dışındaydı: onay durumu kontrol edilmiyordu,
    // hiçbir sayaç harcanmıyordu ve metin uzunluğu sınırsızdı; yani
    // geçerli oturumu olan herkes sınırsız ücretli çağrı yapabiliyordu.
    const reqGate = await consumeRequest(SUPABASE_URL, SERVICE_KEY, user.id);
    if (!reqGate) {
      return json({ error: 'Limit kontrolü yapılamadı.' }, 500);
    }
    if (reqGate.user_status !== 'approved') {
      return json({ error: 'not_approved', userStatus: reqGate.user_status }, 403);
    }
    if (!reqGate.allowed) {
      return json({
        error: 'request_limit',
        limit: reqGate.day_limit,
      }, 429);
    }

    // ── 2. ÇEVİRİ (soru hakkı harcamaz, ama istek sayacına dahildir) ──
    if (mode === 'translate') {
      const lang = LANG_INSTRUCTS[body?.lang] ? body.lang : 'de';
      const text = typeof body?.text === 'string' ? body.text : '';
      if (!text.trim()) {
        return json({ error: 'text required' }, 400);
      }
      if (text.length > MAX_TRANSLATE_CHARS) {
        return json({ error: 'text_too_long', max: MAX_TRANSLATE_CHARS }, 413);
      }
      const translated = await callAnthropic(
        ANTHROPIC_KEY,
        'You are a professional translator. Translate accurately and preserve all formatting including bold and line breaks.',
        [{ role: 'user', content: LANG_INSTRUCTS[lang] + '\n\n' + text }],
        2048,
      );
      return json({ answer: translated });
    }

    // ── 3. SOHBET ──────────────────────────────────────────────
    const messages = body?.messages;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return json({ error: 'messages array required' }, 400);
    }
    if (messages.length > MAX_MESSAGES) {
      return json({ error: 'too_many_messages', max: MAX_MESSAGES }, 413);
    }
    if (JSON.stringify(messages).length > MAX_BODY_CHARS) {
      return json({ error: 'payload_too_large', max: MAX_BODY_CHARS }, 413);
    }

    const category = CATEGORY_PROMPTS[body?.category] ? body.category : 'legal';

    // ── 3a. GÜNLÜK HAK — önce sadece BAK, harcama ──────────────
    // Kapsam dışı sorular üyenin hakkından düşmesin diye hak,
    // ancak gerçek bir cevap üretileceği anda harcanıyor.
    const quota = await checkQuota(SUPABASE_URL, SERVICE_KEY, user.id, false);

    if (!quota) {
      return json({ error: 'Limit kontrolü yapılamadı.' }, 500);
    }

    if (quota.user_status !== 'approved') {
      return json({
        error: 'not_approved',
        userStatus: quota.user_status,
      }, 403);
    }

    if (!quota.allowed) {
      return json({
        error: 'daily_limit',
        limit: quota.day_limit,
        isPremium: !!quota.is_premium,
      }, 429);
    }

    // ── 3b. KONU KONTROLÜ ──────────────────────────────────────
    // CÖMERT olacak şekilde yazıldı. Eski sürüm soruyu yalnızca SEÇİLİ
    // kategorinin anahtar kelimelerine karşı ölçüyordu ve "mali müşavir
    // ne kadar tutar?" gibi tamamen meşru soruları reddediyordu.
    // Artık: sadece açıkça alakasız olanlar (futbol, yemek tarifi, kod)
    // eleniyor. Şüphede kalırsa YES.
    const text = lastUserText(messages);
    if (text.trim()) {
      const verdict = await callAnthropic(
        ANTHROPIC_KEY,
        'You are a permissive topic gate. Reply only YES or NO.',
        [{
          role: 'user',
          content: `A Turkish person living in Germany asked this question:

"${text}"

This platform helps Turkish immigrants in Germany with: ${ALL_TOPICS}.
It also covers the practical side of those areas — finding, choosing, paying for and dealing with professionals and institutions (lawyers, tax advisors, doctors, landlords, insurers, authorities), what things typically cost, which documents are needed, and where to apply.

Answer NO only if the question is CLEARLY unrelated to any of that — for example sports results, recipes, celebrity gossip, programming help, or homework.
If it is even loosely connected to living, working, studying, renting, staying healthy, raising a family or dealing with paperwork in Germany, answer YES.
When in doubt, answer YES.

Reply with ONLY the word YES or NO.`,
        }],
        10,
      );
      if (verdict.trim().toUpperCase().startsWith('NO')) {
        return json({
          offTopic: true,
        });
      }
    }

    // ── 3c. HAKKI ŞİMDİ HARCA (cevap üretilmeden hemen önce) ───
    const spent = await checkQuota(SUPABASE_URL, SERVICE_KEY, user.id, true);
    if (!spent) {
      return json({ error: 'Limit kontrolü yapılamadı.' }, 500);
    }
    if (!spent.allowed) {
      return json({
        error: 'daily_limit',
        limit: spent.day_limit,
        isPremium: !!spent.is_premium,
      }, 429);
    }

    // ── 3d. ASIL CEVAP ─────────────────────────────────────────
    const answer = await callAnthropic(
      ANTHROPIC_KEY,
      buildSystemPrompt(category, brand),
      messages,
      2048,
    );

    return json({
      answer,
      used: spent.used,
      limit: spent.day_limit,
      isPremium: !!spent.is_premium,
    });

  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
