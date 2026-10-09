// En-tête de l'éditeur : Annuler (ou « ‹ Séances » dans une séance) · étapes cliquables · Enregistrer
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';
import type { EditorStep } from './nav';

const STEPS: EditorStep[] = [1, 2, 3];

interface Props {
  step?: EditorStep;
  onCancel(): void;
  onSave(): void;
  /** Aller directement à une étape (indicateur cliquable) */
  onStep?(step: EditorStep): void;
  /** Écran d'une séance : retour à la liste des séances à la place d'« Annuler » */
  onBack?(): void;
}

export function EditorHeader({ step, onCancel, onSave, onStep, onBack }: Props) {
  const { colors, fonts } = useTheme();
  const { t } = useI18n();
  return (
    <View style={styles.row}>
      {onBack ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('editor_back_sessions')} onPress={onBack} style={[styles.btn, styles.back]}>
          <Ionicons name="chevron-back" size={18} color={colors.gold} />
          <Text style={{ color: colors.gold, fontFamily: fonts.uiBold }}>{t('editor_back_sessions')}</Text>
        </Pressable>
      ) : (
        <Pressable accessibilityRole="button" onPress={onCancel} style={styles.btn}>
          <Text style={{ color: colors.textDim, fontFamily: fonts.uiBold }}>{t('editor_cancel')}</Text>
        </Pressable>
      )}
      {step ? (
        <View style={styles.center}>
          <Text style={{ color: colors.textDim, fontFamily: fonts.uiMedium, fontSize: 12 }}>{`${t('editor_step')} ${step} ${t('editor_step_of')} 3`}</Text>
          <View style={styles.dots}>
            {STEPS.map((s) => (
              <Pressable
                key={s}
                accessibilityRole="button"
                accessibilityLabel={`${t('editor_step')} ${s}`}
                accessibilityState={{ selected: s === step }}
                disabled={!onStep || s === step}
                onPress={() => onStep?.(s)}
                hitSlop={8}
                style={styles.dotHit}
              >
                <View style={[styles.dot, { backgroundColor: s === step ? colors.gold : s < step ? colors.goldDim : colors.border, width: s === step ? 22 : 8 }]} />
              </Pressable>
            ))}
          </View>
        </View>
      ) : <View style={styles.center} />}
      <Pressable accessibilityRole="button" onPress={onSave} style={[styles.btn, styles.end]}>
        <Text style={{ color: colors.gold, fontFamily: fonts.uiBold }}>{t('editor_save')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  btn: { minHeight: TOUCH_MIN, minWidth: TOUCH_MIN, justifyContent: 'center' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  end: { alignItems: 'flex-end' },
  center: { flex: 1, alignItems: 'center', gap: 2 },
  dots: { flexDirection: 'row', alignItems: 'center' },
  dotHit: { minHeight: 28, minWidth: 30, alignItems: 'center', justifyContent: 'center' },
  dot: { height: 8, borderRadius: 4 },
});
