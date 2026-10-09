// ============================================================
// Séance lift / mixed — cartes, compteur, blocs, pied, feuilles.
// Lit tout par useDbQuery(loadTodayView) ; chaque action écrit puis bumpData.
// ============================================================
import { useEffect, useState, type ReactElement } from 'react';
import { View } from 'react-native';
import { useRepoCtx } from '@/db/DbContext';
import type { StoredProgram } from '@/db/repos/programsRepo';
import { getSetting } from '@/db/repos/settingsRepo';
import type { RepoCtx } from '@/db/types';
import { weightKey, type EffectiveExercise } from '@/domain/exerciseView';
import type { Session } from '@/domain/program';
import { restDurationSec, sessionProgress, sessionSummary } from '@/domain/progress';
import { schemeReps } from '@/domain/scheme';
import { useDbQuery } from '@/features/common/useDbQuery';
import { AlertsPermissionSheet } from '@/features/notifications/AlertsPermissionSheet';
import { shouldAskForAlerts } from '@/features/notifications/permissionFlow';
import { useI18n } from '@/i18n/I18nProvider';
import { confirm } from '@/platform/confirm';
import { keepAwake } from '@/platform/keepAwake';
import { restNotifier } from '@/platform/restNotifier';
import { usePrefs } from '@/state/prefsStore';
import { useTimerStore } from '@/state/timerStore';
import { useToastStore } from '@/state/toastStore';
import {
  changeWeight, finishToday, hasCheckedSets, moveExercise, pressSet, reopenToday,
  resetToday, saveSetValues, swapExercise, type TodayEnv,
} from './actions';
import { BonusBlock } from './BonusBlock';
import { CardioBlock } from './CardioBlock';
import { CompletedSummary } from './CompletedSummary';
import { ExerciseCard } from './ExerciseCard';
import { ProgressBar } from './ProgressBar';
import { ReorderableList } from './ReorderableList';
import { RulesBlock } from './RulesBlock';
import { SessionNote } from './SessionNote';
import { SetEditSheet } from './SetEditSheet';
import { SwapSheet } from './SwapSheet';
import { TodayFooter } from './TodayFooter';
import { cardWeight, loadTodayView } from './todayView';
import { WarmupBlock } from './WarmupBlock';

const readKeepAwake = (ctx: RepoCtx) => getSetting(ctx, 'keepAwake') !== false;

/** Exécute une écriture puis rafraîchit l'écran ; false (et toast d'erreur) si elle a échoué.
 *  Fonction de module : un try/finally dans le composant empêcherait le React Compiler de l'optimiser. */
function attempt(write: () => void, errorMessage: string): boolean {
  try {
    write();
    return true;
  } catch {
    useToastStore.getState().show(errorMessage);
    return false;
  } finally {
    usePrefs.getState().bumpData();
  }
}

/** Après une série qui démarre un minuteur : faut-il proposer les alertes de fin de repos ? */
async function needsAlertsPrompt(ctx: RepoCtx): Promise<boolean> {
  if (useTimerStore.getState().timer === null) return false;
  try {
    return shouldAskForAlerts(ctx, await restNotifier.permission());
  } catch {
    return false;
  }
}

export interface TodaySessionBodyProps {
  program: StoredProgram;
  sessionKey: string;
  session: Session;
  /** Date de la séance affichée (jour local) */
  date: string;
  focused: boolean;
  onDragStateChange(dragging: boolean): void;
  /** Position d'une carte dans la liste (relative à la liste) */
  onCardLayout(exerciseId: string, y: number): void;
  /** Position de la liste dans le bloc de séance */
  onListLayout(y: number): void;
  /** Noms des exercices affichés, pour la barre de repos */
  onExerciseNames(names: Record<string, string>): void;
}

