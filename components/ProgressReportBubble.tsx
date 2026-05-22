import React, { useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Canvas, Path, Skia, Circle, Line as SkLine } from '@shopify/react-native-skia';
import { C, EMOTION_COLORS, SHADOW } from '../constants/theme';
import { EmotionIcon } from './EmotionIcon';

const NAVY     = '#1A1F3C';
const EMOTIONS = ['happy', 'sad', 'angry', 'anxious'] as const;
type Emotion   = typeof EMOTIONS[number];

// ── Data interfaces ───────────────────────────────────────────────────────────
export interface EmotionPoint {
  date: string;   // 'YYYY-MM-DD'
  happy:   number; // 0-100
  sad:     number;
  angry:   number;
  anxious: number;
}

export interface ProgressReportData {
  patientName:     string;
  dateRange:       string;   // e.g. 'May 13 – May 20'
  data:            EmotionPoint[];
  dominantEmotion: string;
  totalSessions:   number;
  trend:           'improving' | 'stable' | 'declining';
}

// Mock data — 7-day sample with realistic emotional arc
export const MOCK_PROGRESS: ProgressReportData = {
  patientName:     'Miwa',
  dateRange:       'May 13 – May 20',
  dominantEmotion: 'happy',
  totalSessions:   7,
  trend:           'improving',
  data: [
    { date: '2026-05-13', happy: 42, sad: 30, angry: 18, anxious: 10 },
    { date: '2026-05-14', happy: 55, sad: 22, angry: 12, anxious: 11 },
    { date: '2026-05-15', happy: 48, sad: 27, angry: 15, anxious: 10 },
    { date: '2026-05-16', happy: 60, sad: 18, angry: 10, anxious: 12 },
    { date: '2026-05-17', happy: 65, sad: 15, angry:  8, anxious: 12 },
    { date: '2026-05-18', happy: 70, sad: 12, angry:  7, anxious: 11 },
    { date: '2026-05-19', happy: 72, sad: 10, angry:  6, anxious: 12 },
  ],
};

// ── Helper: aggregate raw sketch timeline → EmotionPoint[] ───────────────────
export function aggregateTimeline(
  timeline: Array<{ emotion: string; date: string }>
): EmotionPoint[] {
  const byDate: Record<string, Record<string, number>> = {};
  for (const item of timeline) {
    const key = item.date.slice(0, 10);
    if (!byDate[key]) byDate[key] = { happy: 0, sad: 0, angry: 0, anxious: 0 };
    byDate[key][item.emotion] = (byDate[key][item.emotion] ?? 0) + 1;
  }
  return Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => {
      const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
      return {
        date,
        happy:   Math.round((counts.happy   ?? 0) / total * 100),
        sad:     Math.round((counts.sad     ?? 0) / total * 100),
        angry:   Math.round((counts.angry   ?? 0) / total * 100),
        anxious: Math.round((counts.anxious ?? 0) / total * 100),
      };
    });
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-MY', { month: 'short', day: 'numeric' });
}

// ── Skia line chart ───────────────────────────────────────────────────────────
const PAD = { l: 6, r: 6, t: 8, b: 20 };
const GRID_LEVELS = [0.25, 0.5, 0.75];

