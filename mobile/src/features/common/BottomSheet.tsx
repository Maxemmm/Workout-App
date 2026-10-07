// Feuille modale en bas d'écran (Modal RN : natif et web)
// Hauteur bornée et contenu défilant : les formulaires longs restent utilisables clavier ouvert.
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
        <View
          testID="bottom-sheet"
          style={[styles.sheet, { backgroundColor: colors.bgElevated, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingTop: spacing.md }]}
        >
          <Text style={{ color: colors.text, fontFamily: fonts.display, fontSize: 24, paddingHorizontal: spacing.md }}>{title}</Text>
          <ScrollView
            testID="bottom-sheet-scroll"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 12, padding: spacing.md, paddingBottom: spacing.md + insets.bottom }}
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { maxHeight: '90%', gap: 4 },
});
