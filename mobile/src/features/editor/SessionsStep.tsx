// Étape 2 — séances : liste réordonnable, créer / modifier / dupliquer / supprimer
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRepoCtx } from '@/db/DbContext';
import { addSession, deleteSession, duplicateSession, moveSession } from '@/domain/draft';
import { ReorderableList } from '@/features/today/ReorderableList';
import { useI18n } from '@/i18n/I18nProvider';
import { confirm } from '@/platform/confirm';
import { useDraftStore } from '@/state/draftStore';
import { useTheme } from '@/theme/ThemeProvider';
import { EditorScreen } from './EditorScreen';
import type { EditorNav } from './nav';
import { SessionCard } from './SessionCard';

export function SessionsStep({ nav }: { nav: EditorNav }) {
  const ctx = useRepoCtx();
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  const program = useDraftStore((s) => s.draft?.program);
  const apply = useDraftStore((s) => s.apply);
  const keys = program ? Object.keys(program.sessions) : [];

  const create = () => {
    let created = '';
    apply(ctx, (d) => {
      const r = addSession(d);
      created = r.key;
      return r.draft;
    });
    if (created) nav.openSession(created);
  };
  const remove = async (key: string) => {
    const name = program?.sessions[key]?.name || t('editor_no_name');
    const ok = await confirm({ title: t('editor_delete'), message: t('editor_confirm_delete_session', name), confirmLabel: t('editor_delete'), cancelLabel: t('editor_cancel'), destructive: true });
    if (ok) apply(ctx, (d) => deleteSession(d, key));
  };

  return (
    <EditorScreen nav={nav} step={2}>
      {({ onDragStateChange }) => (program ? (
        <View style={styles.root}>
          <Text style={[styles.title, { color: colors.text, fontFamily: fonts.display }]}>{t('editor_step2_title').toUpperCase()}</Text>
          <Text style={{ color: colors.textDim, fontFamily: fonts.ui }}>
            {program.meta.label ? t('editor_step2_sub_named', program.meta.label) : t('editor_step2_sub')}
          </Text>
          {keys.length === 0 ? <Text style={{ color: colors.textDim, fontFamily: fonts.ui }}>{t('editor_no_sessions')}</Text> : null}
          <ReorderableList
            items={keys}
            keyOf={(k) => k}
            onMove={(from, to) => apply(ctx, (d) => moveSession(d, from, to))}
            onDragStateChange={onDragStateChange}
            moveUpLabel={t('today_move_up')}
            moveDownLabel={t('today_move_down')}
            renderItem={(key, _i, handle) => (
              <SessionCard
                session={program.sessions[key]}
                header={handle}
                onEdit={() => nav.openSession(key)}
                onDuplicate={() => apply(ctx, (d) => duplicateSession(d, key, t('editor_copy_suffix')).draft)}
                onDelete={() => void remove(key)}
              />
            )}
          />
          <Pressable accessibilityRole="button" onPress={create} style={[styles.btn, { borderColor: colors.gold, borderWidth: 1, borderRadius: radius.md }]}>
            <Text style={{ color: colors.gold, fontFamily: fonts.uiBold }}>{t('editor_add_session_btn')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => nav.goToStep(3)} style={[styles.btn, { backgroundColor: colors.gold, borderRadius: radius.md }]}>
            <Text style={{ color: '#0a0a0a', fontFamily: fonts.uiBold }}>{t('editor_configure_planning')}</Text>
          </Pressable>
        </View>
      ) : null)}
    </EditorScreen>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  title: { fontSize: 36, letterSpacing: -0.5 },
  btn: { minHeight: 52, alignItems: 'center', justifyContent: 'center' },
});
