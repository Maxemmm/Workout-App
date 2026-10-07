// Retours haptiques natifs (spec §5.6) — échecs silencieux
import * as ExpoHaptics from 'expo-haptics';
import type { Haptics } from './types';

const quiet = (p: Promise<unknown>) => { p.catch(() => {}); };

export const haptics: Haptics = {
  light: () => quiet(ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Light)),
  success: () => quiet(ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Success)),
  warning: () => quiet(ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Warning)),
};
