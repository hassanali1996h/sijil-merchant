import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Crypto from 'expo-crypto';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { palette, parsePositiveIqd, radii } from '@debt/shared';
import { supabase } from '../src/lib/supabase';

type EntryKind = 'debt' | 'payment';
type CustomerOption = { id: string; customer_display_name: string; credit_limit_iqd: number | string };

export default function NewTransactionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ kind?: string; linkId?: string }>();
  const { t } = useTranslation();
  const [kind, setKind] = useState<EntryKind>(params.kind === 'payment' ? 'payment' : 'debt');
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(() => Crypto.randomUUID());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void supabase.from('customer_links')
      .select('id,customer_display_name,credit_limit_iqd')
      .eq('status', 'active')
      .order('customer_display_name')
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) Alert.alert(t('common.error'), error.message);
        const rows = (data ?? []) as CustomerOption[];
        setCustomers(rows);
        if (rows.length) setCustomerId(rows.find((row) => row.id === params.linkId)?.id ?? rows[0].id);
        setLoading(false);
      });
    return () => { alive = false; };
  }, [params.linkId, t]);

  async function submit() {
    if (!customerId) {
      Alert.alert(t('common.error'), t('merchant.selectCustomer'));
      return;
    }
    let amountIqd = 0;
    try {
      amountIqd = parsePositiveIqd(amount);
    } catch {
      Alert.alert(t('common.error'), t('merchant.amountRequired'));
      return;
    }

    setBusy(true);
    const { error } = await supabase.rpc('create_transaction_request', {
      p_link_id: customerId,
      p_kind: kind,
      p_amount_iqd: amountIqd,
      p_description: description.trim(),
      p_due_at: null,
      p_idempotency_key: idempotencyKey,
    });
    setBusy(false);
    if (error) {
      Alert.alert(t('common.error'), error.message);
      return;
    }
    setIdempotencyKey(Crypto.randomUUID());
    Alert.alert(t('transaction.created'), undefined, [{ text: t('app.continue'), onPress: () => router.back() }]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen options={{ title: t('merchant.entryTitle'), headerShown: false }} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => router.back()} style={styles.backButton}>
              <Text style={styles.backText}>‹</Text>
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={styles.kicker}>{t('merchant.dashboard')}</Text>
              <Text style={styles.title}>{t('merchant.entryTitle')}</Text>
            </View>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.kindSelector}>
            <Text style={styles.label}>{t('merchant.chooseKind')}</Text>
            <View style={styles.kindRow}>
              <Pressable accessibilityRole="button" onPress={() => setKind('debt')} style={[styles.kindCard, kind === 'debt' && styles.kindSelected]}>
                <View style={[styles.kindIcon, kind === 'debt' && styles.kindIconSelected]}><Text style={[styles.kindSymbol, kind === 'debt' && styles.kindSymbolSelected]}>−</Text></View>
                <Text style={[styles.kindText, kind === 'debt' && styles.kindTextSelected]}>{t('merchant.debtKind')}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => setKind('payment')} style={[styles.kindCard, kind === 'payment' && styles.kindSelected]}>
                <View style={[styles.kindIcon, kind === 'payment' && styles.kindIconSelected]}><Text style={[styles.kindSymbol, kind === 'payment' && styles.kindSymbolSelected]}>+</Text></View>
                <Text style={[styles.kindText, kind === 'payment' && styles.kindTextSelected]}>{t('merchant.paymentKind')}</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t('merchant.selectCustomer')}</Text>
            {loading ? <ActivityIndicator color={palette.primary} style={styles.loader} /> : customers.length === 0 ? (
              <View style={styles.emptyCard}><Text style={styles.emptyText}>{t('merchant.noActiveCustomers')}</Text></View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.customerRow}>
                {customers.map((customer) => (
                  <Pressable key={customer.id} onPress={() => setCustomerId(customer.id)} style={[styles.customerChip, customerId === customer.id && styles.customerChipSelected]}>
                    <View style={[styles.customerDot, customerId === customer.id && styles.customerDotSelected]} />
                    <Text style={[styles.customerName, customerId === customer.id && styles.customerNameSelected]}>{customer.customer_display_name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t('merchant.writeAmount')}</Text>
            <View style={styles.amountCard}>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                style={styles.amountInput}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor="#AAB4AD"
                accessibilityLabel={t('transaction.amount')}
              />
              <View style={styles.currencyBadge}><Text style={styles.currencyText}>{t('common.currency')}</Text></View>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t('merchant.noteOptional')}</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              style={[styles.input, styles.description]}
              placeholder={t('transaction.description')}
              placeholderTextColor={palette.muted}
              multiline
              maxLength={1000}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.notice}>
            <View style={styles.noticeIcon}><Text style={styles.noticeCheck}>✓</Text></View>
            <Text style={styles.noticeText}>{t('transaction.created')}</Text>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={busy || loading || customers.length === 0}
            onPress={() => void submit()}
            style={({ pressed }) => [styles.submit, pressed && styles.submitPressed, (busy || loading || customers.length === 0) && styles.submitDisabled]}
          >
            {busy ? <ActivityIndicator color={palette.white} /> : <Text style={styles.submitText}>{t('merchant.sendForApproval')}</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  flex: { flex: 1 },
  content: { flexGrow: 1, padding: 22, paddingBottom: 30, gap: 23 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  backButton: { width: 44, height: 44, borderRadius: 15, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, alignItems: 'center', justifyContent: 'center' },
  backText: { color: palette.ink, fontSize: 29, lineHeight: 34 },
  headerCopy: { flex: 1, gap: 2 },
  headerSpacer: { width: 44 },
  kicker: { color: palette.primary, fontSize: 12, fontWeight: '800' },
  title: { color: palette.ink, fontSize: 24, fontWeight: '900' },
  label: { color: palette.ink, fontSize: 14, fontWeight: '800' },
  kindSelector: { gap: 11 },
  kindRow: { flexDirection: 'row', gap: 12 },
  kindCard: { flex: 1, minHeight: 94, borderRadius: 20, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, padding: 14, gap: 10, justifyContent: 'center' },
  kindSelected: { backgroundColor: palette.primaryTint, borderColor: palette.primary },
  kindIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#F0F3F0', alignItems: 'center', justifyContent: 'center' },
  kindIconSelected: { backgroundColor: palette.primary },
  kindSymbol: { color: palette.ink, fontSize: 20, lineHeight: 23, fontWeight: '700' },
  kindSymbolSelected: { color: palette.white },
  kindText: { color: palette.muted, fontSize: 13, fontWeight: '700' },
  kindTextSelected: { color: palette.primaryDark },
  field: { gap: 10 },
  loader: { height: 56 },
  customerRow: { gap: 8, paddingVertical: 2 },
  customerChip: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 13, borderRadius: radii.pill, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface },
  customerChipSelected: { borderColor: palette.primary, backgroundColor: palette.primaryTint },
  customerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#B6C1B8' },
  customerDotSelected: { backgroundColor: palette.primary },
  customerName: { maxWidth: 180, color: palette.muted, fontSize: 13, fontWeight: '700' },
  customerNameSelected: { color: palette.primaryDark },
  emptyCard: { minHeight: 58, padding: 14, borderRadius: 16, backgroundColor: palette.surface, justifyContent: 'center' },
  emptyText: { color: palette.muted, fontSize: 13, lineHeight: 20 },
  amountCard: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, paddingHorizontal: 18 },
  amountInput: { flex: 1, color: palette.ink, fontSize: 34, fontWeight: '900', paddingVertical: 12, textAlign: 'left', writingDirection: 'ltr' },
  currencyBadge: { backgroundColor: palette.primaryTint, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.pill },
  currencyText: { color: palette.primaryDark, fontSize: 12, fontWeight: '800' },
  input: { minHeight: 54, borderWidth: 1, borderColor: palette.line, borderRadius: radii.control, backgroundColor: palette.surface, paddingHorizontal: 16, paddingVertical: 14, color: palette.ink, fontSize: 15 },
  description: { minHeight: 92 },
  notice: { flexDirection: 'row', gap: 10, alignItems: 'center', borderRadius: 16, backgroundColor: palette.primaryTint, padding: 13 },
  noticeIcon: { width: 24, height: 24, borderRadius: 12, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  noticeCheck: { color: palette.white, fontSize: 14, fontWeight: '900' },
  noticeText: { flex: 1, color: palette.primaryDark, fontSize: 12, lineHeight: 18 },
  submit: { minHeight: 58, borderRadius: radii.control, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, marginTop: 'auto' },
  submitPressed: { backgroundColor: palette.primaryDark },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: palette.white, fontSize: 16, fontWeight: '800' },
});
