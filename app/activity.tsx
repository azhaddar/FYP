import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabaseClient';
import { C, EMOTION_COLORS, SHADOW } from '../constants/theme';
import { ParentShell } from '../components/ParentShell';
import { EmotionIcon } from '../components/EmotionIcon';
import { ChildProfileButton } from '../components/ChildProfileButton';

// ── Constants ─────────────────────────────────────────────────────────────────
const NAVY         = '#1A1F3C';
const EMOTION_LIST = ['happy', 'sad', 'angry', 'anxious'] as const;
type  Emotion      = typeof EMOTION_LIST[number];
const DAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// ── Types ─────────────────────────────────────────────────────────────────────
type SketchRow  = { id: string; emotion: string; created_at: string; patient_id: string; notes: string | null };
type PatientRow = { id: string; full_name: string };

// ── Helpers ───────────────────────────────────────────────────────────────────
function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function isThisWeek(iso: string) {
  return new Date(iso) >= new Date(Date.now() - 7 * 86400000);
}
function getDominant(sketches: SketchRow[]) {
  if (!sketches.length) return null;
  const c: Record<string, number> = {};
  sketches.forEach(s => { c[s.emotion] = (c[s.emotion] ?? 0) + 1; });
  return Object.entries(c).sort((a, b) => b[1] - a[1])[0][0];
}

