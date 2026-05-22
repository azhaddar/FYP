import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Canvas, Path, Skia, Circle,
  Line as SkLine,
} from '@shopify/react-native-skia';
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
type SketchRow   = { id: string; emotion: string; created_at: string; patient_id: string; notes: string | null };
type PatientRow  = { id: string; full_name: string };
type RadarData   = Record<Emotion, number>;   // 0-100
type WeekPoint   = { label: string } & RadarData;
interface InsightData { icon: string; title: string; body: string; color: string }

// ── Mock fallback data (used when no sketches exist) ──────────────────────────
const MOCK_RADAR: RadarData = { happy: 72, sad: 14, angry: 8, anxious: 22 };
const MOCK_WEEKS: WeekPoint[] = [
  { label: 'W1', happy: 42, sad: 30, angry: 18, anxious: 28 },
  { label: 'W2', happy: 55, sad: 22, angry: 12, anxious: 22 },
  { label: 'W3', happy: 65, sad: 15, angry:  8, anxious: 15 },
  { label: 'W4', happy: 72, sad: 10, angry:  6, anxious: 12 },
];

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
function emoPercents(sketches: SketchRow[]): RadarData {
  const total = sketches.length || 1;
  return {
    happy:   Math.round(sketches.filter(s => s.emotion === 'happy').length   / total * 100),
    sad:     Math.round(sketches.filter(s => s.emotion === 'sad').length     / total * 100),
    angry:   Math.round(sketches.filter(s => s.emotion === 'angry').length   / total * 100),
    anxious: Math.round(sketches.filter(s => s.emotion === 'anxious').length / total * 100),
  };
}
function getWeeklyPoints(sketches: SketchRow[]): WeekPoint[] {
  return Array.from({ length: 4 }, (_, wi) => {
    const weekStart = 27 - wi * 7;
    const dates = new Set(
      Array.from({ length: 7 }, (__, di) => {
        const d = new Date();
        d.setDate(d.getDate() - (weekStart - di));
        return localDateStr(d);
      })
    );
    const ws = sketches.filter(s => dates.has(s.created_at.slice(0, 10)));
    return { label: `W${4 - wi}`, ...emoPercents(ws) };
  }).reverse();
}
function fallbackInsights(radar: RadarData, weeks: WeekPoint[]): InsightData[] {
  const dom = (Object.entries(radar).sort((a, b) => b[1] - a[1])[0][0]) as Emotion;
  const ec  = EMOTION_COLORS[dom];
  const out: InsightData[] = [{
    icon:  dom === 'happy' ? 'happy-outline' : dom === 'sad' ? 'sad-outline' : dom === 'angry' ? 'flame-outline' : 'alert-circle-outline',
    title: `${dom.charAt(0).toUpperCase() + dom.slice(1)} is the Dominant Emotion`,
    body:  `Over the last 7 days, ${radar[dom]}% of drawings expressed ${dom} emotions. ${dom === 'happy' ? 'This is a positive sign of emotional wellbeing.' : 'Consider discussing this pattern with the assigned therapist.'}`,
    color: ec.text,
  }];
  if (weeks.length >= 2) {
    const Δhappy = weeks[weeks.length - 1].happy - weeks[0].happy;
    if (Math.abs(Δhappy) > 8) out.push({
      icon: Δhappy > 0 ? 'trending-up' : 'trending-down',
      title: `Happiness ${Δhappy > 0 ? 'Rising' : 'Declining'} Over 4 Weeks`,
      body: Δhappy > 0 ? `Happy expressions increased by ${Δhappy}% over 4 weeks.` : `Happy expressions dropped by ${Math.abs(Δhappy)}%. Consider a therapist check-in.`,
      color: Δhappy > 0 ? '#16a34a' : '#dc2626',
    });
  }
  if (out.length < 2) out.push({ icon: 'bulb-outline', title: 'Keep Encouraging Daily Drawing', body: 'Consistent drawing sessions give the AI more data points for accurate emotional trend analysis.', color: '#7c3aed' });
  return out.slice(0, 3);
}

