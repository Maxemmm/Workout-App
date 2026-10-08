// ============================================================
// TODAY — séance du jour (ou du jour choisi), séance d'hier à reprendre,
// barre de repos flottante. Aucune séance ni jour en dur : tout vient du programme.
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { AppState, type ScrollView } from 'react-native';
import { useRepoCtx } from '@/db/DbContext';
import { findStaleInProgress } from '@/db/repos/workoutsRepo';
import { localDateKey, resolveDay, weekdayOf, weekStrip, type DayPlan, type Weekday } from '@/domain/schedule';
import { Screen } from '@/features/common/Screen';
import { useDbQuery } from '@/features/common/useDbQuery';
import { prepareEditor } from '@/features/editor/openEditor';
import { msUntilNextDay } from '@/features/common/useTodayKey';
import { useI18n } from '@/i18n/I18nProvider';
import { confirm } from '@/platform/confirm';
import { usePrefs } from '@/state/prefsStore';
import { useTimerStore } from '@/state/timerStore';
import { useToastStore } from '@/state/toastStore';
import { finishStale } from './actions';
import { formatShortDate } from './formatDate';
import { NoProgram } from './NoProgram';
import { RestBar } from './RestBar';
import { RestDayScreen } from './RestDayScreen';
import { ResumeBanner } from './ResumeBanner';
import { TimerDriver } from './TimerDriver';
import { TipsList } from './TipsList';
import { TodayHeader } from './TodayHeader';
import { TodaySessionBody } from './TodaySessionBody';
import { useActiveProgram } from './useActiveProgram';
import { WeekStrip } from './WeekStrip';

const REST_BAR_SPACE = 150;


interface Props {
  focused?: boolean;
  /** Pas de programme : ouvrir l'éditeur (brouillon neuf déjà prêt) */
  onOpenEditor?(): void;
  onOpenImport?(): void;
}

export function TodayScreen({ focused = true, onOpenEditor, onOpenImport }: Props) {
  const ctx = useRepoCtx();
  const program = useActiveProgram();
  const { t, tList } = useI18n();
  const [todayKey, setTodayKey] = useState(() => localDateKey(new Date()));
  const today = new Date();
  const [selected, setSelected] = useState<Weekday>(weekdayOf(today));
  const [resumedId, setResumedId] = useState<string | null>(null);

  // Changement de jour (minuit app ouverte, ou retour au premier plan) : on bascule sur le jour courant ;
  // une séance de la veille restée en cours est alors proposée par le bandeau.
  useEffect(() => {
    const refresh = () => {
      const now = new Date();
      const key = localDateKey(now);
      if (key === todayKey) return;
      setTodayKey(key);
      setSelected(weekdayOf(now));
      setResumedId(null);
    };
    const id = setTimeout(refresh, msUntilNextDay(new Date()));
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') refresh(); });
    return () => { clearTimeout(id); sub.remove(); };
  }, [todayKey]);
  const [dragging, setDragging] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});
  const scrollRef = useRef<ScrollView>(null);
  const cardY = useRef<Record<string, number>>({});
  const stale = useDbQuery(findStaleInProgress, todayKey);
  const timerVisible = useTimerStore((s) => s.timer !== null || s.flash !== null);

  if (!program) {
    const create = async () => {
      const ok = await prepareEditor(ctx, { kind: 'new' }, () =>
        confirm({ title: t('editor_replace_draft_title'), confirmLabel: t('editor_discard'), cancelLabel: t('editor_keep'), destructive: true }));
      if (ok) onOpenEditor?.();
    };
    return (
      <Screen>
        <NoProgram onCreate={() => void create()} onImport={() => onOpenImport?.()} />
      </Screen>
    );
  }

  const def = program.definition;
  const daysShort = tList('days_short');
  const monthsShort = tList('months_short');
  const staleSession = stale && stale.programId === program.id && Object.hasOwn(def.sessions, stale.sessionKey)
    ? def.sessions[stale.sessionKey] : undefined;
  const resumed = stale !== null && resumedId === stale.id && staleSession !== undefined;

  const plan: DayPlan = resumed
    ? { kind: 'session', weekday: selected, sessionKey: stale.sessionKey, session: staleSession }
    : resolveDay(def, selected);
  const date = resumed ? stale.date : todayKey;
  const staleLabel = stale ? formatShortDate(new Date(`${stale.date}T12:00:00`), daysShort, monthsShort) : '';

  const onFinishStale = () => {
    if (!stale) return;
    try {
      finishStale(ctx, stale.id);
      useToastStore.getState().show(t('today_session_saved_toast'));
    } catch {
      useToastStore.getState().show(t('error_not_saved'));
    } finally {
      setResumedId(null);
      usePrefs.getState().bumpData();
    }
  };
  const scrollToCard = (exerciseId: string) => {
    const y = cardY.current[exerciseId];
    if (y !== undefined) scrollRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true });
  };

  return (
    <Screen
      scrollRef={scrollRef}
      scrollEnabled={!dragging}
      bottomInset={timerVisible ? REST_BAR_SPACE : 0}
      overlay={<RestBar exerciseName={(id) => names[id] ?? ''} onPressBar={scrollToCard} />}
    >
      <TimerDriver />
      <TodayHeader programLabel={def.meta.label} dateLabel={formatShortDate(today, daysShort, monthsShort)} plan={plan} />
      <WeekStrip
        days={weekStrip(def, today)}
        selected={selected}
        dayLabels={daysShort.map((d) => d.toUpperCase())}
        onSelect={(d) => { setSelected(d); setResumedId(null); }}
      />
      {stale ? (
        <ResumeBanner
          dateLabel={staleLabel}
          canResume={staleSession !== undefined && !resumed}
          onResume={() => setResumedId(stale.id)}
          onFinish={onFinishStale}
        />
      ) : null}
      {plan.kind === 'implicit-rest' ? <RestDayScreen /> : null}
      {plan.kind === 'session' && (plan.session.type === 'cardio' || plan.session.type === 'rest') ? (
        <TipsList tips={plan.session.tips} accent={plan.session.accent} />
      ) : null}
      {plan.kind === 'session' && (plan.session.type === 'lift' || plan.session.type === 'mixed') ? (
        <TodaySessionBody
          key={`${plan.sessionKey}-${date}`}
          program={program}
          sessionKey={plan.sessionKey}
          session={plan.session}
          date={date}
          focused={focused}
          onDragStateChange={setDragging}
          onCardLayout={(id, y) => { cardY.current[id] = y; }}
          onExerciseNames={setNames}
        />
      ) : null}
    </Screen>
  );
}
