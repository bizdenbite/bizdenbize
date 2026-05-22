// ─────────────────────────────────────────────
// BizdenBize — Supabase Integration Layer
// ─────────────────────────────────────────────

const SUPABASE_URL = 'https://wxjudojlwksivhzjnmim.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4anVkb2psd2tzaXZoempubWltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzNzM1MDUsImV4cCI6MjA5Mzk0OTUwNX0.sRvZXS389i9MwCtLoDgfqJKyRsZLMXLNAJbsMZN9wOY';

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

// ── Generic fetch helper ──────────────────────
async function sbFetch(table, params = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, { headers });
  if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
  return res.json();
}

// ── Generic insert helper ─────────────────────
async function sbInsert(table, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Insert error: ${err}`);
  }
  return res.json();
}

// ── DOCTORS ───────────────────────────────────
async function getDoctors({ city = '', insurance = '', specialty = '' } = {}) {
  let params = 'active=eq.true&order=verified.desc,rating.desc';
  if (city)      params += `&city=ilike.*${encodeURIComponent(city)}*`;
  if (insurance && insurance !== 'all') params += `&insurance=ilike.*${encodeURIComponent(insurance)}*`;
  if (specialty && specialty !== 'all') params += `&specialty=eq.${encodeURIComponent(specialty)}`;
  return sbFetch('doctors', params);
}

async function submitDoctor(data) {
  return sbInsert('doctors', {
    name:        data.name,
    specialty:   data.specialty,
    city:        data.city,
    phone:       data.phone || null,
    address:     data.address || null,
    insurance:   data.insurance || null,
    description: data.description || null,
    verified:    false,
    active:      true
  });
}

// ── TUTORS ────────────────────────────────────
async function getTutors({ subject = '', level = '', format = '', free = false } = {}) {
  let params = 'active=eq.true&order=verified.desc,rating.desc';
  if (subject && subject !== 'all') params += `&subject=eq.${encodeURIComponent(subject)}`;
  if (free)                         params += `&price_type=eq.free`;
  if (format === 'online')          params += `&format=in.(online,both)`;
  if (format === 'inperson')        params += `&format=in.(inperson,both)`;
  return sbFetch('tutors', params);
}

async function submitTutor(data) {
  return sbInsert('tutors', {
    name:        data.name,
    subject:     data.subject,
    levels:      data.levels || [],
    city:        data.city || null,
    format:      data.format,
    price_type:  data.priceType,
    price_label: data.priceLabel || null,
    description: data.description,
    contact:     data.contact,
    verified:    false,
    active:      true
  });
}

// ── LISTINGS ──────────────────────────────────
async function getListings({ type = '', country = 'de' } = {}) {
  let params = 'active=eq.true&order=featured.desc,created_at.desc';
  if (type)    params += `&type=eq.${type}`;
  if (country && country !== 'all') params += `&country=eq.${country}`;
  return sbFetch('listings', params);
}

async function submitListing(data) {
  return sbInsert('listings', {
    type:        data.type,
    title:       data.title,
    company:     data.company || null,
    author:      data.author,
    location:    data.location,
    country:     data.country || 'de',
    category:    data.category || null,
    worktype:    data.worktype || null,
    price:       data.price || null,
    description: data.description,
    contact:     data.contact,
    featured:    false,
    verified:    false,
    active:      true
  });
}

// ── SWAP OFFERS ───────────────────────────────
async function getSwapOffers({ city = '', destination = '' } = {}) {
  let params = 'active=eq.true&order=featured.desc,created_at.desc';
  if (city)        params += `&city=ilike.*${encodeURIComponent(city)}*`;
  if (destination) params += `&destination=ilike.*${encodeURIComponent(destination)}*`;
  return sbFetch('swap_offers', params);
}

async function submitSwapOffer(data) {
  return sbInsert('swap_offers', {
    user_name:      data.userName,
    city:           data.city,
    country:        data.country || 'de',
    home_type:      data.homeType || null,
    rooms:          data.rooms || null,
    available_from: data.from || null,
    available_to:   data.to || null,
    family_size:    data.familySize || null,
    destination:    data.destination,
    description:    data.description,
    contact:        data.contact,
    featured:       false,
    verified:       false,
    active:         true
  });
}

// ── SUGGESTIONS ───────────────────────────────
async function submitSuggestion(data) {
  return sbInsert('suggestions', {
    source_page:  data.sourcePage || null,
    title:        data.title,
    url:          data.url || null,
    category:     data.category || null,
    country:      data.country || null,
    description:  data.description || null,
    submitted_by: data.submittedBy || null,
    status:       'pending'
  });
}

// ── Export ────────────────────────────────────
window.BB = {
  getDoctors, submitDoctor,
  getTutors, submitTutor,
  getListings, submitListing,
  getSwapOffers, submitSwapOffer,
  submitSuggestion
};

console.log('BizdenBize Supabase integration loaded.');
