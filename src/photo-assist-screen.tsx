import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Image, Modal, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Button } from './components';
import { Ionicons, Pressable, SafeAreaView, Text, useLocale } from './localized-ui';
import { router } from './navigation';
import { PhotoCapture, type CapturedPhoto } from './photo-capture';
import { RecordingStatus } from './recording-status';
import { useApp } from './store';
import { colors } from './theme';
import { usePhotoAnalysis } from './use-photo-analysis';
import { getPslResultPresentation, type VisionLanguage, type VisionTask } from './vision-client';
import { pslSigns } from './psl-signs';

const resultLanguages: { code: VisionLanguage; label: string; name: string }[] = [
  { code: 'en', label: 'English', name: 'English' },
  { code: 'ur', label: 'اردو', name: 'Urdu' },
  { code: 'roman', label: 'Roman Urdu', name: 'Roman Urdu' },
];

/** Screen owns the photo; the hook owns network and voice lifetimes. */
export function PhotoAssistScreen({ task }: { task: VisionTask }) {
  const { language, rtl, t } = useLocale();
  const { prefs } = useApp();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null);
  const [selectedSignId, setSelectedSignId] = useState<string | null>(null);
  const [readAloud, setReadAloud] = useState(prefs.autoSpeak);
  const analysis = usePhotoAnalysis();
  const scroll = useRef<ScrollView>(null);
  const isGesture = task === 'gesture', busy = analysis.phase === 'analyzing';
  const translating = analysis.phase === 'translating';
  const speaking = analysis.playback.phase !== 'idle';
  const outputLanguage: VisionLanguage = language === 'English' ? 'en' : rtl ? 'ur' : 'roman';
  const selectedSign = pslSigns.find(sign => sign.id === selectedSignId);
  const resultRTL = analysis.language === 'ur';
  const resultPresentation = analysis.result ? getPslResultPresentation(analysis.result, analysis.language ?? outputLanguage) : null;
  const { cancel } = analysis;
  useFocusEffect(useCallback(() => () => setCameraOpen(false), []));
  useEffect(() => {
    // iOS permission prompts can be briefly inactive; only actual backgrounding closes capture.
    const subscription = AppState.addEventListener('change', status => { if (status === 'background') setCameraOpen(false); });
    const hidden = () => { if (document.visibilityState !== 'visible') setCameraOpen(false); };
    if (Platform.OS === 'web') document.addEventListener('visibilitychange', hidden);
    return () => { subscription.remove(); if (Platform.OS === 'web') document.removeEventListener('visibilitychange', hidden); };
  }, []);
  // Changing language invalidates pending results and stops the old language's voice.
  useEffect(() => { cancel(); }, [outputLanguage, cancel]);
  const startCamera = () => { cancel(); setPhoto(null); setCameraOpen(true); };
  const takePhoto = (captured: CapturedPhoto) => { setCameraOpen(false); setPhoto(captured); };
  const analyze = () => { if (photo) void analysis.analyze(photo, outputLanguage, task, readAloud); };
  const back = () => { setCameraOpen(false); cancel(); router.canGoBack() ? router.back() : router.replace('/'); };
  if (cameraOpen) return <SafeAreaView style={s.safe}><View style={s.camera}>
    <PhotoCapture onCapture={takePhoto} onCancel={() => setCameraOpen(false)} facing={isGesture ? 'front' : 'back'}/>
  </View></SafeAreaView>;
  return <SafeAreaView style={s.safe}>
    <View style={s.header}>
      <Pressable onPress={back} accessibilityLabel="Go back" style={s.iconButton}><Ionicons name="arrow-back" size={23} color={colors.ink}/></Pressable>
      <View style={s.headerCopy}><Text accessibilityRole="header" style={s.title}>{isGesture ? 'Sign Assistant' : 'AI Vision'}</Text>
        <Text style={s.subtitle}>{isGesture ? 'PSL sign check · experimental' : 'Take a photo. Hear what is visible.'}</Text></View>
    </View>
    <ScrollView ref={scroll} contentContainerStyle={s.content}>
      {isGesture && <View style={s.notice}><Text style={s.noticeText}>Take one still photo for AI identification, or browse the ten signs below to see their meanings in English and Urdu.</Text></View>}
      <View style={[s.preview, photo && s.previewWithPhoto]}>
        {photo ? <Image source={{ uri: photo.uri }} resizeMode="contain" style={s.image} accessible accessibilityLabel={t('Your captured photo')}/> : <>
          <View style={s.cameraIcon}><Ionicons name={isGesture ? 'hand-left-outline' : 'camera-outline'} size={40} color={colors.primaryDark}/></View>
          <Text style={s.emptyTitle}>{isGesture ? 'Capture a PSL sign' : 'What is in front of you?'}</Text>
          <Text style={s.emptyText}>{isGesture ? 'Use good light. Show the whole hand and orientation; include both hands if the sign needs them.' : 'Keep the photo clear and well lit.'}</Text>
        </>}
      </View>
      {!photo ? <Button label="Take a photo" icon="camera-outline" onPress={startCamera}/> : <>
        {busy ? <View style={s.progress} accessibilityLiveRegion="polite">
          <ActivityIndicator color={colors.primaryDark}/><Text style={s.progressText}>Analyzing your photo…</Text>
          <Pressable onPress={cancel} accessibilityLabel="Cancel photo analysis" style={s.smallButton}><Text style={s.link}>Cancel</Text></Pressable>
        </View> : analysis.result ? null : <Button label="Analyze photo" icon="scan-outline" onPress={analyze}/>}
        <View style={s.photoActions}>
          <Pressable onPress={startCamera} style={s.smallButton} accessibilityLabel="Retake photo"><Ionicons name="camera-reverse-outline" size={19} color={colors.primaryDark}/><Text style={s.link}>Retake photo</Text></Pressable>
          <Pressable onPress={() => { cancel(); setPhoto(null); }} style={s.smallButton} accessibilityLabel="Clear photo"><Ionicons name="close" size={19} color={colors.muted}/><Text style={s.secondaryLink}>Clear photo</Text></Pressable>
        </View>
      </>}
      {isGesture && <View style={s.library}>
        <View style={s.libraryHeading}>
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={s.libraryTitle}>Browse signs</Text>
            <Text style={s.libraryHint}>Tap a symbol to see its meaning in both languages.</Text>
          </View>
          <View style={s.signCount}><Text style={s.signCountText}>10</Text></View>
        </View>
        <View style={s.signGrid}>
          {pslSigns.map(sign => {
            const selected = sign.id === selectedSignId;
            return <Pressable key={sign.id} accessibilityRole="button"
              accessibilityLabel={`${selected ? `${t('Selected sign')}. ` : ''}${sign.nameEn}, ${sign.nameUr}`}
              accessibilityHint="Shows this sign's meaning in English and Urdu"
              onPress={() => setSelectedSignId(sign.id)}
              style={[s.signCard, selected && s.signCardSelected]}>
              <View style={s.symbolFrame}><Image source={sign.symbol} resizeMode="contain" accessible={false} style={s.symbolImage}/></View>
              <Text verbatim numberOfLines={1} style={s.signNameEn}>{sign.nameEn}</Text>
              <Text verbatim numberOfLines={1} style={s.signNameUr}>{sign.nameUr}</Text>
              {selected && <View style={s.selectedMark}><Ionicons name="checkmark" size={13} color={colors.surface}/></View>}
            </Pressable>;
          })}
        </View>
      </View>}
      {!analysis.result && !isGesture && <Pressable accessibilityRole="button" accessibilityLabel="Read results aloud" accessibilityState={{ selected: readAloud, disabled: busy }} disabled={busy} onPress={() => setReadAloud(value => !value)} style={s.readOption}>
        <Ionicons name={readAloud ? 'volume-high-outline' : 'volume-mute-outline'} size={22} color={colors.primaryDark}/><Text style={s.readText}>Read results aloud</Text>
        <View accessible={false} style={[s.switch, readAloud && s.switchOn]}><View style={[s.switchDot, readAloud && s.switchDotOn]}/></View>
      </Pressable>}
      {!!analysis.message && <View style={s.error} accessibilityLiveRegion="polite"><Text style={s.errorText}>{analysis.message}</Text>
        {analysis.needsConnection && <Button label="Open Speech setup" variant="secondary" icon="settings-outline" onPress={() => router.push('/speech-setup')}/>}
      </View>}
      {analysis.result && <View style={s.result} onLayout={({ nativeEvent }) => scroll.current?.scrollTo({ y: nativeEvent.layout.y, animated: false })}>
        <View style={s.resultHeading}><Ionicons name={analysis.result.uncertain ? 'help-circle-outline' : 'checkmark-circle-outline'} size={23} color={colors.primaryDark}/><Text accessibilityRole="header" style={s.resultTitle}>{isGesture ? 'Possible sign meaning' : analysis.result.uncertain ? 'Please check this result' : 'Photo result'}</Text></View>
        {!isGesture && <View style={s.languageControl}>
          <Text style={s.languageLabel}>Result language</Text>
          <View {...(Platform.OS === 'web' ? { dir: 'ltr' } : {})} style={[s.languages, Platform.OS !== 'web' && { direction: 'ltr' }]}>{resultLanguages.map(option => {
            const selected = analysis.language === option.code;
            return <Pressable key={option.code} accessibilityLabel={option.name}
              accessibilityState={{ selected, disabled: translating, busy: translating && analysis.translatingTo === option.code }}
              disabled={translating} onPress={() => { if (!selected) void analysis.translate(option.code, readAloud); }}
              style={[s.languageButton, selected && s.languageSelected]}>
              {selected && <Ionicons name="checkmark" size={15} color={colors.primaryDark}/>}
              <Text verbatim style={[s.languageText, option.code === 'ur' ? s.rtlText : s.ltrText]}>{option.label}</Text>
            </Pressable>;
          })}</View>
          {translating && <View style={s.progress} accessibilityLiveRegion="polite">
            <ActivityIndicator color={colors.primaryDark}/><Text style={s.progressText}>Translating result…</Text>
            <Pressable onPress={analysis.cancelTranslation} accessibilityLabel="Cancel translation" style={s.smallButton}><Text style={s.link}>Cancel</Text></Pressable>
          </View>}
        </View>}
        <Text verbatim selectable accessibilityLiveRegion={readAloud ? 'none' : 'polite'} style={[s.description, resultRTL ? s.urdu : s.ltrText, isGesture && resultPresentation?.matchedCatalog && s.signResultText]}>{isGesture ? resultPresentation?.displayText ?? analysis.result.description : analysis.result.description}</Text>
        {analysis.result.objects.length > 0 && <View {...(Platform.OS === 'web' ? { dir: resultRTL ? 'rtl' : 'ltr' } : {})} style={[s.objects, Platform.OS !== 'web' && { direction: resultRTL ? 'rtl' : 'ltr' }]}>{analysis.result.objects.map((object, index) => <View style={s.object} key={`${index}-${object}`}><Text verbatim style={[s.objectText, resultRTL ? s.rtlText : s.ltrText]}>{object}</Text></View>)}</View>}
        {speaking ? <RecordingStatus active={analysis.playback.phase === 'speaking'} title={analysis.playback.phase === 'preparing' ? 'Preparing voice' : 'Speaking'} detail="Device voice" action="stop" accessibilityLabel="Stop speaking" onAction={analysis.stopSpeaking}/> : !translating && <Button label="Speak again" icon="volume-high-outline" variant="secondary" onPress={analysis.speak}/>}
        {!!analysis.playback.error && <Text style={s.errorText} accessibilityLiveRegion="polite">{analysis.playback.error}</Text>}
        {!isGesture && <Text style={s.privacy}>Changing language sends only the result text to OpenAI, not your photo again.</Text>}
      </View>}
      {isGesture && <View style={s.supported}><Text style={s.emptyText}>Camera identification is experimental and may be wrong. A still photo cannot capture movement or context, and this is not a substitute for a qualified interpreter.</Text></View>}
      <Text style={s.privacy}>Analyze sends this photo to OpenAI. Hum Ahang does not store the upload on its server. Camera photos may remain in temporary device cache.</Text>
      <View style={s.caution}><Ionicons name="information-circle-outline" size={18} color="#665025"/><Text style={s.cautionText}>AI can miss objects or make mistakes. Do not use this for road crossing, medical decisions, or confirming safety.</Text></View>
    </ScrollView>
    {isGesture && <Modal visible={!!selectedSign} transparent animationType="fade" onRequestClose={() => setSelectedSignId(null)}>
      <View style={s.modalOverlay}>
        <Pressable accessible={false} style={StyleSheet.absoluteFill} onPress={() => setSelectedSignId(null)}/>
        {selectedSign && <View style={s.signMeaning} accessibilityViewIsModal accessibilityLiveRegion="polite">
          <Image source={selectedSign.symbol} resizeMode="contain" accessible={false} style={s.meaningImage}/>
          <View style={s.meaningCopy}>
            <Text style={s.meaningLabel}>English meaning</Text>
            <Text verbatim accessibilityRole="header" style={s.meaningEnglish}>{selectedSign.nameEn}</Text>
            <Text style={s.meaningLabel}>اردو معنی</Text>
            <Text verbatim style={s.meaningUrdu}>{selectedSign.nameUr}</Text>
          </View>
          <Pressable onPress={() => setSelectedSignId(null)} accessibilityLabel="Close sign meaning" style={s.closeMeaning}>
            <Ionicons name="close" size={20} color={colors.muted}/>
          </Pressable>
        </View>}
      </View>
    </Modal>}
  </SafeAreaView>;
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream }, camera: { flex: 1, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 12 }, headerCopy: { flex: 1 },
  iconButton: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.ink, fontSize: 24, fontWeight: '800' }, subtitle: { color: '#615E70', fontSize: 13, lineHeight: 20, marginTop: 3 },
  content: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  preview: { minHeight: 220, borderWidth: 1, borderColor: '#E4DFF0', borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12, overflow: 'hidden' },
  previewWithPhoto: { height: 240, padding: 0, backgroundColor: '#20202A' }, image: { width: '100%', height: '100%' },
  cameraIcon: { height: 76, width: 76, borderRadius: 24, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { color: colors.ink, fontSize: 19, fontWeight: '700', textAlign: 'center' }, emptyText: { color: '#615E70', fontSize: 14, lineHeight: 22, textAlign: 'center' },
  photoActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  smallButton: { minHeight: 48, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, flexShrink: 1 },
  link: { fontSize: 14, color: colors.primaryDark, fontWeight: '700', flexShrink: 1 }, secondaryLink: { color: '#615E70', fontSize: 14, flexShrink: 1 },
  progress: { minHeight: 58, borderRadius: 18, backgroundColor: colors.primaryLight, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 }, progressText: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: '600' },
  readOption: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8 }, readText: { flex: 1, color: colors.ink, fontSize: 14 },
  switch: { width: 44, height: 26, borderRadius: 20, padding: 3, backgroundColor: '#A6A1B3' }, switchOn: { backgroundColor: colors.primaryDark },
  switchDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.surface, alignSelf: 'flex-start' }, switchDotOn: { alignSelf: 'flex-end' },
  error: { backgroundColor: colors.redSoft, borderRadius: 16, padding: 16, gap: 12 }, errorText: { color: '#842334', fontSize: 14, lineHeight: 22 },
  result: { backgroundColor: colors.surface, borderWidth: 1, borderColor: '#E4DFF0', borderRadius: 20, padding: 16, gap: 16 }, resultHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resultTitle: { flexShrink: 1, fontSize: 17, fontWeight: '700', color: colors.ink }, description: { fontSize: 20, lineHeight: 30, color: colors.ink }, signResultText: { fontSize: 28, fontWeight: '800', textAlign: 'center' }, urdu: { writingDirection: 'rtl', textAlign: 'right', lineHeight: 34 },
  languageControl: { gap: 8 }, languageLabel: { fontSize: 12, fontWeight: '600', color: '#615E70' },
  languages: { flexDirection: 'row', gap: 4, padding: 4, backgroundColor: colors.cream, borderRadius: 14 },
  languageButton: { flex: 1, minHeight: 48, paddingHorizontal: 6, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1, borderColor: 'transparent', borderRadius: 10 },
  languageSelected: { backgroundColor: colors.primaryLight, borderColor: '#B5A1F4' }, languageText: { fontSize: 14, fontWeight: '600', color: colors.primaryDark, flexShrink: 1 },
  rtlText: { writingDirection: 'rtl', textAlign: 'right' }, ltrText: { writingDirection: 'ltr', textAlign: 'left' },
  objects: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, object: { backgroundColor: colors.primaryLight, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 }, objectText: { fontSize: 14, color: colors.primaryDark },
  privacy: { fontSize: 12, lineHeight: 19, color: '#615E70' }, caution: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 12, backgroundColor: colors.yellow }, cautionText: { flex: 1, fontSize: 12, lineHeight: 19, color: '#665025' },
  notice: { padding: 14, borderRadius: 14, backgroundColor: colors.primaryLight }, noticeText: { color: '#493781', fontSize: 13, lineHeight: 21 }, supported: { gap: 8, padding: 16, alignItems: 'center' },
  library: { gap: 12, paddingTop: 8 }, libraryHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  libraryTitle: { color: colors.ink, fontSize: 18, fontWeight: '800' }, libraryHint: { color: '#615E70', fontSize: 13, lineHeight: 20, marginTop: 3 },
  signCount: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }, signCountText: { color: colors.primaryDark, fontSize: 15, fontWeight: '800' },
  signGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  signCard: { width: '48.5%', minHeight: 148, padding: 10, borderWidth: 1, borderColor: '#E4DFF0', borderRadius: 18, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: 4, overflow: 'hidden' },
  signCardSelected: { borderColor: colors.primary, borderWidth: 2, backgroundColor: '#F6F2FF' }, symbolFrame: { width: '100%', height: 88, borderRadius: 12, backgroundColor: '#F7F5FC', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  symbolImage: { width: '100%', height: '100%' }, signNameEn: { color: colors.ink, fontSize: 14, fontWeight: '700', maxWidth: '100%', textAlign: 'center' }, signNameUr: { color: colors.primaryDark, fontSize: 15, fontWeight: '700', maxWidth: '100%', textAlign: 'center' },
  selectedMark: { position: 'absolute', top: 7, right: 7, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primaryDark, alignItems: 'center', justifyContent: 'center' },
  modalOverlay: { flex: 1, backgroundColor: '#1A173399', justifyContent: 'center', alignItems: 'center', padding: 20 },
  signMeaning: { width: '100%', maxWidth: 460, minHeight: 156, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 22, borderWidth: 1, borderColor: '#D9CCFF', backgroundColor: colors.surface, elevation: 12 }, meaningImage: { width: 112, height: 112, borderRadius: 14, backgroundColor: '#F7F5FC' }, meaningCopy: { flex: 1, gap: 3 }, meaningLabel: { color: '#615E70', fontSize: 12, fontWeight: '600', marginTop: 2 }, meaningEnglish: { color: colors.ink, fontSize: 18, fontWeight: '800' }, meaningUrdu: { color: colors.primaryDark, fontSize: 20, fontWeight: '800', writingDirection: 'rtl' }, closeMeaning: { alignSelf: 'flex-start', width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
