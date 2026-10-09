// Courbe SVG : ligne, un cercle par point, record en or, étiquettes premier / dernier / record
import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Polyline, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';

interface Props {
  points: { value: number; label: string }[];
  recordIndex: number;
  height?: number;
}

const PAD_X = 24;
const PAD_TOP = 22;
const PAD_BOTTOM = 12;

export function LineChart({ points, recordIndex, height = 160 }: Props) {
  const { colors, fonts } = useTheme();
  // Largeur par défaut avant la mesure (et en test, où onLayout ne se déclenche pas)
  const [width, setWidth] = useState(320);
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const x = (i: number) => (points.length === 1 ? width / 2 : PAD_X + (i * (width - 2 * PAD_X)) / (points.length - 1));
  const y = (v: number) => (max === min ? height / 2 : PAD_TOP + ((max - v) * (height - PAD_TOP - PAD_BOTTOM)) / (max - min));
  const labelled = [...new Set([0, points.length - 1, recordIndex])].filter((i) => i >= 0 && i < points.length);

  return (
    <View onLayout={(e) => setWidth(Math.max(120, e.nativeEvent.layout.width))} style={{ height }}>
      <Svg width={width} height={height}>
        {points.length > 1 ? (
          <Polyline points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')} fill="none" stroke={colors.gold} strokeOpacity={0.6} strokeWidth={2} />
        ) : null}
        {points.map((p, i) => (
          <Circle
            key={i}
            testID={i === recordIndex ? 'chart-record' : 'chart-point'}
            cx={x(i)}
            cy={y(p.value)}
            r={i === recordIndex ? 6 : 4}
            fill={colors.gold}
            stroke={i === recordIndex ? colors.text : 'none'}
            strokeWidth={i === recordIndex ? 1.5 : 0}
          />
        ))}
        {labelled.map((i) => (
          <SvgText key={`l${i}`} testID="chart-label" x={x(i)} y={y(points[i].value) - 10} fill={i === recordIndex ? colors.gold : colors.textDim} fontSize={11} fontFamily={fonts.uiBold} textAnchor="middle">
            {points[i].label}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}
