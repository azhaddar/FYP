import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, useWindowDimensions,
  Image, ScrollView,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, useAnimatedScrollHandler,
  interpolate, Extrapolation, runOnJS, useAnimatedRef,
} from 'react-native-reanimated';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabaseClient';
import { useApp } from '../contexts/AppContext';
import { Patient, Sketch } from '../types';
import { Ionicons } from '@expo/vector-icons';
import { C, EMOTION_COLORS, SHADOW } from '../constants/theme';
import { ParentShell } from '../components/ParentShell';
import { EmotionIcon } from '../components/EmotionIcon';

const NAVY   = '#1A1F3C';
// Arc intensity — increase for a more dramatic curve
const BEND   = 3;
const SPACING = 18;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });
}

// ── Individual gallery card with circular-arc positioning ─────────────────────
//
// Mirror of the OGL Media.update() math from the original web component:
//   R  = (H² + B²) / (2B)          — radius of the arc circle
//   arc = R − √(R² − x²)           — vertical drop at offset x
//   rz  = −sign(x) · asin(x / R)   — tilt to follow the tangent
//
// H = half the visible screen width  B = bend scale (px)
//
function GalleryCard({
  sketch, index, scrollX, cardW, cardH, itemW, screenW, contentPad, onPress,
}: {
  sketch: Sketch;
  index: number;
  scrollX: Animated.SharedValue<number>;
  cardW: number;
  cardH: number;
  itemW: number;
  screenW: number;
  contentPad: number;
  onPress: () => void;
}) {
  // Pre-compute the card's center X in content coordinates (static)
  const cardCenterX = contentPad + index * itemW + cardW / 2;

  const animStyle = useAnimatedStyle(() => {
    // Distance of this card's center from the screen center
    const x = cardCenterX - (scrollX.value + screenW / 2);

    const H = screenW / 2;
    const B = BEND * (cardW / 18); // scale bend to card size

    // Circular arc formula
    const R       = (H * H + B * B) / (2 * B);
    const ex      = Math.min(Math.abs(x), H);
    const arc     = R - Math.sqrt(Math.max(0, R * R - ex * ex));
    const rz      = -Math.sign(x) * Math.asin(Math.min(ex / R, 0.9999));
    const scale   = interpolate(Math.abs(x), [0, screenW * 0.45], [1, 0.88], Extrapolation.CLAMP);
    const opacity = interpolate(Math.abs(x), [0, screenW * 0.6], [1, 0.55], Extrapolation.CLAMP);

    return {
      opacity,
      transform: [
        { translateY: arc },
        { rotateZ: `${rz}rad` },
        { scale },
      ],
    };
  });

  const ec = EMOTION_COLORS[sketch.emotion] ?? EMOTION_COLORS.happy;

  return (
    // White glow shadow on the wrapper — renders outside overflow:hidden so no clipping
    <Animated.View style={[glass.glow, { width: cardW, marginRight: SPACING }, animStyle]}>

      {/* Card content — overflow:hidden clips image to rounded corners */}
      <TouchableOpacity
        style={[pc.card, { width: cardW, height: cardH }]}
        onPress={onPress}
        activeOpacity={0.93}
      >
        {sketch.image_url ? (
          <Image
            source={{ uri: sketch.image_url }}
            style={{ width: '100%', height: cardH * 0.72 }}
            resizeMode="cover"
          />
        ) : (
          <View style={[pc.placeholder, { height: cardH * 0.72, backgroundColor: ec.card }]}>
            <EmotionIcon emotion={sketch.emotion} size={52} />
          </View>
        )}
        <View style={[pc.bottom, { backgroundColor: ec.card }]}>
          <View style={pc.emoRow}>
            <EmotionIcon emotion={sketch.emotion} size={20} />
            <Text style={[pc.emoText, { color: ec.text }]}>
              {sketch.emotion.charAt(0).toUpperCase() + sketch.emotion.slice(1)}
            </Text>
          </View>
          <Text style={[pc.dateText, { color: ec.text + 'aa' }]}>
            {formatDate(sketch.created_at)} · {formatTime(sketch.created_at)}
          </Text>
          {sketch.notes ? (
            <Text style={[pc.noteText, { color: ec.text + '88' }]} numberOfLines={1}>
              {sketch.notes}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>

      {/* Glass border overlay — painted ON TOP of the card, outside overflow:hidden */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Rounded border frame */}
        <View style={[glass.frame, { borderRadius: 21, height: cardH }]} />
        {/* Top-edge light streak — simulates light catching the glass rim */}
        <View style={glass.topStreak} />
      </View>

    </Animated.View>
  );
}

const pc = StyleSheet.create({
  card:        { borderRadius: 20, overflow: 'hidden', backgroundColor: '#fff', ...SHADOW.lg },
  placeholder: { width: '100%', justifyContent: 'center', alignItems: 'center' },
  bottom:      { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 5, padding: 16 },
  emoRow:      { flexDirection: 'row', alignItems: 'center', gap: 7 },
  emoText:     { fontSize: 17, fontWeight: '800', textTransform: 'capitalize' },
  dateText:    { fontSize: 11, fontWeight: '500', textAlign: 'center' },
  noteText:    { fontSize: 11, textAlign: 'center', fontStyle: 'italic', marginTop: 2 },
});

// ── Glass border styles ────────────────────────────────────────────────────────
//
// Technique: the border is painted as an absolutely-positioned overlay OUTSIDE
// the card's own `overflow:'hidden'` context, so it never gets clipped.
// The glow shadow lives on the Animated.View wrapper (also no overflow:hidden).
//
const glass = StyleSheet.create({
  // Outer wrapper — white glow/halo around the card
  glow: {
    shadowColor: 'rgba(255,255,255,0.95)',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 14,
    shadowOpacity: 1,
    // Android: a faint white elevation tint
    elevation: 6,
  },
  // Rounded border frame drawn on top of the card surface
  frame: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.68)',
    // Slight inner transparency gives depth — card shows through behind the border
    backgroundColor: 'transparent',
  },
  // Horizontal light streak near the top edge — classic glass "highlight"
  topStreak: {
    position: 'absolute',
    top: 3,
    left: '18%',
    right: '18%',
    height: 1.5,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
  },
});