function LineChart({
  data, width, height,
}: { data: EmotionPoint[]; width: number; height: number }) {
  const chartW = width  - PAD.l - PAD.r;
  const chartH = height - PAD.t - PAD.b;
  const n      = data.length;

  const xOf = (i: number) => PAD.l + (n < 2 ? chartW / 2 : (i / (n - 1)) * chartW);
  const yOf = (v: number) => PAD.t + (1 - Math.min(v, 100) / 100) * chartH;

  // Build one SkPath per emotion
  const paths = useMemo(() => {
    if (n < 2) return [];
    return EMOTIONS.map(e => {
      const p = Skia.Path.Make();
      data.forEach((pt, i) => {
        const x = xOf(i);
        const y = yOf(pt[e]);
        i === 0 ? p.moveTo(x, y) : p.lineTo(x, y);
      });
      return { e, path: p, color: EMOTION_COLORS[e].text };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, width, height]);

  // Grid Y values
  const gridY = GRID_LEVELS.map(f => PAD.t + f * chartH);

  return (
    <Canvas style={{ width, height }}>
      {/* Grid lines */}
      {gridY.map((y, i) => (
        <SkLine
          key={i}
          p1={{ x: PAD.l, y }}
          p2={{ x: PAD.l + chartW, y }}
          color="#E8E4F5"
          strokeWidth={1}
        />
      ))}

      {/* Bottom axis */}
      <SkLine
        p1={{ x: PAD.l, y: PAD.t + chartH }}
        p2={{ x: PAD.l + chartW, y: PAD.t + chartH }}
        color="#DDD8F0"
        strokeWidth={1}
      />

      {/* Emotion paths */}
      {paths.map(({ e, path, color }) => (
        <Path
          key={e}
          path={path}
          color={color}
          style="stroke"
          strokeWidth={2}
          strokeCap="round"
          strokeJoin="round"
        />
      ))}

      {/* Data point circles */}
      {data.map((pt, i) =>
        EMOTIONS.map(e => (
          <Circle
            key={`${i}-${e}`}
            cx={xOf(i)}
            cy={yOf(pt[e])}
            r={2.5}
            color={EMOTION_COLORS[e].text}
          />
        ))
      )}
    </Canvas>
  );
}

// ── Trend config ──────────────────────────────────────────────────────────────
const TREND_CFG = {
  improving: { icon: 'trending-up',   color: '#16a34a', label: 'Improving' },
  stable:    { icon: 'remove',        color: '#f59e0b', label: 'Stable'    },
  declining: { icon: 'trending-down', color: '#dc2626', label: 'Declining' },
} as const;

// ── Component ─────────────────────────────────────────────────────────────────
interface Props {
  data: ProgressReportData;
  onViewReport: () => void;
}

export function ProgressReportBubble({ data, onViewReport }: Props) {
  const { width: screenW } = useWindowDimensions();
  // Card is ~85% of screen; subtract internal horizontal padding (28px each side)
  const chartW  = Math.round(screenW * 0.82) - 28;
  const chartH  = 110;
  const ec      = EMOTION_COLORS[data.dominantEmotion] ?? EMOTION_COLORS.happy;
  const tCfg    = TREND_CFG[data.trend];
  const hasDots = data.data.length > 0;

  return (
    <View style={s.card}>
      {/* ── Badge row ──────────────────────────────── */}
      <View style={s.badgeRow}>
        <View style={s.typeBadge}>
          <Ionicons name="trending-up" size={10} color={NAVY} />
          <Text style={s.typeBadgeText}>PROGRESS REPORT</Text>
        </View>
        <View style={[s.trendChip, { backgroundColor: tCfg.color + '18' }]}>
          <Ionicons name={tCfg.icon as any} size={10} color={tCfg.color} />
          <Text style={[s.trendChipText, { color: tCfg.color }]}>{tCfg.label}</Text>
        </View>
      </View>

      {/* ── Patient + date range row ───────────────── */}
      <View style={s.metaRow}>
        <View style={s.patientPill}>
          <EmotionIcon emotion={data.dominantEmotion} size={12} />
          <Text style={s.patientPillText}>{data.patientName}</Text>
        </View>
        <Text style={s.dateRange}>{data.dateRange}</Text>
      </View>

      {/* ── Line chart ────────────────────────────── */}
      {hasDots && data.data.length >= 2 ? (
        <View style={s.chartWrap}>
          <LineChart data={data.data} width={chartW} height={chartH} />
          {/* X-axis date labels */}
          <View style={[s.xLabels, { width: chartW }]}>
            {data.data.map((pt, i) => {
              const isFirst = i === 0;
              const isLast  = i === data.data.length - 1;
              const isMid   = i === Math.floor(data.data.length / 2);
              if (!isFirst && !isLast && !isMid) return null;
              const pct = data.data.length < 2 ? 50 : (i / (data.data.length - 1)) * 100;
              return (
                <Text
                  key={pt.date}
                  style={[
                    s.xLabel,
                    { left: `${pct}%` as any },
                    isFirst  && { textAlign: 'left' },
                    isLast   && { textAlign: 'right', left: undefined as any, right: 0 },
                    isMid && !isFirst && !isLast && { textAlign: 'center', transform: [{ translateX: -20 }] },
                  ]}
                >
                  {shortDate(pt.date)}
                </Text>
              );
            })}
          </View>
        </View>
      ) : (
        // Fallback: emotion dots when not enough data for a line
        <View style={s.dotsWrap}>
          {data.data.map((pt, i) => {
            const dom = (Object.entries(pt) as [string, number][])
              .filter(([k]) => (EMOTIONS as readonly string[]).includes(k))
              .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'happy';
            return (
              <View key={i} style={[s.dot, { backgroundColor: EMOTION_COLORS[dom]?.text ?? C.borderMed }]} />
            );
          })}
        </View>
      )}

      {/* ── Legend ────────────────────────────────── */}
      <View style={s.legend}>
        {EMOTIONS.map(e => (
          <View key={e} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: EMOTION_COLORS[e].text }]} />
            <Text style={s.legendLabel}>{e.charAt(0).toUpperCase() + e.slice(1)}</Text>
          </View>
        ))}
      </View>

      {/* ── Stats row ─────────────────────────────── */}
      <View style={s.statsRow}>
        <View style={s.stat}>
          <Text style={s.statNum}>{data.totalSessions}</Text>
          <Text style={s.statLbl}>Sessions</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.stat}>
          <View style={s.statEmo}>
            <EmotionIcon emotion={data.dominantEmotion} size={14} />
            <Text style={[s.statNum, { color: ec.text }]}>
              {data.dominantEmotion.charAt(0).toUpperCase() + data.dominantEmotion.slice(1)}
            </Text>
          </View>
          <Text style={s.statLbl}>Dominant</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.stat}>
          <Text style={[s.statNum, { color: tCfg.color }]}>{tCfg.label}</Text>
          <Text style={s.statLbl}>Trend</Text>
        </View>
      </View>

      {/* ── Divider + CTA ─────────────────────────── */}
      <View style={s.divider} />
      <TouchableOpacity style={s.btn} onPress={onViewReport} activeOpacity={0.82}>
        <Text style={s.btnText}>View Full Report</Text>
        <Ionicons name="arrow-forward" size={14} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16, padding: 14,
    minWidth: 240, maxWidth: '100%',
    ...SHADOW.md, overflow: 'hidden',
  },

  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  typeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#EEF0FF', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
  },
  typeBadgeText: { fontSize: 9, fontWeight: '800', color: NAVY, letterSpacing: 0.8, textTransform: 'uppercase' },
  trendChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
  },
  trendChipText: { fontSize: 9, fontWeight: '700' },

  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  patientPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.primaryLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  patientPillText: { fontSize: 11, fontWeight: '700', color: C.primary },
  dateRange: { fontSize: 10, color: C.textMuted, fontWeight: '500' },

  chartWrap: { marginBottom: 4 },
  xLabels: { position: 'relative', height: 16 },
  xLabel:  { position: 'absolute', fontSize: 9, color: C.textMuted, fontWeight: '500' },

  dotsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, paddingVertical: 10 },
  dot: { width: 12, height: 12, borderRadius: 6 },

  legend: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', marginBottom: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendLabel: { fontSize: 10, color: C.textMuted, fontWeight: '500' },

  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8F8FC', borderRadius: 10, padding: 10, marginBottom: 12,
  },
  stat:    { flex: 1, alignItems: 'center', gap: 2 },
  statEmo: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statNum: { fontSize: 12, fontWeight: '800', color: NAVY },
  statLbl: { fontSize: 9, color: C.textMuted, fontWeight: '500' },
  statDivider: { width: 1, height: 28, backgroundColor: '#E8E4F5' },

  divider: { height: 1, backgroundColor: '#F0F0F5', marginBottom: 10 },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: NAVY, borderRadius: 10, paddingVertical: 10,
  },
  btnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});
