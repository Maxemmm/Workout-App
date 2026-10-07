// Plan · Mes programmes
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StoredProgram } from '@/db/repos/programsRepo';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { ProgramCard } from './ProgramCard';

interface Props {
  programs: StoredProgram[];
  activeId: string | null;
  onActivate(id: string): void;
  onEdit(id: string): void;
  onDuplicate(id: string): void;
  onDelete(id: string): void;
  onCreate(): void;
  onImport(): void;
}

export function ProgramsView({ programs, activeId, onActivate, onEdit, onDuplicate, onDelete, onCreate, onImport }: Props) {
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  return (
    <View style={{ gap: 12 }}>
      {programs.length === 0 ? <Text style={{ color: colors.textDim, fontFamily: fonts.ui }}>{t('plan_no_programs')}</Text> : null}
      {programs.map((p) => (
        <ProgramCard
          key={p.id}
          program={p}
          active={p.id === activeId}
          onActivate={() => onActivate(p.id)}
          onEdit={() => onEdit(p.id)}
          onDuplicate={() => onDuplicate(p.id)}
          onDelete={() => onDelete(p.id)}
        />
      ))}
      <Pressable accessibilityRole="button" onPress={onCreate} style={[styles.btn, { backgroundColor: colors.gold, borderRadius: radius.md }]}>
        <Text style={{ color: '#0a0a0a', fontFamily: fonts.uiBold }}>{t('plan_create_new')}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onImport} style={[styles.btn, { borderColor: colors.gold, borderWidth: 1, borderRadius: radius.md }]}>
        <Text style={{ color: colors.gold, fontFamily: fonts.uiBold }}>{t('plan_import')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({ btn: { minHeight: 52, alignItems: 'center', justifyContent: 'center' } });
