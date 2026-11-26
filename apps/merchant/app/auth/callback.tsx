import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { palette } from '@debt/shared';
import { completeAuthRedirect } from '../../src/lib/auth';
import { supabase } from '../../src/lib/supabase';

export default function AuthCallbackScreen() {
  const url = Linking.useURL();
  const router = useRouter();
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void (async () => {
      const redirectUrl = url ?? await Linking.getInitialURL();
      if (redirectUrl && /[?#&](code|token_hash|access_token|error)=/.test(redirectUrl)) {
        await completeAuthRedirect(redirectUrl);
      }
      const { data, error: authError } = await supabase.auth.getUser();
      if (authError || !data.user) throw authError ?? new Error(t('auth.verifyFailed'));
      if (active) router.replace('/roles');
    })().catch((e: unknown) => {
      if (active) setError(e instanceof Error ? e.message : t('auth.verifyFailed'));
    });
    return () => { active = false; };
  }, [router, t, url]);

  return (
    <View style={styles.root}>
      {error ? (
        <>
          <Text style={styles.error}>{error}</Text>
          <Pressable accessibilityRole="button" style={styles.action} onPress={() => router.replace('/sign-in')}>
            <Text style={styles.actionText}>{t('auth.signInTitle')}</Text>
          </Pressable>
        </>
      ) : (
        <>
          <ActivityIndicator color={palette.primary} />
          <Text style={styles.message}>{t('auth.completingSignIn')}</Text>
        </>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background, gap: 20, paddingHorizontal: 24 },
  message: { color: palette.ink, fontSize: 16, textAlign: 'center' },
  error: { color: palette.danger, textAlign: 'center', fontSize: 14, lineHeight: 24 },
  action: { minHeight: 48, borderRadius: 14, paddingHorizontal: 22, justifyContent: 'center', backgroundColor: palette.primary },
  actionText: { color: palette.white, fontWeight: '800' },
});