// ── Main screen ────────────────────────────────────────────────────────────────
export default function JournalScreen() {
  const { profile } = useApp();
  const router      = useRouter();
  const { width: screenW } = useWindowDimensions();

  const { patientId, patientName } =
    useLocalSearchParams<{ patientId: string; patientName: string }>();

  const CARD_W  = screenW * 0.72;
  const CARD_H  = CARD_W * 1.44;
  const ITEM_W  = CARD_W + SPACING;
  const PAD     = (screenW - CARD_W) / 2;

  const [children, setChildren]               = useState<Patient[]>([]);
  const [childrenLoading, setChildrenLoading] = useState(false);
  const [sketches, setSketches]               = useState<Sketch[]>([]);
  const [loading, setLoading]                 = useState(false);
  const [activeIndex, setActiveIndex]         = useState(0);

  const scrollX   = useSharedValue(0);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();

  useEffect(() => {
    if (patientId) {
      setLoading(true);
      setSketches([]);
      setActiveIndex(0);
      scrollX.value = 0;
      fetchSketches(patientId);
    } else {
      setChildrenLoading(true);
      fetchChildren();
    }
  }, [patientId]);

  async function fetchChildren() {
    if (!profile?.id) return;
    const { data } = await supabase
      .from('patients').select('*').eq('guardian_id', profile.id).order('full_name');
    setChildren(data ?? []);
    setChildrenLoading(false);
  }

  async function fetchSketches(pid: string) {
    const { data } = await supabase
      .from('sketches').select('*').eq('patient_id', pid)
      .order('created_at', { ascending: false });
    setSketches(data ?? []);
    setLoading(false);
  }

  const setIndex = useCallback((x: number) => {
    setActiveIndex(Math.round(x / ITEM_W));
  }, [ITEM_W]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
      runOnJS(setIndex)(e.contentOffset.x);
    },
  });

  // ── Derived ─────────────────────────────────────────────────────────────────
  const firstName = (patientName ?? '').split(' ')[0] || 'Child';
  const emotionCount: Record<string, number> = {};
  for (const s of sketches) emotionCount[s.emotion] = (emotionCount[s.emotion] ?? 0) + 1;
  const domEntries = Object.entries(emotionCount).sort((a, b) => b[1] - a[1]);

  // ── Child picker ─────────────────────────────────────────────────────────────
  if (!patientId) {
    return (
      <ParentShell>
        <View style={s.root}>
          <View style={s.header}>
            <View style={s.headerInner}>
              <View style={s.sideSlot} />
              <Text style={s.title}>Journal</Text>
              <View style={{ width: 36 }} />
            </View>
            <Text style={s.headerSub}>Select a child to view their drawing journal</Text>
          </View>

          <View style={s.content}>
            {childrenLoading ? (
              <View style={s.loadingWrap}><ActivityIndicator size="large" color={C.primary} /></View>
            ) : children.length === 0 ? (
              <View style={s.emptyWrap}>
                <Ionicons name="people-outline" size={60} color={C.borderMed} />
                <Text style={s.emptyTitle}>No children yet</Text>
                <Text style={s.emptyDesc}>Add a child from the dashboard first.</Text>
                <TouchableOpacity style={s.cta} onPress={() => router.push('/dashboard')}>
                  <Text style={s.ctaText}>Go to Dashboard</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView contentContainerStyle={s.pickerList}>
                {children.map(child => (
                  <TouchableOpacity
                    key={child.id}
                    style={s.pickerCard}
                    onPress={() => router.push({
                      pathname: '/journal',
                      params: { patientId: child.id, patientName: child.full_name },
                    })}
                    activeOpacity={0.75}
                  >
                    <View style={s.pickerAvatar}>
                      <Text style={s.pickerAvatarText}>{child.full_name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={s.pickerInfo}>
                      <Text style={s.pickerName}>{child.full_name}</Text>
                      <Text style={s.pickerMeta}>{child.age} y/o · {child.gender}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={C.borderMed} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </ParentShell>
    );
  }

  // ── Journal view ─────────────────────────────────────────────────────────────
  return (
    <ParentShell>
      <View style={s.root}>

        <View style={s.header}>
          <View style={s.headerInner}>
            <TouchableOpacity
              style={s.sideSlot}
              onPress={() => router.canGoBack() ? router.back() : router.replace('/journal')}
            >
              <Ionicons name="chevron-back" size={20} color="#fff" />
            </TouchableOpacity>
            <Text style={s.title}>{firstName}'s Journal</Text>
            <TouchableOpacity
              style={s.uploadBtn}
              onPress={() => router.push({ pathname: '/draw', params: { patientId, patientName } })}
            >
              <Ionicons name="cloud-upload-outline" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.content}>
          {loading ? (
            <View style={s.loadingWrap}><ActivityIndicator size="large" color={C.primary} /></View>

          ) : sketches.length === 0 ? (
            <View style={s.emptyWrap}>
              <Ionicons name="images-outline" size={64} color={C.borderMed} />
              <Text style={s.emptyTitle}>No drawings yet</Text>
              <Text style={s.emptyDesc}>{firstName} hasn't submitted any drawings yet.</Text>
              <TouchableOpacity
                style={s.cta}
                onPress={() => router.push({ pathname: '/draw', params: { patientId, patientName } })}
              >
                <Ionicons name="cloud-upload-outline" size={15} color="#fff" />
                <Text style={s.ctaText}>Upload First Drawing</Text>
              </TouchableOpacity>
            </View>

          ) : (
            <>
              {/* Pills */}
              <View style={s.pillsRow}>
                {domEntries.slice(0, 3).map(([emotion, count]) => {
                  const ec = EMOTION_COLORS[emotion];
                  return (
                    <View key={emotion} style={[s.pill, { backgroundColor: ec.card }]}>
                      <EmotionIcon emotion={emotion} size={14} />
                      <Text style={[s.pillText, { color: ec.text }]}>{count}×</Text>
                    </View>
                  );
                })}
                <View style={[s.pill, { backgroundColor: C.primaryLight }]}>
                  <Ionicons name="images-outline" size={13} color={C.primary} />
                  <Text style={[s.pillText, { color: C.primary }]}>{sketches.length}</Text>
                </View>
              </View>

              {/* Circular gallery */}
              <View style={{ height: CARD_H + 60 }}>
                <Animated.ScrollView
                  ref={scrollRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  snapToInterval={ITEM_W}
                  snapToAlignment="start"
                  decelerationRate="fast"
                  onScroll={scrollHandler}
                  scrollEventThrottle={16}
                  contentContainerStyle={{ paddingHorizontal: PAD }}
                >
                  {sketches.map((sketch, i) => (
                    <GalleryCard
                      key={sketch.id}
                      sketch={sketch}
                      index={i}
                      scrollX={scrollX}
                      cardW={CARD_W}
                      cardH={CARD_H}
                      itemW={ITEM_W}
                      screenW={screenW}
                      contentPad={PAD}
                      onPress={() => router.push({
                        pathname: '/sketch-detail',
                        params: { sketchId: sketch.id, editable: 'false' },
                      })}
                    />
                  ))}
                </Animated.ScrollView>
              </View>

              {/* Dots */}
              <View style={s.dotsRow}>
                {sketches.slice(0, 9).map((_, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => scrollRef.current?.scrollTo({ x: i * ITEM_W, animated: true })}
                  >
                    <View style={[s.dot, i === activeIndex && s.dotActive]} />
                  </TouchableOpacity>
                ))}
                {sketches.length > 9 && (
                  <Text style={s.dotMore}>+{sketches.length - 9}</Text>
                )}
              </View>

              <Text style={s.counter}>{activeIndex + 1} of {sketches.length}</Text>
            </>
          )}
        </View>
      </View>
    </ParentShell>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#F2F2F7' },
  content: { flex: 1, overflow: 'hidden' },

  header:    { backgroundColor: NAVY, paddingTop: 52, zIndex: 999, elevation: 999 },
  headerInner: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12,
  },
  sideSlot:  { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  title:     { flex: 1, fontSize: 18, fontWeight: '700', color: '#fff', textAlign: 'center' },
  headerSub: {
    fontSize: 12, color: 'rgba(255,255,255,0.7)',
    textAlign: 'center', paddingHorizontal: 24, paddingBottom: 10,
  },
  uploadBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', alignItems: 'center',
  },

  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  pillsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 7,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14,
  },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20,
  },
  pillText: { fontSize: 12, fontWeight: '700' },

  dotsRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14 },
  dot:       { width: 7, height: 7, borderRadius: 4, backgroundColor: C.borderMed },
  dotActive: { width: 20, backgroundColor: C.primary },
  dotMore:   { fontSize: 11, color: C.textMuted, fontWeight: '700', marginLeft: 2 },
  counter:   { textAlign: 'center', fontSize: 11, color: C.textMuted, fontWeight: '500', marginTop: 8 },

  emptyWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: C.text, marginBottom: 8, marginTop: 20 },
  emptyDesc:  { fontSize: 14, color: C.textSub, textAlign: 'center', lineHeight: 21, marginBottom: 28 },
  cta: {
    backgroundColor: C.primary, paddingHorizontal: 28, paddingVertical: 13,
    borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  ctaText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  pickerList:       { padding: 20, gap: 10 },
  pickerCard:       { backgroundColor: '#fff', borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, ...SHADOW.sm },
  pickerAvatar:     { width: 48, height: 48, borderRadius: 14, backgroundColor: '#EDEDF8', justifyContent: 'center', alignItems: 'center' },
  pickerAvatarText: { fontSize: 18, fontWeight: '800', color: NAVY },
  pickerInfo:       { flex: 1, gap: 2 },
  pickerName:       { fontSize: 16, fontWeight: '700', color: NAVY },
  pickerMeta:       { fontSize: 12, color: C.textSub },
});