// ── RadarChart ────────────────────────────────────────────────────────────────
const RADAR_SIZE = 240;
const RADAR_CX   = RADAR_SIZE / 2;
const RADAR_CY   = RADAR_SIZE / 2;
const RADAR_R    = 84;
const LABEL_PAD  = 28;
const RADAR_EMO: Emotion[] = ['happy', 'anxious', 'sad', 'angry'];

function angle(i: number) {
  return -Math.PI / 2 + i * (2 * Math.PI / RADAR_EMO.length);
}
function vertex(i: number, pct: number) {
  const a = angle(i);
  return { x: RADAR_CX + RADAR_R * pct * Math.cos(a), y: RADAR_CY + RADAR_R * pct * Math.sin(a) };
}

function RadarChart({ data }: { data: RadarData }) {
  const { filledPath, gridPaths, axisLines } = useMemo(() => {
    // Filled polygon
    const fp = Skia.Path.Make();
    RADAR_EMO.forEach((e, i) => {
      const { x, y } = vertex(i, data[e] / 100);
      i === 0 ? fp.moveTo(x, y) : fp.lineTo(x, y);
    });
    fp.close();

    // Grid rings at 25 / 50 / 75 / 100 %
    const gp = [0.25, 0.5, 0.75, 1.0].map(pct => {
      const p = Skia.Path.Make();
      RADAR_EMO.forEach((_, i) => {
        const { x, y } = vertex(i, pct);
        i === 0 ? p.moveTo(x, y) : p.lineTo(x, y);
      });
      p.close();
      return p;
    });

    // Axis lines (center → 100% vertex)
    const ax = RADAR_EMO.map((_, i) => ({
      p1: { x: RADAR_CX, y: RADAR_CY },
      p2: vertex(i, 1.0),
    }));

    return { filledPath: fp, gridPaths: gp, axisLines: ax };
  }, [data]);

  return (
    <View style={{ width: RADAR_SIZE, height: RADAR_SIZE, alignSelf: 'center' }}>
      <Canvas style={{ width: RADAR_SIZE, height: RADAR_SIZE }}>
        {/* Grid rings */}
        {gridPaths.map((p, i) => (
          <Path key={i} path={p} color="#E8E4F5" style="stroke" strokeWidth={1} />
        ))}
        {/* Axis lines */}
        {axisLines.map(({ p1, p2 }, i) => (
          <SkLine key={i} p1={p1} p2={p2} color="#DDD8F0" strokeWidth={1} />
        ))}
        {/* Filled emotion polygon */}
        <Path path={filledPath} color="rgba(76, 110, 245, 0.20)" style="fill" />
        <Path path={filledPath} color="#4C6EF5" style="stroke" strokeWidth={2} strokeCap="round" strokeJoin="round" />
        {/* Vertex dots */}
        {RADAR_EMO.map((e, i) => {
          const { x, y } = vertex(i, data[e] / 100);
          return <Circle key={e} cx={x} cy={y} r={4} color="#4C6EF5" />;
        })}
      </Canvas>

      {/* Axis labels (RN Text positioned absolutely) */}
      {RADAR_EMO.map((e, i) => {
        const a   = angle(i);
        const lx  = RADAR_CX + (RADAR_R + LABEL_PAD) * Math.cos(a);
        const ly  = RADAR_CY + (RADAR_R + LABEL_PAD) * Math.sin(a);
        const ec  = EMOTION_COLORS[e];
        return (
          <View
            key={e}
            style={[
              radarLabel.wrap,
              { left: lx - 32, top: ly - 16 },
            ]}
          >
            <EmotionIcon emotion={e} size={14} />
            <Text style={[radarLabel.text, { color: ec.text }]}>
              {e.charAt(0).toUpperCase() + e.slice(1)}
            </Text>
            <Text style={[radarLabel.pct, { color: ec.text }]}>{data[e]}%</Text>
          </View>
        );
      })}
    </View>
  );
}

const radarLabel = StyleSheet.create({
  wrap: { position: 'absolute', width: 64, alignItems: 'center', gap: 1 },
  text: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
  pct:  { fontSize: 9,  fontWeight: '600', textAlign: 'center', opacity: 0.8 },
});

// ── MultiLineChart (bezier, 4-week trend) ─────────────────────────────────────
const LINE_H = 130;
const LP     = { l: 8, r: 8, t: 10, b: 22 };