// ── WeekStrip (7-day bar chart) ───────────────────────────────────────────────
function WeekStrip({ sketches }: { sketches: SketchRow[] }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return { date: localDateStr(d), label: DAY_INITIALS[d.getDay()], isToday: i === 6 };
  });
  const counts  = days.map(({ date }) => sketches.filter(s => s.created_at.slice(0, 10) === date).length);
  const maxCount = Math.max(1, ...counts);

  return (
    <View style={wk.card}>
      <Text style={wk.title}>Last 7 Days</Text>
      <View style={wk.row}>
        {days.map(({ date, label, isToday }, i) => {
          const count    = counts[i];
          const dom      = getDominant(sketches.filter(s => s.created_at.slice(0, 10) === date));
          const ec       = dom ? EMOTION_COLORS[dom] : null;
          const barH     = count > 0 ? Math.max(12, Math.round((count / maxCount) * 56)) : 4;
          return (
            <View key={date} style={wk.col}>
              <Text style={wk.count}>{count > 0 ? count : ''}</Text>
              <View style={wk.barWrap}>
                <View style={[
                  wk.bar,
                  ec ? { backgroundColor: ec.text, opacity: 0.85 } : { backgroundColor: C.border },
                  { height: barH },
                ]} />
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

const wk = StyleSheet.create({
  card:    { backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, marginBottom: 20, ...SHADOW.sm },
  title:   { fontSize: 13, fontWeight: '700', color: C.textMuted, marginBottom: 10 },
  row:     { flexDirection: 'row', justifyContent: 'space-between' },
  col:     { flex: 1, alignItems: 'center' },
  count:   { fontSize: 10, fontWeight: '700', color: C.textMuted, height: 14 },
  barWrap: { height: 60, justifyContent: 'flex-end', alignItems: 'center', marginBottom: 6 },
  bar:     { width: 14, borderRadius: 7 },
  day:     { fontSize: 11, fontWeight: '600', color: C.textMuted },
  dayToday:{ color: C.primary, fontWeight: '800' },
  todayDot:{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.primary, marginTop: 3 },
  dotGap:  { width: 5, height: 5, marginTop: 3 },
});

// ── Section header helper ─────────────────────────────────────────────────────
function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={{ marginBottom: 12, marginTop: 4 }}>
      <Text style={s.sectionTitle}>{title}</Text>
      {sub ? <Text style={s.sectionSub}>{sub}</Text> : null}
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function AnalysisScreen() {
  const router = useRouter();

  const [sketches, setSketches]     = useState<SketchRow[]>([]);
  const [patients, setPatients]     = useState<PatientRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selChild, setSelChild]     = useState<string>('all');

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: pts } = await supabase.from('patients').select('id, full_name').eq('guardian_id', user.id);
    setPatients(pts ?? []);
    if (!pts?.length) { setLoading(false); setRefreshing(false); return; }
    const { data: sks } = await supabase
      .from('sketches').select('id, emotion, created_at, patient_id, notes')
      .in('patient_id', pts.map(p => p.id)).order('created_at', { ascending: false });
    setSketches(sks ?? []);
    setLoading(false);
    setRefreshing(false);
  }

  const patientMap = Object.fromEntries(patients.map(p => [p.id, p.full_name]));
  const filtered   = selChild === 'all' ? sketches : sketches.filter(s => s.patient_id === selChild);

  const total    = filtered.length;
  const thisWeek = filtered.filter(s => isThisWeek(s.created_at)).length;
  const dominant = getDominant(filtered);

  const emotionCounts = EMOTION_LIST.reduce((acc, e) => {
    acc[e] = filtered.filter(s => s.emotion === e).length; return acc;
  }, {} as Record<string, number>);

  return (
    <ParentShell>
      <View style={s.root}>
        {/* ── Header ────────────────────────────────────── */}
        <View style={s.header}>
          <View style={s.headerInner}>
            <Text style={s.headerTitle}>Analysis</Text>
            <Text style={s.headerSub}>
              {patients.length} {patients.length === 1 ? 'child' : 'children'} · {sketches.length} total drawings
            </Text>
          </View>

          {!loading && patients.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>
              <TouchableOpacity
                style={[s.tab, selChild === 'all' && s.tabActive]}
                onPress={() => setSelChild('all')}
              >
                <Text style={[s.tabText, selChild === 'all' && s.tabTextActive]}>All Children</Text>
              </TouchableOpacity>
              {patients.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[s.tab, selChild === p.id && s.tabActive]}
                  onPress={() => setSelChild(p.id)}
                >
                  <Text style={[s.tabText, selChild === p.id && s.tabTextActive]}>{p.full_name.split(' ')[0]}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* ── Scrollable body ───────────────────────────── */}
        <ScrollView
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={C.primary} />
          }
        >
          {loading ? (
            <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 60 }} />
          ) : sketches.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="color-palette-outline" size={64} color={C.borderMed} />
              <Text style={s.emptyTitle}>No drawings yet</Text>
              <Text style={s.emptyDesc}>Activity will appear here once your children start drawing.</Text>
            </View>
          ) : (
            <>
              {/* ── Stat cards ──────────────────────────── */}
              <View style={s.statsRow}>
                <View style={[s.statCard, { borderTopColor: C.primary }]}>
                  <Ionicons name="images-outline" size={20} color={C.primary} />
                  <Text style={s.statNum}>{total}</Text>
                  <Text style={s.statLbl}>Total</Text>
                </View>
                <View style={[s.statCard, { borderTopColor: '#7c3aed' }]}>
                  <Ionicons name="calendar-outline" size={20} color="#7c3aed" />
                  <Text style={[s.statNum, { color: '#7c3aed' }]}>{thisWeek}</Text>
                  <Text style={s.statLbl}>This Week</Text>
                </View>
                <View style={[
                  s.statCard,
                  dominant
                    ? { borderTopColor: EMOTION_COLORS[dominant].text, backgroundColor: EMOTION_COLORS[dominant].card }
                    : { borderTopColor: C.borderMed },
                ]}>
                  {dominant ? <EmotionIcon emotion={dominant} size={22} /> : <Ionicons name="help-circle-outline" size={22} color={C.borderMed} />}
                  <Text style={[s.statNum, { fontSize: 13, color: dominant ? EMOTION_COLORS[dominant].text : C.text }]}>
                    {dominant ? dominant.charAt(0).toUpperCase() + dominant.slice(1) : '—'}
                  </Text>
                  <Text style={[s.statLbl, { color: dominant ? EMOTION_COLORS[dominant].text + '99' : C.textMuted }]}>Top Mood</Text>
                </View>
              </View>

              {/* ── 7-day bar chart ──────────────────────── */}
              <WeekStrip sketches={filtered} />

              {/* ── By Child ─────────────────────────────── */}
              {selChild === 'all' && patients.length > 1 && (
                <>
                  <SectionHeader title="By Child" />
                  <View style={s.childList}>
                    {patients.map(p => {
                      const cs = sketches.filter(sk => sk.patient_id === p.id);
                      const cd = getDominant(cs);
                      return (
                        <ChildProfileButton
                          key={p.id}
                          childName={p.full_name}
                          dominantEmotion={cd}
                          totalDrawings={cs.length}
                          onPress={() => router.push({ pathname: '/child-profile/[id]', params: { id: p.id } })}
                        />
                      );
                    })}
                  </View>
                </>
              )}

              {/* ── Emotion Breakdown ────────────────────── */}
              <SectionHeader
                title={`Emotion Breakdown${selChild !== 'all' ? ` — ${patientMap[selChild]?.split(' ')[0]}` : ''}`}
              />
              <View style={s.breakdownCard}>
                {EMOTION_LIST.map(e => {
                  const count = emotionCounts[e] ?? 0;
                  const pct   = total > 0 ? count / total : 0;
                  const ec    = EMOTION_COLORS[e];
                  return (
                    <View key={e} style={s.barRow}>
                      <View style={s.barLabelRow}>
                        <EmotionIcon emotion={e} size={18} />
                        <Text style={s.barEmo}>{e.charAt(0).toUpperCase() + e.slice(1)}</Text>
                        <Text style={[s.barCount, { color: ec.text }]}>{count}</Text>
                      </View>
                      <View style={s.barTrack}>
                        <View style={[s.barFill, { width: `${Math.round(pct * 100)}%` as any, backgroundColor: ec.text }]} />
                      </View>
                      <Text style={s.barPct}>{Math.round(pct * 100)}%</Text>
                    </View>
                  );
                })}
              </View>

              {/* ── Recent Drawings ──────────────────────── */}
              <SectionHeader title="Recent Drawings" sub="Last 5 sessions" />
              <View style={s.recentCard}>
                {filtered.slice(0, 5).map((sk, i, arr) => {
                  const ec     = EMOTION_COLORS[sk.emotion as Emotion];
                  const isLast = i === arr.length - 1;
                  return (
                    <View key={sk.id} style={[s.recentItem, !isLast && s.recentDivider]}>
                      <View style={[s.recentBadge, { backgroundColor: ec.text + '22' }]}>
                        <EmotionIcon emotion={sk.emotion} size={20} />
                      </View>
                      <View style={s.recentInfo}>
                        <Text style={s.recentEmo}>{sk.emotion.charAt(0).toUpperCase() + sk.emotion.slice(1)}</Text>
                        <Text style={s.recentDate}>
                          {new Date(sk.created_at).toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </Text>
                      </View>
                      <View style={[s.recentDot, { backgroundColor: ec.text }]} />
                    </View>
                  );
                })}
              </View>

              {/* ── View Full Calendar CTA ───────────────── */}
              <TouchableOpacity
                style={s.calBtn}
                onPress={() => router.push('/calendar' as any)}
                activeOpacity={0.85}
              >
                <Ionicons name="calendar-outline" size={16} color="#fff" />
                <Text style={s.calBtnText}>View Full Calendar</Text>
                <Ionicons name="arrow-forward" size={14} color="#fff" />
              </TouchableOpacity>

            </>
          )}
        </ScrollView>
      </View>
    </ParentShell>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#F2F2F7' },

  header:      { backgroundColor: NAVY, paddingTop: 52, paddingBottom: 0 },
  headerInner: { paddingHorizontal: 24, paddingBottom: 14 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#fff' },
  headerSub:   { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 3 },

  tabs:        { flexDirection: 'row', gap: 8, paddingHorizontal: 24, paddingBottom: 14, paddingTop: 4 },
  tab:         { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)' },
  tabActive:   { backgroundColor: '#fff' },
  tabText:     { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  tabTextActive: { color: NAVY },

  content: { padding: 20, paddingBottom: 48 },

  sectionTitle: { fontSize: 15, fontWeight: '800', color: NAVY },
  sectionSub:   { fontSize: 11, color: C.textMuted, marginTop: 2 },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 12, alignItems: 'center', gap: 3, borderTopWidth: 3, ...SHADOW.sm },
  statNum:  { fontSize: 22, fontWeight: '800', color: C.primary },
  statLbl:  { fontSize: 10, color: C.textMuted, fontWeight: '600', textAlign: 'center' },

  childList: { gap: 10, marginBottom: 24 },

  breakdownCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 24, gap: 14, ...SHADOW.sm },
  barRow:        { gap: 6 },
  barLabelRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barEmo:        { flex: 1, fontSize: 14, fontWeight: '600', color: C.text },
  barCount:      { fontSize: 14, fontWeight: '700' },
  barTrack:      { height: 10, backgroundColor: C.base, borderRadius: 5, overflow: 'hidden' },
  barFill:       { height: 10, borderRadius: 5, minWidth: 8, opacity: 0.85 },
  barPct:        { fontSize: 11, color: C.textMuted, textAlign: 'right' },

  empty:      { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.text, marginTop: 16, marginBottom: 8 },
  emptyDesc:  { fontSize: 14, color: C.textMuted, textAlign: 'center' },

  recentCard:    { backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 4, marginBottom: 16, ...SHADOW.sm },
  recentItem:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  recentDivider: { borderBottomWidth: 1, borderBottomColor: C.base },
  recentBadge:   { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  recentInfo:    { flex: 1 },
  recentEmo:     { fontSize: 14, fontWeight: '700', color: NAVY },
  recentDate:    { fontSize: 12, color: C.textMuted, marginTop: 1 },
  recentDot:     { width: 8, height: 8, borderRadius: 4 },

  calBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: NAVY, borderRadius: 14, paddingVertical: 14, marginBottom: 24 },
  calBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
