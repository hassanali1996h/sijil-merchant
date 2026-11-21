import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { palette, radii } from '@debt/shared';
import type { PurchasesPackage } from 'react-native-purchases';
import { loadAvailablePackages, preparePurchases, Purchases, syncServerEntitlement } from '../src/lib/purchases';

type ScreenState = 'loading' | 'ready' | 'empty' | 'missing_key' | 'web_unsupported' | 'signed_out' | 'error';

const productOrder = ['merchant_monthly', 'merchant_6_months', 'merchant_annual'];
const productNameKeys: Record<string, string> = {
  merchant_monthly: 'subscription.monthly',
  merchant_6_months: 'subscription.sixMonths',
  merchant_annual: 'subscription.annual',
};

function nameForProduct(product: PurchasesPackage['product'], t: (key: string) => string): string {
  const identifier = product.identifier.split('.').pop() ?? product.identifier;
  const key = productNameKeys[identifier];
  return key ? t(key) : product.title || identifier;
}

export default function MerchantSubscriptionScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [screenState, setScreenState] = useState<ScreenState>('loading');
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const loadOffers = useCallback(async () => {
    setScreenState('loading');
    const setup = await preparePurchases().catch(() => 'error' as const);
    if (setup !== 'ready') {
      setScreenState(setup);
      return;
    }
    try {
      const available = await loadAvailablePackages();
      const sorted = [...available].sort((a, b) => {
        const aId = a.product.identifier.split('.').pop() ?? a.product.identifier;
        const bId = b.product.identifier.split('.').pop() ?? b.product.identifier;
        const aIndex = productOrder.indexOf(aId);
        const bIndex = productOrder.indexOf(bId);
        return (aIndex < 0 ? productOrder.length : aIndex) - (bIndex < 0 ? productOrder.length : bIndex);
      });
      setPackages(sorted);
      setScreenState(sorted.length ? 'ready' : 'empty');
    } catch {
      setScreenState('error');
    }
  }, []);

  useEffect(() => { void loadOffers(); }, [loadOffers]);

  const finishStoreAction = useCallback(async (successKey: 'purchaseSuccess' | 'restoreSuccess') => {
    try {
      const result = await syncServerEntitlement();
      if (result.active) {
        Alert.alert(t('subscription.title'), t(`subscription.${successKey}`));
        router.replace('/home');
      } else {
        Alert.alert(t('subscription.title'), t('subscription.syncPending'));
      }
    } catch {
      Alert.alert(t('subscription.title'), t('subscription.syncPending'));
    }
  }, [router, t]);

  async function buy(item: PurchasesPackage) {
    setBusy(item.identifier);
    try {
      await Purchases.purchasePackage(item);
      await finishStoreAction('purchaseSuccess');
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
      if (code !== Purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
        Alert.alert(t('common.error'), t('subscription.purchaseError'));
      }
    } finally {
      setBusy(null);
    }
  }

  async function restore() {
    setBusy('restore');
    try {
      const customerInfo = await Purchases.restorePurchases();
      if (!customerInfo.entitlements.active.merchant_pro) {
        const serverState = await syncServerEntitlement().catch(() => null);
        if (!serverState?.active) {
          Alert.alert(t('subscription.title'), t('subscription.nothingToRestore'));
          return;
        }
      }
      await finishStoreAction('restoreSuccess');
    } catch {
      Alert.alert(t('common.error'), t('subscription.purchaseError'));
    } finally {
      setBusy(null);
    }
  }

  async function manageSubscription() {
    setBusy('manage');
    try {
      await Purchases.showManageSubscriptions();
    } catch {
      Alert.alert(t('common.error'), t('subscription.purchaseError'));
    } finally {
      setBusy(null);
    }
  }

  const statusKey = screenState === 'loading' ? 'loadingOffers'
    : screenState === 'empty' ? 'noOffers'
      : screenState === 'missing_key' ? 'setupPending'
        : screenState === 'web_unsupported' ? 'webUnsupported'
          : screenState === 'signed_out' ? 'signedOut'
            : screenState === 'error' ? 'loadError' : null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topbar}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <Text style={styles.topTitle}>{t('merchant.subscribe')}</Text>
          <View style={styles.topSpacer} />
        </View>

        <View style={styles.hero}>
          <View style={styles.heroMark}><View style={styles.heroMarkInner} /><Text style={styles.heroCheck}>✓</Text></View>
          <Text style={styles.title}>{t('subscription.title')}</Text>
          <Text style={styles.intro}>{t('subscription.intro')}</Text>
        </View>

        {screenState === 'ready' ? (
          <View style={styles.planList}>
            {packages.map((item) => {
              const isBusy = busy === item.identifier;
              return (
                <View key={item.identifier} style={styles.planCard}>
                  <View style={styles.planTop}>
                    <Text style={styles.planTitle}>{nameForProduct(item.product, t)}</Text>
                    <Text style={styles.price}>{item.product.priceString}</Text>
                  </View>
                  <Text style={styles.productName}>{item.product.title}</Text>
                  <Pressable accessibilityRole="button" disabled={busy !== null} onPress={() => void buy(item)} style={({ pressed }) => [styles.buyButton, pressed && styles.pressed, busy !== null && styles.disabled]}>
                    {isBusy ? <ActivityIndicator color={palette.white} /> : <Text style={styles.buyText}>{t('subscription.purchase')}</Text>}
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.statusCard}>
            {screenState === 'loading' && <ActivityIndicator color={palette.primary} />}
            {statusKey && <Text style={styles.statusText}>{t(`subscription.${statusKey}`)}</Text>}
            {(screenState === 'empty' || screenState === 'error') && (
              <Pressable accessibilityRole="button" onPress={() => void loadOffers()} style={styles.retryButton}>
                <Text style={styles.retryText}>{t('subscription.refresh')}</Text>
              </Pressable>
            )}
          </View>
        )}

        <View style={styles.termsCard}>
          <Text style={styles.termsLabel}>{t('subscription.priceFromStore')}</Text>
          <Text style={styles.terms}>{t('subscription.autoRenew')}</Text>
        </View>

        {screenState === 'ready' && (
          <View style={styles.secondaryActions}>
            <Pressable accessibilityRole="button" disabled={busy !== null} onPress={() => void restore()} style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>{busy === 'restore' ? t('common.loading') : t('subscription.restore')}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={busy !== null} onPress={() => void manageSubscription()} style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>{t('subscription.manage')}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  content: { flexGrow: 1, paddingBottom: 28 },
  topbar: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  backButton: { width: 40, height: 40, borderRadius: 14, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.line },
  backText: { color: palette.ink, fontSize: 27, lineHeight: 30, fontWeight: '700' },
  topTitle: { color: palette.ink, fontSize: 13, fontWeight: '800' },
  topSpacer: { width: 40 },
  hero: { alignItems: 'center', paddingHorizontal: 28, paddingTop: 20, paddingBottom: 25, gap: 11 },
  heroMark: { width: 74, height: 74, borderRadius: 25, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 6, transform: [{ rotate: '-4deg' }] },
  heroMarkInner: { width: 29, height: 36, borderRadius: 9, borderWidth: 2, borderColor: '#D9ECE2' },
  heroCheck: { position: 'absolute', bottom: 5, right: 5, width: 28, height: 28, overflow: 'hidden', borderRadius: 14, textAlign: 'center', textAlignVertical: 'center', color: palette.ink, fontSize: 17, fontWeight: '900', backgroundColor: palette.gold },
  title: { color: palette.ink, fontSize: 24, lineHeight: 32, fontWeight: '900', textAlign: 'center' },
  intro: { maxWidth: 340, color: palette.muted, fontSize: 13, lineHeight: 21, textAlign: 'center' },
  planList: { paddingHorizontal: 20, gap: 12 },
  planCard: { padding: 16, gap: 9, borderRadius: 21, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line },
  planTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  planTitle: { color: palette.ink, fontSize: 16, fontWeight: '900' },
  price: { color: palette.primaryDark, fontSize: 18, fontWeight: '900' },
  productName: { color: palette.muted, fontSize: 11 },
  buyButton: { minHeight: 48, borderRadius: radii.control, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.55 },
  buyText: { color: palette.white, fontSize: 13, fontWeight: '900' },
  statusCard: { minHeight: 106, marginHorizontal: 20, padding: 18, borderRadius: 19, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, alignItems: 'center', justifyContent: 'center', gap: 13 },
  statusText: { color: palette.muted, fontSize: 12, lineHeight: 19, textAlign: 'center' },
  retryButton: { paddingVertical: 9, paddingHorizontal: 15, borderRadius: 12, backgroundColor: palette.primaryTint },
  retryText: { color: palette.primaryDark, fontSize: 11, fontWeight: '800' },
  termsCard: { marginHorizontal: 20, marginTop: 16, padding: 15, borderRadius: 18, backgroundColor: palette.goldTint, gap: 7 },
  termsLabel: { color: palette.ink, fontSize: 11, fontWeight: '900' },
  terms: { color: palette.muted, fontSize: 10, lineHeight: 17 },
  secondaryActions: { flexDirection: 'row', justifyContent: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 15 },
  secondaryButton: { minHeight: 42, flex: 1, maxWidth: 190, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface },
  secondaryText: { color: palette.primaryDark, fontSize: 11, fontWeight: '800' },
});
