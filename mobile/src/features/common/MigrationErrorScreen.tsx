// Écran bloquant si une migration SQLite échoue : aucune perte, export brut possible
import { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { dumpRawTables } from '@/db/client';

export function MigrationErrorScreen({ error }: { error: Error }) {
  const [exportError, setExportError] = useState<string | null>(null);
  // Tout l'export (lecture + partage) est protégé : un échec s'affiche au lieu de planter
  const exportRaw = async () => {
    try {
      setExportError(null);
      await Share.share({ message: dumpRawTables() });
    } catch (e) {
      setExportError(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Mise à jour des données impossible</Text>
        <Text style={styles.body}>
          Vos données n'ont pas été supprimées. Exportez-les avant de réinstaller ou de contacter le support.
        </Text>
        <Text selectable style={styles.code}>{error.message}</Text>
        {exportError && <Text selectable style={styles.code}>{`Export impossible : ${exportError}`}</Text>}
        <Pressable accessibilityRole="button" onPress={exportRaw} style={styles.button}>
          <Text style={styles.buttonText}>EXPORTER LES DONNÉES BRUTES</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

// Couleurs fixes : le thème n'est pas encore disponible à ce stade
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 24, paddingTop: 80, gap: 16 },
  title: { color: '#f5f5f5', fontSize: 22, fontWeight: '800' },
  body: { color: '#8a8a8a', fontSize: 15 },
  code: { color: '#d23a3a', fontSize: 12, fontFamily: 'monospace' },
  button: { minHeight: 52, borderRadius: 12, backgroundColor: '#d4a23c', alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#0a0a0a', fontWeight: '700' },
});
