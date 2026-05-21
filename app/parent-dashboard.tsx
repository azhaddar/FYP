import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabaseClient';
import { C, EMOTION_COLORS, MAX_W, SHADOW } from '../constants/theme';

const NAVY = '#1A1F3C';
import { Sketch } from '../types';
import { EmotionIcon } from '../components/EmotionIcon';

const EMOTION_LIST = ['happy', 'sad', 'angry', 'anxious'] as const;

function TrendChart({ sketches }: { sketches: Sketch[] }) {
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return d.toISOString().slice(0, 10);
  });

  const byDate: Record<string, Sketch[]> = {};
  for (const s of sketches) {
    const key = s.created_at.slice(0, 10);
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(s);
  }

  const dayData = days.map(date => {
    const ds = byDate[date] ?? [];
    if (!ds.length) return { date, emotion: null, count: 0 };
    const counts: Record<string, number> = {};
    for (const s of ds) counts[s.emotion] = (counts[s.emotion] ?? 0) + 1;
    const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    return { date, emotion: dominant, count: ds.length };
  });

  const maxCount = Math.max(...dayData.map(d => d.count), 1);
  const today = new Date().toISOString().slice(0, 10);
  const BAR_H = 72;

  return (
    <View style={chartStyles.container}>
      {/* Y-axis ghost lines */}
      <View style={chartStyles.gridLines} pointerEvents="none">
        {[1, 0.5].map(frac => (
          <View key={frac} style={[chartStyles.gridLine, { bottom: frac * BAR_H }]} />
        ))}
      </View>

      {/* Bars */}
      <View style={[chartStyles.barsRow, { height: BAR_H }]}>
        {dayData.map(({ date, emotion, count }) => {
          const barH = count > 0 ? Math.max(Math.round((count / maxCount) * BAR_H), 6) : 2;
          const color = emotion ? EMOTION_COLORS[emotion].text : C.border;
          const isToday = date === today;
          return (
            <View key={date} style={[chartStyles.barWrap, { height: BAR_H }]}>
              <View style={[
                chartStyles.bar,
                { height: barH, backgroundColor: color },
                count === 0 && chartStyles.barEmpty,
                isToday && chartStyles.barToday,
              ]} />
            </View>
          );
        })}
      </View>

      {/* X-axis week markers */}
      <View style={chartStyles.xAxis}>
        {['4 wks ago', '3 wks', '2 wks', '1 wk', 'Today'].map((label, i) => (
          <Text key={i} style={[chartStyles.xLabel, i === 4 && { color: C.primary, fontWeight: '700' }]}>
            {label}
          </Text>
        ))}
      </View>

      {/* Legend */}
      <View style={chartStyles.legend}>
        {EMOTION_LIST.map(e => (
          <View key={e} style={chartStyles.legendItem}>
            <View style={[chartStyles.legendDot, { backgroundColor: EMOTION_COLORS[e].text }]} />
            <Text style={chartStyles.legendLabel}>{e.charAt(0).toUpperCase() + e.slice(1)}</Text>
          </View>
        ))}
      </View>

      <Text style={chartStyles.caption}>Each bar = one day · height = number of sessions</Text>
    </View>
  );
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-MY', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}


function groupByDate(sketches: Sketch[]): Record<string, Sketch[]> {
  return sketches.reduce((acc, s) => {
    const date = s.created_at.slice(0, 10);
    if (!acc[date]) acc[date] = [];
    acc[date].push(s);
    return acc;
  }, {} as Record<string, Sketch[]>);
}

