import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, EMOTION_COLORS, SHADOW } from '../constants/theme';

const NAVY = '#1A1F3C';

// ── Avatar background cycles through emotion palette ─────────────────────────
const AVATAR_PALETTES = [
  { bg: '#EEF0FF', text: NAVY },
  { bg: EMOTION_COLORS.happy.card,   text: EMOTION_COLORS.happy.text   },
  { bg: EMOTION_COLORS.anxious.card, text: EMOTION_COLORS.anxious.text },
  { bg: EMOTION_COLORS.sad.card,     text: EMOTION_COLORS.sad.text     },
];

function paletteFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_PALETTES[h % AVATAR_PALETTES.length];
}

// ── Props ─────────────────────────────────────────────────────────────────────
export interface ChildProfileButtonProps {
  childName:    string;
  imageUrl?:    string | null;
  dominantEmotion?: string | null;
  totalDrawings?: number;
  onPress:      () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function ChildProfileButton({
  childName,
  imageUrl,
  dominantEmotion,
  totalDrawings,
  onPress,
}: ChildProfileButtonProps) {
  const palette  = paletteFor(childName);
  const initials = childName.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const ec       = dominantEmotion ? EMOTION_COLORS[dominantEmotion] : null;

  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.82}>

      {/* ── Avatar + badge ─────────────────────────────── */}
      <View style={s.avatarWrap}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={s.avatar} />
        ) : (
          <View style={[s.avatar, { backgroundColor: palette.bg }]}>
            <Text style={[s.initials, { color: palette.text }]}>{initials}</Text>
          </View>
        )}

        {/* Status badge — bottom-right */}
        <View style={s.badge}>
          <Ionicons name="bar-chart" size={10} color={NAVY} />
        </View>
      </View>

      {/* ── Info ───────────────────────────────────────── */}
      <View style={s.info}>
        <Text style={s.name} numberOfLines={1}>{childName}</Text>

        <View style={s.metaRow}>
          {ec && dominantEmotion ? (
            <View style={[s.emotionPill, { backgroundColor: ec.card }]}>
              <Text style={[s.emotionPillText, { color: ec.text }]}>
                {dominantEmotion.charAt(0).toUpperCase() + dominantEmotion.slice(1)}
              </Text>
            </View>
          ) : null}
          {totalDrawings != null ? (
            <Text style={s.drawingCount}>{totalDrawings} drawing{totalDrawings !== 1 ? 's' : ''}</Text>
          ) : null}
        </View>

        <Text style={s.cta}>View Clinical Dashboard</Text>
      </View>

      {/* ── Chevron ────────────────────────────────────── */}
      <Ionicons name="chevron-forward" size={17} color={C.borderMed} />
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    gap: 14,
    ...SHADOW.sm,
  },

  // Avatar
  avatarWrap: { position: 'relative', flexShrink: 0 },
  avatar: {
    width: 64, height: 64, borderRadius: 32,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#EEF0FF',
  },
  initials: { fontSize: 22, fontWeight: '800' },

  // Badge
  badge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#EEF0FF',
    borderWidth: 2, borderColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
  },

  // Info
  info: { flex: 1, gap: 3 },
  name: { fontSize: 15, fontWeight: '700', color: NAVY },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  emotionPill: {
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6,
  },
  emotionPillText: { fontSize: 10, fontWeight: '700' },
  drawingCount: { fontSize: 11, color: C.textMuted, fontWeight: '500' },

  cta: { fontSize: 11, color: C.textMuted, fontWeight: '500', marginTop: 1 },
});
