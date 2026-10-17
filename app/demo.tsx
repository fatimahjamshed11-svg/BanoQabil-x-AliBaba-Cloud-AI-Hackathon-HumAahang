import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Pressable, Text, SafeAreaView, Ionicons } from '../src/localized-ui';
import { router } from '../src/navigation';
import { createJudgeAccessClient, judgeAccessMessages, takeJudgeAccessKey, type JudgeAccessState } from '../src/judge-access-client';
import { serviceCredentials } from '../src/service-connection';
import { colors, radius, space } from '../src/theme';

export default function JudgeDemo() {
  const [state, setState] = useState<JudgeAccessState>({ phase: 'idle', message: '' });
  const key = useRef<string | null>(null), captured = useRef(false);
  const navigated = useRef(false);
  const client = useRef<ReturnType<typeof createJudgeAccessClient> | null>(null);
  useEffect(() => {
    if (!captured.current) {
      captured.current = true;
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        try { key.current = takeJudgeAccessKey(window.location, url => window.history.replaceState(window.history.state, '', url)); }
        catch { key.current = null; }
      }
    }
    const connection = createJudgeAccessClient({ origin: typeof window !== 'undefined' ? window.location.origin : '', credentials: serviceCredentials, onState: setState });
    client.current = connection;
    let alive = true;
    // React Strict Mode may replay setup/cleanup. Defer so the discarded mount makes no request.
    void Promise.resolve().then(() => {
      if (!alive) return;
      if (key.current) void connection.connect(key.current);
      else if (serviceCredentials.current && serviceCredentials.current.expiresAt > Date.now()) setState({ phase: 'connected', message: '' });
      else setState({ phase: 'error', message: judgeAccessMessages.missing });
    });
    return () => { alive = false; connection.dispose(); client.current = null; };
  }, []);
  const busy = state.phase === 'connecting' || state.phase === 'idle';
  const connected = state.phase === 'connected';
  useEffect(() => {
    if (connected && !navigated.current) {
      navigated.current = true;
      router.replace('/onboarding');
    }
  }, [connected]);
  return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.launch}>
    <View style={s.launchInner}>
      <Image source={require('../assets/icon.png')} resizeMode="contain" accessibilityLabel="Hum Ahang logo" style={s.logo}/>
      <Text accessibilityRole="header" style={s.brand}>HUM AHANG</Text>
      {busy && <View accessibilityLiveRegion="polite" style={s.loading}><ActivityIndicator color={colors.primaryDark}/><Text style={s.help}>Opening Hum Ahang…</Text></View>}
      {!busy && !connected && <View style={s.card}>
        <View style={s.icon}><Ionicons name="link-outline" size={32} color={colors.primaryDark} accessible={false}/></View>
        <Text accessibilityRole="header" style={s.title}>Couldn’t connect to online features</Text>
        {!!state.message && <Text accessibilityRole="alert" style={s.message}>{state.message}</Text>}
        {!!key.current && <Pressable accessibilityLabel="Retry secure connection" onPress={() => { if (key.current) void client.current?.connect(key.current); }} style={s.primary}><Text style={s.primaryText}>Retry</Text></Pressable>}
        <Pressable onPress={() => router.replace('/onboarding')} style={s.secondary}><Text style={s.secondaryText}>Continue to the app</Text></Pressable>
      </View>}
      <Text style={s.privacy}>No camera or microphone starts automatically.</Text>
    </View>
  </ScrollView></SafeAreaView>;
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream }, launch: { flexGrow: 1 }, launchInner: { flex: 1, width: '100%', maxWidth: 430, minHeight: 480, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', padding: space.lg, gap: space.sm },
  logo: { width: 112, height: 112 }, brand: { color: colors.ink, fontSize: 14, fontWeight: '800', letterSpacing: 3 }, loading: { minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: 10 },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: radius.md, padding: space.lg, gap: 16 },
  icon: { width: 56, height: 56, backgroundColor: colors.primaryLight, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.ink, fontSize: 23, lineHeight: 31, fontWeight: '700' }, help: { color: colors.muted, fontSize: 14, lineHeight: 23, flexShrink: 1 },
  message: { color: colors.ink, backgroundColor: colors.primaryLight, borderRadius: radius.sm, padding: 12, fontSize: 14, lineHeight: 23 },
  primary: { minHeight: 52, padding: 12, borderRadius: radius.sm, backgroundColor: colors.primaryDark, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 },
  primaryText: { color: colors.surface, fontSize: 15, fontWeight: '700' }, secondary: { minHeight: 48, padding: 10, alignItems: 'center', justifyContent: 'center' }, secondaryText: { color: colors.primaryDark, fontSize: 14, fontWeight: '600' },
  privacy: { color: colors.muted, fontSize: 12, textAlign: 'center', paddingVertical: space.md },
});
