// ============================================================
// ONBOARDING — créer, importer, ou essayer le programme exemple ; langue.
// ============================================================
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { APP_NAME } from '@/config';
import example from '@/data/program.example.json';
import { useRepoCtx } from '@/db/DbContext';
import { createProgram, setActiveProgram } from '@/db/repos/programsRepo';
import { setSetting } from '@/db/repos/settingsRepo';
import type { Lang } from '@/domain/prefs';
import { Screen } from '@/features/common/Screen';
import { prepareEditor } from '@/features/editor/openEditor';
import { Segmented } from '@/features/profile/Segmented';
import { useI18n } from '@/i18n/I18nProvider';
import { usePrefs } from '@/state/prefsStore';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';

interface Props {
  onCreate(): void;
  onImport(): void;
  onStarted(): void;
}

export function OnboardingScreen({ onCreate, onImport, onStarted }: Props) {
  const ctx = useRepoCtx();
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  const lang = usePrefs((s) => s.lang);

  const create = async () => {
    if (await prepareEditor(ctx, { kind: 'new' }, async () => true)) onCreate();
  };
  const tryExample = () => {
    const p = createProgram(ctx, example, 'example');
    setActiveProgram(ctx, p.id);
    setSetting(ctx, 'onboarded', true);
    usePrefs.getState().bumpData();
    onStarted();
  };

  return (
    <Screen safeBottom>
      <View style={styles.root}>
        <Text style={[styles.title, { color: colors.gold, fontFamily: fonts.display }]}>{APP_NAME.toUpperCase()}</Text>
        <Text style={{ color: colors.text, fontFamily: fonts.uiMedium, fontSize: 18 }}>{t('onboarding_tagline')}</Text>
        <Segmented<Lang>
          options={[{ value: 'fr', label: 'FR' }, { value: 'en', label: 'EN' }]}
          value={lang}
          onChange={(v) => usePrefs.getState().setLang(ctx, v)}
        />
        <Pressable accessibilityRole="button" onPress={() => void create()} style={[styles.btn, { backgroundColor: colors.gold, borderRadius: radius.md }]}>
          <Text style={{ color: colors.onGold, fontFamily: fonts.uiBold }}>{t('onboarding_create')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onImport} style={[styles.btn, { borderColor: colors.gold, borderWidth: 1, borderRadius: radius.md }]}>
          <Text style={{ color: colors.gold, fontFamily: fonts.uiBold }}>{t('onboarding_import')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={tryExample} style={styles.link}>
          <Text style={{ color: colors.textDim, fontFamily: fonts.uiMedium, textDecorationLine: 'underline' }}>{t('onboarding_example')}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { gap: 16, paddingTop: 48 },
  title: { fontSize: 56, letterSpacing: -1 },
  btn: { minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  link: { minHeight: TOUCH_MIN, alignItems: 'center', justifyContent: 'center' },
});
