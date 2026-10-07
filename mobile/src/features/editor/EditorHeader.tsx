// En-tête de l'éditeur : Annuler · Étape N / 3 · Enregistrer
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';
import type { EditorStep } from './nav';

export function EditorHeader({ step, onCancel, onSave }: { step?: EditorStep; onCancel(): void; onSave(): void }) {
  const { colors, fonts } = useTheme();
  const { t } = useI18n();
  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="button" onPress={onCancel} style={styles.btn}>
        <Text style={{ color: colors.textDim, fontFamily: fonts.uiBold }}>{t('editor_cancel')}</Text>
      </Pressable>
      <Text style={{ color: colors.textDim, fontFamily: fonts.uiMedium }}>{step ? `${t('editor_step')} ${step} ${t('editor_step_of')} 3` : ''}</Text>
      <Pressable accessibilityRole="button" onPress={onSave} style={styles.btn}>
        <Text style={{ color: colors.gold, fontFamily: fonts.uiBold }}>{t('editor_save')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  btn: { minHeight: TOUCH_MIN, minWidth: TOUCH_MIN, justifyContent: 'center' },
});