export default function ParentDashboardScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { patientId, patientName } = useLocalSearchParams<{ patientId: string; patientName: string }>();

  const [sketches, setSketches] = useState<Sketch[]>([]);
  const [therapistName, setTherapistName] = useState<string | null>(null);
  const [therapistId, setTherapistId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { fetchSketches(); fetchTherapistName(); }, []);

  async function fetchTherapistName() {
    if (!patientId) return;
    const { data: patient } = await supabase
      .from('patients').select('therapist_id').eq('id', patientId).single();
    if (!patient?.therapist_id) return;
    setTherapistId(patient.therapist_id);
    const { data: profile } = await supabase
      .from('profiles').select('full_name').eq('id', patient.therapist_id).single();
    if (profile) setTherapistName(profile.full_name);
  }

  async function fetchSketches() {
    if (!patientId) return;
    const { data } = await supabase
      .from('sketches')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });
    setSketches(data ?? []);
    setLoading(false);
    setRefreshing(false);
  }


  const grouped = groupByDate(sketches);
  const total = sketches.length;

  const emotionCounts = EMOTION_LIST.reduce((acc, e) => {
    acc[e] = sketches.filter(s => s.emotion === e).length;
    return acc;
  }, {} as Record<string, number>);

  const sortedDates = Object.keys(grouped).sort().reverse();
  const firstName = (patientName ?? 'Child').split(' ')[0];

  return (
    <View style={styles.root}>
      {/* Pink header */}
      <View style={styles.header}>
        <View style={[styles.headerInner, width >= 768 && { maxWidth: MAX_W }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={C.white} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{firstName}'s Dashboard</Text>
            <Text style={styles.headerSub}>{total} total drawings</Text>
            {therapistName && (
              <TouchableOpacity
                style={styles.therapistPill}
                onPress={() => therapistId && router.push({
                  pathname: '/therapist-profile',
                  params: { therapistId },
                })}
                activeOpacity={0.8}
              >
                <Ionicons name="person-circle-outline" size={13} color="rgba(255,255,255,0.9)" />
                <Text style={styles.therapistPillText}>Therapist: {therapistName}</Text>
                <Ionicons name="chevron-forward" size={11} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            )}
          </View>
          <View style={{ width: 60 }} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, width >= 768 && styles.contentWide]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSketches(); }} tintColor={C.primary} />
        }
      >
        {loading ? (
          <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 60 }} />
        ) : sketches.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="color-palette-outline" size={72} color={C.borderMed} />
            <Text style={styles.emptyTitle}>No drawings yet</Text>
            <Text style={styles.emptyDesc}>Start a drawing session to see data here.</Text>
          </View>
        ) : (
          <>
            {/* Emotion summary — 2x2 grid */}
            <Text style={styles.sectionTitle}>Emotion Summary</Text>
            <View style={styles.summaryGrid}>
              {EMOTION_LIST.map(emotion => {
                const ec = EMOTION_COLORS[emotion];
                const count = emotionCounts[emotion];
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <View key={emotion} style={[styles.summaryCard, { backgroundColor: ec.card, borderColor: ec.card }]}>
                    <EmotionIcon emotion={emotion} size={32} />
                    <Text style={[styles.summaryCount, { color: ec.text }]}>{count}</Text>
                    <Text style={[styles.summaryLabel, { color: ec.text }]}>
                      {emotion.charAt(0).toUpperCase() + emotion.slice(1)}
                    </Text>
                    <Text style={[styles.summaryPct, { color: ec.text + '99' }]}>{pct}%</Text>
                  </View>
                );
              })}
            </View>

            {/* 30-day trend chart */}
            <Text style={styles.sectionTitle}>Emotion Trend · Last 30 Days</Text>
            <View style={styles.trendCard}>
              <TrendChart sketches={sketches} />
            </View>

            {/* Session list with notes */}
            <Text style={styles.sectionTitle}>All Sessions</Text>
            {sortedDates.map(date => (
              <View key={date}>
                <Text style={styles.dateHeader}>{formatDate(date)}</Text>
                {grouped[date].map(sketch => {
                  const ec = EMOTION_COLORS[sketch.emotion];
                  return (
                    <TouchableOpacity
                      key={sketch.id}
                      style={styles.sessionCard}
                      onPress={() => router.push({
                        pathname: '/sketch-detail',
                        params: { sketchId: sketch.id, editable: 'true' },
                      })}
                      activeOpacity={0.85}
                    >
                      <View style={[styles.sessionCircle, { backgroundColor: ec.card }]}>
                        <EmotionIcon emotion={sketch.emotion} size={22} />
                      </View>
                      <View style={styles.sessionBody}>
                        <View style={styles.sessionTop}>
                          <Text style={[styles.sessionEmotion, { color: ec.text }]}>
                            {sketch.emotion.charAt(0).toUpperCase() + sketch.emotion.slice(1)}
                          </Text>
                          <Text style={styles.sessionTime}>{formatTime(sketch.created_at)}</Text>
                        </View>
                        {sketch.notes ? (
                          <View style={styles.noteRow}>
                            <Ionicons name="document-text-outline" size={13} color={C.textSub} />
                            <Text style={styles.sessionNote}>{sketch.notes}</Text>
                          </View>
                        ) : (
                          <Text style={styles.sessionNoNote}>Tap to view · add a note</Text>
                        )}
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={C.borderMed} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.base },

  header: { backgroundColor: NAVY, paddingTop: 52, paddingBottom: 18 },
  therapistPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginTop: 6, backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, alignSelf: 'center',
  },
  therapistPillText: { fontSize: 12, color: 'rgba(255,255,255,0.95)', fontWeight: '600' },
  headerInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, alignSelf: 'center', width: '100%',
  },
  backBtn: { fontSize: 15, color: C.white, fontWeight: '600', width: 60 },
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: C.white },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

  content: { padding: 24, paddingBottom: 40 },
  contentWide: { maxWidth: MAX_W, alignSelf: 'center', width: '100%' },

  sectionTitle: {
    fontSize: 16, fontWeight: '700', color: C.text,
    marginBottom: 12, marginTop: 8,
  },

  summaryGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28,
  },
  summaryCard: {
    width: '47%', borderRadius: 14,
    padding: 14, alignItems: 'center', gap: 3,
    ...SHADOW.sm,
  },
  summaryCount: { fontSize: 32, fontWeight: '800' },
  summaryLabel: { fontSize: 14, fontWeight: '600', textTransform: 'capitalize' },
  summaryPct: { fontSize: 13 },

  trendCard: {
    backgroundColor: C.white, borderRadius: 14,
    padding: 14, marginBottom: 24,
    ...SHADOW.sm,
  },

  dateHeader: {
    fontSize: 13, fontWeight: '700', color: C.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 10, marginTop: 8,
  },
  sessionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.white, borderRadius: 12, padding: 12,
    marginBottom: 8,
    ...SHADOW.sm,
  },
  sessionCircle: {
    width: 46, height: 46, borderRadius: 23,
    justifyContent: 'center', alignItems: 'center',
  },
  sessionBody: { flex: 1 },
  sessionTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  sessionEmotion: { fontSize: 15, fontWeight: '700', textTransform: 'capitalize' },
  sessionTime: { fontSize: 12, color: C.textMuted },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  sessionNote: { fontSize: 13, color: C.textSub, lineHeight: 18, flex: 1 },
  sessionNoNote: { fontSize: 13, color: C.textMuted, marginTop: 4, fontStyle: 'italic' },


  empty: { alignItems: 'center', paddingVertical: 80 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: C.text, marginBottom: 8 },
  emptyDesc: { fontSize: 15, color: C.textSub, textAlign: 'center' },
});

const chartStyles = StyleSheet.create({
  container: { gap: 0 },

  gridLines: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 28 },
  gridLine: {
    position: 'absolute', left: 0, right: 0,
    height: 1, backgroundColor: C.border,
  },

  barsRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    gap: 2, marginBottom: 6,
  },
  barWrap: {
    flex: 1, justifyContent: 'flex-end', alignItems: 'center',
  },
  bar: { width: '100%', borderRadius: 3 },
  barEmpty: { backgroundColor: C.border, height: 2, opacity: 0.5 },
  barToday: { opacity: 1 },

  xAxis: {
    flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14,
  },
  xLabel: { fontSize: 10, color: C.textMuted, fontWeight: '600' },

  legend: {
    flexDirection: 'row', gap: 14, flexWrap: 'wrap', marginBottom: 10,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 12, color: C.textSub, fontWeight: '600' },

  caption: { fontSize: 11, color: C.textMuted, fontStyle: 'italic' },
});
