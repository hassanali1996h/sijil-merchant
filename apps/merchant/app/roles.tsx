import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { palette, radii } from '@debt/shared';
import { isPreviewMode, supabase } from '../src/lib/supabase';
import { LanguageControl } from '../src/components/LanguageControl';

export default function ChooseRoleScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [checking, setChecking] = useState(!isPreviewMode);
  useEffect(() => {
    if (isPreviewMode) return;
    let active = true;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      setChecking(false);
      if (error || !data.session) router.replace('/sign-in');
    }).catch(() => { if (active) { setChecking(false); router.replace('/sign-in'); } });
    return () => { active = false; };
  }, [router]);
  if (checking) return <View style={styles.center}><ActivityIndicator color={palette.primary} /></View>;
  return <SafeAreaView style={styles.safe}>
    <View style={styles.top}><Text style={styles.brand}>{t('app.merchantName')}</Text><LanguageControl /></View>
    <View style={styles.body}>
      <Text style={styles.title}>{t('merged.chooseRole')}</Text>
      <Text style={styles.intro}>{t('merged.intro')}</Text>
      <Pressable accessibilityRole="button" onPress={() => router.replace('/client/home')} style={styles.card}>
        <Text style={styles.cardTitle}>{t('merged.customer')}</Text>
        <Text style={styles.cardText}>{t('merged.customerDetails')}</Text>
        <Text style={styles.free}>{t('merged.customerFree')}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.replace('/home')} style={styles.card}>
        <Text style={styles.cardTitle}>{t('merged.merchant')}</Text>
        <Text style={styles.cardText}>{t('merged.merchantDetails')}</Text>
        <Text style={styles.cardNote}>{t('merged.merchantTrial')}</Text>
      </Pressable>
    </View>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:palette.background},
  center:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:palette.background},
  top:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:24,paddingTop:16},
  brand:{fontSize:22,fontWeight:'900',color:palette.primary},
  body:{flex:1,justifyContent:'center',paddingHorizontal:24,gap:18},
  title:{fontSize:27,lineHeight:38,fontWeight:'900',color:palette.ink,textAlign:'center'},
  intro:{fontSize:15,lineHeight:26,color:palette.muted,textAlign:'center',marginBottom:8},
  card:{padding:24,minHeight:156,borderRadius:radii.control,backgroundColor:palette.surface,borderWidth:1,borderColor:palette.line,gap:12},
  cardTitle:{fontSize:20,fontWeight:'900',color:palette.ink},
  cardText:{fontSize:14,lineHeight:24,color:palette.muted},
  free:{fontSize:14,fontWeight:'800',color:palette.primary},
  cardNote:{fontSize:13,fontWeight:'800',color:palette.ink},
});
