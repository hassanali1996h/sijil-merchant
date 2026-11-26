import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase, isSupabaseConfigured } from './supabase';

WebBrowser.maybeCompleteAuthSession();

export function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export const AUTH_REDIRECT = Linking.createURL('auth/callback', { scheme: 'debtledger-merchant' });

export async function sendEmailCode(email: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('خدمة تسجيل الدخول غير مهيأة. تواصل مع الدعم.');
  const normalized = normalizeEmail(email);
  if (!normalized) throw new Error('أدخل بريداً إلكترونياً صحيحاً.');
  const { error } = await supabase.auth.signInWithOtp({
    email: normalized,
    options: { shouldCreateUser: true, emailRedirectTo: AUTH_REDIRECT },
  });
  if (error) throw error;
}

export async function verifyEmailCode(email: string, code: string): Promise<void> {
  const normalized = normalizeEmail(email);
  if (!normalized || !/^\d{6,8}$/.test(code)) throw new Error('أدخل البريد والرمز الصحيح.');
  const { data, error } = await supabase.auth.verifyOtp({ email: normalized, token: code, type: 'email' });
  if (error) throw error;
  if (!data.session) throw new Error('تعذّر إنشاء الجلسة. حاول مجدداً.');
}

function findParam(url: string, key: string): string | null {
  // All callers supply fixed, trusted parameter names.
  const match = new RegExp('(?:[?#&])' + key + '=([^&#]*)').exec(url);
  return match ? decodeURIComponent(match[1].replace(/\+/g, ' ')) : null;
}

const pendingExchanges = new Map<string, Promise<void>>();
const completedCodes = new Set<string>();

export async function completeAuthRedirect(url: string): Promise<void> {
  const errorDescription = findParam(url, 'error_description') ?? findParam(url, 'error');
  if (errorDescription) throw new Error(errorDescription);
  const code = findParam(url, 'code');
  if (code) {
    if (completedCodes.has(code)) return;
    let pending = pendingExchanges.get(code);
    if (!pending) {
      pending = (async () => {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
        // The auth redirect can be delivered both by the browser and Expo Router.
        completedCodes.add(code);
        if (completedCodes.size > 20) completedCodes.delete(completedCodes.values().next().value!);
      })();
      pendingExchanges.set(code, pending);
      void pending.finally(() => { pendingExchanges.delete(code); }).catch(() => {});
    }
    await pending;
    return;
  }
  const tokenHash = findParam(url, 'token_hash');
  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'email' });
    if (error) throw error;
    return;
  }
  const accessToken = findParam(url, 'access_token');
  const refreshToken = findParam(url, 'refresh_token');
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) throw error;
    return;
  }
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error('لم يكتمل تسجيل الدخول. حاول مرة أخرى.');
}

export async function signInWithGoogle(): Promise<boolean> {
  if (!isSupabaseConfigured) throw new Error('خدمة تسجيل الدخول غير مهيأة. تواصل مع الدعم.');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: AUTH_REDIRECT, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) throw new Error('تعذر فتح صفحة تسجيل الدخول في Google.');
  const result = await WebBrowser.openAuthSessionAsync(data.url, AUTH_REDIRECT);
  if (result.type === 'cancel' || result.type === 'dismiss') return false;
  if (result.type !== 'success' || !result.url) throw new Error('لم تكتمل عملية تسجيل الدخول.');
  await completeAuthRedirect(result.url);
  const { data: current } = await supabase.auth.getUser();
  if (!current.user) throw new Error('تعذّر التحقق من حساب Google.');
  return true;
}