function MultiLineChart({ data, width }: { data: WeekPoint[]; width: number }) {
  const chartW = width - LP.l - LP.r;
  const chartH = LINE_H - LP.t - LP.b;
  const n      = data.length;

  const xOf = (i: number) => LP.l + (n < 2 ? chartW / 2 : (i / (n - 1)) * chartW);
  const yOf = (v: number) => LP.t + (1 - Math.min(v, 100) / 100) * chartH;

  const { paths } = useMemo(() => {
    if (n < 2) return { paths: [] };
    const ps = EMOTION_LIST.map(e => {
      const p = Skia.Path.Make();
      data.forEach((pt, i) => {
        const x = xOf(i);
        const y = yOf(pt[e]);
        if (i === 0) {
          p.moveTo(x, y);
        } else {
          // Smooth cubic bezier control points (Catmull-Rom inspired)
          const px  = xOf(i - 1);
          const py  = yOf(data[i - 1][e]);
          const cpx = (px + x) / 2;
          p.cubicTo(cpx, py, cpx, y, x, y);
        }
      });
      return { e, path: p, color: EMOTION_COLORS[e].text };
    });
    return { paths: ps };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, width]);

  const gridY = [0.25, 0.5, 0.75].map(f => LP.t + f * chartH);

  return (
    <View style={{ width, height: LINE_H + 20, position: 'relative' }}>
      <Canvas style={{ width, height: LINE_H }}>
        {/* Grid */}
        {gridY.map((y, i) => (
          <SkLine key={i} p1={{ x: LP.l, y }} p2={{ x: LP.l + chartW, y }} color="#EAE7F5" strokeWidth={1} />
        ))}
        <SkLine p1={{ x: LP.l, y: LP.t + chartH }} p2={{ x: LP.l + chartW, y: LP.t + chartH }} color="#DDD8F0" strokeWidth={1} />

        {/* Bezier lines */}
        {paths.map(({ e, path, color }) => (
          <Path key={e} path={path} color={color} style="stroke" strokeWidth={2.5} strokeCap="round" strokeJoin="round" />
        ))}

        {/* Data point circles */}
        {data.map((pt, i) =>
          EMOTION_LIST.map(e => (
            <Circle key={`${i}-${e}`} cx={xOf(i)} cy={yOf(pt[e])} r={3} color={EMOTION_COLORS[e].text} />
          ))
        )}
      </Canvas>

      {/* X labels */}
      {data.map((pt, i) => (
        <Text
          key={pt.label}
          style={[lineLabelStyle.label, { left: xOf(i) - 12, top: LINE_H }]}
        >
          {pt.label}
        </Text>
      ))}

      {/* Y legend (25 / 50 / 75 %) */}
      {[75, 50, 25].map((v, i) => (
        <Text
          key={v}
          style={[lineLabelStyle.yLabel, { top: LP.t + (i / 3) * chartH - 6 }]}
        >
          {v}%
        </Text>
      ))}
    </View>
  );
}

const lineLabelStyle = StyleSheet.create({
  label:  { position: 'absolute', width: 24, fontSize: 10, fontWeight: '600', color: C.textMuted, textAlign: 'center' },
  yLabel: { position: 'absolute', left: 0, fontSize: 8, color: '#C0BAD8', fontWeight: '500' },
});

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

// ── InsightCard ───────────────────────────────────────────────────────────────
function InsightCard({ insight }: { insight: InsightData }) {
  return (
    <View style={ic.card}>
      <View style={[ic.iconBox, { backgroundColor: insight.color + '18' }]}>
        <Ionicons name={insight.icon as any} size={22} color={insight.color} />
      </View>
      <View style={ic.body}>
        <Text style={ic.title}>{insight.title}</Text>
        <Text style={ic.desc}>{insight.body}</Text>
      </View>
    </View>
  );
}

