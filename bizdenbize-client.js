// bizdenbize-client.js
//
// Das hier ist ein ES-Modul (import/export). Es laesst sich NICHT als
// klassisches Skript einbinden — so eingebunden bricht es sofort mit
// einem Syntaxfehler ab. Der bisherige Hinweis an dieser Stelle riet
// genau dazu; korrigiert am 31.10.2026.
//
// So wird es benutzt (admin.html, messages.html und profil.html tun das):
//     const { supabase } = await import('./bizdenbize-client.js');

import { createClient } from '/supabase.js';

// ── CONFIG ──────────────────────────────────────
// Replace these with your actual Supabase project values
// Found in: Supabase Dashboard → Settings → API
const SUPABASE_URL  = 'https://wxjudojlwksivhzjnmim.supabase.co';
const SUPABASE_ANON = 'sb_publishable_52tr_hEnnQ3kllZexTue0Q_ByF71303';

// ── CLIENT ──────────────────────────────────────
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  }
});

// ── AUTH HELPERS ─────────────────────────────────

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getCurrentProfile() {
  const user = await getCurrentUser();
  if (!user) return null;
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
  localStorage.removeItem('bb_auth_token');
  localStorage.removeItem('bb_user');
  window.location.href = '/login.html';
}

// ── ROUTE GUARD ──────────────────────────────────
// Call on protected pages to redirect if not logged in
export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    window.location.replace('/login.html');
    return null;
  }
  return user;
}

// ── CREDIT HELPERS ───────────────────────────────
export async function getCredits() {
  const profile = await getCurrentProfile();
  return profile?.abibot_credits ?? 0;
}

// ── ENTFERNT AM 31.10.2026: askAbiBOT() und joinWaitlist() ──
//
// Beide riefen Adressen auf, die es nicht gibt:
//   askAbiBOT   -> /functions/v1/abibot    (die eingesetzte Funktion
//                                           heisst swift-worker)
//   joinWaitlist -> /functions/v1/waitlist (gibt es gar nicht)
//
// Aufgerufen hat sie niemand, kaputt war also nichts. Stehen geblieben
// waeren sie eine Falle: wer sie spaeter benutzt, bekommt einen Fehler,
// den die Datei selbst nicht erklaert.
//
// Umgebogen statt entfernt habe ich sie nicht, weil ungetesteter Code,
// der richtig aussieht, schlimmer ist als keiner. Wird AbiBOT von hier
// aus gebraucht, kommt der Helfer zurueck — dann mit dem echten Slug
// und einem Test dazu.
