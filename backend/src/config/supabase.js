const { createClient } = require('@supabase/supabase-js');
const config = require('./env');

let client;

function getSupabaseClient() {
  if (client) return client;

  if (!config.supabase?.url || !config.supabase?.serviceRoleKey) {
    const err = new Error('Supabase is not configured. Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    err.status = 500;
    throw err;
  }

  client = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
    auth: { persistSession: false }
  });

  return client;
}

module.exports = {
  getSupabaseClient
};
