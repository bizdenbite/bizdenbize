/* ============================================================
   BizdenBize — Görüşler: paylaşım önizlemesi (sunucu tarafı)
   ------------------------------------------------------------
   SORUN
   blog-post.html boş bir kabuk: yazı, sayfa açıldıktan SONRA
   JavaScript ile Supabase'ten geliyor. WhatsApp, Facebook ve
   LinkedIn'in önizleme robotları JavaScript çalıştırmaz — bu
   yüzden hangi yazı paylaşılırsa paylaşılsın hep aynı genel
   BizdenBize kartını gösteriyorlardı.

   ÇÖZÜM
   /gorus/<slug> adresini bu fonksiyon karşılıyor. Yazıyı
   Supabase'ten alıp meta etiketlerini HTML'in İÇİNE yazıyor,
   sonra sayfayı öyle gönderiyor. Robot doğru başlığı ve
   görseli hazır buluyor; insan ziyaretçi için hiçbir şey
   değişmiyor, sayfa aynı sayfa.

   blog-post.html'e DOKUNULMUYOR: statik dosya olarak duruyor,
   eski bağlantılar çalışmaya devam ediyor. Bu fonksiyon kabuğu
   kendi sitesinden çekip sadece <head> kısmını düzenliyor —
   yani sayfanın tek bir kopyası var, ikinci bir şablon yok.
   ============================================================ */

const SB_URL = 'https://wxjudojlwksivhzjnmim.supabase.co';
const SB_KEY = 'sb_publishable_52tr_hEnnQ3kllZexTue0Q_ByF71303';
const SITE   = 'https://bizdenbize.com';
const FALLBACK_IMG = SITE + '/og-image.png';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function clip(s, n) {
  const t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  return t.length <= n ? t : t.slice(0, n - 1).trimEnd() + '…';
}

// Yazının kendi meta bilgileri. Uydurma yok: özet yoksa
// gövdenin başı kullanılıyor, görsel yoksa site görseli.
function buildMeta(post, url) {
  const title = clip(post.title, 90);
  const desc  = clip(post.excerpt || post.body || '', 200)
             || 'BizdenBize — Gurbetteki İyilerin Dijital Mahallesi.';
  const img = post.cover_url
    || (post.media_type === 'video' && post.youtube_id
          ? 'https://i.ytimg.com/vi/' + encodeURIComponent(post.youtube_id) + '/maxresdefault.jpg'
          : FALLBACK_IMG);
  const type = post.media_type === 'audio' ? 'music.song'
             : post.media_type === 'video' ? 'video.other'
             : 'article';

  const tags = Array.isArray(post.tags) ? post.tags.slice(0, 10) : [];

  return [
    '<title>' + esc(title) + ' — BizdenBize</title>',
    '<link rel="canonical" href="' + esc(url) + '">',
    '<meta name="description" content="' + esc(desc) + '">',
    post.author_name ? '<meta name="author" content="' + esc(post.author_name) + '">' : '',
    '<meta property="og:site_name" content="BizdenBize">',
    '<meta property="og:type" content="' + type + '">',
    '<meta property="og:title" content="' + esc(title) + '">',
    '<meta property="og:description" content="' + esc(desc) + '">',
    '<meta property="og:url" content="' + esc(url) + '">',
    '<meta property="og:image" content="' + esc(img) + '">',
    '<meta property="og:image:alt" content="' + esc(title) + '">',
    '<meta property="og:locale" content="tr_TR">',
    post.published_at ? '<meta property="article:published_time" content="' + esc(post.published_at) + '">' : '',
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="twitter:title" content="' + esc(title) + '">',
    '<meta name="twitter:description" content="' + esc(desc) + '">',
    '<meta name="twitter:image" content="' + esc(img) + '">',
    tags.map(t => '<meta property="article:tag" content="' + esc(t) + '">').join('')
  ].filter(Boolean).join('\n  ');
}

// Kabuktaki mevcut etiketleri söküp yenilerini koyuyoruz.
// Eskisi kalırsa robot ikisinden birini seçer — hangisini
// seçeceği garanti değildir, o yüzden temizliyoruz.
// <base href="/"> MUSS ganz oben im <head> stehen: die Regel
// wirkt nur auf Verweise, die NACH ihr kommen. Steht sie unten,
// bleibt alles darüber (z. B. brand.css) weiter kaputt.
function injectBase(html) {
  if (/<base\s/i.test(html)) return html;                 // schon vorhanden
  // Nach der Zeichensatz-Angabe einsetzen, nicht davor: die muss
  // ganz oben stehen, sonst kann der Browser türkische Zeichen
  // kurzzeitig falsch deuten.
  const charset = html.match(/<meta[^>]+charset[^>]*>/i);
  if (charset) {
    return html.replace(charset[0], charset[0] + '\n  <base href="/">');
  }
  return html.replace(/<head([^>]*)>/i, '<head$1>\n  <base href="/">');
}

