import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { formatIqd, getMerchantAccessState, palette, radii, type MerchantAccessState } from '@debt/shared';
import { isPreviewMode, supabase } from '../src/lib/supabase';
import { registerMerchantDevice } from '../src/lib/device';
import { requestAndRegisterPushToken, syncGrantedPushToken } from '../src/lib/notifications';
import { LanguageControl } from '../src/components/LanguageControl';

type Business = { id: string; name: string };
type CustomerLink = { id: string; customer_display_name: string; customer_phone_e164: string | null; customer_email?: string | null; credit_limit_iqd: number | string; status: string; confirmed_balance_iqd?: number | string; pending_debt_iqd?: number | string };
type LedgerTransaction = { id: string; kind: 'debt' | 'payment'; amount_iqd: number | string; status: string; created_at: string; customer_link_id: string };

export default function MerchantHomeScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [businessName, setBusinessName] = useState('');
  const [business, setBusiness] = useState<Business | null>(null);
  const [links, setLinks] = useState<CustomerLink[]>([]);
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [access, setAccess] = useState<MerchantAccessState>('read_only');
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [paidUntil, setPaidUntil] = useState<string | null>(null);
  const [savingBusiness, setSavingBusiness] = useState(false);
  const [pushStatus, setPushStatus] = useState<string>('permission_needed');

  useEffect(() => {
    let active = true;
    void syncGrantedPushToken(t('notifications.channel')).then((status) => {
      if (active) setPushStatus(status);
    });
    return () => { active = false; };
  }, [t]);

  async function blockForDevice(messageKey: 'auth.deviceOtpBody' | 'auth.deviceBoundElsewhere' | 'auth.deviceCheckFailed') {
    await supabase.auth.signOut();
    setBusiness(null);
    setLinks([]);
    setTransactions([]);
    setPendingCount(0);
    setLoading(false);
    Alert.alert(t('auth.deviceOtpTitle'), t(messageKey), [
      { text: t('auth.signInTitle'), onPress: () => router.replace('/sign-in') },
    ]);
  }

  const load = useCallback(async () => {
    setLoading(true);
    if (isPreviewMode) {
      setBusiness({ id: '00000000-0000-4000-8000-000000000001', name: 'متجر التجربة' });
      setLinks([
        { id: '00000000-0000-4000-8000-000000000011', customer_display_name: 'عميل تجريبي', customer_phone_e164: '+9647500000000', credit_limit_iqd: 250000, status: 'active', confirmed_balance_iqd: 45000 },
        { id: '00000000-0000-4000-8000-000000000012', customer_display_name: 'طلب ربط جديد', customer_phone_e164: '+9647510000000', credit_limit_iqd: 100000, status: 'invited' },
      ]);
      setTransactions([{ id: '00000000-0000-4000-8000-000000000021', kind: 'debt', amount_iqd: 45000, status: 'pending', created_at: new Date().toISOString(), customer_link_id: '00000000-0000-4000-8000-000000000011' }]);
      setPendingCount(1);
      setAccess('trial');
      setTrialEndsAt(new Date(Date.now() + 29 * 86_400_000).toISOString());
      setPaidUntil(null);
      setLoading(false);
      return;
    }
    const { data: businessData, error: businessError } = await supabase.from('businesses').select('id,name').maybeSingle();
    if (businessError) {
      Alert.alert(t('common.error'), businessError.message);
      setBusiness(null);
      setLoading(false);
      return;
    }
    const currentBusiness = (businessData ?? null) as Business | null;
    if (currentBusiness) {
      const registration = await registerMerchantDevice();
      if (registration.error) {
        await blockForDevice('auth.deviceCheckFailed');
        return;
      }
      if (registration.status === 'fresh_otp_required') {
        await blockForDevice('auth.deviceOtpBody');
        return;
      }
      if (registration.status === 'installation_bound_to_another_account' || registration.status === 'not_merchant' || registration.status === null) {
        await blockForDevice('auth.deviceBoundElsewhere');
        return;
      }
    }
    setBusiness(currentBusiness);
    if (!currentBusiness) {
      setLinks([]);
      setTransactions([]);
      setPendingCount(0);
      setAccess('read_only');
      setTrialEndsAt(null);
      setPaidUntil(null);
      setLoading(false);
      return;
    }

    const [entitlementResponse, customerResponse, pendingResponse, transactionResponse] = await Promise.all([
      supabase.from('merchant_entitlements').select('trial_ends_at,paid_until').eq('business_id', currentBusiness.id).maybeSingle(),
      supabase.from('customer_links').select('id,customer_display_name,customer_email,customer_phone_e164,credit_limit_iqd,status').eq('business_id', currentBusiness.id).order('created_at', { ascending: false }),
      supabase.from('ledger_transactions').select('id', { count: 'exact', head: true }).eq('business_id', currentBusiness.id).eq('status', 'pending'),
      supabase.from('ledger_transactions').select('id,kind,amount_iqd,status,created_at,customer_link_id').eq('business_id', currentBusiness.id).order('created_at', { ascending: false }).limit(5),
    ]);

    if (entitlementResponse.error) Alert.alert(t('common.error'), entitlementResponse.error.message);
    if (customerResponse.error) Alert.alert(t('common.error'), customerResponse.error.message);
    if (pendingResponse.error) Alert.alert(t('common.error'), pendingResponse.error.message);
    if (transactionResponse.error) Alert.alert(t('common.error'), transactionResponse.error.message);

    const entitlement = entitlementResponse.data as { trial_ends_at: string; paid_until: string | null } | null;
    const nextTrialEnd = entitlement?.trial_ends_at ?? null;
    const nextPaidUntil = entitlement?.paid_until ?? null;
    setTrialEndsAt(nextTrialEnd);
    setPaidUntil(nextPaidUntil);
    setAccess(entitlement ? getMerchantAccessState({ trialEndsAt: nextTrialEnd, paidUntil: nextPaidUntil }) : 'read_only');
    const customerRows = (customerResponse.data ?? []) as CustomerLink[];
    const balanceRows = await Promise.all(customerRows.filter((link) => link.status === 'active').slice(0, 5).map(async (link) => {
      const { data } = await supabase.rpc('get_customer_balance', { p_link_id: link.id });
      const balance = Array.isArray(data) ? data[0] : data;
      return balance ? [link.id, balance] as const : null;
    }));
    const balanceByLink = new Map(balanceRows.filter((row): row is NonNullable<typeof row> => row !== null));
    setLinks(customerRows.map((link) => ({ ...link, ...(balanceByLink.get(link.id) ?? {}) })));
    setPendingCount(pendingResponse.count ?? 0);
    setTransactions((transactionResponse.data ?? []) as LedgerTransaction[]);
    setLoading(false);
  }, [t]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function createBusiness() {
    if (businessName.trim().length < 2 || businessName.trim().length > 120) {
      Alert.alert(t('common.error'), t('merchant.shopName'));
      return;
    }
    if (isPreviewMode) {
      setBusiness({ id: '00000000-0000-4000-8000-000000000001', name: businessName.trim() });
      setBusinessName('');
      return;
    }
    setSavingBusiness(true);
    const { error } = await supabase.rpc('create_business', { p_name: businessName.trim() });
    setSavingBusiness(false);
    if (error) {
      Alert.alert(t('common.error'), error.message);
      return;
    }
    setBusinessName('');
    await load();
  }

  async function enableNotifications() {
    const status = await requestAndRegisterPushToken(t('notifications.channel'));
    setPushStatus(status);
    const messageKey = status === 'registered' ? 'notifications.enabled'
      : status === 'permission_denied' ? 'notifications.permissionDenied'
        : status === 'permission_needed' ? 'notifications.permissionNeeded'
          : status === 'error' ? 'notifications.error' : 'notifications.setupPending';
    Alert.alert(t('notifications.title'), t(messageKey));
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={palette.primary} /></View>;
  const locale = i18n.resolvedLanguage === 'ckb' ? 'ckb-IQ' : 'ar-IQ';
  const customerNames = new Map(links.map((link) => [link.id, link.customer_display_name]));
  const daysRemaining = trialEndsAt ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86_400_000)) : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topbar}>
          <View style={styles.brand}>
            <View style={styles.brandMark}><View style={styles.brandMarkInner} /></View>
            <View>
              <Text style={styles.brandName}>{t('merchant.dashboard')}</Text>
              <Text style={styles.brandCaption}>{business?.name ?? t('app.merchantName')}</Text>
            </View>
          </View>
          <View style={styles.topActions}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('merged.changeRole')} onPress={() => router.push('/roles')} style={{backgroundColor:palette.primaryTint,borderRadius:12,paddingHorizontal:10,paddingVertical:8}}><Text style={{color:palette.primary,fontWeight:'800'}}>{t('merged.changeRole')}</Text></Pressable>
            <LanguageControl />
            <Pressable accessibilityRole="button" accessibilityLabel={t('common.settings')} onPress={() => router.push('/settings')} style={styles.profileButton}>
              <Text style={styles.profileInitial}>{business?.name?.trim().charAt(0) || '•'}</Text>
            </Pressable>
          </View>
        </View>

        {!business ? (
          <>
            <View style={styles.welcomeCopy}>
              <Text style={styles.eyebrow}>{t('app.welcome')}</Text>
              <Text style={styles.pageTitle}>{t('merchant.homeGreeting')}</Text>
              <Text style={styles.subhead}>{t('merchant.createShopPrompt')}</Text>
            </View>
            <View style={styles.setupCard}>
              <View style={styles.setupIcon}><Text style={styles.setupIconText}>+</Text></View>
              <Text style={styles.setupTitle}>{t('merchant.shopName')}</Text>
              <Text style={styles.setupDescription}>{t('merchant.createShopPrompt')}</Text>
              <TextInput
                value={businessName}
                onChangeText={setBusinessName}
                style={styles.input}
                placeholder={t('merchant.businessNameHint')}
                placeholderTextColor={palette.muted}
                maxLength={120}
                returnKeyType="done"
                onSubmitEditing={() => void createBusiness()}
              />
              <Pressable disabled={savingBusiness} onPress={() => void createBusiness()} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, savingBusiness && styles.disabled]}>
                {savingBusiness ? <ActivityIndicator color={palette.white} /> : <Text style={styles.primaryButtonText}>{t('merchant.createShop')}</Text>}
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <View style={styles.welcomeCopy}>
              <Text style={styles.eyebrow}>{t('app.welcome')}</Text>
              <Text style={styles.pageTitle}>{business.name}</Text>
              <Text style={styles.subhead}>{t('merchant.homeGreeting')}</Text>
            </View>

              <View style={[styles.accessCard, access === 'read_only' && styles.accessCardReadonly]}>
              <View style={styles.accessIcon}><Text style={styles.accessIconText}>{access === 'read_only' ? '!' : '✓'}</Text></View>
              <View style={styles.accessCopy}>
                <Text style={styles.accessTitle}>
                  {access === 'trial' ? t('merchant.trialRemaining', { days: daysRemaining }) : access === 'active' ? t('merchant.subscriptionActive') : t('merchant.readOnlyAccess')}
                </Text>
                {access === 'read_only' && <Text style={styles.accessDetail}>{t('merchant.readOnly')}</Text>}
                {access === 'trial' && <Text style={styles.accessDetail}>{t('merchant.shellNote')}</Text>}
                {access === 'active' && paidUntil && <Text style={styles.accessDetail}>{new Date(paidUntil).toLocaleDateString(locale)}</Text>}
              </View>
                {access === 'read_only' || access === 'active' ? (
                  <Pressable accessibilityRole="button" onPress={() => router.push('/subscription')} style={styles.accessAction}>
                    <Text style={styles.accessActionText}>{t(access === 'active' ? 'subscription.manage' : 'merchant.subscribe')}</Text>
                  </Pressable>
                ) : <View style={styles.accessDot} />}
            </View>

            <View style={styles.notificationCard}>
              <View style={styles.notificationIcon}><View style={styles.bellBody} /><View style={styles.bellBase} /></View>
              <View style={styles.notificationCopy}>
                <Text style={styles.notificationTitle}>{t('notifications.title')}</Text>
                <Text style={styles.notificationText}>{t(pushStatus === 'registered' ? 'notifications.enabled' : pushStatus === 'permission_denied' ? 'notifications.permissionDenied' : pushStatus === 'error' ? 'notifications.error' : pushStatus === 'permission_needed' ? 'notifications.permissionNeeded' : 'notifications.setupPending')}</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => void enableNotifications()} style={styles.notificationButton}>
                <Text style={styles.notificationButtonText}>{t('notifications.enable')}</Text>
              </Pressable>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{t('merchant.customerCount')}</Text>
                <View style={styles.statValueRow}><Text style={styles.statValue}>{links.filter((link) => link.status === 'active').length}</Text><Text style={styles.statSuffix}>{t('merchant.customerActive')}</Text></View>
                <View style={styles.statDecor}><View style={styles.statDecorInner} /></View>
              </View>
              <View style={[styles.statCard, styles.statCardGold]}>
                <Text style={styles.statLabel}>{t('merchant.pendingCount')}</Text>
                <View style={styles.statValueRow}><Text style={styles.statValue}>{pendingCount}</Text><Text style={styles.statSuffix}>{t('transaction.pendingStatus')}</Text></View>
                <View style={styles.statDecorGold}><View style={styles.statDecorGoldInner} /></View>
              </View>
            </View>

            <View style={styles.actionsSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t('merchant.newDebt')}</Text>
                <Text style={styles.sectionHint}>{t('merchant.chooseKind')}</Text>
              </View>
              <View style={styles.actionRow}>
                <Pressable disabled={access === 'read_only'} onPress={() => router.push('/new-transaction?kind=debt')} style={({ pressed }) => [styles.actionCard, pressed && styles.pressed, access === 'read_only' && styles.disabled]}>
                  <View style={styles.actionIcon}><Text style={styles.actionIconText}>−</Text></View>
                  <Text style={styles.actionTitle}>{t('merchant.newDebt')}</Text>
                  <Text style={styles.actionSubtitle}>{t('transaction.debt')}</Text>
                </Pressable>
                <Pressable disabled={access === 'read_only'} onPress={() => router.push('/new-transaction?kind=payment')} style={({ pressed }) => [styles.actionCard, pressed && styles.pressed, access === 'read_only' && styles.disabled]}>
                  <View style={[styles.actionIcon, styles.actionIconGold]}><Text style={[styles.actionIconText, styles.actionIconTextGold]}>+</Text></View>
                  <Text style={styles.actionTitle}>{t('merchant.newPayment')}</Text>
                  <Text style={styles.actionSubtitle}>{t('transaction.payment')}</Text>
                </Pressable>
              </View>
              <Pressable disabled={access === 'read_only'} onPress={() => router.push('/add-customer')} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed, access === 'read_only' && styles.disabled]}>
                <Text style={styles.secondaryPlus}>+</Text>
                <Text style={styles.secondaryText}>{t('merchant.addCustomer')}</Text>
                <Text style={styles.secondaryArrow}>‹</Text>
              </Pressable>
            </View>

            <View style={styles.listSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t('merchant.customers')}</Text>
                {links.length > 0 && <Pressable accessibilityRole="button" onPress={() => router.push('/customers')}><Text style={styles.viewAll}>{t('merchant.viewAll')}</Text></Pressable>}
                <Text style={styles.countPill}>{links.length}</Text>
              </View>
              {links.length === 0 ? (
                <View style={styles.emptyCard}>
                  <View style={styles.emptyIcon}><Text style={styles.emptyIconText}>＋</Text></View>
                  <Text style={styles.emptyTitle}>{t('merchant.noCustomers')}</Text>
                  <Text style={styles.emptyText}>{t('merchant.createShopPrompt')}</Text>
                  <Pressable disabled={access === 'read_only'} onPress={() => router.push('/add-customer')} style={styles.emptyButton}><Text style={styles.emptyButtonText}>{t('merchant.addFirstCustomer')}</Text></Pressable>
                </View>
              ) : links.slice(0, 5).map((link) => (
                <Pressable key={link.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/customer/[linkId]', params: { linkId: link.id } })} style={({ pressed }) => [styles.customerRow, pressed && styles.pressed]}>
                  <View style={styles.customerAvatar}><Text style={styles.customerAvatarText}>{link.customer_display_name.trim().charAt(0)}</Text></View>
                  <View style={styles.customerCopy}>
                    <Text numberOfLines={1} style={styles.customerName}>{link.customer_display_name}</Text>
                    <Text style={styles.customerMeta}>{link.status === 'active' ? `${t('merchant.customerActive')} · ${t('merchant.balance')}: ${formatIqd(String(link.confirmed_balance_iqd ?? '0'), locale)}` : t('merchant.customerInvited')}</Text>
                  </View>
                  <View style={styles.limitCopy}>
                    <Text style={styles.limitLabel}>{t('merchant.creditLimit')}</Text>
                    <Text style={styles.limitValue}>{formatIqd(String(link.credit_limit_iqd), locale)}</Text>
                  </View>
                </Pressable>
              ))}
            </View>

            <View style={styles.listSection}>
              <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{t('merchant.latestActivity')}</Text></View>
              {transactions.length === 0 ? (
                <Text style={styles.activityEmpty}>{t('merchant.noRecentActivity')}</Text>
              ) : transactions.map((transaction) => (
                <View key={transaction.id} style={styles.activityRow}>
                  <View style={[styles.activityIcon, transaction.kind === 'payment' && styles.activityIconPayment]}>
                    <Text style={[styles.activityMark, transaction.kind === 'payment' && styles.activityMarkPayment]}>{transaction.kind === 'debt' ? '−' : '+'}</Text>
                  </View>
                  <View style={styles.activityCopy}>
                    <Text numberOfLines={1} style={styles.activityName}>{customerNames.get(transaction.customer_link_id) ?? t('customer.shop')}</Text>
                    <Text style={styles.activityMeta}>{t(transaction.kind === 'debt' ? 'transaction.debt' : 'transaction.payment')} · {t(`transaction.${transaction.status === 'pending' ? 'pendingStatus' : transaction.status === 'confirmed' ? 'confirmedStatus' : transaction.status === 'disputed' ? 'disputedStatus' : 'cancelledStatus'}`)}</Text>
                  </View>
                  <Text style={styles.activityAmount}>{formatIqd(String(transaction.amount_iqd), locale)}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.footerNote}>{t('merchant.shellNote')}</Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background },
  content: { padding: 22, paddingBottom: 32, gap: 23 },
  topbar: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: 38, height: 38, borderRadius: 13, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  brandMarkInner: { width: 13, height: 19, borderRadius: 4, borderWidth: 2, borderColor: palette.white },
  brandName: { color: palette.ink, fontSize: 12, fontWeight: '800' },
  brandCaption: { color: palette.muted, fontSize: 11, marginTop: 2 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  profileButton: { width: 42, height: 42, borderRadius: 15, backgroundColor: palette.primaryTint, alignItems: 'center', justifyContent: 'center' },
  profileInitial: { color: palette.primaryDark, fontSize: 16, fontWeight: '900' },
  welcomeCopy: { gap: 6, paddingTop: 5 },
  eyebrow: { color: palette.primary, fontSize: 12, fontWeight: '800' },
  pageTitle: { color: palette.ink, fontSize: 28, lineHeight: 36, fontWeight: '900' },
  subhead: { color: palette.muted, fontSize: 14, lineHeight: 22 },
  setupCard: { borderRadius: radii.card, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, padding: 22, gap: 13, shadowColor: '#193B2B', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.04, shadowRadius: 15, elevation: 1 },
  setupIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: palette.primaryTint, alignItems: 'center', justifyContent: 'center' },
  setupIconText: { color: palette.primary, fontSize: 28, lineHeight: 31, fontWeight: '500' },
  setupTitle: { color: palette.ink, fontSize: 18, fontWeight: '900' },
  setupDescription: { color: palette.muted, fontSize: 13, lineHeight: 20 },
  input: { minHeight: 54, borderWidth: 1, borderColor: palette.line, borderRadius: radii.control, backgroundColor: palette.background, paddingHorizontal: 16, color: palette.ink, fontSize: 15 },
  primaryButton: { minHeight: 54, borderRadius: radii.control, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  primaryButtonText: { color: palette.white, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  accessCard: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, borderRadius: 19, backgroundColor: palette.primaryTint, borderWidth: 1, borderColor: '#D8E9DE' },
  accessCardReadonly: { backgroundColor: palette.goldTint, borderColor: '#F0DFBB' },
  accessIcon: { width: 36, height: 36, borderRadius: 13, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  accessIconText: { color: palette.white, fontSize: 18, fontWeight: '900' },
  accessCopy: { flex: 1, gap: 3 },
  accessTitle: { color: palette.primaryDark, fontSize: 13, lineHeight: 19, fontWeight: '800' },
  accessDetail: { color: palette.muted, fontSize: 11, lineHeight: 17 },
  accessDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.primary },
  accessAction: { minHeight: 36, borderRadius: 12, paddingHorizontal: 12, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  accessActionText: { color: palette.white, fontSize: 11, fontWeight: '800' },
  notificationCard: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 18, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line },
  notificationIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: palette.goldTint, alignItems: 'center', justifyContent: 'center' },
  bellBody: { width: 15, height: 17, borderWidth: 2, borderColor: '#9D6C27', borderTopLeftRadius: 9, borderTopRightRadius: 9, borderBottomLeftRadius: 5, borderBottomRightRadius: 5 },
  bellBase: { width: 21, height: 2, borderRadius: 1, backgroundColor: '#9D6C27', marginTop: -1 },
  notificationCopy: { flex: 1, gap: 3 },
  notificationTitle: { color: palette.ink, fontSize: 11, fontWeight: '800' },
  notificationText: { color: palette.muted, fontSize: 9, lineHeight: 14 },
  notificationButton: { minHeight: 36, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, borderRadius: 11, backgroundColor: palette.primaryTint, maxWidth: 98 },
  notificationButtonText: { color: palette.primaryDark, fontSize: 9, lineHeight: 13, fontWeight: '800', textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1, minHeight: 112, borderRadius: 21, backgroundColor: palette.primaryDark, padding: 16, justifyContent: 'space-between', overflow: 'hidden' },
  statCardGold: { backgroundColor: '#F1D79D' },
  statLabel: { color: '#D8E8DF', fontSize: 11, lineHeight: 16, fontWeight: '700' },
  statValueRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 6 },
  statValue: { color: palette.white, fontSize: 28, fontWeight: '900' },
  statSuffix: { color: '#D8E8DF', fontSize: 10, fontWeight: '700' },
  statDecor: { position: 'absolute', width: 80, height: 80, borderRadius: 40, backgroundColor: '#286E5B', right: -31, top: -29 },
  statDecorInner: { width: 46, height: 46, margin: 16, borderRadius: 23, borderWidth: 1, borderColor: '#4D8A76' },
  statDecorGold: { position: 'absolute', width: 80, height: 80, borderRadius: 40, backgroundColor: '#E7C77F', right: -31, top: -29 },
  statDecorGoldInner: { width: 46, height: 46, margin: 16, borderRadius: 23, borderWidth: 1, borderColor: '#D2AF62' },
  actionsSection: { gap: 13 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  sectionTitle: { color: palette.ink, fontSize: 18, fontWeight: '900' },
  sectionHint: { color: palette.muted, fontSize: 11, marginStart: 'auto' },
  viewAll: { color: palette.primary, fontSize: 10, fontWeight: '800' },
  actionRow: { flexDirection: 'row', gap: 12 },
  actionCard: { flex: 1, minHeight: 122, borderRadius: 20, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, padding: 15, gap: 7 },
  actionIcon: { width: 33, height: 33, borderRadius: 12, backgroundColor: palette.primaryTint, alignItems: 'center', justifyContent: 'center' },
  actionIconGold: { backgroundColor: palette.goldTint },
  actionIconText: { color: palette.primary, fontSize: 21, lineHeight: 23, fontWeight: '800' },
  actionIconTextGold: { color: '#9D6C27' },
  actionTitle: { color: palette.ink, fontSize: 13, fontWeight: '800' },
  actionSubtitle: { color: palette.muted, fontSize: 11 },
  secondaryButton: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, paddingHorizontal: 15 },
  secondaryPlus: { color: palette.primary, fontSize: 23, fontWeight: '500' },
  secondaryText: { color: palette.primaryDark, fontSize: 13, fontWeight: '800', flex: 1 },
  secondaryArrow: { color: palette.muted, fontSize: 23 },
  listSection: { gap: 13 },
  countPill: { color: palette.primary, backgroundColor: palette.primaryTint, fontSize: 11, fontWeight: '800', overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 4, borderRadius: radii.pill },
  emptyCard: { alignItems: 'center', borderRadius: 21, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, padding: 20, gap: 8 },
  emptyIcon: { width: 44, height: 44, borderRadius: 15, backgroundColor: palette.primaryTint, alignItems: 'center', justifyContent: 'center' },
  emptyIconText: { color: palette.primary, fontSize: 21, fontWeight: '800' },
  emptyTitle: { color: palette.ink, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  emptyText: { color: palette.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  emptyButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 15, borderRadius: 13, backgroundColor: palette.primary, marginTop: 4 },
  emptyButtonText: { color: palette.white, fontSize: 12, fontWeight: '800' },
  customerRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 12, borderRadius: 17, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line },
  customerAvatar: { width: 40, height: 40, borderRadius: 15, backgroundColor: palette.primaryTint, alignItems: 'center', justifyContent: 'center' },
  customerAvatarText: { color: palette.primary, fontSize: 16, fontWeight: '900' },
  customerCopy: { flex: 1, gap: 4 },
  customerName: { color: palette.ink, fontSize: 13, fontWeight: '800' },
  customerMeta: { color: palette.muted, fontSize: 10 },
  limitCopy: { alignItems: 'flex-end', gap: 3 },
  limitLabel: { color: palette.muted, fontSize: 9 },
  limitValue: { color: palette.ink, fontSize: 11, fontWeight: '800' },
  activityEmpty: { color: palette.muted, fontSize: 12, lineHeight: 19, padding: 16, backgroundColor: palette.surface, borderRadius: 16, borderWidth: 1, borderColor: palette.line },
  activityRow: { minHeight: 65, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 11, borderRadius: 16, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line },
  activityIcon: { width: 36, height: 36, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.dangerTint },
  activityIconPayment: { backgroundColor: palette.primaryTint },
  activityMark: { color: palette.danger, fontSize: 22, fontWeight: '700' },
  activityMarkPayment: { color: palette.primary },
  activityCopy: { flex: 1, gap: 4 },
  activityName: { color: palette.ink, fontSize: 12, fontWeight: '800' },
  activityMeta: { color: palette.muted, fontSize: 10 },
  activityAmount: { color: palette.ink, fontSize: 11, fontWeight: '800' },
  footerNote: { color: palette.muted, fontSize: 11, lineHeight: 18, textAlign: 'center', paddingHorizontal: 8 },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.45 },
});
