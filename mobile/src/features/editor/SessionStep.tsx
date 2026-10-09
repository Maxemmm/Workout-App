// ============================================================
// Étape 4 — éditeur de séance : identité, type, couleur, puis
// exercices (lift/mixte) ou conseils (cardio/repos).
// ============================================================
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRepoCtx } from '@/db/DbContext';
import {
  addExercise, deleteExercise, duplicateExercise, moveExercise, sectionExercises, setBonusTitle,
  setSessionAccent, updateExercise, updateSession, type ExerciseSection, type SessionPatch,
} from '@/domain/draft';
import type { Exercise, SessionType } from '@/domain/program';
import { ListEditor } from '@/features/common/ListEditor';
import { Segmented } from '@/features/profile/Segmented';
import { ReorderableList } from '@/features/today/ReorderableList';
import { useI18n } from '@/i18n/I18nProvider';
import type { StringKey } from '@/i18n/translate';
import { useDraftStore } from '@/state/draftStore';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';
import { AccentPicker } from './AccentPicker';
import { EditorScreen } from './EditorScreen';
import { ExerciseRow } from './ExerciseRow';
import { blankExercise, ExerciseSheet } from './ExerciseSheet';
import type { EditorNav } from './nav';
import { TipsEditor } from './TipsEditor';

const TYPES: SessionType[] = ['lift', 'cardio', 'rest', 'mixed'];

