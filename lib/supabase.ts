import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://pqbyqfamucourmygnivb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_3Y_UNU3C8f_tzQ8qb_f4XA_t_iA4THC";
const PRODUCTION_SITE_URL = "https://studyhelper-gamma.vercel.app";
const REMEMBER_KEY = "studyhelper-remember-me";

let client: SupabaseClient | undefined;

export function setRememberMe(value: boolean) {
  window.localStorage.setItem(REMEMBER_KEY, value ? "true" : "false");
}

export function getRememberMe() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(REMEMBER_KEY) !== "false";
}

export function getEmailRedirectTo() {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const currentOrigin = typeof window === "undefined" ? undefined : window.location.origin;
  const siteUrl = configuredSiteUrl || currentOrigin || PRODUCTION_SITE_URL;
  return new URL("/?auth=confirmed", siteUrl).toString();
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
