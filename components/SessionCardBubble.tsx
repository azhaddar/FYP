import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, EMOTION_COLORS, SHADOW } from '../constants/theme';
import { EmotionIcon } from './EmotionIcon';

const NAVY    = '#1A1F3C';
const EMOTIONS = ['happy', 'sad', 'angry', 'anxious'] as const;

// ── Data interface ────────────────────────────────────────────────────────────
export interface SessionCardData {
  patientName: string;
  date: string;
  dominantEmotion: string;
  scores: Record<string, number> | null;
  imageUrl: string | null;
  sessionLabel?: string;
  aiInsight?: string;
}

// Mock data — drop this into a FlatList item or pass via props
export const MOCK_SESSION: SessionCardData = {
  patientName:     'Miwa',
  date:            new Date().toISOString(),
  dominantEmotion: 'happy',
  scores:          { happy: 65, sad: 12, angry: 8, anxious: 15 },
  imageUrl:        null,
  sessionLabel:    'Session 7',
  aiInsight:       'Child exhibits predominantly positive affect with mild anxiety indicators in line detail.',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function normalise(scores: Record<string, number> | null): Record<string, number> | null {
  if (!scores) return null;
  const vals = EMOTIONS.map(e => scores[e] ?? 0);
  const sum  = vals.reduce((a, b) => a + b, 0);
  if (sum === 0) return null;
  const max  = Math.max(...vals);
  if (max <= 0) return null;
  const norm = (v: number) => max <= 1 ? Math.round(v * 100) : Math.round(v);
  return {
    happy:   norm(scores.happy   ?? 0),
    sad:     norm(scores.sad     ?? 0),
    angry:   norm(scores.angry   ?? 0),
    anxious: norm(scores.anxious ?? 0),
  };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-MY', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

// ── Component ─────────────────────────────────────────────────────────────────
interface Props {
  data: SessionCardData;
  isMine?: boolean;
  onViewDetails: () => void;
}

export function SessionCardBubble({ data, isMine = false, onViewDetails }: Props) {
  const ec          = data.dominantEmotion ? EMOTION_COLORS[data.dominantEmotion] : null;
  const scores      = normalise(data.scores);
  const dominantPct = ec && scores ? scores[data.dominantEmotion] : null;

  return (
    <View style={s.card}>
      {/* ── Badge row ──────────────────────────────── */}
      <View style={s.badgeRow}>
        <View style={s.typeBadge}>
          <Ionicons name="bar-chart" size={10} color={NAVY} />
          <Text style={s.typeBadgeText}>SESSION RESULT</Text>
        </View>
        {data.sessionLabel && (
          <Text style={s.sessionLabel}>{data.sessionLabel}</Text>
        )}
        <Text style={s.dateLabel}>{fmtDate(data.date)}</Text>
      </View>

      {/* ── Horizontal content row ─────────────────── */}
      <View style={s.contentRow}>
        {/* Left: thumbnail */}
        <View style={s.thumbWrap}>
          {data.imageUrl ? (
            <Image source={{ uri: data.imageUrl }} style={s.thumb} resizeMode="cover" />
          ) : (
            <View style={[s.thumbFallback, ec && { backgroundColor: ec.bg }]}>
              <EmotionIcon emotion={data.dominantEmotion} size={30} />
            </View>
          )}
          {dominantPct != null && (
            <View style={[s.pctChip, ec && { backgroundColor: ec.text }]}>
              <Text style={s.pctChipText}>{dominantPct}%</Text>
            </View>
          )}
        </View>

        {/* Right: info stack */}
        <View style={s.infoStack}>
          {/* Dominant emotion headline */}
          {ec && data.dominantEmotion && (
            <View style={s.emoHeadline}>
              <EmotionIcon emotion={data.dominantEmotion} size={15} />
              <Text style={[s.emoHeadlineText, { color: ec.text }]}>
                {data.dominantEmotion.charAt(0).toUpperCase() + data.dominantEmotion.slice(1)}
                {dominantPct != null ? ` · ${dominantPct}%` : ''}
              </Text>
            </View>
          )}

          {/* Score bars */}
          {scores && (
            <View style={s.bars}>
              {EMOTIONS.map(e => {
                const pct = scores[e];
                const eColor = EMOTION_COLORS[e].text;
                return (
                  <View key={e} style={s.barRow}>
                    <Text style={s.barEmo}>{e[0].toUpperCase()}</Text>
                    <View style={s.barTrack}>
                      <View style={[s.barFill, { width: `${pct}%`, backgroundColor: eColor,
                        opacity: e === data.dominantEmotion ? 1 : 0.55 }]} />
                    </View>
                    <Text style={s.barPct}>{pct}%</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Patient chip */}
          <View style={s.patientChip}>
            <Ionicons name="person" size={9} color={C.primary} />
            <Text style={s.patientChipText} numberOfLines={1}>{data.patientName}</Text>
          </View>
        </View>
      </View>

      {/* ── AI insight snippet ─────────────────────── */}
      {data.aiInsight ? (
        <View style={s.insightWrap}>
          <Ionicons name="sparkles" size={11} color={NAVY} style={{ opacity: 0.5 }} />
          <Text style={s.insightText} numberOfLines={2}>{data.aiInsight}</Text>
        </View>
      ) : null}

      {/* ── Divider ───────────────────────────────── */}
      <View style={s.divider} />

      {/* ── CTA ──────────────────────────────────── */}
      <TouchableOpacity style={s.btn} onPress={onViewDetails} activeOpacity={0.82}>
        <Text style={s.btnText}>View Full Analysis</Text>
        <Ionicons name="arrow-forward" size={14} color={C.white} />
      </TouchableOpacity>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    minWidth: 220,
    maxWidth: '100%',
    ...SHADOW.md,
    overflow: 'hidden',
  },

  // Badge row
  badgeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12,
  },
  typeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#EEF0FF', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
  },
  typeBadgeText: { fontSize: 9, fontWeight: '800', color: NAVY, letterSpacing: 0.8, textTransform: 'uppercase' },
  sessionLabel:  { fontSize: 10, fontWeight: '600', color: C.textMuted },
  dateLabel:     { fontSize: 10, color: C.textMuted, marginLeft: 'auto' as any },

  // Content row
  contentRow: {
    flexDirection: 'row', gap: 12, marginBottom: 10,
  },

  // Thumbnail
  thumbWrap: { position: 'relative', flexShrink: 0 },
  thumb: {
    width: 78, height: 78, borderRadius: 10,
  },
  thumbFallback: {
    width: 78, height: 78, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#F0F0F5',
  },
  pctChip: {
    position: 'absolute', bottom: -6, left: '50%',
    transform: [{ translateX: -18 }],
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 10, backgroundColor: NAVY,
  },
  pctChipText: { fontSize: 9, fontWeight: '800', color: '#fff' },

  // Info stack
  infoStack: { flex: 1, gap: 4 },

  emoHeadline: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
  emoHeadlineText: { fontSize: 13, fontWeight: '700' },

  bars: { gap: 4 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  barEmo: { width: 11, fontSize: 9, fontWeight: '700', color: C.textMuted },
  barTrack: {
    flex: 1, height: 6, borderRadius: 3,
    backgroundColor: '#F0F0F5', overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 3 },
  barPct: { width: 28, fontSize: 9, fontWeight: '600', color: C.textMuted, textAlign: 'right' },

  patientChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    backgroundColor: C.primaryLight, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8,
    marginTop: 2,
  },
  patientChipText: { fontSize: 10, fontWeight: '700', color: C.primary },

  // AI insight
  insightWrap: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 5,
    backgroundColor: '#F8F8FC', borderRadius: 8, padding: 8, marginBottom: 10,
  },
  insightText: { flex: 1, fontSize: 11, color: C.textSub, lineHeight: 16, fontStyle: 'italic' },

  // Divider + CTA
  divider: { height: 1, backgroundColor: '#F0F0F5', marginBottom: 10 },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: NAVY, borderRadius: 10, paddingVertical: 10,
  },
  btnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});
