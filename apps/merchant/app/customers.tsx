import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { getMerchantAccessState, palette, radii } from '@debt/shared';
import { supabase } from '../src/lib/supabase';

type CustomerLink = { id: string; customer_display_name: string; customer_phone_e164: string | null; customer_email: string | null; credit_limit_iqd: number | string; status: string; created_at: string };
const PAGE_SIZE = 30;

export default function MerchantCustomersScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [customers, setCustomers] = useState<CustomerLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [canWrite, setCanWrite] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAppliedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: business, error: businessError } = await supabase.from('businesses').select('id').maybeSingle();
    if (businessError || !business) {
      if (businessError) Alert.alert(t('common.error'), businessError.message);
      setCustomers([]);
      setTotalCount(0);
      setCanWrite(false);
      setLoading(false);
      return;
    }

    const { data: entitlement, error: entitlementError } = await supabase.from('merchant_entitlements').select('trial_ends_at,paid_until').eq('business_id', business.id).maybeSingle();
    if (entitlementError) Alert.alert(t('common.error'), entitlementError.message);
    const entitlementRow = entitlement as { trial_ends_at: string; paid_until: string | null } | null;
    setCanWrite(!entitlementError && Boolean(entitlementRow) && getMerchantAccessState({ trialEndsAt: entitlementRow?.trial_ends_at, paidUntil: entitlementRow?.paid_until }) !== 'read_only');

    let rows: CustomerLink[] = [];
    if (appliedSearch) {
      const pattern = `%${appliedSearch.replace(/[%_]/g, '')}%`;
      const emailSearch = appliedSearch.toLowerCase().replace(/[%_]/g, '');
      const base = () => supabase.from('customer_links').select('id,customer_display_name,customer_email,customer_phone_e164,credit_limit_iqd,status,created_at').eq('business_id', business.id).order('created_at', { ascending: false }).limit(PAGE_SIZE);
      const [{ data: byName }, { data: byEmail }] = await Promise.all([
        base().ilike('customer_display_name', pattern),
        base().ilike('customer_email', `%${emailSearch}%`),
      ]);
      const unique = new Map<string, CustomerLink>();
      for (const row of [...(byName ?? []), ...(byEmail ?? [])] as CustomerLink[]) unique.set(row.id, row);
      rows = [...unique.values()].sort((left, right) => right.created_at.localeCompare(left.created_at));
      setHasMore(false);
      setTotalCount(rows.length);
    } else {
      const { data, count, error } = await supabase.from('customer_links')
        .select('id,customer_display_name,customer_email,customer_phone_e164,credit_limit_iqd,status,created_at', { count: 'exact' })
        .eq('business_id', business.id)
        .order('created_at', { ascending: false })
        .range(0, PAGE_SIZE - 1);
      if (error) {
        Alert.alert(t('common.error'), error.message);
        setCustomers([]);
        setLoading(false);
        return;
      }
      rows = (data ?? []) as CustomerLink[];
      setHasMore(rows.length === PAGE_SIZE);
      setTotalCount(count ?? rows.length);
    }
    setCustomers(rows);
    setLoading(false);
  }, [appliedSearch, t]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function loadMore() {
    if (loadingMore || !hasMore || appliedSearch) return;
    setLoadingMore(true);
    const { data: business } = await supabase.from('businesses').select('id').maybeSingle();
    if (!business) {
      setLoadingMore(false);
      return;
    }
    const start = customers.length;
    const { data, error } = await supabase.from('customer_links')
      .select('id,customer_display_name,customer_email,customer_phone_e164,credit_limit_iqd,status,created_at')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false })
      .range(start, start + PAGE_SIZE - 1);
    if (error) Alert.alert(t('common.error'), error.message);
    if (!error) {
      const rows = (data ?? []) as CustomerLink[];
      setCustomers((current) => [...current, ...rows]);
      setHasMore(rows.length === PAGE_SIZE);
    }
    setLoadingMore(false);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.topbar}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable>
          <View style={styles.titleCopy}><Text style={styles.kicker}>{t('merchant.dashboard')}</Text><Text style={styles.title}>{t('merchant.customersDirectory')}</Text></View>
          <Text style={styles.countPill}>{totalCount}</Text>
        </View>

        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput value={search} onChangeText={setSearch} placeholder={t('merchant.searchCustomers')} placeholderTextColor={palette.muted} style={styles.searchInput} returnKeyType="search" />
          {search.length > 0 && <Pressable accessibilityRole="button" accessibilityLabel={t('common.cancel')} onPress={() => setSearch('')}><Text style={styles.clearSearch}>×</Text></Pressable>}
        </View>

        <Pressable disabled={!canWrite} onPress={() => router.push('/add-customer')} style={({ pressed }) => [styles.addButton, pressed && styles.pressed, !canWrite && styles.disabled]}>
          <Text style={styles.addPlus}>+</Text><Text style={styles.addText}>{t('merchant.addCustomer')}</Text>
        </Pressable>

        <View style={styles.listHeader}><Text style={styles.listTitle}>{appliedSearch ? t('merchant.searchCustomers') : t('merchant.customers')}</Text><Text style={styles.listCount}>{customers.length}{!appliedSearch ? ` / ${totalCount}` : ''}</Text></View>

        {loading ? <ActivityIndicator color={palette.primary} style={styles.loader} /> : customers.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}><Text style={styles.emptyIconText}>⌕</Text></View>
            <Text style={styles.emptyText}>{appliedSearch ? t('merchant.noMatchingCustomers') : t('merchant.noCustomers')}</Text>
          </View>
        ) : customers.map((customer) => (
          <Pressable key={customer.id} onPress={() => router.push({ pathname: '/customer/[linkId]', params: { linkId: customer.id } })} style={({ pressed }) => [styles.customerCard, pressed && styles.pressed]}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{customer.customer_display_name.trim().charAt(0)}</Text></View>
            <View style={styles.customerCopy}>
              <Text numberOfLines={1} style={styles.customerName}>{!customer.customer_phone_e164 && !customer.customer_email ? t('account.deletedAccount') : customer.customer_display_name}</Text>
              <Text style={styles.phone}>{customer.customer_email}</Text>
            </View>
            <View style={styles.customerStatus}>
              <View style={[styles.statusDot, customer.status === 'active' && styles.statusDotActive]} />
              <Text style={[styles.statusText, customer.status === 'active' && styles.statusTextActive]}>{!customer.customer_phone_e164 && !customer.customer_email ? t('account.deletedAccount') : customer.status === 'active' ? t('merchant.customerActive') : t('merchant.customerInvited')}</Text>
            </View>
            <Text style={styles.chevron}>‹</Text>
          </Pressable>
        ))}

        {hasMore && !appliedSearch && (
          <Pressable disabled={loadingMore} onPress={() => void loadMore()} style={styles.moreButton}>
            {loadingMore ? <ActivityIndicator color={palette.primary} /> : <Text style={styles.moreButtonText}>{t('customer.loadMore')}</Text>}
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  content: { padding: 22, paddingBottom: 35, gap: 15 },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54 },
  backButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, alignItems: 'center', justifyContent: 'center' },
  backText: { color: palette.ink, fontSize: 28, lineHeight: 32 },
  titleCopy: { flex: 1, gap: 2 },
  kicker: { color: palette.primary, fontSize: 10, fontWeight: '800' },
  title: { color: palette.ink, fontSize: 22, fontWeight: '900' },
  countPill: { color: palette.primary, fontSize: 11, fontWeight: '800', backgroundColor: palette.primaryTint, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.pill },
  searchBox: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 13, borderRadius: 16, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line },
  searchIcon: { color: palette.muted, fontSize: 24, lineHeight: 28 },
  searchInput: { flex: 1, color: palette.ink, fontSize: 13, paddingVertical: 10 },
  clearSearch: { color: palette.muted, fontSize: 22, paddingHorizontal: 5 },
  addButton: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 15, backgroundColor: palette.primary },
  addPlus: { color: palette.white, fontSize: 22 },
  addText: { color: palette.white, fontSize: 12, fontWeight: '800' },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  listTitle: { color: palette.ink, fontSize: 16, fontWeight: '900' },
  listCount: { color: palette.muted, fontSize: 10, fontWeight: '700' },
  loader: { minHeight: 120 },
  emptyCard: { minHeight: 135, alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 20, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, padding: 18 },
  emptyIcon: { width: 42, height: 42, borderRadius: 15, backgroundColor: palette.primaryTint, alignItems: 'center', justifyContent: 'center' },
  emptyIconText: { color: palette.primary, fontSize: 23 },
  emptyText: { color: palette.muted, fontSize: 12, textAlign: 'center' },
  customerCard: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 18, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line },
  avatar: { width: 42, height: 42, borderRadius: 15, backgroundColor: palette.primaryTint, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: palette.primary, fontSize: 16, fontWeight: '900' },
  customerCopy: { flex: 1, gap: 4, minWidth: 0 },
  customerName: { color: palette.ink, fontSize: 12, fontWeight: '800' },
  phone: { color: palette.muted, fontSize: 10 },
  customerStatus: { alignItems: 'flex-end', gap: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#B17C2F' },
  statusDotActive: { backgroundColor: palette.primary },
  statusText: { color: '#8F6528', fontSize: 9, fontWeight: '700' },
  statusTextActive: { color: palette.primary },
  chevron: { color: palette.muted, fontSize: 22, marginStart: 2 },
  moreButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line },
  moreButtonText: { color: palette.primary, fontSize: 11, fontWeight: '800' },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.5 },
});