export function TodaySessionBody(p: TodaySessionBodyProps) {
  const ctx = useRepoCtx();
  const { t } = useI18n();
  const view = useDbQuery(loadTodayView, p.program, p.sessionKey, p.date);
  const keepAwakePref = useDbQuery(readKeepAwake);
  const timer = useTimerStore((s) => s.timer);
  const [editing, setEditing] = useState<{ ex: EffectiveExercise; setIndex: number } | null>(null);
  const [swapping, setSwapping] = useState<EffectiveExercise | null>(null);
  const [askAlerts, setAskAlerts] = useState(false);

  const meta = p.program.definition.meta;
  const units = meta.units;
  const accent = p.session.accent;
  const completed = view.workout?.status === 'completed';
  const inProgress = view.workout?.status === 'in_progress';
  const progress = sessionProgress({ ...p.session, exercises: view.exercises }, view.track);

  // Écran allumé : séance en cours + onglet affiché + réglage actif
  const awake = p.focused && inProgress && keepAwakePref;
  useEffect(() => {
    if (!awake) return;
    keepAwake.activate();
    return () => keepAwake.deactivate();
  }, [awake]);

  // Noms pour la barre de repos — dépendre de la fonction (stable) et non de `p` (nouvel objet à chaque rendu → boucle)
  const { onExerciseNames } = p;
  const names = Object.fromEntries([...view.exercises, ...view.bonus].map((e) => [e.id, e.name]));
  const namesKey = JSON.stringify(names);
  useEffect(() => { onExerciseNames(JSON.parse(namesKey) as Record<string, string>); }, [namesKey, onExerciseNames]);

  const env = (): TodayEnv => ({ ctx, nowMs: Date.now(), program: p.program, sessionKey: p.sessionKey, date: p.date });
  const run = (fn: () => void) => attempt(fn, t('error_not_saved'));

  const onFinish = async () => {
    if (progress.done < progress.total) {
      const ok = await confirm({ title: t('modal_finish_title'), message: t('modal_finish_body'), confirmLabel: t('modal_finish_confirm'), cancelLabel: t('modal_finish_cancel') });
      if (!ok) return;
    }
    if (run(() => finishToday(env(), view))) useToastStore.getState().show(t('today_session_saved_toast'));
  };
  const onReset = async () => {
    const ok = await confirm({ title: t('profile_reset_today'), message: t('today_reset_confirm_body'), confirmLabel: t('today_reset_action'), cancelLabel: t('today_cancel'), destructive: true });
    if (!ok) return;
    if (run(() => resetToday(env(), view))) useToastStore.getState().show(t('profile_reset_today_toast'));
  };
  const onSwapSelect = async (name: string | null) => {
    const ex = swapping;
    setSwapping(null);
    if (!ex || name === ex.performedName) return;
    if (hasCheckedSets(view, ex.id)) {
      const ok = await confirm({ title: t('today_swap_confirm_title'), message: t('today_swap_confirm_body'), confirmLabel: t('today_swap_action'), cancelLabel: t('today_cancel') });
      if (!ok) return;
    }
    run(() => swapExercise(env(), view, ex, name));
  };

  const pendingFor = (ex: EffectiveExercise) =>
    timer?.mode === 'work' && timer.exerciseId === ex.id && timer.workoutId === view.workout?.id ? timer.setIndex : null;

  const card = (ex: EffectiveExercise, handle?: (title: ReactElement) => ReactElement) => (
    <ExerciseCard
      exercise={ex}
      units={units}
      accent={accent}
      done={view.track[ex.id] ?? []}
      weight={cardWeight(view, ex)}
      restSec={restDurationSec(ex, meta)}
      last={view.last[weightKey(ex.id, ex.performedName)] ?? null}
      locked={completed}
      pendingSet={pendingFor(ex)}
      onPressSet={(i) => {
        if (run(() => pressSet(env(), view, ex, i))) {
          void needsAlertsPrompt(ctx).then((ask) => { if (ask) setAskAlerts(true); });
        }
      }}
      onLongPressSet={(i) => setEditing({ ex, setIndex: i })}
      onChangeWeight={(v) => run(() => changeWeight(env(), ex, v))}
      onSwap={ex.alternatives.length > 0 && !completed ? () => setSwapping(ex) : undefined}
      onPressRest={() => { if (timer?.exerciseId === ex.id) useTimerStore.getState().clear(ctx); }}
      header={handle}
    />
  );

  const editingEntry = editing ? view.entries.find((e) => e.exerciseId === editing.ex.id && e.setIndex === editing.setIndex) : undefined;
  const bonusDone = view.bonus.reduce((n, b) => n + (view.track[b.id] ?? []).filter(Boolean).length, 0);

  return (
    <View style={{ gap: 16 }}>
      {completed && view.workout ? (
        <CompletedSummary
          summary={sessionSummary(view.entries, view.workout.startedAt, view.workout.completedAt)}
          units={units}
          onReopen={() => run(() => reopenToday(env(), view))}
        />
      ) : null}
      <ProgressBar done={progress.done} total={progress.total} accent={accent} />
      {p.session.note ? <SessionNote text={p.session.note} /> : null}
      <WarmupBlock items={p.session.warmup} />
      <View testID="today-list" onLayout={(e) => p.onListLayout(e.nativeEvent.layout.y)}>
        <ReorderableList
          items={view.exercises}
          keyOf={(ex) => ex.id}
          onMove={(from, to) => run(() => moveExercise(env(), view, from, to))}
          onDragStateChange={p.onDragStateChange}
          onItemLayout={p.onCardLayout}
          moveUpLabel={t('today_move_up')}
          moveDownLabel={t('today_move_down')}
          renderItem={(ex, _i, handle) => card(ex, completed ? undefined : handle)}
        />
      </View>
      {p.session.cardio?.label ? <CardioBlock label={p.session.cardio.label} detail={p.session.cardio.detail} /> : null}
      {view.bonus.length > 0 ? (
        <BonusBlock title={p.session.bonus?.title}>
          {view.bonus.map((ex) => <View key={ex.id}>{card(ex)}</View>)}
        </BonusBlock>
      ) : null}
      <RulesBlock rules={p.program.definition.rules} />
      <TodayFooter
        canFinish={!completed && progress.done + bonusDone > 0}
        showReset={view.workout !== null}
        onFinish={onFinish}
        onReset={onReset}
      />
      {editing ? (
        <SetEditSheet
          key={`${editing.ex.id}-${editing.setIndex}`}
          visible
          setIndex={editing.setIndex}
          units={units}
          initialWeight={editingEntry?.weight ?? cardWeight(view, editing.ex)}
          initialReps={editingEntry?.reps ?? schemeReps(editing.ex)}
          onClose={() => setEditing(null)}
          onSave={(values) => {
            const target = editing;
            setEditing(null);
            run(() => saveSetValues(env(), view, target.ex, target.setIndex, values));
          }}
        />
      ) : null}
      <AlertsPermissionSheet visible={askAlerts} onClose={() => setAskAlerts(false)} />
      <SwapSheet visible={swapping !== null} exercise={swapping} onSelect={onSwapSelect} onClose={() => setSwapping(null)} />
    </View>
  );
}
