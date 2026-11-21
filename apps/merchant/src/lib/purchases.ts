import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, type PurchasesPackage } from 'react-native-purchases';
import { supabase } from './supabase';

export type PurchasesSetupStatus = 'ready' | 'missing_key' | 'signed_out' | 'web_unsupported';

function getPlatformApiKey(): string | null {
  if (Platform.OS === 'ios') return process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || null;
  if (Platform.OS === 'android') return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY || null;
  return null;
}

export async function preparePurchases(): Promise<PurchasesSetupStatus> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return 'web_unsupported';
  const apiKey = getPlatformApiKey();
  if (!apiKey || apiKey.includes('PUBLIC_SDK_KEY')) return 'missing_key';

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return 'signed_out';

  Purchases.setLogLevel(LOG_LEVEL.WARN);
  if (await Purchases.isConfigured()) {
    const currentAppUserId = await Purchases.getAppUserID();
    if (currentAppUserId !== data.user.id) await Purchases.logIn(data.user.id);
  } else {
    Purchases.configure({ apiKey, appUserID: data.user.id });
  }
  return 'ready';
}

export async function loadAvailablePackages(): Promise<PurchasesPackage[]> {
  const offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages ?? [];
}

export async function syncServerEntitlement(): Promise<{ active: boolean; paidUntil: string | null }> {
  const { data, error } = await supabase.functions.invoke('revenuecat-sync', { body: {} });
  if (error) throw error;
  return data as { active: boolean; paidUntil: string | null };
}

export { Purchases };