export function SessionStep({ nav, sessionKey }: { nav: EditorNav; sessionKey: string }) {
  const ctx = useRepoCtx();
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  const draft = useDraftStore((s) => s.draft);
  const apply = useDraftStore((s) => s.apply);
  const [sheet, setSheet] = useState<{ section: ExerciseSection; exercise: Exercise | null } | null>(null);
  const session = draft?.program.sessions[sessionKey];
  const units = draft?.program.meta.units ?? 'kg';
  const restDefault = draft?.program.meta.restDefaultSec ?? 90;
  const { closeSession } = nav;

  // Séance disparue (supprimée ailleurs, lien périmé) → retour à la liste
  useEffect(() => {
    if (draft && !session) closeSession();
  }, [draft, session, closeSession]);

  const label = { color: colors.textDim, fontFamily: fonts.uiBold, fontSize: 11, letterSpacing: 1.5 };
  const field = [styles.input, { color: colors.text, fontFamily: fonts.ui, borderColor: colors.border, borderRadius: radius.sm }];
  const update = (patch: SessionPatch) => apply(ctx, (d) => updateSession(d, sessionKey, patch));

  const exerciseList = (section: ExerciseSection, onDragStateChange: (dragging: boolean) => void) => {
    if (!session) return null;
    const list = sectionExercises(session, section);
    return (
      <ReorderableList
        items={list}
        keyOf={(e) => e.id}
        onMove={(from, to) => apply(ctx, (d) => moveExercise(d, sessionKey, section, from, to))}
        onDragStateChange={onDragStateChange}
        moveUpLabel={t('today_move_up')}
        moveDownLabel={t('today_move_down')}
        renderItem={(e, _i, handle) => (
          <ExerciseRow
            exercise={e}
            header={handle}
            onEdit={() => setSheet({ section, exercise: e })}
            onDuplicate={() => apply(ctx, (d) => duplicateExercise(d, sessionKey, section, e.id).draft)}
            onDelete={() => apply(ctx, (d) => deleteExercise(d, sessionKey, section, e.id))}
          />
        )}
      />
    );
  };
  const addButton = (section: ExerciseSection, text: string) => (
    <Pressable accessibilityRole="button" onPress={() => setSheet({ section, exercise: null })} style={[styles.btn, { borderColor: colors.gold, borderWidth: 1, borderRadius: radius.md }]}>
      <Text style={{ color: colors.gold, fontFamily: fonts.uiBold }}>{text}</Text>
    </Pressable>
  );

  return (
    <EditorScreen nav={nav} onBack={closeSession}>
      {({ onDragStateChange }) => (session ? (
        <View style={styles.root}>
          <Text style={[styles.title, { color: colors.text, fontFamily: fonts.display }]}>{t('editor_edit_session').toUpperCase()}</Text>
          <Text style={label}>{t('editor_sess_name_label').toUpperCase()}</Text>
          <TextInput testID="sess-name" value={session.name} maxLength={100} placeholder={t('editor_sess_name_ph')} placeholderTextColor={colors.textDim} onChangeText={(name) => update({ name })} style={field} />
          <Text style={label}>{t('editor_sess_subtitle_label').toUpperCase()}</Text>
          <TextInput testID="sess-subtitle" value={session.subtitle ?? ''} maxLength={150} placeholder={t('editor_sess_subtitle_ph')} placeholderTextColor={colors.textDim} onChangeText={(v) => update({ subtitle: v || null })} style={field} />
          <Text style={label}>{t('editor_sess_note_label').toUpperCase()}</Text>
          <TextInput testID="sess-note" value={session.note ?? ''} maxLength={500} multiline placeholderTextColor={colors.textDim} onChangeText={(v) => update({ note: v || null })} style={field} />
          <Text style={label}>{t('editor_sess_type_label').toUpperCase()}</Text>
          <Segmented<SessionType>
            options={TYPES.map((type) => ({ value: type, label: t(`session_type_${type}` as StringKey) }))}
            value={session.type}
            onChange={(type) => update({ type })}
          />
          <Text style={label}>{t('editor_sess_accent_label').toUpperCase()}</Text>
          <AccentPicker value={session.accent} onChange={(accent) => apply(ctx, (d) => setSessionAccent(d, sessionKey, accent))} />

          {session.type === 'lift' || session.type === 'mixed' ? (
            <>
              <Text style={label}>{t('editor_warmup_section').toUpperCase()}</Text>
              <ListEditor items={session.warmup} onChange={(warmup) => update({ warmup })} placeholder={t('editor_warmup_ph')} addLabel={t('editor_add_warmup')} maxItems={20} maxLength={200} testID="warmup" />
              <Text style={label}>{t('editor_exercises_section').toUpperCase()}</Text>
              {exerciseList('main', onDragStateChange)}
              {addButton('main', t('editor_add_exercise'))}
              <Text style={label}>{t('editor_cardio_section').toUpperCase()}</Text>
              <TextInput
                testID="cardio-label"
                value={session.cardio?.label ?? ''}
                maxLength={100}
                placeholder={t('editor_cardio_label_ph')}
                placeholderTextColor={colors.textDim}
                onChangeText={(v) => update({ cardio: v ? { ...(session.cardio ?? {}), label: v, detail: session.cardio?.detail ?? null } : null })}
                style={field}
              />
              <TextInput
                testID="cardio-detail"
                value={session.cardio?.detail ?? ''}
                maxLength={200}
                placeholder={t('editor_cardio_detail_ph')}
                placeholderTextColor={colors.textDim}
                onChangeText={(v) => update({ cardio: session.cardio ? { ...session.cardio, detail: v || null } : null })}
                style={field}
              />
              <Text style={label}>{t('editor_bonus_section').toUpperCase()}</Text>
              <TextInput
                testID="bonus-title"
                value={session.bonus?.title ?? ''}
                maxLength={100}
                placeholder={t('editor_bonus_title_ph')}
                placeholderTextColor={colors.textDim}
                onChangeText={(v) => apply(ctx, (d) => setBonusTitle(d, sessionKey, v || null))}
                style={field}
              />
              {exerciseList('bonus', onDragStateChange)}
              {addButton('bonus', t('editor_add_bonus'))}
            </>
          ) : (
            <>
              <Text style={label}>{t('editor_tips_section').toUpperCase()}</Text>
              <TipsEditor tips={session.tips} onChange={(tips) => update({ tips })} />
            </>
          )}

          <Pressable accessibilityRole="button" onPress={closeSession} style={[styles.btn, { backgroundColor: colors.gold, borderRadius: radius.md }]}>
            <Text style={{ color: '#0a0a0a', fontFamily: fonts.uiBold }}>{t('editor_save_session_btn')}</Text>
          </Pressable>

          {sheet ? (
            <ExerciseSheet
              key={sheet.exercise?.id ?? `new-${sheet.section}`}
              visible
              isNew={sheet.exercise === null}
              initial={sheet.exercise ?? blankExercise()}
              units={units}
              restDefault={restDefault}
              onClose={() => setSheet(null)}
              onSave={(input) => {
                const target = sheet;
                setSheet(null);
                apply(ctx, (d) => (target.exercise
                  ? updateExercise(d, sessionKey, target.section, target.exercise.id, input)
                  : addExercise(d, sessionKey, target.section, input).draft));
              }}
            />
          ) : null}
        </View>
      ) : null)}
    </EditorScreen>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10 },
  title: { fontSize: 32, letterSpacing: -0.5 },
  input: { minHeight: TOUCH_MIN, borderWidth: 1, paddingHorizontal: 12 },
  btn: { minHeight: 52, alignItems: 'center', justifyContent: 'center' },
});
