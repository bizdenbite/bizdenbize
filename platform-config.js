// platform-config.js
// Single source of truth for category and language data shared across BizdenBize + AbiBOT pages.
// Load this before any page-specific script that references window.BB_CONFIG.
//
// Scope note: this covers STRUCTURAL data (id, label, icon, price, color, classifier topic) —
// the stuff that was drifting between uzman-basvuru.html, expert-panel.html, expert-profile.html,
// and abibot.html's sidebar. It deliberately does NOT include AbiBOT's full Claude system prompts
// or conversation starters — those are large, deeply BizdenBize/Turkish-immigrant-specific content
// blocks, not shared structural config, and stay in abibot.html for now.

window.BB_CONFIG = {
  platform: {
    id: 'bizdenbize',
    name: 'BizdenBize',
    tagline: 'Gurbet Hayatını Kolaylaştırıyoruz',
    defaultLanguage: 'tr',
  },

  languages: [
    { id: 'tr', label: '🇹🇷 Türkçe' },
    { id: 'de', label: '🇩🇪 Deutsch' },
    { id: 'en', label: '🇬🇧 English' },
    { id: 'fr', label: '🇫🇷 Français' },
    { id: 'nl', label: '🇳🇱 Nederlands' },
  ],

  // NOTE: AbiBOT's actual system-prompt language instructions (langInstructions in abibot.html)
  // currently only cover tr/de/en — fr/nl show as selectable elsewhere on the platform (e.g. expert
  // applications) but AbiBOT itself doesn't have prompt instructions for them yet. Flagged as a
  // backlog item, not fixed here — see session notes July 13 2026.

  categories: [
    { id: 'legal',      label: 'Hukuki',            icon: '⚖️', price: 5, color: '#EEF2FF', topic: 'legal matters, German/EU law, rights, contracts, courts, lawyers, Recht', badge: 'Popüler' },
    { id: 'visa',       label: 'Vize & Oturma',      icon: '🛂', price: 5, color: '#FFF7ED', topic: 'visa, residence permits, Aufenthaltstitel, immigration, citizenship' },
    { id: 'medical',    label: 'Tıbbi',              icon: '🏥', price: 4, color: '#F0FDF4', topic: 'medical topics, health, symptoms, doctors, Krankenkasse, medications' },
    { id: 'tax',        label: 'Vergi & Finans',     icon: '💶', price: 4, color: '#FFFBEB', topic: 'tax, finance, Steuer, Kindergeld, Wohngeld, income, social benefits' },
    { id: 'housing',    label: 'Konut & Kira',       icon: '🏠', price: 3, color: '#FDF4FF', topic: 'housing, rental, Mietrecht, tenancy, deposit, Nebenkosten, landlord' },
    { id: 'employment', label: 'İş & Çalışma',       icon: '💼', price: 3, color: '#EFF6FF', topic: 'employment, work, Kündigung, Arbeitsvertrag, salary, unemployment' },
    { id: 'school',     label: 'Okul & Yardımlar',   icon: '👶', price: 2, color: '#FEF9C3', topic: 'school, children, Kita, Kindergeld, Elterngeld, education, Bafög' },
    { id: 'insurance',  label: 'Sigorta & Araç',     icon: '🚗', price: 2, color: '#FFF1F2', topic: 'insurance, Kfz-Versicherung, car, vehicle, accident, claims' },
    { id: 'migration',  label: "Avrupa'ya Göç",      icon: '✈️', price: 5, color: '#FEE2E2', topic: 'legitimate work migration from Turkey to Europe, work visas, job offers, avoiding scams', badge: 'YENİ', badgeStyle: 'background:rgba(212,43,43,.1);color:var(--red);font-size:9px;padding:2px 6px;border-radius:10px;font-weight:700;' },
  ],

  expertApplication: {
    requiredFields: ['title', 'bio', 'phone', 'address'],
    whatsappConsentDefault: false,
  },
};

// Convenience lookups built once, so pages don't each re-derive these.
window.BB_CONFIG.categoryById = Object.fromEntries(window.BB_CONFIG.categories.map(c => [c.id, c]));
window.BB_CONFIG.categoryIcons = Object.fromEntries(window.BB_CONFIG.categories.map(c => [c.id, c.icon]));
window.BB_CONFIG.categoryColors = Object.fromEntries(window.BB_CONFIG.categories.map(c => [c.id, c.color]));
window.BB_CONFIG.categoryLabels = Object.fromEntries(window.BB_CONFIG.categories.map(c => [c.id, c.label]));
window.BB_CONFIG.categoryTopics = Object.fromEntries(window.BB_CONFIG.categories.map(c => [c.id, c.topic]));
window.BB_CONFIG.categoryPrices = Object.fromEntries(window.BB_CONFIG.categories.map(c => [c.id, c.price]));
