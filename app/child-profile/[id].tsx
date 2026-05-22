import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image, RefreshControl, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabaseClient';
import { C, EMOTION_COLORS, SHADOW } from '../../constants/theme';
import { EmotionIcon } from '../../components/EmotionIcon';
import { Patient, Sketch } from '../../types';

const NAVY   = '#1A1F3C';
const BG     = '#F2F2F7';
const EMOTIONS = ['happy', 'sad', 'angry', 'anxious'] as const;
type Emotion = typeof EMOTIONS[number];

interface TherapistInfo {
  name: string;
  title: string;
}

function dateLabel(iso: string) {
  return new Date(iso).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ChildProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [child, setChild]           = useState<Patient | null>(null);
  const [therapist, setTherapist]   = useState<TherapistInfo | null>(null);
  const [sketches, setSketches]     = useState<Sketch[]>([]);
  const [activeTab, setActiveTab]   = useState<Emotion | 'all'>('all');
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { if (id) load(); }, [id]);

  async function load() {
    setLoading(true);
    try {
      // Fetch patient
      const { data: patientData, error: pe } = await supabase
        .from('patients')
        .select('*')
        .eq('id', id)
        .single();
      if (pe || !patientData) { router.back(); return; }
      setChild(patientData);

      // Fetch therapist
      if (patientData.therapist_id) {
        const [{ data: prof }, { data: tProf }] = await Promise.all([
          supabase.from('profiles').select('full_name').eq('id', patientData.therapist_id).single(),
          supabase.from('therapist_profiles').select('professional_title').eq('id', patientData.therapist_id).single(),
        ]);
        if (prof) setTherapist({ name: prof.full_name, title: tProf?.professional_title ?? '' });
      }

      // Fetch sketches
      const { data: sketchData } = await supabase
        .from('sketches')
        .select('id, patient_id, emotion, notes, image_url, created_at, scores')
        .eq('patient_id', id)
        .order('created_at', { ascending: false })
        .limit(60);
      setSketches((sketchData ?? []) as Sketch[]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const filteredSketches = activeTab === 'all'
    ? sketches
    : sketches.filter(s => s.emotion === activeTab);

  const emotionCounts = EMOTIONS.reduce<Record<string, number>>((acc, e) => {
    acc[e] = sketches.filter(s => s.emotion === e).length;
    return acc;
  }, {});

  const lastActivity = sketches[0]?.created_at;

  if (loading) {
    return (
      <View style={s.loadingWrap}>
        <ActivityIndicator size="large" color={NAVY} />
      </View>
    );
  }

  if (!child) return null;

  const initials = child.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const dominantEmotion = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const ec = dominantEmotion ? EMOTION_COLORS[dominantEmotion] : null;

  return (
    <View style={s.root}>
      {/* ── Header ─────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>

        <View style={s.headerMain}>
          <View style={[s.headerAvatar, ec && { backgroundColor: ec.card }]}>
            <Text style={[s.headerAvatarText, ec && { color: ec.text }]}>{initials}</Text>
          </View>

          <View style={s.headerInfo}>
            <Text style={s.headerName}>{child.full_name}</Text>
            <View style={s.headerTags}>
              <View style={s.headerTag}>
                <Ionicons name="calendar-outline" size={10} color="rgba(255,255,255,0.75)" />
                <Text style={s.headerTagText}>Age {child.age}</Text>
              </View>
              <View style={s.headerTag}>
                <Ionicons name="person-outline" size={10} color="rgba(255,255,255,0.75)" />
                <Text style={s.headerTagText}>{child.gender}</Text>
              </View>
              <View style={[s.headerTag, child.status === 'Active' ? s.tagActive : s.tagInactive]}>
                <Text style={s.headerTagText}>{child.status}</Text>
              </View>
            </View>
          </View>
        </View>

        <TouchableOpacity style={s.editBtn}>
          <Ionicons name="create-outline" size={16} color="rgba(255,255,255,0.85)" />
          <Text style={s.editBtnText}>Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={NAVY} />
        }
      >
        {/* ── Stat strip ──────────────────────────────────── */}
        <View style={s.statStrip}>
          <StatItem icon="brush" value={String(sketches.length)} label="Drawings" />
          <View style={s.statDivider} />
          <StatItem
            icon={dominantEmotion ? undefined : 'analytics-outline'}
            emoIcon={dominantEmotion}
            value={dominantEmotion ? dominantEmotion.charAt(0).toUpperCase() + dominantEmotion.slice(1) : '—'}
            label="Dominant"
          />
          <View style={s.statDivider} />
          <StatItem
            icon="time-outline"
            value={lastActivity ? dateLabel(lastActivity) : '—'}
            label="Last Active"
          />
        </View>

        {/* ── Clinical Overview ───────────────────────────── */}
        <SectionLabel>Clinical Overview</SectionLabel>
        <View style={s.card}>
          <InfoRow
            icon="medkit-outline"
            label="Primary Therapist"
            value={therapist ? therapist.name : 'Not assigned'}
            sub={therapist?.title}
          />
          <RowDivider />
          <InfoRow
            icon="checkmark-circle-outline"
            label="Status"
            value={child.status}
            valueColor={child.status === 'Active' ? '#16a34a' : C.textMuted}
          />
          <RowDivider />
          <InfoRow
            icon="bar-chart-outline"
            label="Total Sketches"
            value={String(child.total_sketches ?? sketches.length)}
          />
          {lastActivity && (
            <>
              <RowDivider />
              <InfoRow icon="calendar-outline" label="Last Drawing" value={dateLabel(lastActivity)} />
            </>
          )}
        </View>

        {/* ── Emotion Breakdown ───────────────────────────── */}
        <SectionLabel>Emotion Breakdown</SectionLabel>
        <View style={s.card}>
          {EMOTIONS.map((e, i) => {
            const count = emotionCounts[e];
            const pct   = sketches.length > 0 ? count / sketches.length : 0;
            const ec2   = EMOTION_COLORS[e];
            return (
              <React.Fragment key={e}>
                {i > 0 && <RowDivider />}
                <View style={s.emoRow}>
                  <EmotionIcon emotion={e} size={16} />
                  <Text style={s.emoLabel}>{e.charAt(0).toUpperCase() + e.slice(1)}</Text>
                  <View style={s.emoTrackWrap}>
                    <View style={[s.emoTrack, { width: `${Math.round(pct * 100)}%`, backgroundColor: ec2.text }]} />
                  </View>
                  <Text style={[s.emoPct, { color: ec2.text }]}>{count}</Text>
                </View>
              </React.Fragment>
            );
          })}
        </View>

        {/* ── Drawings ────────────────────────────────────── */}
        <View style={s.drawingsHeader}>
          <SectionLabel style={{ marginBottom: 0 }}>Drawings</SectionLabel>
          <Text style={s.drawingsCount}>{filteredSketches.length} shown</Text>
        </View>

        {/* Emotion filter tabs */}
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.tabs}
          style={s.tabsScroll}
        >
          <FilterTab label="All" count={sketches.length} active={activeTab === 'all'} onPress={() => setActiveTab('all')} />
          {EMOTIONS.map(e => (
            <FilterTab
              key={e}
              label={e.charAt(0).toUpperCase() + e.slice(1)}
              count={emotionCounts[e]}
              active={activeTab === e}
              onPress={() => setActiveTab(e)}
              emotion={e}
            />
          ))}
        </ScrollView>

        {filteredSketches.length === 0 ? (
          <View style={s.emptyDrawings}>
            <Ionicons name="brush-outline" size={36} color={C.borderMed} />
            <Text style={s.emptyDrawingsText}>No drawings yet</Text>
          </View>
        ) : (
          <View style={s.drawingGrid}>
            {filteredSketches.map(sketch => (
              <DrawingCard
                key={sketch.id}
                sketch={sketch}
                onPress={() => router.push({ pathname: '/sketch-detail', params: { id: sketch.id } })}
              />
            ))}
          </View>
        )}

        {/* ── Actions ─────────────────────────────────────── */}
        <View style={s.actions}>
          <ActionBtn
            icon="book-outline"
            label="View Journal"
            onPress={() => router.push({ pathname: '/journal', params: { patientId: child.id, patientName: child.full_name } })}
          />
          <ActionBtn
            icon="bar-chart-outline"
            label="Analytics"
            onPress={() => router.push('/activity' as any)}
            primary
          />
        </View>
      </ScrollView>
    </View>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <Text style={[labelStyle.text, style]}>{children}</Text>
  );
}
const labelStyle = StyleSheet.create({
  text: { fontSize: 11, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
});

function RowDivider() {
  return <View style={{ height: 1, backgroundColor: '#F0F0F5', marginLeft: 46 }} />;
}

function StatItem({
  icon, emoIcon, value, label,
}: { icon?: string; emoIcon?: string; value: string; label: string }) {
  return (
    <View style={statStyles.wrap}>
      {emoIcon
        ? <EmotionIcon emotion={emoIcon} size={18} />
        : icon
          ? <Ionicons name={icon as any} size={18} color={NAVY} />
          : null
      }
      <Text style={statStyles.value} numberOfLines={1}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}
const statStyles = StyleSheet.create({
  wrap:  { flex: 1, alignItems: 'center', gap: 4 },
  value: { fontSize: 13, fontWeight: '800', color: NAVY, textAlign: 'center' },
  label: { fontSize: 10, color: C.textMuted, fontWeight: '500' },
});

function InfoRow({
  icon, label, value, sub, valueColor,
}: { icon: string; label: string; value: string; sub?: string; valueColor?: string }) {
  return (
    <View style={infoStyles.row}>
      <View style={infoStyles.iconBox}>
        <Ionicons name={icon as any} size={16} color={NAVY} />
      </View>
      <View style={infoStyles.body}>
        <Text style={infoStyles.label}>{label}</Text>
        {sub ? <Text style={infoStyles.sub}>{sub}</Text> : null}
      </View>
      <Text style={[infoStyles.value, valueColor ? { color: valueColor } : undefined]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
const infoStyles = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  iconBox: { width: 30, height: 30, borderRadius: 9, backgroundColor: '#EEF0FF', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  body:    { flex: 1 },
  label:   { fontSize: 13, fontWeight: '600', color: C.text },
  sub:     { fontSize: 11, color: C.textMuted, marginTop: 1 },
  value:   { fontSize: 13, fontWeight: '700', color: NAVY, flexShrink: 0, maxWidth: 140, textAlign: 'right' },
});

function FilterTab({
  label, count, active, onPress, emotion,
}: { label: string; count: number; active: boolean; onPress: () => void; emotion?: string }) {
  const ec = emotion ? EMOTION_COLORS[emotion] : null;
  return (
    <TouchableOpacity
      style={[
        tabStyles.tab,
        active && (ec ? { backgroundColor: ec.card } : tabStyles.tabActive),
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {emotion && <EmotionIcon emotion={emotion} size={12} />}
      <Text style={[tabStyles.label, active && (ec ? { color: ec.text } : tabStyles.labelActive)]}>
        {label}
      </Text>
      <View style={[tabStyles.badge, active && (ec ? { backgroundColor: ec.text } : tabStyles.badgeActive)]}>
        <Text style={[tabStyles.badgeText, active && tabStyles.badgeTextActive]}>{count}</Text>
      </View>
    </TouchableOpacity>
  );
}
const tabStyles = StyleSheet.create({
  tab:          { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: C.white, borderWidth: 1, borderColor: C.border },
  tabActive:    { backgroundColor: NAVY, borderColor: NAVY },
  label:        { fontSize: 12, fontWeight: '600', color: C.textSub },
  labelActive:  { color: C.white },
  badge:        { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#F0F0F5', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  badgeActive:  { backgroundColor: 'rgba(255,255,255,0.25)' },
  badgeText:    { fontSize: 10, fontWeight: '700', color: C.textMuted },
  badgeTextActive: { color: C.white },
});

function DrawingCard({ sketch, onPress }: { sketch: Sketch; onPress: () => void }) {
  const ec = EMOTION_COLORS[sketch.emotion];
  return (
    <TouchableOpacity style={drawStyles.card} onPress={onPress} activeOpacity={0.85}>
      {sketch.image_url ? (
        <Image source={{ uri: sketch.image_url }} style={drawStyles.thumb} resizeMode="cover" />
      ) : (
        <View style={[drawStyles.thumbFallback, { backgroundColor: ec.bg }]}>
          <EmotionIcon emotion={sketch.emotion} size={28} />
        </View>
      )}
      <View style={drawStyles.cardBody}>
        <View style={[drawStyles.emoPill, { backgroundColor: ec.card }]}>
          <EmotionIcon emotion={sketch.emotion} size={11} />
          <Text style={[drawStyles.emoText, { color: ec.text }]}>
            {sketch.emotion.charAt(0).toUpperCase() + sketch.emotion.slice(1)}
          </Text>
        </View>
        <Text style={drawStyles.date}>{dateLabel(sketch.created_at)}</Text>
        <TouchableOpacity style={drawStyles.detailBtn} onPress={onPress}>
          <Text style={drawStyles.detailBtnText}>View Details</Text>
          <Ionicons name="arrow-forward" size={11} color={NAVY} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}
const drawStyles = StyleSheet.create({
  card:         { width: '48%', backgroundColor: C.white, borderRadius: 14, overflow: 'hidden', ...SHADOW.sm },
  thumb:        { width: '100%', height: 110 },
  thumbFallback:{ width: '100%', height: 110, justifyContent: 'center', alignItems: 'center' },
  cardBody:     { padding: 10 },
  emoPill:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 5 },
  emoText:      { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  date:         { fontSize: 10, color: C.textMuted, marginBottom: 8 },
  detailBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailBtnText:{ fontSize: 11, fontWeight: '700', color: NAVY },
});

function ActionBtn({
  icon, label, onPress, primary,
}: { icon: string; label: string; onPress: () => void; primary?: boolean }) {
  return (
    <TouchableOpacity
      style={[actionStyles.btn, primary ? actionStyles.btnPrimary : actionStyles.btnSecondary]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Ionicons name={icon as any} size={16} color={primary ? C.white : NAVY} />
      <Text style={[actionStyles.label, primary ? actionStyles.labelPrimary : actionStyles.labelSecondary]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}
const actionStyles = StyleSheet.create({
  btn:            { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 13, borderRadius: 12 },
  btnPrimary:     { backgroundColor: NAVY, ...SHADOW.sm },
  btnSecondary:   { backgroundColor: C.white, borderWidth: 1.5, borderColor: C.border },
  label:          { fontSize: 14, fontWeight: '700' },
  labelPrimary:   { color: C.white },
  labelSecondary: { color: NAVY },
});

// ── Main styles ───────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: BG },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BG },
  scroll:      { flex: 1 },
  content:     { padding: 18, paddingBottom: 48 },

  // Header
  header: {
    backgroundColor: NAVY,
    paddingTop: 54, paddingBottom: 20, paddingHorizontal: 18,
    flexDirection: 'row', alignItems: 'flex-end', gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center', flexShrink: 0, alignSelf: 'center',
  },
  headerMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
  headerAvatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  headerAvatarText: { fontSize: 20, fontWeight: '800', color: '#fff' },
  headerInfo:    { flex: 1 },
  headerName:    { fontSize: 17, fontWeight: '800', color: '#fff', marginBottom: 6 },
  headerTags:    { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  headerTag:     { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  headerTagText: { fontSize: 10, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  tagActive:     { backgroundColor: '#16a34a' },
  tagInactive:   { backgroundColor: '#9ca3af' },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
    alignSelf: 'center',
  },
  editBtnText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },

  // Stat strip
  statStrip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.white, borderRadius: 14, padding: 16, marginBottom: 20,
    ...SHADOW.sm,
  },
  statDivider: { width: 1, height: 32, backgroundColor: C.border },

  // Card
  card: { backgroundColor: C.white, borderRadius: 14, marginBottom: 20, overflow: 'hidden', ...SHADOW.sm },

  // Emotion row in breakdown
  emoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 11 },
  emoLabel: { fontSize: 13, fontWeight: '600', color: C.text, width: 64 },
  emoTrackWrap: { flex: 1, height: 7, backgroundColor: '#F0F0F5', borderRadius: 4, overflow: 'hidden' },
  emoTrack: { height: '100%', borderRadius: 4 },
  emoPct: { fontSize: 12, fontWeight: '700', width: 24, textAlign: 'right' },

  // Drawings section
  drawingsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  drawingsCount:  { fontSize: 11, color: C.textMuted },
  tabsScroll:  { marginBottom: 12 },
  tabs:        { gap: 8, paddingVertical: 2, paddingHorizontal: 2 },
  drawingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },

  // Empty state
  emptyDrawings:     { alignItems: 'center', paddingVertical: 36, gap: 10, backgroundColor: C.white, borderRadius: 14, marginBottom: 20, ...SHADOW.sm },
  emptyDrawingsText: { fontSize: 13, color: C.textMuted },

  // Actions row
  actions: { flexDirection: 'row', gap: 10 },
});
