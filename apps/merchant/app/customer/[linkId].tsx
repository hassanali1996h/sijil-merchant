import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { formatIqd, getMerchantAccessState, palette, parseNonNegativeIqd, radii, type MerchantAccessState } from '@debt/shared';
import { supabase } from '../../src/lib/supabase';
import { shareCustomerInvitation } from '../../src/lib/invitations';

type CustomerLink = { id: string; business_id: string; customer_display_name: string; customer_phone_e164: string | null; credit_limit_iqd: number | string; status: string };
type Balance = { confirmed_balance_iqd: number | string; pending_debt_iqd: number | string; credit_limit_iqd: number | string };
type TransactionRow = { id: string; kind: 'debt' | 'payment'; amount_iqd: number | string; description: string; status: string; created_at: string; due_at: string | null };

const PAGE_SIZE = 25;

function statusKey(status: string) {
  if (status === 'confirmed') return 'transaction.confirmedStatus';
  if (status === 'disputed') return 'transaction.disputedStatus';
  if (status === 'cancelled') return 'transaction.cancelledStatus';
  return 'transaction.pendingStatus';
}

export default function MerchantCustomerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ linkId?: string | string[] }>();
  const { t, i18n } = useTranslation();
  const linkId = Array.isArray(params.linkId) ? params.linkId[0] : params.linkId;
  const [customer, setCustomer] = useState<CustomerLink | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [access, setAccess] = useState<MerchantAccessState>('read_only');
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [limitDraft, setLimitDraft] = useState('0');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [savingLimit, setSavingLimit] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(async () => {
    if (!linkId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: linkData, error: linkError } = await supabase.from('customer_links')
      .select('id,business_id,customer_display_name,customer_phone_e164,credit_limit_iqd,status')
      .eq('id', linkId)
      .maybeSingle();
    if (linkError) Alert.alert(t('common.error'), linkError.message);
    const currentCustomer = (linkData ?? null) as CustomerLink | null;
    setCustomer(currentCustomer);
    if (!currentCustomer) {
      setBalance(null);
      setTransactions([]);
      setLoading(false);
      return;
    }
    setLimitDraft(String(currentCustomer.credit_limit_iqd));

    const [balanceResponse, entitlementResponse, transactionResponse] = await Promise.all([
      supabase.rpc('get_customer_balance', { p_link_id: currentCustomer.id }),
      supabase.from('merchant_entitlements').select('trial_ends_at,paid_until').eq('business_id', currentCustomer.business_id).maybeSingle(),
      supabase.from('ledger_transactions').select('id,kind,amount_iqd,description,status,created_at,due_at').eq('customer_link_id', currentCustomer.id).order('created_at', { ascending: false }).range(0, PAGE_SIZE - 1),
    ]);
    if (balanceResponse.error) Alert.alert(t('common.error'), balanceResponse.error.message);
    if (entitlementResponse.error) Alert.alert(t('common.error'), entitlementResponse.error.message);
    if (transactionResponse.error) Alert.alert(t('common.error'), transactionResponse.error.message);
    const parsedBalance = Array.isArray(balanceResponse.data) ? balanceResponse.data[0] : balanceResponse.data;
    setBalance(balanceResponse.error ? null : (parsedBalance as Balance | null));
    const entitlement = entitlementResponse.data as { trial_ends_at: string; paid_until: string | null } | null;
    setAccess(entitlement ? getMerchantAccessState({ trialEndsAt: entitlement.trial_ends_at, paidUntil: entitlement.paid_until }) : 'read_only');
    const rows = (transactionResponse.data ?? []) as TransactionRow[];
    setTransactions(rows);
    setHasMore(rows.length === PAGE_SIZE);
    setLoading(false);
  }, [linkId, t]);

  useEffect(() => { void load(); }, [load]);

  async function saveLimit() {
    if (!customer) return;
    let limit = 0;
    try {
      limit = parseNonNegativeIqd(limitDraft);
    } catch {
      Alert.alert(t('common.error'), t('merchant.creditLimitRequired'));
      return;
    }
    setSavingLimit(true);
    const { error } = await supabase.rpc('set_customer_credit_limit', { p_link_id: customer.id, p_limit_iqd: limit });
    setSavingLimit(false);
    if (error) {
      Alert.alert(t('common.error'), error.message);
      return;
    }
    await load();
  }

  async function shareInvitation() {
    if (!customer) return;
    const { data: business } = await supabase.from('businesses').select('name').eq('id', customer.business_id).maybeSingle();
    const message = t('merchant.inviteShareMessage', { shop: business?.name ?? t('merchant.shopName') });
    try {
      await shareCustomerInvitation(t('merchant.inviteShareTitle'), message, customer.id);
    } catch {
      Alert.alert(t('common.error'), t('merchant.inviteShareFailed'));
    }
  }

  async function loadMore() {
    if (!customer || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const start = transactions.length;
    const { data, error } = await supabase.from('ledger_transactions')
      .select('id,kind,amount_iqd,description,status,created_at,due_at')
      .eq('customer_link_id', customer.id)
      .order('created_at', { ascending: false })
      .range(start, start + PAGE_SIZE - 1);
    if (error) Alert.alert(t('common.error'), error.message);
    const rows = (data ?? []) as TransactionRow[];
    setTransactions((current) => [...current, ...rows]);
    setHasMore(rows.length === PAGE_SIZE);
    setLoadingMore(false);
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={palette.primary} /></View>;
  if (!customer) return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen options={{ title: t('merchant.customers'), headerShown: false }} />
      <View style={styles.missingState}><Text style={styles.missingTitle}>{t('common.error')}</Text><Pressable onPress={() => router.back()} style={styles.backAction}><Text style={styles.backActionText}>{t('common.back')}</Text></Pressable></View>
    </SafeAreaView>
  );

  const locale = i18n.resolvedLanguage === 'ckb' ? 'ckb-IQ' : 'ar-IQ';
  const writable = access !== 'read_only';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen options={{ title: customer.customer_display_name, headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topbar}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable>
          <View style={styles.topbarCopy}><Text style={styles.kicker}>{t('merchant.customers')}</Text><Text numberOfLines={1} style={styles.topbarTitle}>{customer.customer_display_name}</Text></View>
          <View style={[styles.statusBadge, customer.status === 'active' && styles.statusBadgeActive]}><View style={[styles.statusDot, customer.status === 'active' && styles.statusDotActive]} /><Text style={[styles.statusLabel, customer.status === 'active' && styles.statusLabelActive]}>{customer.status === 'active' ? t('merchant.customerActive') : t('merchant.customerInvited')}</Text></View>
        </View>

        <View style={styles.identityCard}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{customer.customer_display_name.trim().charAt(0)}</Text></View>
          <View style={styles.identityCopy}><Text style={styles.identityName}>{customer.customer_phone_e164 === null ? t('account.deletedAccount') : customer.customer_display_name}</Text><Text style={styles.identityPhone}>{customer.customer_phone_e164}</Text></View>
          {customer.status === 'invited' && <Pressable accessibilityRole="button" onPress={() => void shareInvitation()} style={styles.shareButton}><Text style={styles.shareButtonText}>{t('merchant.shareInvitation')}</Text></Pressable>}
        </View>

        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>{t('merchant.balance')}</Text>
          <Text style={styles.balanceValue}>{balance ? formatIqd(String(balance.confirmed_balance_iqd), locale) : '—'}</Text>
          <View style={styles.balanceDivider} />
          <View style={styles.balanceMetaRow}><Text style={styles.balanceMetaLabel}>{t('merchant.pending')}</Text><Text style={styles.balanceMetaValue}>{balance ? formatIqd(String(balance.pending_debt_iqd), locale) : '—'}</Text></View>
        </View>

        <View style={styles.actionsRow}>
          <Pressable disabled={!writable || customer.status !== 'active'} onPress={() => router.push({ pathname: '/new-transaction', params: { kind: 'debt', linkId: customer.id } })} style={({ pressed }) => [styles.actionButton, pressed && styles.pressed, (!writable || customer.status !== 'active') && styles.disabled]}>
            <Text style={styles.actionSymbol}>−</Text><Text style={styles.actionText}>{t('merchant.newDebt')}</Text>
          </Pressable>
          <Pressable disabled={!writable || customer.status !== 'active'} onPress={() => router.push({ pathname: '/new-transaction', params: { kind: 'payment', linkId: customer.id } })} style={({ pressed }) => [styles.actionButton, styles.actionButtonPayment, pressed && styles.pressed, (!writable || customer.status !== 'active') && styles.disabled]}>
            <Text style={[styles.actionSymbol, styles.actionSymbolPayment]}>+</Text><Text style={styles.actionText}>{t('merchant.newPayment')}</Text>
          </Pressable>
        </View>

        <View style={styles.limitCard}>
          <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>{t('merchant.creditLimit')}</Text><Text style={styles.sectionSubtitle}>{t('merchant.creditLimitHint')}</Text></View></View>
          <View style={styles.limitRow}>
            <TextInput value={limitDraft} onChangeText={setLimitDraft} style={styles.limitInput} keyboardType="number-pad" textAlign="left" editable={writable && !savingLimit} />
            <Text style={styles.limitCurrency}>{t('common.currency')}</Text>
          </View>
          <Pressable disabled={!writable || savingLimit} onPress={() => void saveLimit()} style={({ pressed }) => [styles.saveButton, pressed && styles.pressed, (!writable || savingLimit) && styles.disabled]}>
            {savingLimit ? <ActivityIndicator color={palette.white} /> : <Text style={styles.saveButtonText}>{t('common.save')}</Text>}
          </Pressable>
        </View>

        <View style={styles.historyHeader}><View><Text style={styles.sectionTitle}>{t('customer.history')}</Text><Text style={styles.sectionSubtitle}>{t('merchant.latestActivity')}</Text></View><Text style={styles.historyCount}>{transactions.length}</Text></View>
        {transactions.length === 0 ? (
          <View style={styles.emptyCard}><Text style={styles.emptyText}>{t('merchant.noRecentActivity')}</Text></View>
        ) : transactions.map((transaction) => {
          const payment = transaction.kind === 'payment';
          const disputed = transaction.status === 'disputed';
          const createdDate = new Date(transaction.created_at).toLocaleDateString(locale, { timeZone: 'Asia/Baghdad', year: 'numeric', month: 'short', day: 'numeric' });
          return (
            <View key={transaction.id} style={styles.transactionCard}>
              <View style={[styles.transactionIcon, payment && styles.paymentIcon, disputed && styles.disputedIcon]}><Text style={[styles.transactionSymbol, payment && styles.paymentSymbol, disputed && styles.disputedSymbol]}>{payment ? '+' : '−'}</Text></View>
              <View style={styles.transactionCopy}>
                <View style={styles.transactionHead}><Text style={styles.transactionKind}>{t(payment ? 'customer.payment' : 'customer.debt')}</Text><Text style={[styles.transactionStatus, disputed && styles.disputedText]}>{t(statusKey(transaction.status))}</Text></View>
                <Text style={styles.transactionDescription}>{transaction.description || t('customer.noDescription')}</Text>
                <Text style={styles.transactionDate}>{createdDate}{transaction.due_at ? ` · ${t('transaction.dueDate')}: ${new Date(transaction.due_at).toLocaleDateString(locale, { timeZone: 'Asia/Baghdad' })}` : ''}</Text>
              </View>
              <Text style={styles.transactionAmount}>{formatIqd(String(transaction.amount_iqd), locale)}</Text>
            </View>
          );
        })}

        {hasMore && <Pressable disabled={loadingMore} onPress={() => void loadMore()} style={styles.moreButton}>{loadingMore ? <ActivityIndicator color={palette.primary} /> : <Text style={styles.moreButtonText}>{t('customer.loadMore')}</Text>}</Pressable>}
        {access === 'read_only' && <Text style={styles.readOnlyNote}>{t('merchant.readOnlyAccess')}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background },
  content: { padding: 22, paddingBottom: 36, gap: 16 },
  topbar: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10 },
  backButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, alignItems: 'center', justifyContent: 'center' },
  backText: { color: palette.ink, fontSize: 28, lineHeight: 32 },
  topbarCopy: { flex: 1, gap: 2 },
  kicker: { color: palette.primary, fontSize: 10, fontWeight: '800' },
  topbarTitle: { color: palette.ink, fontSize: 17, fontWeight: '900' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radii.pill, backgroundColor: palette.goldTint, paddingHorizontal: 8, paddingVertical: 6 },
  statusBadgeActive: { backgroundColor: palette.primaryTint },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#B17C2F' },
  statusDotActive: { backgroundColor: palette.primary },
  statusLabel: { color: '#8F6528', fontSize: 9, fontWeight: '800' },
  statusLabelActive: { color: palette.primaryDark },
  identityCard: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72, padding: 13, borderRadius: 18, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line },
  avatar: { width: 45, height: 45, borderRadius: 16, backgroundColor: palette.primaryTint, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: palette.primary, fontSize: 18, fontWeight: '900' },
  identityCopy: { gap: 4 },
  identityName: { color: palette.ink, fontSize: 14, fontWeight: '800' },
  identityPhone: { color: palette.muted, fontSize: 11 },
  shareButton: { minHeight: 38, borderRadius: 12, paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primaryTint },
  shareButtonText: { color: palette.primaryDark, fontSize: 10, fontWeight: '800' },
  balanceCard: { minHeight: 170, borderRadius: radii.card, backgroundColor: palette.primaryDark, padding: 19, gap: 8 },
  balanceLabel: { color: '#C5DFD2', fontSize: 11, fontWeight: '700' },
  balanceValue: { color: palette.white, fontSize: 30, lineHeight: 40, fontWeight: '900', writingDirection: 'ltr', textAlign: 'left' },
  balanceDivider: { height: 1, backgroundColor: '#39725F', marginTop: 3 },
  balanceMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  balanceMetaLabel: { color: '#C5DFD2', fontSize: 10 },
  balanceMetaValue: { color: '#F0D598', fontSize: 11, fontWeight: '800' },
  actionsRow: { flexDirection: 'row', gap: 10 },
  actionButton: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, backgroundColor: palette.primary, paddingHorizontal: 9 },
  actionButtonPayment: { backgroundColor: '#E8C779' },
  actionSymbol: { color: palette.white, fontSize: 21, fontWeight: '700' },
  actionSymbolPayment: { color: '#77531E' },
  actionText: { color: palette.white, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  limitCard: { gap: 12, padding: 15, borderRadius: 19, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line },
  sectionHeader: { flexDirection: 'row', alignItems: 'center' },
  sectionTitle: { color: palette.ink, fontSize: 17, fontWeight: '900' },
  sectionSubtitle: { color: palette.muted, fontSize: 10, lineHeight: 15, marginTop: 3 },
  limitRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, borderRadius: 14, backgroundColor: palette.background, borderWidth: 1, borderColor: palette.line },
  limitInput: { flex: 1, color: palette.ink, fontSize: 16, fontWeight: '800', paddingVertical: 8 },
  limitCurrency: { color: palette.primary, fontSize: 11, fontWeight: '800' },
  saveButton: { minHeight: 45, borderRadius: 13, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  saveButtonText: { color: palette.white, fontSize: 12, fontWeight: '800' },
  historyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 4 },
  historyCount: { color: palette.primary, fontSize: 11, fontWeight: '800', backgroundColor: palette.primaryTint, overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 4, borderRadius: radii.pill },
  emptyCard: { minHeight: 75, justifyContent: 'center', padding: 15, borderRadius: 16, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line },
  emptyText: { color: palette.muted, fontSize: 11, lineHeight: 17 },
  transactionCard: { minHeight: 85, flexDirection: 'row', alignItems: 'center', gap: 9, padding: 11, borderRadius: 17, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line },
  transactionIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: palette.dangerTint, alignItems: 'center', justifyContent: 'center' },
  paymentIcon: { backgroundColor: palette.primaryTint },
  disputedIcon: { backgroundColor: '#F9E6E3' },
  transactionSymbol: { color: palette.danger, fontSize: 20, fontWeight: '700' },
  paymentSymbol: { color: palette.primary },
  disputedSymbol: { color: palette.danger },
  transactionCopy: { flex: 1, gap: 4 },
  transactionHead: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  transactionKind: { color: palette.ink, fontSize: 11, fontWeight: '800' },
  transactionStatus: { color: palette.primary, fontSize: 9, fontWeight: '700' },
  disputedText: { color: palette.danger },
  transactionDescription: { color: palette.muted, fontSize: 10, lineHeight: 14 },
  transactionDate: { color: '#929E95', fontSize: 9 },
  transactionAmount: { maxWidth: 100, color: palette.ink, fontSize: 10, fontWeight: '800', textAlign: 'right' },
  moreButton: { minHeight: 47, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface },
  moreButtonText: { color: palette.primary, fontSize: 11, fontWeight: '800' },
  readOnlyNote: { color: palette.muted, fontSize: 10, lineHeight: 16, textAlign: 'center' },
  missingState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  missingTitle: { color: palette.ink, fontSize: 17, fontWeight: '800' },
  backAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 18, borderRadius: 14, backgroundColor: palette.primary },
  backActionText: { color: palette.white, fontWeight: '800' },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.45 },
});
