import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://pqbyqfamucourmygnivb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_3Y_UNU3C8f_tzQ8qb_f4XA_t_iA4THC";
const REMEMBER_KEY = "studyhelper-remember-me";

let client: SupabaseClient | undefined;

export function setRememberMe(value: boolean) {
  window.localStorage.setItem(REMEMBER_KEY, value ? "true" : "false");
}

export function getRememberMe() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(REMEMBER_KEY) !== "false";
}

const authStorage = {
  getItem(key: string) {
    return (getRememberMe() ? window.localStorage : window.sessionStorage).getItem(key);
  },
  setItem(key: string, value: string) {
    (getRememberMe() ? window.localStorage : window.sessionStorage).setItem(key, value);
  },
  removeItem(key: string) {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  },
};

export function getSupabase() {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        storage: authStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}
