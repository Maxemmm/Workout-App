// Feuille modale en bas d'écran (Modal RN : natif et web)
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';

interface Props {
  visible: boolean;
  title: string;
  onClose(): void;
  children: ReactNode;
}

export function BottomSheet({ visible, title, onClose, children }: Props) {
  const { colors, fonts, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onClose} style={[styles.flex, styles.backdrop]} />
        <View style={[styles.sheet, { backgroundColor: colors.bgElevated, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.md, paddingBottom: spacing.md + insets.bottom }]}>
          <Text style={{ color: colors.text, fontFamily: fonts.display, fontSize: 24 }}>{title}</Text>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { gap: 12 },
});
