// Étape 1 — programme : nom, unité, repos par défaut, règles
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRepoCtx } from '@/db/DbContext';
import { setMeta, setRules } from '@/domain/draft';
import type { Units } from '@/domain/program';
import { ListEditor } from '@/features/common/ListEditor';
import { NumberStepper } from '@/features/common/NumberStepper';
import { Segmented } from '@/features/profile/Segmented';
import { useI18n } from '@/i18n/I18nProvider';
import { useDraftStore } from '@/state/draftStore';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';
import { EditorScreen } from './EditorScreen';
import type { EditorNav } from './nav';

export function MetaStep({ nav }: { nav: EditorNav }) {
  const ctx = useRepoCtx();
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  const program = useDraftStore((s) => s.draft?.program);
  const apply = useDraftStore((s) => s.apply);
  const label = { color: colors.textDim, fontFamily: fonts.uiBold, fontSize: 11, letterSpacing: 1.5 };

  return (
    <EditorScreen nav={nav} step={1}>
      {program ? (
        <View style={styles.root}>
          <Text style={[styles.title, { color: colors.text, fontFamily: fonts.display }]}>{t('editor_step1_title').toUpperCase()}</Text>
          <Text style={{ color: colors.textDim, fontFamily: fonts.ui }}>{t('editor_step1_sub')}</Text>
          <Text style={label}>{t('editor_prog_name_label').toUpperCase()}</Text>
          <TextInput
            testID="meta-label"
            value={program.meta.label}
            maxLength={100}
            placeholder={t('editor_prog_name_ph')}
            placeholderTextColor={colors.textDim}
            onChangeText={(v) => apply(ctx, (d) => setMeta(d, { label: v }))}
            style={[styles.input, { color: colors.text, fontFamily: fonts.uiBold, borderColor: colors.border, borderRadius: radius.sm }]}
          />
          <Text style={label}>{t('editor_prog_units_label').toUpperCase()}</Text>
          <Segmented<Units>
            options={[{ value: 'kg', label: 'KG' }, { value: 'lbs', label: 'LBS' }]}
            value={program.meta.units}
            onChange={(v) => apply(ctx, (d) => setMeta(d, { units: v }))}
          />
          <Text style={label}>{t('editor_rest_default_label').toUpperCase()}</Text>
          <NumberStepper
            value={program.meta.restDefaultSec}
            min={10}
            max={600}
            step={15}
            label={t('editor_rest_default_label')}
            onChange={(v) => apply(ctx, (d) => setMeta(d, { restDefaultSec: v }))}
          />
          <Text style={label}>{t('editor_rules_section').toUpperCase()}</Text>
          <ListEditor
            items={program.rules}
            onChange={(rules) => apply(ctx, (d) => setRules(d, rules))}
            placeholder={t('editor_rule_ph')}
            addLabel={t('editor_add_rule')}
            maxItems={20}
            maxLength={200}
            testID="rules"
          />
          <Pressable accessibilityRole="button" onPress={() => nav.goToStep(2, 1)} style={[styles.next, { backgroundColor: colors.gold, borderRadius: radius.md }]}>
            <Text style={{ color: '#0a0a0a', fontFamily: fonts.uiBold }}>{t('step_next')}</Text>
          </Pressable>
        </View>
      ) : null}
    </EditorScreen>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10 },
  title: { fontSize: 36, letterSpacing: -0.5 },
  input: { minHeight: TOUCH_MIN + 4, borderWidth: 1, paddingHorizontal: 12, fontSize: 16 },
  next: { minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
});
