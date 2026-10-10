// Illustration animée d'un exercice : 3 images SVG en boucle (~0,8 s), recolorées au thème ;
// pastille du muscle si pas d'illustration ou lecture impossible ; immobile si « Réduire les animations »
import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { ILLUSTRATIONS } from '@/data/library/illustrations';
import { muscleLabel, type MuscleKey } from '@/domain/library/muscles';
import { useI18n } from '@/i18n/I18nProvider';
import { readAssetText } from '@/platform/assetText';
import { useTheme } from '@/theme/ThemeProvider';

const FRAME_MS = 800;
const cache = new Map<string, Promise<string[]>>();

/** Les 3 images d'un exercice (mises en cache pour la session) */
function loadFrames(slug: string): Promise<string[]> {
  const mods = ILLUSTRATIONS[slug];
  if (!mods) return Promise.reject(new Error('illustration inconnue'));
  let p = cache.get(slug);
  if (!p) {
    p = Promise.all(mods.map(readAssetText));
    p.catch(() => cache.delete(slug));
    cache.set(slug, p);
  }
  return p;
}

/** Les dessins workout-guide sont blancs : recolorés à la couleur de texte du thème */
const recolor = (xml: string, color: string) => xml.replace(/fill="(#fff|#ffffff|white)"/gi, `fill="${color}"`);

interface Props {
  slug: string | null;
  muscle: MuscleKey;
  size: number;
  /** false : première image seulement (vignettes de liste) */
  animate?: boolean;
}

export function Illustration({ slug, muscle, size, animate = true }: Props) {
  const { colors, fonts, radius } = useTheme();
  const { lang } = useI18n();
  const [frames, setFrames] = useState<string[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [index, setIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let alive = true;
    setFrames(null);
    setFailed(false);
    setIndex(0);
    if (!slug) return;
    loadFrames(slug).then((f) => { if (alive) setFrames(f); }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [slug]);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  const moving = animate && !reduceMotion && frames !== null && frames.length > 1;
  useEffect(() => {
    if (!moving) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % 3), FRAME_MS);
    return () => clearInterval(id);
  }, [moving]);

  if (!slug || failed) {
    return (
      <View testID="illustration-fallback" style={[styles.fallback, { width: size, height: size, borderRadius: radius.md, backgroundColor: colors.bgCardSoft }]}>
        <Text numberOfLines={2} style={{ color: colors.gold, fontFamily: fonts.uiBold, fontSize: Math.max(9, size / 7), textAlign: 'center' }}>
          {muscleLabel(muscle, lang)}
        </Text>
      </View>
    );
  }
  if (!frames) return <View style={{ width: size, height: size }} />;
  return (
    <View testID={`illustration-frame-${index}`} accessibilityRole="image" style={{ width: size, height: size }}>
      <SvgXml xml={recolor(frames[index], colors.text)} width={size} height={size} />
    </View>
  );
}

const styles = StyleSheet.create({ fallback: { alignItems: 'center', justifyContent: 'center', padding: 4 } });
