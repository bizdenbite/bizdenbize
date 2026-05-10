// bizdenbize-client.js
// Include this in every HTML page: <script src="bizdenbize-client.js"></script>
// Place BEFORE any page scripts

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

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

// ── ABIBOT HELPER ────────────────────────────────
export async function askAbiBOT({ category, language, messages }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(`${SUPABASE_URL}/functions/v1/abibot`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': SUPABASE_ANON,
    },
    body: JSON.stringify({ category, language, messages }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'AbiBOT error');
  }

  return response.json();
}

// ── WAITLIST HELPER ───────────────────────────────
export async function joinWaitlist(data) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/waitlist`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON,
    },
    body: JSON.stringify(data),
  });
  return response.json();
}
