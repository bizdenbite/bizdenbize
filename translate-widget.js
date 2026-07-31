// ============================================================
// translate-widget.js — shared per-item translate feature
// Reuses the abibot-chat Edge Function (same one AbiBOT's own
// translate button, messages.html, and mahallem.html all use).
// No new backend needed.
//
// USAGE:
//   1. Add <script src="translate-widget.js"></script> to the page
//      (after SUPABASE_URL/SUPABASE_ANON are defined, or make sure
//      those two globals exist before this script runs).
//   2. Call mhTranslateMenuHtml(selector) inside whatever template
//      string builds your card/row/detail HTML, where `selector` is
//      either:
//        - an id selector ('#ld-description') for a single, unique
//          element that appears once on the page, OR
//        - a class selector ('.review-comment') for a repeated-list
//          item — in that case the widget looks for the nearest
//          ancestor with a data-*-id attribute (or .post-card, or a
//          few other common wrapper patterns) to scope the lookup
//          to the right instance.
// ============================================================
(function () {
  // Self-contained constants — deliberately NOT relying on each page's own
  // SUPABASE_URL/SUPABASE_ANON (or _LD_URL/_LD_KEY, etc.) globals, since
  // naming isn't consistent site-wide. These are the public anon key and
  // project URL, already embedded in every page's own source anyway.
  const MH_SB_URL = 'https://wxjudojlwksivhzjnmim.supabase.co';
  const MH_SB_KEY = 'sb_publishable_52tr_hEnnQ3kllZexTue0Q_ByF71303';

  // Inject the CSS once, only if it hasn't been added by another
  // instance of this same script already (safe to include on every page).
  if (!document.getElementById('mh-translate-widget-style')) {
    const style = document.createElement('style');
    style.id = 'mh-translate-widget-style';
    style.textContent = `
      .msg-translate-wrap { position: relative; display: inline-block; }
      .msg-translate-btn {
        background: none; border: none; cursor: pointer; font-size: 13px;
        color: var(--muted); padding: 4px 8px; border-radius: 6px; line-height: 1;
      }
      .msg-translate-btn:hover { background: var(--warm); color: var(--ink); }
      .msg-translate-dropdown {
        display: none; position: fixed;
        background: #fff; border: 1px solid var(--sand); border-radius: 10px;
        box-shadow: 0 6px 20px rgba(26,18,8,.14); padding: 6px; z-index: 500; white-space: nowrap;
      }
      .msg-translate-dropdown.open { display: block; }
      .msg-translate-opt {
        display: block; width: 100%; text-align: left; background: none; border: none;
        padding: 6px 10px; border-radius: 7px; font-size: 12.5px; cursor: pointer;
        color: var(--ink); font-family: 'Instrument Sans', sans-serif;
      }
      .msg-translate-opt:hover { background: var(--warm); }
      .msg-translation-box {
        margin-top: 6px; padding: 8px 10px; border-radius: 10px; font-size: 12.5px;
        line-height: 1.5; background: var(--warm); color: var(--ink); max-width: 100%;
      }
      .msg-translation-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 3px; }
      .msg-translation-lang { font-size: 10.5px; font-weight: 700; color: var(--muted); }
      .msg-translation-close { background: none; border: none; cursor: pointer; font-size: 13px; color: inherit; opacity: .6; padding: 0 2px; }
      .msg-translation-close:hover { opacity: 1; }
    `;
    document.head.appendChild(style);
  }

  // Reusable HTML-generator: button + language dropdown.
  window.mhTranslateMenuHtml = function (contentSelector) {
    return `<span class="msg-translate-wrap">
      <button class="msg-translate-btn" onclick="event.stopPropagation();toggleMsgTranslateMenu(this)" title="Çevir">🌐</button>
      <div class="msg-translate-dropdown">
        <button class="msg-translate-opt" onclick="event.stopPropagation();translateMhContent(this,'tr','${contentSelector}')">🇹🇷 Türkçe</button>
        <button class="msg-translate-opt" onclick="event.stopPropagation();translateMhContent(this,'de','${contentSelector}')">🇩🇪 Almanca</button>
        <button class="msg-translate-opt" onclick="event.stopPropagation();translateMhContent(this,'en','${contentSelector}')">🇬🇧 İngilizce</button>
        <button class="msg-translate-opt" onclick="event.stopPropagation();translateMhContent(this,'fr','${contentSelector}')">🇫🇷 Fransızca</button>
        <button class="msg-translate-opt" onclick="event.stopPropagation();translateMhContent(this,'nl','${contentSelector}')">🇳🇱 Hollandaca</button>
      </div>
    </span>`;
  };

  if (window.toggleMsgTranslateMenu) return; // already installed by another copy of this script

  window.toggleMsgTranslateMenu = function (btn) {
    const dropdown = btn.nextElementSibling;
    const isOpen = dropdown.classList.contains('open');
    document.querySelectorAll('.msg-translate-dropdown.open').forEach(d => d.classList.remove('open'));
    if (isOpen) return;
    dropdown.classList.add('open');
    const rect = btn.getBoundingClientRect();
    const ddH = dropdown.offsetHeight, ddW = dropdown.offsetWidth;
    const openUpward = rect.top >= (ddH + 12);
    dropdown.style.top = openUpward ? (rect.top - ddH - 4) + 'px' : (rect.bottom + 4) + 'px';
    let left = rect.left;
    if (left + ddW > window.innerWidth - 8) left = window.innerWidth - ddW - 8;
    if (left < 8) left = 8;
    dropdown.style.left = left + 'px';
  };
  document.addEventListener('click', e => {
    if (!e.target.closest('.msg-translate-wrap')) {
      document.querySelectorAll('.msg-translate-dropdown.open').forEach(d => d.classList.remove('open'));
    }
  });
  document.addEventListener('scroll', () => {
    document.querySelectorAll('.msg-translate-dropdown.open').forEach(d => d.classList.remove('open'));
  }, true);

  const mhLangNames = { tr: '🇹🇷 Türkçe', de: '🇩🇪 Almanca', en: '🇬🇧 İngilizce', fr: '🇫🇷 Fransızca', nl: '🇳🇱 Hollandaca' };
  const mhLangInstructs = {
    tr: 'Translate the following text into Turkish. Reply ONLY with the translation, no preamble, no quotes.',
    de: 'Translate the following text into German. Reply ONLY with the translation, no preamble, no quotes.',
    en: 'Translate the following text into English. Reply ONLY with the translation, no preamble, no quotes.',
    fr: 'Translate the following text into French. Reply ONLY with the translation, no preamble, no quotes.',
    nl: 'Translate the following text into Dutch. Reply ONLY with the translation, no preamble, no quotes.',
  };

  window.translateMhContent = async function (optBtn, lang, contentSelector) {
    optBtn.closest('.msg-translate-dropdown').classList.remove('open');
    const wrap = optBtn.closest('.msg-translate-wrap');
    let textEl = null;
    if (contentSelector.startsWith('#')) {
      // Unique element, page-global lookup — no ancestor search needed.
      textEl = document.querySelector(contentSelector);
    } else {
      // Repeated-list item — find the nearest sensible wrapping element so
      // we translate only the specific instance the button was clicked on.
      const container = wrap.closest('[data-comment-id]') || wrap.closest('[data-review-id]')
        || wrap.closest('[data-listing-id]') || wrap.closest('[data-post-id]')
        || wrap.closest('.post-card') || wrap.closest('.review-item')
        || wrap.closest('.card') || wrap.parentElement;
      textEl = container ? container.querySelector(contentSelector) : null;
    }
    if (!textEl) return;
    const original = (textEl.innerText || textEl.textContent || '').trim();
    if (!original) return;

    const existing = textEl.parentElement.querySelector(':scope > .msg-translation-box');
    if (existing) existing.remove();
    const box = document.createElement('div');
    box.className = 'msg-translation-box';
    box.innerHTML = `
      <div class="msg-translation-header">
        <span class="msg-translation-lang">${mhLangNames[lang]}</span>
        <button class="msg-translation-close" onclick="this.closest('.msg-translation-box').remove()">✕</button>
      </div>
      <div class="msg-translation-text">⏳ Çeviriliyor...</div>`;
    textEl.insertAdjacentElement('afterend', box);

    try {
      const res = await fetch(MH_SB_URL + '/functions/v1/abibot-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': MH_SB_KEY, 'Authorization': 'Bearer ' + MH_SB_KEY },
        body: JSON.stringify({
          messages: [{ role: 'user', content: mhLangInstructs[lang] + '\n\n' + original }],
          systemPrompt: 'You are a professional translator. Translate accurately, preserving tone and meaning.',
        }),
      });
      const d = await res.json();
      const t = box.querySelector('.msg-translation-text');
      if (t) t.textContent = d.answer || 'Çeviri alınamadı.';
    } catch (e) {
      const t = box.querySelector('.msg-translation-text');
      if (t) t.textContent = 'Çeviri başarısız oldu. Lütfen tekrar deneyin.';
    }
  };
})();
