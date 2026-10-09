// Feuille modale en bas d'écran (Modal RN : natif et web)
// Hauteur bornée et contenu défilant : les formulaires longs restent utilisables clavier ouvert.
// - zone haute réservée (barre d'état / encoche) : la feuille ne passe jamais dessous ;
// - la feuille rétrécit quand le clavier réduit la place (son contenu défile) au lieu de déborder ;
// - pied optionnel hors du défilement : les actions (Annuler / Enregistrer) restent visibles ;
// - transition : le voile apparaît en fondu, seule la feuille glisse depuis le bas.
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View, Modal } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';

const TOP_GAP = 8;

interface Props {
  visible: boolean;
  title: string;
  onClose(): void;
  children: ReactNode;
  /** Actions fixes sous le contenu défilant */
  footer?: ReactNode;
}

export function BottomSheet({ visible, title, onClose, children, footer }: Props) {
  const { colors, fonts, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = spacing.md + insets.bottom;
  return (
    <Modal testID="bottom-sheet-modal" visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView
        testID="bottom-sheet-frame"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.flex, styles.backdrop, { paddingTop: insets.top + TOP_GAP }]}
      >
        <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onClose} style={styles.flex} />
        <Animated.View
          entering={SlideInDown.duration(240)}
          testID="bottom-sheet"
          style={[styles.sheet, { backgroundColor: colors.bgElevated, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingTop: spacing.md }]}
        >
          <Text style={{ color: colors.text, fontFamily: fonts.display, fontSize: 24, paddingHorizontal: spacing.md }}>{title}</Text>
          <ScrollView
            testID="bottom-sheet-scroll"
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            style={styles.scroll}
            contentContainerStyle={{ gap: 12, padding: spacing.md, paddingBottom: footer ? spacing.sm : bottomPad }}
          >
            {children}
          </ScrollView>
          {footer ? (
            <View testID="bottom-sheet-footer" style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: bottomPad, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
              {footer}
            </View>
          ) : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { maxHeight: '90%', flexShrink: 1, gap: 4 },
  scroll: { flexGrow: 0, flexShrink: 1 },
});
