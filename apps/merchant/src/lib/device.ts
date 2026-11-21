import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabase';

const INSTALLATION_KEY = 'merchant-installation-id';
export type DeviceRegistrationStatus = 'registered' | 'same_device' | 'fresh_otp_required' | 'installation_bound_to_another_account' | 'not_merchant' | 'web_unsupported';

export async function registerMerchantDevice(): Promise<{ status: DeviceRegistrationStatus | null; error: string | null }> {
  if (Platform.OS === 'web') return { status: 'web_unsupported', error: null };

  try {
    let installationId = await SecureStore.getItemAsync(INSTALLATION_KEY);
    if (!installationId) {
      installationId = Crypto.randomUUID();
      await SecureStore.setItemAsync(INSTALLATION_KEY, installationId);
    }

    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    const { data, error } = await supabase.rpc('register_merchant_device', {
      p_installation_id: installationId,
      p_platform: platform,
    });
    if (error) return { status: null, error: error.message };
    return { status: typeof data === 'string' ? data as DeviceRegistrationStatus : null, error: null };
  } catch {
    return { status: null, error: 'device-storage-unavailable' };
  }
}
