import React, { useState, useMemo } from 'react';
import { StyleSheet, View, ScrollView, Platform, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Text, Pressable, Ionicons, useLocale } from './localized-ui';
import { colors, radius, shadow } from './theme';

type Props = {
  value: string;
  onChangeText(text: string): void;
  onSend(text: string): void;
  onClose(): void;
  defaultLanguage?: 'en' | 'ur';
  style?: ViewStyle;
};

const SUGGESTIONS_EN = ['Yes', 'No', 'Thank you', 'Please help', 'Wait', 'Water', 'Where?', 'Okay', 'Repeat'];
const SUGGESTIONS_UR = ['جی ہاں', 'نہیں', 'شکریہ', 'مدد کریں', 'ایک منٹ', 'پانی', 'کہاں؟', 'ٹھیک ہے', 'دوبارہ کہیں'];

const EN_ROW1 = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'];
const EN_ROW2 = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'];
const EN_ROW3 = ['z', 'x', 'c', 'v', 'b', 'n', 'm'];

const UR_ROW1 = ['ق', 'و', 'ع', 'ر', 'ت', 'ے', 'ء', 'ی', 'ہ', 'پ'];
const UR_ROW2 = ['ا', 'س', 'د', 'ف', 'گ', 'ھ', 'ج', 'ک', 'ل', 'ٹ'];
const UR_ROW3 = ['ں', 'ز', 'خ', 'چ', 'ڈ', 'ب', 'ن', 'م'];

const NUM_ROW1 = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const NUM_ROW2 = ['@', '#', '$', '%', '&', '*', '-', '+', '(', ')'];
const NUM_ROW3 = ['!', '"', '\'', ':', ';', ',', '.', '?'];

