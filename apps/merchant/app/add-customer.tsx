import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { normalizeIraqiPhone, palette, parseNonNegativeIqd, radii } from '@debt/shared';
import { supabase } from '../src/lib/supabase';
import { shareCustomerInvitation } from '../src/lib/invitations';

export default function AddCustomerScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+964');
  const [creditLimit, setCreditLimit] = useState('0');
  const [busy, setBusy] = useState(false);

  async function saveCustomer() {
    const normalizedPhone = normalizeIraqiPhone(phone);
    let limit = 0;
    try {
      limit = parseNonNegativeIqd(creditLimit);
    } catch {
      Alert.alert(t('common.error'), t('merchant.creditLimitRequired'));
      return;
    }
    if (name.trim().length < 1 || name.trim().length > 120) {
      Alert.alert(t('common.error'), t('merchant.customerName'));
      return;
    }
    if (!normalizedPhone) {
      Alert.alert(t('common.error'), t('merchant.phoneRequired'));
      return;
    }

    setBusy(true);
    const { data: linkId, error } = await supabase.rpc('add_customer', {
      p_phone_e164: normalizedPhone,
      p_display_name: name.trim(),
      p_credit_limit_iqd: limit,
    });
    setBusy(false);
    if (error) {
      Alert.alert(t('common.error'), error.message);
      return;
    }
    const { data: business } = await supabase.from('businesses').select('name').maybeSingle();
    const message = t('merchant.inviteShareMessage', { shop: business?.name ?? t('merchant.shopName') });
    try {
      await shareCustomerInvitation(t('merchant.inviteShareTitle'), message, typeof linkId === 'string' ? linkId : undefined);
    } catch {
      Alert.alert(t('merchant.customerAdded'), t('merchant.inviteShareFailed'), [
        { text: t('app.continue'), onPress: () => router.back() },
      ]);
      return;
    }
    router.back();
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen options={{ title: t('merchant.addCustomerTitle'), headerShown: false }} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => router.back()} style={styles.backButton}>
              <Text style={styles.backText}>‹</Text>
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={styles.kicker}>{t('merchant.customers')}</Text>
              <Text style={styles.title}>{t('merchant.addCustomerTitle')}</Text>
            </View>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.introCard}>
            <View style={styles.avatar}><Text style={styles.avatarText}>+</Text></View>
            <Text style={styles.introTitle}>{t('merchant.saveCustomer')}</Text>
            <Text style={styles.introText}>{t('merchant.createShopPrompt')}</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>{t('merchant.customerName')}</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={t('merchant.customerName')}
                placeholderTextColor={palette.muted}
                style={styles.input}
                maxLength={120}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>{t('auth.phone')}</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="+964 750 000 0000"
                placeholderTextColor={palette.muted}
                style={[styles.input, styles.ltrInput]}
                textAlign="left"
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                maxLength={24}
              />
              <Text style={styles.hint}>{t('auth.phoneHint')}</Text>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>{t('merchant.creditLimit')}</Text>
              <View style={styles.amountField}>
                <Text style={styles.currency}>{t('common.currency')}</Text>
                <TextInput
                  value={creditLimit}
                  onChangeText={setCreditLimit}
                  style={[styles.input, styles.amountInput]}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={palette.muted}
                  textAlign="left"
                />
              </View>
              <Text style={styles.hint}>{t('merchant.creditLimitHint')}</Text>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void saveCustomer()}
            style={({ pressed }) => [styles.submit, pressed && styles.submitPressed, busy && styles.submitDisabled]}
          >
            {busy ? <ActivityIndicator color={palette.white} /> : <Text style={styles.submitText}>{t('merchant.saveCustomer')}</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  flex: { flex: 1 },
  content: { flexGrow: 1, padding: 22, paddingBottom: 30, gap: 24 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  backButton: { width: 44, height: 44, borderRadius: 15, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, alignItems: 'center', justifyContent: 'center' },
  backText: { color: palette.ink, fontSize: 29, lineHeight: 34 },
  headerCopy: { flex: 1, gap: 2 },
  headerSpacer: { width: 44 },
  kicker: { color: palette.primary, fontSize: 12, fontWeight: '800' },
  title: { color: palette.ink, fontSize: 24, fontWeight: '900' },
  introCard: { minHeight: 158, borderRadius: radii.card, backgroundColor: palette.primaryDark, padding: 22, gap: 8, overflow: 'hidden' },
  avatar: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#286E5B', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  avatarText: { color: palette.white, fontSize: 24, fontWeight: '500' },
  introTitle: { color: palette.white, fontSize: 17, fontWeight: '800' },
  introText: { color: '#D5E7DF', fontSize: 13, lineHeight: 20 },
  form: { gap: 19 },
  field: { gap: 8 },
  label: { color: palette.ink, fontSize: 14, fontWeight: '800' },
  input: { minHeight: 54, borderWidth: 1, borderColor: palette.line, borderRadius: radii.control, backgroundColor: palette.surface, paddingHorizontal: 16, color: palette.ink, fontSize: 16 },
  ltrInput: { writingDirection: 'ltr' },
  hint: { color: palette.muted, fontSize: 12, lineHeight: 18 },
  amountField: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  currency: { paddingHorizontal: 12, color: palette.primary, fontSize: 13, fontWeight: '800' },
  amountInput: { flex: 1 },
  submit: { minHeight: 58, borderRadius: radii.control, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, marginTop: 'auto' },
  submitPressed: { backgroundColor: palette.primaryDark },
  submitDisabled: { opacity: 0.65 },
  submitText: { color: palette.white, fontSize: 16, fontWeight: '800' },
});