const ic = StyleSheet.create({
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    marginBottom: 10, ...SHADOW.sm,
  },
  iconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  body:    { flex: 1 },
  title:   { fontSize: 13, fontWeight: '800', color: NAVY, marginBottom: 4 },
  desc:    { fontSize: 12, color: C.textSub, lineHeight: 18 },
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
  const { width: screenW } = useWindowDimensions();
  const chartW = screenW - 40 - 32; // content padding + card padding

  const [sketches, setSketches]         = useState<SketchRow[]>([]);
  const [patients, setPatients]         = useState<PatientRow[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [selChild, setSelChild]         = useState<string>('all');
  const [insights, setInsights]         = useState<InsightData[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);

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
    const sketchList = sks ?? [];
    setSketches(sketchList);
    setLoading(false);
    setRefreshing(false);
    fetchInsights(sketchList, pts ?? []);
  }

  async function fetchInsights(sketchList: SketchRow[], patientList: PatientRow[]) {
    const last7 = sketchList.filter(s => new Date(s.created_at) >= new Date(Date.now() - 7 * 86400000));
    const radar  = last7.length ? emoPercents(last7) : MOCK_RADAR;
    const weeks  = sketchList.length >= 3 ? getWeeklyPoints(sketchList) : MOCK_WEEKS;
    setInsightsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-insights', {
        body: { radar, weeks, patientNames: patientList.map(p => p.full_name.split(' ')[0]) },
      });
      if (error || !data?.insights?.length) throw new Error('empty');
      setInsights(data.insights);
    } catch {
      setInsights(fallbackInsights(radar, weeks));
    } finally {
      setInsightsLoading(false);
    }
  }

  const patientMap = Object.fromEntries(patients.map(p => [p.id, p.full_name]));
  const filtered   = selChild === 'all' ? sketches : sketches.filter(s => s.patient_id === selChild);

  const total      = filtered.length;
  const thisWeek   = filtered.filter(s => isThisWeek(s.created_at)).length;
  const dominant   = getDominant(filtered);

  const emotionCounts = EMOTION_LIST.reduce((acc, e) => {
    acc[e] = filtered.filter(s => s.emotion === e).length; return acc;
  }, {} as Record<string, number>);

  // Charts: last 7-day radar + 4-week weekly points
  const last7Sketches = filtered.filter(s => new Date(s.created_at) >= new Date(Date.now() - 7 * 86400000));
  const radarData  = last7Sketches.length ? emoPercents(last7Sketches) : MOCK_RADAR;
  const weekPoints = filtered.length >= 3 ? getWeeklyPoints(filtered) : MOCK_WEEKS;

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

              {/* ── Radar Chart ──────────────────────────── */}
              <SectionHeader
                title="Emotional Footprint"
                sub="Last 7 days · normalised by drawing count"
              />
              <View style={s.chartCard}>
                <RadarChart data={radarData} />
                {last7Sketches.length === 0 && (
                  <Text style={s.mockNote}>Showing sample data — no drawings in the last 7 days</Text>
                )}
              </View>

              {/* ── 4-Week Line Chart ────────────────────── */}
              <SectionHeader
                title="Longitudinal Progress"
                sub="Weekly emotion averages · last 4 weeks"
              />
              <View style={[s.chartCard, { paddingBottom: 14 }]}>
                <MultiLineChart data={weekPoints} width={chartW} />
                {/* Legend */}
                <View style={s.legend}>
                  {EMOTION_LIST.map(e => (
                    <View key={e} style={s.legendItem}>
                      <View style={[s.legendDot, { backgroundColor: EMOTION_COLORS[e].text }]} />
                      <Text style={s.legendLabel}>{e.charAt(0).toUpperCase() + e.slice(1)}</Text>
                    </View>
                  ))}
                </View>
                {filtered.length < 3 && (
                  <Text style={s.mockNote}>Showing sample data — add more drawings for real trends</Text>
                )}
              </View>

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

              {/* ── Insights ─────────────────────────────── */}
              <SectionHeader title="Insights & Recommendations" />
              {insightsLoading ? (
                <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                  <ActivityIndicator size="small" color={C.primary} />
                  <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 8 }}>Generating AI insights…</Text>
                </View>
              ) : (
                insights.map((ins, i) => <InsightCard key={i} insight={ins} />)
              )}

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

  chartCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 20, alignItems: 'center', ...SHADOW.sm },
  mockNote:  { fontSize: 10, color: C.textMuted, marginTop: 8, fontStyle: 'italic', textAlign: 'center' },

  legend:      { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14, marginTop: 12 },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:   { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 11, color: C.textMuted, fontWeight: '500' },

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
});