export function PartnerKeyboard({ value, onChangeText, onSend, onClose, defaultLanguage = 'en', style }: Props) {
  const { t } = useLocale();
  const [lang, setLang] = useState<'en' | 'ur'>(defaultLanguage);
  const [mode, setMode] = useState<'alpha' | 'num'>('alpha');
  const [shifted, setShifted] = useState(false);

  const triggerHaptic = () => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  const handleKeyPress = (char: string) => {
    triggerHaptic();
    const toInsert = shifted ? char.toUpperCase() : char;
    onChangeText(value + toInsert);
    if (shifted) setShifted(false);
  };

  const handleBackspace = () => {
    triggerHaptic();
    if (value.length > 0) {
      onChangeText(value.slice(0, -1));
    }
  };

  const handleSpace = () => {
    triggerHaptic();
    onChangeText(value + ' ');
  };

  const handleClear = () => {
    triggerHaptic();
    onChangeText('');
  };

  const handleSend = () => {
    triggerHaptic();
    if (value.trim()) {
      onSend(value.trim());
    }
  };

  const handleSuggestion = (phrase: string) => {
    triggerHaptic();
    const newText = value.trim() ? `${value.trim()} ${phrase} ` : `${phrase} `;
    onChangeText(newText);
  };

  const suggestions = useMemo(() => {
    return lang === 'ur' ? SUGGESTIONS_UR : SUGGESTIONS_EN;
  }, [lang]);

  const renderKey = (char: string, flex = 1) => {
    const display = shifted ? char.toUpperCase() : char;
    return (
      <Pressable
        key={char}
        accessibilityRole="button"
        accessibilityLabel={display}
        onPress={() => handleKeyPress(char)}
        style={({ pressed }) => [s.key, { flex }, pressed && s.keyPressed]}
      >
        <Text style={[s.keyText, lang === 'ur' && s.urKeyText]}>{display}</Text>
      </Pressable>
    );
  };

  return (
    <View style={[s.container, style]}>
      {/* Top Suggestion / Predictive Strip */}
      <View style={s.suggestionBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.suggestionContent}
          keyboardShouldPersistTaps="handled"
        >
          {suggestions.map(phrase => (
            <Pressable
              key={phrase}
              accessibilityRole="button"
              accessibilityLabel={t('Insert {phrase}', { phrase })}
              onPress={() => handleSuggestion(phrase)}
              style={({ pressed }) => [s.suggestionPill, pressed && s.pillPressed]}
            >
              <Text style={[s.suggestionText, lang === 'ur' && s.urText]}>{phrase}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Close keyboard')}
          onPress={() => { triggerHaptic(); onClose(); }}
          style={s.closeButton}
        >
          <Ionicons name="chevron-down" size={20} color={colors.primaryDark} />
        </Pressable>
      </View>

      {/* Keyboard Grid */}
      <View style={s.keyboardGrid}>
        {mode === 'num' ? (
          <>
            <View style={s.row}>{NUM_ROW1.map(char => renderKey(char))}</View>
            <View style={s.row}>{NUM_ROW2.map(char => renderKey(char))}</View>
            <View style={s.row}>
              {NUM_ROW3.map(char => renderKey(char))}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('Backspace')}
                onPress={handleBackspace}
                style={({ pressed }) => [s.actionKey, pressed && s.keyPressed]}
              >
                <Ionicons name="backspace-outline" size={20} color={colors.ink} />
              </Pressable>
            </View>
          </>
        ) : lang === 'ur' ? (
          <>
            <View style={s.row}>{UR_ROW1.map(char => renderKey(char))}</View>
            <View style={s.row}>{UR_ROW2.map(char => renderKey(char))}</View>
            <View style={s.row}>
              {UR_ROW3.map(char => renderKey(char))}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('Backspace')}
                onPress={handleBackspace}
                style={({ pressed }) => [s.actionKey, pressed && s.keyPressed]}
              >
                <Ionicons name="backspace-outline" size={20} color={colors.ink} />
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <View style={s.row}>{EN_ROW1.map(char => renderKey(char))}</View>
            <View style={s.row}>{EN_ROW2.map(char => renderKey(char))}</View>
            <View style={s.row}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('Shift')}
                onPress={() => { triggerHaptic(); setShifted(!shifted); }}
                style={({ pressed }) => [s.actionKey, shifted && s.actionKeyActive, pressed && s.keyPressed]}
              >
                <Ionicons name="arrow-up" size={18} color={shifted ? colors.surface : colors.ink} />
              </Pressable>
              {EN_ROW3.map(char => renderKey(char))}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('Backspace')}
                onPress={handleBackspace}
                style={({ pressed }) => [s.actionKey, pressed && s.keyPressed]}
              >
                <Ionicons name="backspace-outline" size={20} color={colors.ink} />
              </Pressable>
            </View>
          </>
        )}

        {/* Bottom Utility Row */}
        <View style={s.row}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={mode === 'num' ? t('Letters') : '123'}
            onPress={() => { triggerHaptic(); setMode(mode === 'num' ? 'alpha' : 'num'); }}
            style={({ pressed }) => [s.funcKey, pressed && s.keyPressed]}
          >
            <Text style={s.funcKeyText}>{mode === 'num' ? 'ABC' : '123'}</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={lang === 'ur' ? 'English' : 'اردو'}
            onPress={() => { triggerHaptic(); setLang(lang === 'ur' ? 'en' : 'ur'); }}
            style={({ pressed }) => [s.funcKey, pressed && s.keyPressed]}
          >
            <Text style={[s.funcKeyText, s.langKeyText]}>{lang === 'ur' ? 'EN' : 'اردو'}</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Space')}
            onPress={handleSpace}
            style={({ pressed }) => [s.spaceKey, pressed && s.keyPressed]}
          >
            <Text style={s.spaceKeyText}>{t('Space')}</Text>
          </Pressable>

          {!!value.trim() && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('Clear text')}
              onPress={handleClear}
              style={({ pressed }) => [s.funcKey, pressed && s.keyPressed]}
            >
              <Ionicons name="trash-outline" size={17} color={colors.muted} />
            </Pressable>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Send')}
            disabled={!value.trim()}
            onPress={handleSend}
            style={({ pressed }) => [s.sendKey, !value.trim() && s.sendKeyDisabled, pressed && s.keyPressed]}
          >
            <Ionicons name="arrow-up" size={20} color={value.trim() ? colors.surface : colors.muted} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    backgroundColor: '#ECEAF4',
    borderTopWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 6,
    paddingTop: 6,
    paddingBottom: 10,
    ...shadow,
  },
  suggestionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  suggestionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 8,
  },
  suggestionPill: {
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#DFDCE8',
  },
  pillPressed: {
    backgroundColor: colors.primaryLight,
  },
  suggestionText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primaryDark,
  },
  urText: {
    writingDirection: 'rtl',
    fontSize: 14,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  keyboardGrid: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
  },
  key: {
    minHeight: 44,
    backgroundColor: colors.surface,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3A2E6B',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  keyPressed: {
    backgroundColor: colors.primaryLight,
    opacity: 0.75,
  },
  keyText: {
    fontSize: 18,
    fontWeight: '500',
    color: colors.ink,
  },
  urKeyText: {
    fontSize: 20,
    writingDirection: 'rtl',
  },
  actionKey: {
    minWidth: 42,
    minHeight: 44,
    backgroundColor: '#D9D5E5',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionKeyActive: {
    backgroundColor: colors.primary,
  },
  funcKey: {
    minWidth: 46,
    minHeight: 44,
    backgroundColor: '#D9D5E5',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  funcKeyText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  langKeyText: {
    color: colors.primaryDark,
    fontSize: 14,
  },
  spaceKey: {
    flex: 3,
    minHeight: 44,
    backgroundColor: colors.surface,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3A2E6B',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  spaceKeyText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.muted,
  },
  sendKey: {
    minWidth: 46,
    minHeight: 44,
    backgroundColor: colors.primary,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  sendKeyDisabled: {
    backgroundColor: '#D9D5E5',
  },
});
