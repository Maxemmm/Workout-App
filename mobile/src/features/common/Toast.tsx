// Toast global — affiché 2,5 s en haut, sous la barre d'état (jamais sous la barre de repos, les onglets ou le clavier)
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToastStore } from '@/state/toastStore';
import { useTheme } from '@/theme/ThemeProvider';

const VISIBLE_MS = 2500;

export function Toast() {
  const message = useToastStore((s) => s.message);
  const seq = useToastStore((s) => s.seq);
  const { colors, fonts, radius } = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!message) return;
    const id = setTimeout(() => useToastStore.getState().hide(), VISIBLE_MS);
    return () => clearTimeout(id);
  }, [message, seq]);

  if (!message) return null;
  return (
    <View testID="toast" pointerEvents="none" style={[styles.wrap, { top: insets.top + 8 }]}>
      <View accessibilityLiveRegion="polite" style={[styles.toast, { backgroundColor: colors.bgElevated, borderColor: colors.border, borderRadius: radius.md }]}>
        <Text style={{ color: colors.text, fontFamily: fonts.uiMedium }}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  toast: { paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1 },
});
