// Toast global — affiché 2,5 s au-dessus de la barre d'onglets
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useToastStore } from '@/state/toastStore';
import { useTheme } from '@/theme/ThemeProvider';

const VISIBLE_MS = 2500;

export function Toast() {
  const message = useToastStore((s) => s.message);
  const seq = useToastStore((s) => s.seq);
  const { colors, fonts, radius } = useTheme();

  useEffect(() => {
    if (!message) return;
    const id = setTimeout(() => useToastStore.getState().hide(), VISIBLE_MS);
    return () => clearTimeout(id);
  }, [message, seq]);

  if (!message) return null;
  return (
    <View pointerEvents="none" style={styles.wrap}>
      <View accessibilityLiveRegion="polite" style={[styles.toast, { backgroundColor: colors.bgElevated, borderColor: colors.border, borderRadius: radius.md }]}>
        <Text style={{ color: colors.text, fontFamily: fonts.uiMedium }}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, bottom: 96, alignItems: 'center' },
  toast: { paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1 },
});
