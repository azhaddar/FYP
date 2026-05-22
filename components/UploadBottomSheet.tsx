import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  Animated, FlatList, Image, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, EMOTION_COLORS } from '../constants/theme';

const NAVY        = '#1A1F3C';
const SHEET_H     = 260;

// ── Avatar palette (same hash as ChildProfileButton) ─────────────────────────
const PALETTES = [
  { bg: '#EEF0FF', text: NAVY },
  { bg: EMOTION_COLORS.happy.card,   text: EMOTION_COLORS.happy.text   },
  { bg: EMOTION_COLORS.anxious.card, text: EMOTION_COLORS.anxious.text },
  { bg: EMOTION_COLORS.sad.card,     text: EMOTION_COLORS.sad.text     },
];
function paletteFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return PALETTES[h % PALETTES.length];
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface SheetPatient {
  id:        string;
  full_name: string;
  imageUrl?: string | null;
}

interface Props {
  visible:        boolean;
  patients:       SheetPatient[];
  onSelectChild:  (patient: SheetPatient) => void;
  onClose:        () => void;
}

// ── ChildAvatarButton ─────────────────────────────────────────────────────────
function ChildAvatarButton({ patient, onPress }: { patient: SheetPatient; onPress: () => void }) {
  const palette  = paletteFor(patient.full_name);
  const firstName = patient.full_name.trim().split(/\s+/)[0];
  const initials  = patient.full_name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <TouchableOpacity style={av.wrap} onPress={onPress} activeOpacity={0.75}>
      {patient.imageUrl ? (
        <Image source={{ uri: patient.imageUrl }} style={av.avatar} />
      ) : (
        <View style={[av.avatar, { backgroundColor: palette.bg }]}>
          <Text style={[av.initials, { color: palette.text }]}>{initials}</Text>
        </View>
      )}
      <Text style={av.name} numberOfLines={1}>{firstName}</Text>
    </TouchableOpacity>
  );
}

const av = StyleSheet.create({
  wrap:    { alignItems: 'center', gap: 8, width: 88 },
  avatar:  { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' },
  initials:{ fontSize: 26, fontWeight: '800' },
  name:    { fontSize: 13, fontWeight: '700', color: NAVY, textAlign: 'center' },
});

// ── UploadBottomSheet ─────────────────────────────────────────────────────────
export function UploadBottomSheet({ visible, patients, onSelectChild, onClose }: Props) {
  const slideY = useRef(new Animated.Value(SHEET_H)).current;
  const fadeOp = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeOp, { toValue: 1,       duration: 220, useNativeDriver: true }),
        Animated.spring(slideY,  { toValue: 0,       useNativeDriver: true, bounciness: 4, speed: 14 }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeOp, { toValue: 0,       duration: 180, useNativeDriver: true }),
        Animated.timing(slideY, { toValue: SHEET_H, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {/* ── Backdrop ──────────────────────────── */}
      <Animated.View style={[s.backdrop, { opacity: fadeOp }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* ── Sheet ─────────────────────────────── */}
      <Animated.View style={[s.sheet, { transform: [{ translateY: slideY }] }]}>
        {/* Handle */}
        <View style={s.handle} />

        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>Who is uploading?</Text>
          <TouchableOpacity style={s.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Ionicons name="close" size={18} color={C.textMuted} />
          </TouchableOpacity>
        </View>

        <Text style={s.sub}>Select the child whose drawing you're submitting.</Text>

        {/* Child avatar grid */}
        <FlatList
          data={patients}
          keyExtractor={p => p.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.avatarList}
          renderItem={({ item }) => (
            <ChildAvatarButton
              patient={item}
              onPress={() => onSelectChild(item)}
            />
          )}
        />
      </Animated.View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },

  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },

  handle: {
    alignSelf: 'center',
    width: 40, height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E8',
    marginTop: 12, marginBottom: 4,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 4,
  },
  title:    { fontSize: 18, fontWeight: '800', color: NAVY },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: C.base,
    justifyContent: 'center', alignItems: 'center',
  },

  sub: {
    fontSize: 12, color: C.textMuted, fontWeight: '500',
    paddingHorizontal: 24, marginBottom: 20,
  },

  avatarList: {
    paddingHorizontal: 24,
    gap: 16,
  },
});
