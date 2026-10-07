// Erreur de rendu d'un onglet : message + « Recharger l'onglet »
import { Component, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useI18n } from '@/i18n/I18nProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { TOUCH_MIN } from '@/theme/tokens';

function Fallback({ onReload }: { onReload(): void }) {
  const { colors, fonts, radius } = useTheme();
  const { t } = useI18n();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.bg, padding: 24 }}>
      <Text style={{ color: colors.text, fontFamily: fonts.uiBold }}>{t('error_tab')}</Text>
      <Pressable accessibilityRole="button" onPress={onReload} style={{ minHeight: TOUCH_MIN, paddingHorizontal: 20, justifyContent: 'center', backgroundColor: colors.gold, borderRadius: radius.md }}>
        <Text style={{ color: '#0a0a0a', fontFamily: fonts.uiBold }}>{t('error_reload_tab')}</Text>
      </Pressable>
    </View>
  );
}

export class TabErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean; attempt: number }> {
  state = { failed: false, attempt: 0 };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return <Fallback onReload={() => this.setState((s) => ({ failed: false, attempt: s.attempt + 1 }))} />;
    return <View key={this.state.attempt} style={{ flex: 1 }}>{this.props.children}</View>;
  }
}
