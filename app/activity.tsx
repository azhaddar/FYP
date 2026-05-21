import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabaseClient';
import { C, EMOTION_COLORS, MAX_W, SHADOW } from '../constants/theme';

const NAVY = '#1A1F3C';
import { ParentShell } from '../components/ParentShell';
import { EmotionIcon } from '../components/EmotionIcon';

type SketchRow = { id: string; emotion: string; created_at: string; patient_id: string; notes: string | null };
type PatientRow = { id: string; full_name: string };

const EMOTION_LIST = ['happy', 'sad', 'angry', 'anxious'] as const;
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function makeDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });
}
function isThisWeek(iso: string) {
  return new Date(iso) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
}
function getDominantEmotion(sketches: SketchRow[]) {
  if (!sketches.length) return null;
  const counts = EMOTION_LIST.reduce((acc, e) => { acc[e] = 0; return acc; }, {} as Record<string, number>);
  sketches.forEach(s => { if (counts[s.emotion] !== undefined) counts[s.emotion]++; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

// ── 7-day activity strip ──────────────────────────────────────────
function WeekStrip({ sketches }: { sketches: SketchRow[] }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return { date: localDateStr(d), label: DAY_INITIALS[d.getDay()], isToday: i === 6 };
  });

  const counts = days.map(({ date }) => sketches.filter(s => s.created_at.slice(0, 10) === date).length);
  const maxCount = Math.max(1, ...counts);

  return (
    <View style={wk.card}>
      <Text style={wk.title}>Last 7 Days</Text>
      <View style={wk.row}>
        {days.map(({ date, label, isToday }, i) => {
          const count = counts[i];
          const daySketches = sketches.filter(s => s.created_at.slice(0, 10) === date);
          const dominant = getDominantEmotion(daySketches);
          const ec = dominant ? EMOTION_COLORS[dominant] : null;
          const barH = count > 0 ? Math.max(12, Math.round((count / maxCount) * 52)) : 5;
          return (
            <View key={date} style={wk.col}>
              <Text style={wk.count}>{count > 0 ? count : ''}</Text>
              <View style={wk.barWrap}>
                <View style={[wk.bar, ec ? { backgroundColor: ec.text, opacity: 0.8 } : { backgroundColor: C.border }, { height: barH }]} />
              </View>
              <Text style={[wk.day, isToday && wk.dayToday]}>{label}</Text>
              {isToday ? <View style={wk.todayDot} /> : <View style={wk.dotGap} />}
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── Calendar view ─────────────────────────────────────────────────
function CalendarView({
  sketches, patientMap, selectedChild, onSketchPress,
}: {
  sketches: SketchRow[];
  patientMap: Record<string, string>;
  selectedChild: string;
  onSketchPress: (id: string) => void;
}) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const todayStr = localDateStr();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
    setSelectedDate(null);
  }
  function nextMonth() {
    if (isCurrentMonth) return;
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
    setSelectedDate(null);
  }

  // Build grid cells: null = empty padding, number = day
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  function getDayInfo(day: number) {
    const date = makeDateStr(year, month, day);
    const daySketches = sketches.filter(s => s.created_at.slice(0, 10) === date);
    const seen = new Set<string>();
    const emotions: string[] = [];
    for (const s of daySketches) {
      if (!seen.has(s.emotion) && emotions.length < 3) { seen.add(s.emotion); emotions.push(s.emotion); }
    }
    return { date, count: daySketches.length, emotions };
  }

  const selectedSketches = selectedDate
    ? sketches.filter(s => s.created_at.slice(0, 10) === selectedDate)
    : [];

  return (
    <View style={cal.card}>
      {/* Month navigator */}
      <View style={cal.monthNav}>
        <TouchableOpacity style={cal.navBtn} onPress={prevMonth} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={17} color={C.text} />
        </TouchableOpacity>
        <Text style={cal.monthLabel}>{MONTH_NAMES[month]} {year}</Text>
        <TouchableOpacity style={cal.navBtn} onPress={nextMonth} activeOpacity={0.7} disabled={isCurrentMonth}>
          <Ionicons name="chevron-forward" size={17} color={isCurrentMonth ? C.borderMed : C.text} />
        </TouchableOpacity>
      </View>

      {/* Day-of-week header */}
      <View style={cal.weekHeader}>
        {DAY_INITIALS.map((d, i) => (
          <Text key={i} style={cal.weekHeaderText}>{d}</Text>
        ))}
      </View>

      {/* Grid rows */}
      {rows.map((row, ri) => (
        <View key={ri} style={cal.row}>
          {row.map((day, ci) => {
            if (!day) return <View key={ci} style={cal.cellGhost} />;
            const { date, count, emotions } = getDayInfo(day);
            const isToday = date === todayStr;
            const isSelected = date === selectedDate;
            const hasDrawings = count > 0;
            return (
              <TouchableOpacity
                key={ci}
                style={[
                  cal.cell,
                  isSelected && cal.cellSelected,
                  isToday && !isSelected && cal.cellToday,
                ]}
                onPress={() => setSelectedDate(isSelected ? null : date)}
                activeOpacity={0.72}
              >
                <Text style={[
                  cal.cellNum,
                  isSelected && cal.cellNumSelected,
                  isToday && !isSelected && cal.cellNumToday,
                  !hasDrawings && { color: C.textMuted },
                ]}>
                  {day}
                </Text>
                {hasDrawings && (
                  <View style={cal.dotRow}>
                    {emotions.map((e, ei) => (
                      <View
                        key={ei}
                        style={[cal.dot, { backgroundColor: isSelected ? 'rgba(255,255,255,0.9)' : EMOTION_COLORS[e]?.text }]}
                      />
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      {/* Selected day panel */}
      {selectedDate && (
        <View style={cal.panel}>
          <View style={cal.panelHeader}>
            <Text style={cal.panelTitle}>
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-MY', {
                weekday: 'long', day: 'numeric', month: 'long',
              })}
            </Text>
            <Text style={cal.panelCount}>
              {selectedSketches.length} {selectedSketches.length === 1 ? 'drawing' : 'drawings'}
            </Text>
          </View>

          {selectedSketches.length === 0 ? (
            <Text style={cal.panelEmpty}>No drawings on this day</Text>
          ) : (
            selectedSketches.map(s => {
              const ec = EMOTION_COLORS[s.emotion];
              const name = patientMap[s.patient_id] ?? 'Unknown';
              return (
                <TouchableOpacity
                  key={s.id}
                  style={cal.panelEntry}
                  onPress={() => onSketchPress(s.id)}
                  activeOpacity={0.82}
                >
                  <View style={[cal.panelEntryCircle, { backgroundColor: ec.card }]}>
                    <EmotionIcon emotion={s.emotion} size={18} />
                  </View>
                  <View style={{ flex: 1 }}>
                    {selectedChild === 'all' && (
                      <Text style={cal.panelEntryName}>{name}</Text>
                    )}
                    <Text style={[cal.panelEntryEmotion, { color: ec.text }]}>
                      {s.emotion.charAt(0).toUpperCase() + s.emotion.slice(1)}
                    </Text>
                    {!!s.notes && (
                      <Text style={cal.panelEntryNotes} numberOfLines={1}>{s.notes}</Text>
                    )}
                  </View>
                  <Text style={cal.panelEntryTime}>{formatTime(s.created_at)}</Text>
                  <Ionicons name="chevron-forward" size={13} color={C.borderMed} />
                </TouchableOpacity>
              );
            })
          )}
        </View>
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────
export default function ActivityScreen() {
  const router = useRouter();

  const [sketches, setSketches] = useState<SketchRow[]>([]);
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedChild, setSelectedChild] = useState<string>('all');
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: pts } = await supabase
      .from('patients').select('id, full_name').eq('guardian_id', user.id);

    const patientIds = (pts ?? []).map(p => p.id);
    setPatients(pts ?? []);

    if (patientIds.length === 0) {
      setSketches([]); setLoading(false); setRefreshing(false); return;
    }

    const { data: sks } = await supabase
      .from('sketches')
      .select('id, emotion, created_at, patient_id, notes')
      .in('patient_id', patientIds)
      .order('created_at', { ascending: false });

    setSketches(sks ?? []);
    setLoading(false);
    setRefreshing(false);
  }

  const patientMap = Object.fromEntries(patients.map(p => [p.id, p.full_name]));
  const filtered = selectedChild === 'all' ? sketches : sketches.filter(s => s.patient_id === selectedChild);

  const total = filtered.length;
  const thisWeekCount = filtered.filter(s => isThisWeek(s.created_at)).length;
  const dominant = getDominantEmotion(filtered);

  const emotionCounts = EMOTION_LIST.reduce((acc, e) => {
    acc[e] = filtered.filter(s => s.emotion === e).length; return acc;
  }, {} as Record<string, number>);

  return (
    <ParentShell>
    <View style={styles.root}>
      <View style={[styles.header, isWide && styles.headerWide]}>
        <View style={styles.headerInner}>
          <Text style={[styles.headerTitle, isWide && styles.headerTitleWide]}>Activity</Text>
          <Text style={[styles.headerSub, isWide && styles.headerSubWide]}>
            {patients.length} {patients.length === 1 ? 'child' : 'children'} · {sketches.length} total drawings
          </Text>
        </View>

        {!loading && patients.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
            <TouchableOpacity
              style={[styles.tab, isWide && styles.tabWide, selectedChild === 'all' && styles.tabActive, isWide && selectedChild === 'all' && styles.tabActiveWide]}
              onPress={() => setSelectedChild('all')}
            >
              <Text style={[styles.tabText, isWide && styles.tabTextWide, selectedChild === 'all' && styles.tabTextActive, isWide && selectedChild === 'all' && styles.tabTextActiveWide]}>All Children</Text>
            </TouchableOpacity>
            {patients.map(p => (
              <TouchableOpacity
                key={p.id}
                style={[styles.tab, isWide && styles.tabWide, selectedChild === p.id && styles.tabActive, isWide && selectedChild === p.id && styles.tabActiveWide]}
                onPress={() => setSelectedChild(p.id)}
              >
                <Text style={[styles.tabText, isWide && styles.tabTextWide, selectedChild === p.id && styles.tabTextActive, isWide && selectedChild === p.id && styles.tabTextActiveWide]}>
                  {p.full_name.split(' ')[0]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={C.primary} />
        }
      >
        {loading ? (
          <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 60 }} />
        ) : sketches.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="color-palette-outline" size={64} color={C.borderMed} />
            <Text style={styles.emptyTitle}>No drawings yet</Text>
            <Text style={styles.emptyDesc}>Activity will appear here once your children start drawing.</Text>
          </View>
        ) : (
          <>
            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={[styles.statCard, { borderTopColor: C.primary }]}>
                <Ionicons name="images-outline" size={20} color={C.primary} />
                <Text style={styles.statNumber}>{total}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
              <View style={[styles.statCard, { borderTopColor: '#7c3aed' }]}>
                <Ionicons name="calendar-outline" size={20} color="#7c3aed" />
                <Text style={[styles.statNumber, { color: '#7c3aed' }]}>{thisWeekCount}</Text>
                <Text style={styles.statLabel}>This Week</Text>
              </View>
              <View style={[
                styles.statCard,
                dominant
                  ? { borderTopColor: EMOTION_COLORS[dominant].text, backgroundColor: EMOTION_COLORS[dominant].card }
                  : { borderTopColor: C.borderMed },
              ]}>
                {dominant
                  ? <EmotionIcon emotion={dominant} size={22} />
                  : <Ionicons name="help-circle-outline" size={22} color={C.borderMed} />}
                <Text style={[styles.statNumber, { fontSize: 13, color: dominant ? EMOTION_COLORS[dominant].text : C.text }]}>
                  {dominant ? dominant.charAt(0).toUpperCase() + dominant.slice(1) : '—'}
                </Text>
                <Text style={[styles.statLabel, { color: dominant ? EMOTION_COLORS[dominant].text + '99' : C.textMuted }]}>
                  Top Mood
                </Text>
              </View>
            </View>

            {/* 7-day strip */}
            <WeekStrip sketches={filtered} />

            {/* By Child cards */}
            {selectedChild === 'all' && patients.length > 1 && (
              <>
                <Text style={styles.sectionTitle}>By Child</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.childCardsScroll}>
                  <View style={styles.childCardsRow}>
                    {patients.map(p => {
                      const cs = sketches.filter(s => s.patient_id === p.id);
                      const cd = getDominantEmotion(cs);
                      const cw = cs.filter(s => isThisWeek(s.created_at)).length;
                      const ec = cd ? EMOTION_COLORS[cd] : null;
                      return (
                        <TouchableOpacity
                          key={p.id}
                          style={styles.childCard}
                          onPress={() => router.push({ pathname: '/parent-dashboard', params: { patientId: p.id, patientName: p.full_name } })}
                          activeOpacity={0.85}
                        >
                          <View style={[styles.childCardTop, ec && { backgroundColor: ec.card }]}>
                            {cd ? <EmotionIcon emotion={cd} size={36} /> : <Ionicons name="brush-outline" size={36} color={C.textMuted} />}
                          </View>
                          <View style={styles.childCardBody}>
                            <Text style={styles.childCardName}>{p.full_name.split(' ')[0]}</Text>
                            <Text style={styles.childCardCount}>{cs.length} drawings</Text>
                            {cd && <Text style={[styles.childCardEmotion, { color: ec!.text }]}>Mostly {cd}</Text>}
                            <View style={styles.childCardWeekRow}>
                              <Ionicons name="calendar-outline" size={11} color={C.textMuted} />
                              <Text style={styles.childCardWeek}>{cw} this week</Text>
                            </View>
                          </View>
                          <Ionicons name="chevron-forward" size={16} color={C.borderMed} style={styles.childCardChevron} />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              </>
            )}

            {/* Emotion breakdown */}
            <Text style={styles.sectionTitle}>
              Emotion Breakdown{selectedChild !== 'all' && ` — ${patientMap[selectedChild]?.split(' ')[0]}`}
            </Text>
            <View style={styles.breakdownCard}>
              {EMOTION_LIST.map(emotion => {
                const count = emotionCounts[emotion] ?? 0;
                const pct = total > 0 ? count / total : 0;
                const ec = EMOTION_COLORS[emotion];
                return (
                  <View key={emotion} style={styles.barRow}>
                    <View style={styles.barLabelRow}>
                      <EmotionIcon emotion={emotion} size={18} />
                      <Text style={styles.barEmotion}>{emotion.charAt(0).toUpperCase() + emotion.slice(1)}</Text>
                      <Text style={[styles.barCount, { color: ec.text }]}>{count}</Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${Math.round(pct * 100)}%` as any, backgroundColor: ec.text }]} />
                    </View>
                    <Text style={styles.barPct}>{Math.round(pct * 100)}%</Text>
                  </View>
                );
              })}
            </View>

            {/* Calendar */}
            <Text style={styles.sectionTitle}>
              Drawing Calendar{selectedChild !== 'all' && ` — ${patientMap[selectedChild]?.split(' ')[0]}`}
            </Text>
            <CalendarView
              sketches={filtered}
              patientMap={patientMap}
              selectedChild={selectedChild}
              onSketchPress={id => router.push({ pathname: '/sketch-detail', params: { sketchId: id, editable: 'false' } })}
            />
          </>
        )}
      </ScrollView>

    </View>
    </ParentShell>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.base },

  header: { backgroundColor: NAVY, paddingTop: 52, paddingBottom: 0 },
  headerInner: { paddingHorizontal: 24, paddingBottom: 14 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: C.white },
  headerSub: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 3 },

  tabsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 24, paddingBottom: 14, paddingTop: 4 },
  tab: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)' },
  tabActive: { backgroundColor: C.white },
  tabText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  tabTextActive: { color: NAVY },

  headerWide:     { backgroundColor: '#fff', paddingTop: 0, borderBottomWidth: 1, borderBottomColor: '#EBEBEB' },
  headerTitleWide:{ color: NAVY },
  headerSubWide:  { color: '#888' },
  tabWide:        { backgroundColor: '#F4F5FA' },
  tabActiveWide:  { backgroundColor: NAVY },
  tabTextWide:    { color: NAVY },
  tabTextActiveWide: { color: '#fff' },

  content: { padding: 20, paddingBottom: 40, maxWidth: MAX_W, alignSelf: 'center', width: '100%' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 12, marginTop: 4 },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: C.white, borderRadius: 14, padding: 12, alignItems: 'center', gap: 3, borderTopWidth: 3, ...SHADOW.sm },
  statNumber: { fontSize: 22, fontWeight: '800', color: C.primary },
  statLabel: { fontSize: 10, color: C.textMuted, fontWeight: '600', textAlign: 'center' },

  childCardsScroll: { marginBottom: 24 },
  childCardsRow: { flexDirection: 'row', gap: 14, paddingRight: 4 },
  childCard: { width: 160, backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  childCardTop: { backgroundColor: C.base, height: 80, justifyContent: 'center', alignItems: 'center' },
  childCardBody: { padding: 14, gap: 3 },
  childCardName: { fontSize: 15, fontWeight: '800', color: C.text },
  childCardCount: { fontSize: 12, color: C.textMuted },
  childCardEmotion: { fontSize: 13, fontWeight: '600', textTransform: 'capitalize', marginTop: 2 },
  childCardWeekRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  childCardWeek: { fontSize: 11, color: C.textMuted },
  childCardChevron: { position: 'absolute', bottom: 16, right: 14 },

  breakdownCard: { backgroundColor: C.white, borderRadius: 14, padding: 16, marginBottom: 24, gap: 14, ...SHADOW.sm },
  barRow: { gap: 6 },
  barLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barEmotion: { flex: 1, fontSize: 14, fontWeight: '600', color: C.text },
  barCount: { fontSize: 14, fontWeight: '700' },
  barTrack: { height: 10, backgroundColor: C.base, borderRadius: 5, overflow: 'hidden' },
  barFill: { height: 10, borderRadius: 5, minWidth: 8, opacity: 0.8 },
  barPct: { fontSize: 12, color: C.textMuted, textAlign: 'right' },

  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.text, marginTop: 16, marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: C.textMuted, textAlign: 'center' },
});

const wk = StyleSheet.create({
  card: { backgroundColor: C.white, borderRadius: 14, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, marginBottom: 20, ...SHADOW.sm },
  title: { fontSize: 13, fontWeight: '700', color: C.textMuted, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  col: { flex: 1, alignItems: 'center' },
  count: { fontSize: 10, fontWeight: '700', color: C.textMuted, height: 14 },
  barWrap: { height: 56, justifyContent: 'flex-end', alignItems: 'center', marginBottom: 6 },
  bar: { width: 14, borderRadius: 7 },
  day: { fontSize: 11, fontWeight: '600', color: C.textMuted },
  dayToday: { color: C.primary, fontWeight: '800' },
  todayDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.primary, marginTop: 3 },
  dotGap: { width: 5, height: 5, marginTop: 3 },
});

const cal = StyleSheet.create({
  card: { backgroundColor: C.white, borderRadius: 16, padding: 16, marginBottom: 24, ...SHADOW.sm },

  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  navBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.base, justifyContent: 'center', alignItems: 'center' },
  monthLabel: { fontSize: 15, fontWeight: '800', color: C.text },

  weekHeader: { flexDirection: 'row', marginBottom: 6 },
  weekHeaderText: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: C.textMuted, paddingVertical: 4 },

  row: { flexDirection: 'row', marginBottom: 4 },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 10, minHeight: 50 },
  cellGhost: { flex: 1 },
  cellSelected: { backgroundColor: C.primary },
  cellToday: { backgroundColor: C.primaryLight },
  cellNum: { fontSize: 13, fontWeight: '600', color: C.text, marginBottom: 4 },
  cellNumSelected: { color: C.white, fontWeight: '800' },
  cellNumToday: { color: C.primary, fontWeight: '800' },
  dotRow: { flexDirection: 'row', gap: 3, justifyContent: 'center' },
  dot: { width: 5, height: 5, borderRadius: 3 },

  panel: { marginTop: 14, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 14 },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  panelTitle: { fontSize: 13, fontWeight: '700', color: C.text, flex: 1 },
  panelCount: { fontSize: 12, color: C.textMuted, fontWeight: '600' },
  panelEmpty: { fontSize: 14, color: C.textMuted, textAlign: 'center', paddingVertical: 20 },

  panelEntry: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.base, borderRadius: 12, padding: 10, marginBottom: 8 },
  panelEntryCircle: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  panelEntryName: { fontSize: 12, fontWeight: '700', color: C.text },
  panelEntryEmotion: { fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
  panelEntryNotes: { fontSize: 11, color: C.textMuted, marginTop: 1 },
  panelEntryTime: { fontSize: 11, color: C.textMuted },
});
