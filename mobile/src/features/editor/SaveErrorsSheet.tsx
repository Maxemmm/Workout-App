// Erreurs d'enregistrement — chacune ramène à l'étape concernée
import { Pressable, StyleSheet, Text } from 'react-native';
import type { DraftError } from '@/domain/programRules';
import { BottomSheet } from '@/features/common/BottomSheet';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';
import { errorMessage } from './errorMessage';

interface Props {
  errors: DraftError[] | null;
  sessionName(key: string): string;
  onSelect(e: DraftError): void;
  onClose(): void;
}

export function SaveErrorsSheet({ errors, sessionName, onSelect, onClose }: Props) {
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  if (!errors) return null;
  return (
    <BottomSheet visible title={t('editor_errors_title')} onClose={onClose}>
      {errors.map((e, i) => (
        <Pressable key={i} accessibilityRole="button" onPress={() => onSelect(e)} style={[styles.item, { borderColor: colors.redDanger, borderRadius: radius.md }]}>
          <Text style={{ color: colors.text, fontFamily: fonts.ui }}>{errorMessage(t, e, e.sessionKey ? sessionName(e.sessionKey) : undefined)}</Text>
        </Pressable>
      ))}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({ item: { minHeight: TOUCH_MIN, borderWidth: 1, padding: 12, justifyContent: 'center' } });
