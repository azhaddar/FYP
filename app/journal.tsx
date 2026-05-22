import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, useWindowDimensions,
  Image, ScrollView,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withSpring,
  interpolate, Extrapolation,
  runOnJS, Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabaseClient';
import { useApp } from '../contexts/AppContext';
import { Patient, Sketch } from '../types';
import { Ionicons } from '@expo/vector-icons';
import { C, EMOTION_COLORS, SHADOW } from '../constants/theme';
import { ParentShell } from '../components/ParentShell';
import { EmotionIcon } from '../components/EmotionIcon';

const NAVY     = '#1A1F3C';
const ANIM_MS  = 380;
const EASE_OUT = Easing.bezier(0.25, 0.46, 0.45, 0.94);

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });
}

// ── PageCard ──────────────────────────────────────────────────────────────────
function PageCard({
  sketch, cardW, cardH, onPress,
}: {
  sketch: Sketch; cardW: number; cardH: number; onPress: () => void;
}) {
  const ec = EMOTION_COLORS[sketch.emotion] ?? EMOTION_COLORS.happy;
  return (
    <TouchableOpacity
      style={[pc.card, { width: cardW, height: cardH }]}
      onPress={onPress}
      activeOpacity={0.96}
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

// ── Main screen ───────────────────────────────────────────────────────────────
export default function JournalScreen() {
  const { profile } = useApp();
  const router      = useRouter();
  const { width: screenW } = useWindowDimensions();

  const { patientId, patientName } =
    useLocalSearchParams<{ patientId: string; patientName: string }>();

  const CARD_W = screenW * 0.82;
  const CARD_H = CARD_W * 1.44;
  const AREA_H = CARD_H + 32;

  const [children, setChildren]           = useState<Patient[]>([]);
  const [childrenLoading, setChildrenLoading] = useState(false);
  const [sketches, setSketches]           = useState<Sketch[]>([]);
  const [loading, setLoading]             = useState(false);
  const [activeIndex, setActiveIndex]     = useState(0);

  // ── Animation shared values ──────────────────────────────────────────────
  // progress: 0 = idle, -1 = fully flipped forward, +1 = fully flipped backward
  const progress    = useSharedValue(0);
  const isAnimating = useSharedValue(false);

  useEffect(() => {
    if (patientId) {
      setLoading(true);
      setSketches([]);
      setActiveIndex(0);
      progress.value = 0;
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

  // Called on JS thread after animation completes
  const completeFlip = useCallback((targetIndex: number) => {
    setActiveIndex(targetIndex);
    isAnimating.value = false;
    progress.value    = 0;
  }, []);

  // Programmatic flip (arrow buttons, dots)
  function flipTo(targetIndex: number) {
    if (isAnimating.value) return;
    if (targetIndex < 0 || targetIndex >= sketches.length) return;
    isAnimating.value = true;
    const dir = targetIndex > activeIndex ? -1 : 1;
    progress.value = withTiming(dir, { duration: ANIM_MS, easing: EASE_OUT }, () => {
      runOnJS(completeFlip)(targetIndex);
    });
  }

  // ── Pan gesture ───────────────────────────────────────────────────────────
  const gesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-18, 18])
    .onUpdate((e) => {
      if (isAnimating.value) return;
      const raw       = e.translationX / screenW;
      const atFirst   = activeIndex === 0 && raw > 0;
      const atLast    = activeIndex === sketches.length - 1 && raw < 0;
      progress.value  = (atFirst || atLast) ? raw * 0.16 : raw;
    })
    .onEnd((e) => {
      if (isAnimating.value) return;
      const pct   = e.translationX / screenW;
      const fast  = Math.abs(e.velocityX) > 500;

      if ((pct < -0.14 || (fast && e.velocityX < 0)) && activeIndex < sketches.length - 1) {
        isAnimating.value = true;
        progress.value = withTiming(-1, { duration: ANIM_MS, easing: EASE_OUT }, () => {
          runOnJS(completeFlip)(activeIndex + 1);
        });
      } else if ((pct > 0.14 || (fast && e.velocityX > 0)) && activeIndex > 0) {
        isAnimating.value = true;
        progress.value = withTiming(1, { duration: ANIM_MS, easing: EASE_OUT }, () => {
          runOnJS(completeFlip)(activeIndex - 1);
        });
      } else {
        progress.value = withSpring(0, { damping: 22, stiffness: 220 });
      }
    });

  // ── Animated styles ───────────────────────────────────────────────────────

  // Front (current) card — moves away with perspective tilt
  const frontStyle = useAnimatedStyle(() => {
    const tx = interpolate(progress.value, [-1, 0, 1], [-screenW, 0, screenW], Extrapolation.CLAMP);
    const ry = interpolate(progress.value, [-1, 0, 1], [24, 0, -24], Extrapolation.CLAMP);
    const sc = interpolate(Math.abs(progress.value), [0, 0.5, 1], [1, 0.97, 0.91], Extrapolation.CLAMP);
    return {
      transform: [
        { perspective: 1400 },
        { translateX: tx },
        { rotateY: `${ry}deg` },
        { scale: sc },
      ],
    };
  });

  // Dark scrim that fades over the front card as it departs (depth cue)
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(progress.value), [0, 0.4, 1], [0, 0.08, 0.22], Extrapolation.CLAMP),
  }));

  // Next card — scales + rotates in from behind when swiping forward
  const nextStyle = useAnimatedStyle(() => {
    const p = Math.max(0, -progress.value); // 0→1 when going forward
    return {
      opacity: interpolate(p, [0, 0.2, 1], [0, 0.9, 1], Extrapolation.CLAMP),
      transform: [
        { perspective: 1400 },
        { scale:   interpolate(p, [0, 1], [0.86, 1], Extrapolation.CLAMP) },
        { rotateY: `${interpolate(p, [0, 1], [-10, 0], Extrapolation.CLAMP)}deg` },
      ],
    };
  });

  // Prev card — scales + rotates in from behind when swiping backward
  const prevStyle = useAnimatedStyle(() => {
    const p = Math.max(0, progress.value); // 0→1 when going backward
    return {
      opacity: interpolate(p, [0, 0.2, 1], [0, 0.9, 1], Extrapolation.CLAMP),
      transform: [
        { perspective: 1400 },
        { scale:   interpolate(p, [0, 1], [0.86, 1], Extrapolation.CLAMP) },
        { rotateY: `${interpolate(p, [0, 1], [10, 0], Extrapolation.CLAMP)}deg` },
      ],
    };
  });

  // ── Derived data ──────────────────────────────────────────────────────────
  const firstName = (patientName ?? '').split(' ')[0] || 'Child';
  const emotionCount: Record<string, number> = {};
  for (const s of sketches) emotionCount[s.emotion] = (emotionCount[s.emotion] ?? 0) + 1;
  const domEntries = Object.entries(emotionCount).sort((a, b) => b[1] - a[1]);

  // ── Child picker (no patientId) ───────────────────────────────────────────
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
      </ParentShell>
    );
  }

  // ── Journal view ─────────────────────────────────────────────────────────
  return (
    <ParentShell>
      <View style={s.root}>

        {/* Header */}
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
            {/* Emotion summary pills */}
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

            {/* ── Flip card area ──────────────────────────────────────── */}
            <View style={[s.cardArea, { height: AREA_H }]}>

              {/* Prev card — behind, revealed when swiping right */}
              {activeIndex > 0 && (
                <Animated.View style={[s.cardLayer, prevStyle]}>
                  <PageCard
                    sketch={sketches[activeIndex - 1]}
                    cardW={CARD_W} cardH={CARD_H}
                    onPress={() => {}}
                  />
                </Animated.View>
              )}

              {/* Next card — behind, revealed when swiping left */}
              {activeIndex < sketches.length - 1 && (
                <Animated.View style={[s.cardLayer, nextStyle]}>
                  <PageCard
                    sketch={sketches[activeIndex + 1]}
                    cardW={CARD_W} cardH={CARD_H}
                    onPress={() => {}}
                  />
                </Animated.View>
              )}

              {/* Front card — current, with pan gesture */}
              <GestureDetector gesture={gesture}>
                <Animated.View style={[s.cardLayer, frontStyle]}>
                  <PageCard
                    sketch={sketches[activeIndex]}
                    cardW={CARD_W} cardH={CARD_H}
                    onPress={() => router.push({
                      pathname: '/sketch-detail',
                      params: { sketchId: sketches[activeIndex].id, editable: 'false' },
                    })}
                  />
                  {/* Depth scrim — darkens as card departs */}
                  <Animated.View
                    style={[
                      StyleSheet.absoluteFill,
                      { borderRadius: 20, backgroundColor: '#000' },
                      scrimStyle,
                    ]}
                    pointerEvents="none"
                  />
                </Animated.View>
              </GestureDetector>
            </View>

            {/* ── Navigation row ──────────────────────────────────────── */}
            <View style={s.navRow}>
              <TouchableOpacity
                style={[s.navArrow, activeIndex === 0 && s.navArrowOff]}
                onPress={() => flipTo(activeIndex - 1)}
                disabled={activeIndex === 0}
              >
                <Ionicons name="chevron-back" size={18} color={activeIndex === 0 ? C.borderMed : C.text} />
              </TouchableOpacity>

              <View style={s.dotsRow}>
                {sketches.slice(0, 9).map((_, i) => (
                  <TouchableOpacity key={i} onPress={() => flipTo(i)}>
                    <View style={[s.dot, i === activeIndex && s.dotActive]} />
                  </TouchableOpacity>
                ))}
                {sketches.length > 9 && (
                  <Text style={s.dotMore}>+{sketches.length - 9}</Text>
                )}
              </View>

              <TouchableOpacity
                style={[s.navArrow, activeIndex === sketches.length - 1 && s.navArrowOff]}
                onPress={() => flipTo(activeIndex + 1)}
                disabled={activeIndex === sketches.length - 1}
              >
                <Ionicons name="chevron-forward" size={18} color={activeIndex === sketches.length - 1 ? C.borderMed : C.text} />
              </TouchableOpacity>
            </View>

            {/* Counter */}
            <Text style={s.counter}>{activeIndex + 1} of {sketches.length}</Text>
          </>
        )}
      </View>
    </ParentShell>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F2F2F7' },

  // Header — matches all other screens
  header: { backgroundColor: NAVY, paddingTop: 52 },
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

  // Pills
  pillsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 7,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
  },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20,
  },
  pillText: { fontSize: 12, fontWeight: '700' },

  // Flip area
  cardArea:  { position: 'relative' },
  cardLayer: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center',
  },

  // Navigation
  navRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 22 },
  navArrow:    { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EDEDF8', justifyContent: 'center', alignItems: 'center', ...SHADOW.sm },
  navArrowOff: { opacity: 0.28 },
  dotsRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot:         { width: 7, height: 7, borderRadius: 4, backgroundColor: C.borderMed },
  dotActive:   { width: 20, backgroundColor: C.primary },
  dotMore:     { fontSize: 11, color: C.textMuted, fontWeight: '700', marginLeft: 2 },
  counter:     { textAlign: 'center', fontSize: 11, color: C.textMuted, fontWeight: '500', marginTop: 10 },

  // Empty state
  emptyWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: C.text, marginBottom: 8, marginTop: 20 },
  emptyDesc:  { fontSize: 14, color: C.textSub, textAlign: 'center', lineHeight: 21, marginBottom: 28 },
  cta: {
    backgroundColor: C.primary, paddingHorizontal: 28, paddingVertical: 13,
    borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  ctaText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Child picker
  pickerList:      { padding: 20, gap: 10 },
  pickerCard:      { backgroundColor: '#fff', borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, ...SHADOW.sm },
  pickerAvatar:    { width: 48, height: 48, borderRadius: 14, backgroundColor: '#EDEDF8', justifyContent: 'center', alignItems: 'center' },
  pickerAvatarText:{ fontSize: 18, fontWeight: '800', color: NAVY },
  pickerInfo:      { flex: 1, gap: 2 },
  pickerName:      { fontSize: 16, fontWeight: '700', color: NAVY },
  pickerMeta:      { fontSize: 12, color: C.textSub },
});
