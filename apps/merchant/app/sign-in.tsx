import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { palette, radii, toAsciiDigits } from '@debt/shared';
import { LanguageControl } from '../src/components/LanguageControl';
import { isSupabaseConfigured } from '../src/lib/supabase';
import { normalizeEmail, sendEmailCode, signInWithGoogle, verifyEmailCode } from '../src/lib/auth';

type Stage = 'email' | 'code';

export default function SignInScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ linkId?: string | string[] }>();
  const linkId = Array.isArray(params.linkId) ? params.linkId[0] : params.linkId;
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<Stage>('email');
  const [busy, setBusy] = useState(false);
  const [lastSentAt, setLastSentAt] = useState(0);

  function finishSignIn() {
    router.replace(linkId ? { pathname: '/invite', params: { linkId } } : '/roles');
  }

  async function sendCode() {
    if (busy) return;
    const normalized = normalizeEmail(email);
    if (!normalized) {
      Alert.alert(t('common.error'), t('auth.invalidEmail'));
      return;
    }
    if (Date.now() - lastSentAt < 60_000) {
      Alert.alert(t('auth.resend'), t('auth.resendLater'));
      return;
    }
    setBusy(true);
    try {
      await sendEmailCode(normalized);
      setEmail(normalized);
      setStage('code');
      setLastSentAt(Date.now());
      setCode('');
      Alert.alert(t('auth.emailSentTitle'), t('auth.emailSentDetail'));
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : t('auth.sendFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    if (busy) return;
    setBusy(true);
    try {
      await verifyEmailCode(email, toAsciiDigits(code).trim());
      finishSignIn();
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : t('auth.verifyFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function googleLogin() {
    if (busy) return;
    setBusy(true);
    try {
      if (await signInWithGoogle()) finishSignIn();
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : t('auth.googleFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.topRow}>
            <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={styles.back}>
              <Text style={styles.backText}>‹</Text>
            </Pressable>
            <LanguageControl />
          </View>
          <View style={styles.brand}><Text style={styles.brandText}>{t('app.merchantName')}</Text></View>
          <Text style={styles.title}>{t('auth.signInTitle')}</Text>
          <Text style={styles.description}>{t('auth.signInIntro')}</Text>
          {!isSupabaseConfigured && <Text style={styles.error}>{t('auth.unavailable')}</Text>}
          {stage === 'email' ? (
            <>
              <Pressable accessibilityRole="button" disabled={busy || !isSupabaseConfigured} onPress={() => void googleLogin()} style={({ pressed }) => [styles.googleButton, (busy || !isSupabaseConfigured) && styles.disabled, pressed && styles.pressed]}>
                {busy ? <ActivityIndicator color={palette.primary} /> : <Text style={styles.googleText}>G</Text>}
                <Text style={styles.googleLabel}>{t('auth.googleContinue')}</Text>
              </Pressable>
              <View style={styles.separator}><View style={styles.line} /><Text style={styles.or}>{t('auth.orEmail')}</Text><View style={styles.line} /></View>
              <Text style={styles.label}>{t('auth.email')}</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="name@example.com"
                placeholderTextColor={palette.muted}
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                textAlign="left"
                accessibilityLabel={t('auth.email')}
                maxLength={254}
                returnKeyType="send"
                onSubmitEditing={() => void sendCode()}
              />
              <Pressable accessibilityRole="button" disabled={busy || !isSupabaseConfigured} onPress={() => void sendCode()} style={({ pressed }) => [styles.button, (busy || !isSupabaseConfigured) && styles.disabled, pressed && styles.pressed]}>
                {busy ? <ActivityIndicator color={palette.white} /> : <Text style={styles.buttonText}>{t('auth.sendCode')}</Text>}
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.address}>{email}</Text>
              <Text style={styles.description}>{t('auth.emailSentDetail')}</Text>
              <Text style={styles.label}>{t('auth.code')}</Text>
              <TextInput
                value={code}
                onChangeText={(value) => setCode(toAsciiDigits(value).replace(/\D/g, ''))}
                placeholder="123456"
                placeholderTextColor={palette.muted}
                style={styles.input}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                maxLength={8}
                textAlign="center"
                accessibilityLabel={t('auth.code')}
              />
              <Pressable accessibilityRole="button" disabled={busy || code.length < 6} onPress={() => void verifyCode()} style={({ pressed }) => [styles.button, (busy || code.length < 6) && styles.disabled, pressed && styles.pressed]}>
                {busy ? <ActivityIndicator color={palette.white} /> : <Text style={styles.buttonText}>{t('auth.verify')}</Text>}
              </Pressable>
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => void sendCode()} style={styles.secondary}>
                <Text style={styles.secondaryText}>{t('auth.resend')}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setStage('email'); setCode(''); }} style={styles.secondary}>
                <Text style={styles.secondaryText}>{t('auth.changeEmail')}</Text>
              </Pressable>
            </>
          )}
          <Text style={styles.privacy}>{t('merged.customerFree')}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 36, gap: 13 },
  topRow: { minHeight: 70, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, justifyContent: 'center', alignItems: 'center' },
  backText: { fontSize: 29, color: palette.ink, lineHeight: 34 },
  brand: { width: 66, height: 66, borderRadius: 22, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginTop: 24 },
  brandText: { fontSize: 23, color: palette.white, fontWeight: '900' },
  title: { fontSize: 26, lineHeight: 37, textAlign: 'center', fontWeight: '900', color: palette.ink, marginTop: 14 },
  description: { fontSize: 14, lineHeight: 24, textAlign: 'center', color: palette.muted, marginBottom: 9 },
  error: { fontSize: 13, lineHeight: 23, textAlign: 'center', color: palette.danger },
  googleButton: { minHeight: 56, borderRadius: radii.control, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 16 },
  googleText: { color: '#4285F4', fontSize: 23, fontWeight: '900' },
  googleLabel: { color: palette.ink, fontSize: 15, fontWeight: '800' },
  separator: { flexDirection: 'row', alignItems: 'center', gap: 14, marginVertical: 10 },
  line: { flex: 1, height: 1, backgroundColor: palette.line },
  or: { color: palette.muted, fontSize: 13 },
  label: { color: palette.ink, fontSize: 14, fontWeight: '800' },
  input: { minHeight: 56, borderRadius: radii.control, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, fontSize: 17, color: palette.ink, paddingHorizontal: 15, writingDirection: 'ltr' },
  button: { minHeight: 56, borderRadius: radii.control, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  buttonText: { color: palette.white, fontSize: 15, fontWeight: '800' },
  address: { fontSize: 15, color: palette.primary, textAlign: 'center', writingDirection: 'ltr', marginTop: 15 },
  secondary: { minHeight: 42, justifyContent: 'center', alignItems: 'center' },
  secondaryText: { color: palette.primary, fontSize: 13, fontWeight: '800' },
  privacy: { color: palette.muted, textAlign: 'center', fontSize: 12, marginTop: 25 },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.48 },
});