function injectMeta(html, metaBlock) {
  let out = html
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<meta\s+name=["']description["'][^>]*>/gi, '')
    .replace(/<meta\s+name=["']author["'][^>]*>/gi, '')
    .replace(/<meta\s+name=["']twitter:[^"']*["'][^>]*>/gi, '')
    .replace(/<meta\s+property=["'](og|article):[^"']*["'][^>]*>/gi, '')
    .replace(/<link\s+rel=["']canonical["'][^>]*>/gi, '');

  const head = out.search(/<\/head>/i);
  if (head === -1) return metaBlock + out;      // <head> yoksa en azından etiketler gitsin
  return out.slice(0, head) + '  ' + metaBlock + '\n' + out.slice(head);
}

async function getPost(slug) {
  const q = new URL(SB_URL + '/rest/v1/blog_posts');
  q.searchParams.set('slug', 'eq.' + slug);
  q.searchParams.set('is_published', 'eq.true');
  q.searchParams.set('select',
    'slug,title,excerpt,body,cover_url,media_type,youtube_id,published_at,tags,author_name');
  q.searchParams.set('limit', '1');

  const r = await fetch(q, {
    headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY },
    signal: AbortSignal.timeout(4000)
  });
  if (!r.ok) throw new Error('supabase ' + r.status);
  const rows = await r.json();
  return rows && rows[0] ? rows[0] : null;
}

async function getShell(host) {
  // Kendi sitemizden statik kabuğu çekiyoruz. /blog-post.html
  // bu fonksiyona yönlendirilmiş DEĞİL, dolayısıyla döngü yok.
  const proto = /^localhost|127\.0\.0\.1/.test(host) ? 'http' : 'https';
  const r = await fetch(proto + '://' + host + '/blog-post.html', {
    headers: { 'user-agent': 'bizdenbize-og' },
    signal: AbortSignal.timeout(4000)
  });
  if (!r.ok) throw new Error('shell ' + r.status);
  return r.text();
}

// Kabuk çekilemezse yine de doğru önizleme + sayfaya yönlendirme.
// Sessizce genel karta düşmektense küçük bir sayfa göndermek iyi.
function minimalPage(metaBlock, target) {
  return '<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8">\n  ' + metaBlock +
    '\n  <meta http-equiv="refresh" content="0; url=' + esc(target) + '">' +
    '</head><body><p>Yazıya gidiliyor… <a href="' + esc(target) + '">devam et</a></p></body></html>';
}

module.exports = async (req, res) => {
  const slugRaw = (req.query && req.query.slug) || '';
  const slug = String(slugRaw).trim().slice(0, 100);

  if (!/^[A-Za-z0-9-]+$/.test(slug)) {
    res.setHeader('Location', '/blog.html');
    res.status(302).end();
    return;
  }

  const url = SITE + '/gorus/' + slug;
  const host = (req.headers && req.headers.host) || 'bizdenbize.com';

  let post = null;
  try {
    post = await getPost(slug);
  } catch (e) {
    console.error('post lookup failed:', e && e.message);
  }

  // Yayında olmayan ya da bulunmayan yazı: listeye gönder.
  if (!post) {
    res.setHeader('Location', '/blog.html');
    res.status(302).end();
    return;
  }

  const metaBlock = buildMeta(post, url);
  // Kabuk statik; yazı değişebilir. Kısa CDN önbelleği +
  // arkada tazeleme: paylaşım anında yavaşlık olmasın.
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');

  try {
    const shell = await getShell(host);
    // Kabuk slug'ı adres çubuğundan okuyor; /gorus/<slug>
    // biçiminden de okuyabilsin diye bir ipucu bırakıyoruz.
    // Die Seite wird unter /gorus/<slug> ausgeliefert, verweist aber
    // relativ auf ihre Dateien ("brand.css", "site-footer.js").
    // Ohne <base> sucht der Browser sie unter /gorus/brand.css.
    const html = injectBase(injectMeta(shell, metaBlock))
      .replace('</head>', '  <meta name="bb-slug" content="' + esc(slug) + '">\n</head>');
    res.status(200).send(html);
  } catch (e) {
    console.error('shell fetch failed:', e && e.message);
    res.status(200).send(minimalPage(metaBlock, '/blog-post.html?slug=' + encodeURIComponent(slug)));
  }
};

module.exports.buildMeta = buildMeta;
module.exports.injectMeta = injectMeta;
module.exports.clip = clip;
module.exports.esc = esc;
