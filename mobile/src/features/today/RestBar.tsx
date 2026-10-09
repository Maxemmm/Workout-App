// ============================================================
// Barre de repos flottante — temps restant, progression, ±15 s, Passer.
// Rafraîchit son propre affichage (≈ 4 fois/s) sans re-rendre l'écran.
// ============================================================
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRepoCtx } from '@/db/DbContext';
import { remainingSec } from '@/domain/progress';
import { ADJUST_STEP_SEC, timerPhase, timerProgress } from '@/domain/timer';
import { useI18n } from '@/i18n/I18nProvider';
import { usePrefs } from '@/state/prefsStore';
import { useTimerStore } from '@/state/timerStore';
import { readableOn } from '@/theme/resolve';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';
import { completeWorkTimer } from './actions';

const TICK_MS = 250;

function formatClock(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

interface Props {
  exerciseName(exerciseId: string): string;
  onPressBar(exerciseId: string): void;
}

export function RestBar({ exerciseName, onPressBar }: Props) {
  const ctx = useRepoCtx();
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  const timer = useTimerStore((s) => s.timer);
  const flash = useTimerStore((s) => s.flash);
  const [now, setNow] = useState(() => Date.now());

  // Un seul intervalle tant que la barre est visible : ne pas le relancer à chaque changement du minuteur
  const live = timer !== null || (flash !== null && now < flash.until);
  useEffect(() => {
    if (!live) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [live]);

  if (!timer && !(flash && now < flash.until)) return null;

  const exerciseId = timer?.exerciseId ?? flash!.exerciseId;
  const phase = timer ? timerPhase(timer, now) : 'done';
  const bg = phase === 'done' ? colors.greenDone : phase === 'critical' ? colors.redTimer : colors.bgElevated;
  // Fond vert / rouge : texte noir ou blanc selon le meilleur contraste
  const fg = phase === 'running' ? colors.text : readableOn(bg);
  const label = timer?.mode === 'work' ? t('timer_work') : t('timer_rest');
  const clock = timer ? formatClock(remainingSec(timer.endAt, now)) : t('timer_done');

  const skip = () => {
    if (!timer) return;
    if (timer.mode === 'work') completeWorkTimer(ctx, timer, Date.now(), true);
    else useTimerStore.getState().finish(ctx, null);
    usePrefs.getState().bumpData();
  };
  const adjust = (delta: number) => useTimerStore.getState().adjust(ctx, delta, Date.now());

  const small = [styles.small, { backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: radius.sm }];
  const smallText = { color: fg, fontFamily: fonts.uiBold, fontSize: 13 };
  return (
    <View style={[styles.wrap, { backgroundColor: bg, borderColor: colors.border, borderRadius: radius.lg }]}>
      <Pressable testID="rest-bar" accessibilityRole="button" onPress={() => onPressBar(exerciseId)} style={styles.main}>
        <View style={styles.flex}>
          <Text style={{ color: fg, fontFamily: fonts.uiBold, fontSize: 11, letterSpacing: 1.5 }}>{label}</Text>
          <Text numberOfLines={1} style={{ color: fg, fontFamily: fonts.uiMedium }}>{exerciseName(exerciseId)}</Text>
        </View>
        <Text style={{ color: fg, fontFamily: fonts.display, fontSize: 36 }}>{clock}</Text>
      </Pressable>
      {timer ? (
        <>
          <View style={[styles.track, { backgroundColor: `${fg}33` }]}>
            <View style={[styles.fill, { width: `${timerProgress(timer, now) * 100}%`, backgroundColor: fg }]} />
          </View>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('timer_minus')} onPress={() => adjust(-ADJUST_STEP_SEC)} style={small}>
              <Text style={smallText}>{t('timer_minus')}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t('timer_plus')} onPress={() => adjust(ADJUST_STEP_SEC)} style={small}>
              <Text style={smallText}>{t('timer_plus')}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t('timer_skip')} onPress={skip} style={small}>
              <Text style={smallText}>{t('timer_skip')}</Text>
            </Pressable>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, bottom: 12, borderWidth: 1, padding: 12, gap: 8 },
  main: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4 },
  actions: { flexDirection: 'row', gap: 8 },
  small: { flex: 1, minHeight: TOUCH_MIN, alignItems: 'center', justifyContent: 'center' },
});
