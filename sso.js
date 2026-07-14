// sso.js — shared cross-domain SSO helper for the BizdenBize / AbiBOT domain pair.
// Hosted at bizdenbize.com/sso.js and loaded cross-origin by both domains, same
// pattern as platform-config.js — one source of truth, no duplicated logic to drift.
//
// Requires: window.supabase already initialized before consumeIfPresent() runs.

const SSO_FUNCTIONS_URL = 'https://wxjudojlwksivhzjnmim.supabase.co/functions/v1';
const SSO_ANON_KEY = 'sb_publishable_52tr_hEnnQ3kllZexTue0Q_ByF71303';

window.BB_SSO = {
  // Call this from a button's onclick. Navigates to another domain in the family,
  // carrying the current session over via a short-lived handoff token if the
  // person is logged in. Falls back to a plain link if not logged in, or if
  // anything about the handoff fails for any reason — never blocks navigation.
  async crossTo(targetOrigin, path = '/') {
    try {
      const { data: { session } } = await window.supabase.auth.getSession();
      if (session) {
        const res = await fetch(`${SSO_FUNCTIONS_URL}/create-sso-handoff`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': SSO_ANON_KEY,
          },
        });
        if (res.ok) {
          const { token } = await res.json();
          if (token) {
            window.location.href = `${targetOrigin}${path}?sso=${token}`;
            return;
          }
        }
      }
    } catch (e) {
      console.warn('SSO handoff failed, falling back to plain link:', e);
    }
    window.location.href = `${targetOrigin}${path}`;
  },

  // Call once on page load, after your Supabase client exists. Checks for
  // ?sso=<token> in the URL and, if present, redeems it for a real session.
  // Always cleans the token out of the URL afterward — it's single-use and
  // shouldn't linger as something bookmarkable or shareable.
  async consumeIfPresent() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('sso');
    if (!token) return;

    try {
      const res = await fetch(`${SSO_FUNCTIONS_URL}/consume-sso-handoff`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SSO_ANON_KEY,
        },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        const { email, hashed_token } = await res.json();
        if (email && hashed_token) {
          const { error } = await window.supabase.auth.verifyOtp({
            email, token: hashed_token, type: 'magiclink',
          });
          if (error) console.error('SSO session verification failed:', error);
        }
      } else {
        console.warn('SSO handoff consume failed:', await res.text());
      }
    } catch (e) {
      console.error('SSO consume error:', e);
    } finally {
      params.delete('sso');
      const clean = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
      window.history.replaceState({}, '', clean);
    }
  }
};
