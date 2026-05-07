import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, useWindowDimensions,
  Image, Animated, FlatList, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabaseClient';
import { useApp } from '../../contexts/AppContext';
import { Sketch } from '../../types';
import { Ionicons } from '@expo/vector-icons';
import { C, EMOTION_COLORS, MAX_W, SHADOW } from '../../constants/theme';
import { ChildNav } from '../../components/ChildNav';
import { EmotionIcon } from '../../components/EmotionIcon';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });
}

export default function JournalScreen() {
  const { activeChild } = useApp();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const [sketches, setSketches] = useState<Sketch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const scrollX = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);

  // Card sizing — center card is 72% of screen width
  const CARD_W = Math.min(width * 0.72, 300);
  const CARD_H = CARD_W * 1.38;
  const ITEM_SIZE = CARD_W + 20;
  const SIDE_PAD = (width - CARD_W) / 2;

  useEffect(() => {
    if (!activeChild) { router.replace('/dashboard'); return; }
    fetchSketches();
  }, [activeChild]);

  async function fetchSketches() {
    if (!activeChild) return;
    const { data } = await supabase
      .from('sketches')
      .select('*')
      .eq('patient_id', activeChild.id)
      .order('created_at', { ascending: false });
    setSketches(data ?? []);
    setLoading(false);
    setRefreshing(false);
  }

  function handleScrollEnd(e: any) {
    const offset = e.nativeEvent.contentOffset.x;
    const index = Math.round(offset / ITEM_SIZE);
    setActiveIndex(Math.max(0, Math.min(index, sketches.length - 1)));
  }

  function goTo(index: number) {
    const clamped = Math.max(0, Math.min(index, sketches.length - 1));
    flatListRef.current?.scrollToOffset({ offset: clamped * ITEM_SIZE, animated: true });
    setActiveIndex(clamped);
  }

  if (!activeChild) return null;

  const firstName = activeChild.full_name.split(' ')[0];
  const emotionCount = sketches.reduce((acc, s) => {
    acc[s.emotion] = (acc[s.emotion] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const focused = sketches[activeIndex];

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.headerInner, { maxWidth: MAX_W }]}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/child/home')} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={20} color={C.white} />
          </TouchableOpacity>
          <Text style={styles.title}>{firstName}'s Journal</Text>
          <View style={{ width: 36 }} />
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : sketches.length === 0 ? (
        /* ── Empty state ─────────────────────────────────────── */
        <View style={styles.emptyWrap}>
          <Ionicons name="color-palette-outline" size={80} color={C.borderMed} />
          <Text style={styles.emptyTitle}>No drawings yet</Text>
          <Text style={styles.emptyDesc}>Start drawing to see your emotion journal here!</Text>
          <TouchableOpacity style={styles.drawNowBtn} onPress={() => router.push('/child/home')}>
            <Ionicons name="brush-outline" size={18} color={C.white} />
            <Text style={styles.drawNowText}>Draw Something!</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* ── Emotion summary pills ─────────────────────────── */}
          <View style={styles.summaryRow}>
            {Object.entries(emotionCount).sort((a, b) => b[1] - a[1]).map(([emotion, count]) => {
              const ec = EMOTION_COLORS[emotion];
              return (
                <View key={emotion} style={[styles.summaryPill, { backgroundColor: ec.card }]}>
                  <EmotionIcon emotion={emotion} size={15} />
                  <Text style={[styles.pillText, { color: ec.text }]}>{count}×</Text>
                </View>
              );
            })}
            <View style={[styles.summaryPill, { backgroundColor: C.primaryLight }]}>
              <Ionicons name="images-outline" size={14} color={C.primary} />
              <Text style={[styles.pillText, { color: C.primary }]}>{sketches.length}</Text>
            </View>
          </View>

          {/* ── Coverflow carousel ───────────────────────────── */}
          <Animated.FlatList
            ref={flatListRef}
            data={sketches}
            keyExtractor={item => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={ITEM_SIZE}
            decelerationRate="fast"
            bounces={false}
            contentContainerStyle={{ paddingHorizontal: SIDE_PAD }}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }],
              { useNativeDriver: true }
            )}
            scrollEventThrottle={16}
            onMomentumScrollEnd={handleScrollEnd}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSketches(); }} tintColor={C.primary} />
            }
            renderItem={({ item, index }) => {
              const inputRange = [
                (index - 1) * ITEM_SIZE,
                index * ITEM_SIZE,
                (index + 1) * ITEM_SIZE,
              ];
              const scale = scrollX.interpolate({
                inputRange, outputRange: [0.80, 1, 0.80], extrapolate: 'clamp',
              });
              const rotateY = scrollX.interpolate({
                inputRange, outputRange: ['42deg', '0deg', '-42deg'], extrapolate: 'clamp',
              });
              const opacity = scrollX.interpolate({
                inputRange, outputRange: [0.55, 1, 0.55], extrapolate: 'clamp',
              });
              const ec = EMOTION_COLORS[item.emotion];
              return (
                <TouchableOpacity
                  activeOpacity={0.92}
                  onPress={() => router.push({
                    pathname: '/sketch-detail',
                    params: { sketchId: item.id, editable: 'false' },
                  })}
                  style={{ width: CARD_W, marginHorizontal: 10 }}
                >
                  <Animated.View style={[
                    styles.card,
                    { width: CARD_W, height: CARD_H },
                    { transform: [{ perspective: 900 }, { rotateY }, { scale }], opacity },
                  ]}>
                    {/* Drawing image */}
                    {item.image_url ? (
                      <Image
                        source={{ uri: item.image_url }}
                        style={[styles.cardImage, { height: CARD_H * 0.68 }]}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[styles.cardImagePlaceholder, { height: CARD_H * 0.68, backgroundColor: ec.card }]}>
                        <EmotionIcon emotion={item.emotion} size={52} />
                      </View>
                    )}

                    {/* Bottom info */}
                    <View style={[styles.cardBottom, { backgroundColor: ec.card }]}>
                      <View style={styles.cardEmotionRow}>
                        <EmotionIcon emotion={item.emotion} size={20} />
                        <Text style={[styles.cardEmotion, { color: ec.text }]}>
                          {item.emotion.charAt(0).toUpperCase() + item.emotion.slice(1)}
                        </Text>
                      </View>
                      <Text style={[styles.cardDate, { color: ec.text + 'bb' }]}>
                        {formatDate(item.created_at)} · {formatTime(item.created_at)}
                      </Text>
                      {item.notes && (
                        <Text style={[styles.cardNote, { color: ec.text + '99' }]} numberOfLines={1}>
                          {item.notes}
                        </Text>
                      )}
                    </View>
                  </Animated.View>
                </TouchableOpacity>
              );
            }}
          />

          {/* ── Nav arrows + dot indicators ──────────────────── */}
          <View style={styles.navRow}>
            <TouchableOpacity
              style={[styles.navArrow, activeIndex === 0 && styles.navArrowDisabled]}
              onPress={() => goTo(activeIndex - 1)}
              disabled={activeIndex === 0}
            >
              <Ionicons name="chevron-back" size={20} color={activeIndex === 0 ? C.borderMed : C.text} />
            </TouchableOpacity>

            {/* Dot indicators — max 9 visible */}
            <View style={styles.dotsRow}>
              {sketches.slice(0, 9).map((_, i) => (
                <TouchableOpacity key={i} onPress={() => goTo(i)}>
                  <View style={[
                    styles.dot,
                    i === activeIndex && styles.dotActive,
                    sketches.length > 9 && i === 8 && styles.dotSmall,
                  ]} />
                </TouchableOpacity>
              ))}
              {sketches.length > 9 && (
                <Text style={styles.dotMore}>+{sketches.length - 9}</Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.navArrow, activeIndex === sketches.length - 1 && styles.navArrowDisabled]}
              onPress={() => goTo(activeIndex + 1)}
              disabled={activeIndex === sketches.length - 1}
            >
              <Ionicons name="chevron-forward" size={20} color={activeIndex === sketches.length - 1 ? C.borderMed : C.text} />
            </TouchableOpacity>
          </View>

          {/* ── Focused card detail strip ─────────────────────── */}
          {focused && (() => {
            const ec = EMOTION_COLORS[focused.emotion];
            return (
              <View style={[styles.focusStrip, { borderLeftColor: ec.text }]}>
                <Text style={styles.focusIndex}>{activeIndex + 1} / {sketches.length}</Text>
                <Text style={[styles.focusEmotion, { color: ec.text }]}>
                  {focused.emotion.charAt(0).toUpperCase() + focused.emotion.slice(1)}
                </Text>
                <Text style={styles.focusDate}>{formatDate(focused.created_at)}</Text>
              </View>
            );
          })()}
        </>
      )}

      {/* FAB */}
      {!loading && (
        <TouchableOpacity style={styles.fab} onPress={() => router.push('/child/home')}>
          <Ionicons name="brush" size={26} color={C.white} />
        </TouchableOpacity>
      )}

      <ChildNav />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFF8F0' },

  header: { backgroundColor: C.primary, paddingTop: 52, paddingBottom: 18 },
  headerInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, alignSelf: 'center', width: '100%',
  },
  backBtn: {},
  title: { fontSize: 20, fontWeight: '800', color: C.white },

  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: C.text, marginBottom: 8, marginTop: 20 },
  emptyDesc: { fontSize: 15, color: C.textSub, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  drawNowBtn: {
    backgroundColor: C.primary, paddingHorizontal: 32, paddingVertical: 16,
    borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  drawNowText: { fontSize: 16, fontWeight: '700', color: C.white },

  summaryRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 7,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
  },
  summaryPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20,
  },
  pillText: { fontSize: 12, fontWeight: '700' },

  // Cards
  card: {
    borderRadius: 20, overflow: 'hidden',
    backgroundColor: C.white,
    ...SHADOW.lg,
  },
  cardImage: { width: '100%' },
  cardImagePlaceholder: {
    width: '100%', justifyContent: 'center', alignItems: 'center',
  },
  cardBottom: { flex: 1, padding: 14, justifyContent: 'center', gap: 3 },
  cardEmotionRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  cardEmotion: { fontSize: 16, fontWeight: '800', textTransform: 'capitalize' },
  cardDate: { fontSize: 11, fontWeight: '500' },
  cardNote: { fontSize: 11, marginTop: 2 },

  // Nav
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 18 },
  navArrow: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#FFE4F0', justifyContent: 'center', alignItems: 'center',
    ...SHADOW.sm,
  },
  navArrowDisabled: { opacity: 0.35 },
  dotsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.borderMed },
  dotActive: { width: 20, backgroundColor: C.primary },
  dotSmall: { width: 5, height: 5 },
  dotMore: { fontSize: 11, color: C.textMuted, fontWeight: '700', marginLeft: 2 },

  // Focus strip
  focusStrip: {
    marginHorizontal: 24, marginTop: 14,
    borderLeftWidth: 3, paddingLeft: 12,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  focusIndex: { fontSize: 11, color: C.textMuted, fontWeight: '600', minWidth: 40 },
  focusEmotion: { fontSize: 14, fontWeight: '800', textTransform: 'capitalize', flex: 1 },
  focusDate: { fontSize: 12, color: C.textMuted },

  fab: {
    position: 'absolute', bottom: 32, right: 24,
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center',
    shadowColor: C.primary, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6,
  },
});
