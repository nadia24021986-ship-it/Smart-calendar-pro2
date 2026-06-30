const { createClient } = require('@supabase/supabase-js');

let _client = null;

function getSupabase() {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diset. Tambahkan di Environment Variables Vercel atau file .env.local.'
    );
  }

  _client = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _client;
}

module.exports = { getSupabase };
