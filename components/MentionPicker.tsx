import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Image, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabaseClient';
import { C, EMOTION_COLORS, SHADOW } from '../constants/theme';
import { EmotionIcon } from './EmotionIcon';

export interface PickerAttachment {
  type: 'drawing' | 'result' | 'graph';
  id: string;
  title: string;
  imageUrl: string | null;
  emotion: string | null;
  date: string;
  patientName: string;
  sessionNum: number;
  scores: Record<string, number> | null;
  timeline?: Array<{ emotion: string; date: string }>;
}

interface RawSketch {
  id: string;
  image_url: string | null;
  emotion: string;
  created_at: string;
  patient_id: string;
  scores: Record<string, number> | null;
}

interface Patient {
  id: string;
  full_name: string;
}

type Tab = 'drawing' | 'result' | 'graph';

const EMOTIONS = ['happy', 'sad', 'angry', 'anxious'] as const;

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-MY', {
    day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

function normalizeScores(raw: Record<string, number> | null): Record<string, number> | null {
  if (!raw) return null;
  const vals = EMOTIONS.map(e => raw[e] ?? 0);
  const sum = vals.reduce((a, b) => a + b, 0);
  if (sum === 0) return null;
  const max = Math.max(...vals);
  const norm = (v: number) => max <= 1 ? Math.round(v * 100) : Math.round(v);
  return { happy: norm(raw.happy ?? 0), sad: norm(raw.sad ?? 0), angry: norm(raw.angry ?? 0), anxious: norm(raw.anxious ?? 0) };
}

interface Props {
  visible: boolean;
  onClose: () => void;
  myId: string;
  otherId: string;
  onSelect: (attachment: PickerAttachment) => void;
}

export function MentionPicker({ visible, onClose, myId, otherId, onSelect }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('drawing');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [sketches, setSketches] = useState<RawSketch[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && myId && otherId) fetchData();
  }, [visible]);

  async function fetchData() {
    setLoading(true);
    const [{ data: asParent }, { data: asTherapist }] = await Promise.all([
      supabase.from('patients').select('id, full_name').eq('guardian_id', myId).eq('therapist_id', otherId),
      supabase.from('patients').select('id, full_name').eq('therapist_id', myId).eq('guardian_id', otherId),
    ]);

    const pts: Patient[] = [...(asParent ?? []), ...(asTherapist ?? [])];
    setPatients(pts);

    if (pts.length > 0) {
      const { data } = await supabase
        .from('sketches')
        .select('id, image_url, emotion, created_at, patient_id, scores')
        .in('patient_id', pts.map(p => p.id))
        .order('created_at', { ascending: false })
        .limit(60);
      setSketches(data ?? []);
    } else {
      setSketches([]);
    }
    setLoading(false);
  }

  // Group sketches by patient and compute session numbers (1 = first/oldest)
  const sketchesByPatient: Record<string, RawSketch[]> = {};
  for (const s of sketches) {
    if (!sketchesByPatient[s.patient_id]) sketchesByPatient[s.patient_id] = [];
    sketchesByPatient[s.patient_id].push(s);
  }

  const sessionNumMap: Record<string, number> = {};
  for (const [pid, arr] of Object.entries(sketchesByPatient)) {
    const total = arr.length;
    arr.forEach((s, i) => { sessionNumMap[s.id] = total - i; });
  }

  const patientMap: Record<string, string> = {};
  patients.forEach(p => { patientMap[p.id] = p.full_name; });

  const TABS: { key: Tab; icon: string; label: string }[] = [
    { key: 'drawing', icon: 'pencil',      label: 'Drawing' },
    { key: 'result',  icon: 'bar-chart',   label: 'Result'  },
    { key: 'graph',   icon: 'trending-up', label: 'Graph'   },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Mention something</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={22} color={C.textSub} />
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={styles.tabs}>
            {TABS.map(tab => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Ionicons name={tab.icon as any} size={14} color={activeTab === tab.key ? C.primary : C.textMuted} />
                <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Content */}
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={C.primary} />
            </View>
          ) : sketches.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="images-outline" size={52} color={C.borderMed} />
              <Text style={styles.emptyTitle}>No sessions found</Text>
              <Text style={styles.emptySub}>Sessions between you and this person will appear here.</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>

              {/* ── Drawing tab ── */}
              {activeTab === 'drawing' && sketches.map(sketch => {
                const ec = EMOTION_COLORS[sketch.emotion];
                const patientName = patientMap[sketch.patient_id] ?? '';
                const sessionNum = sessionNumMap[sketch.id] ?? 1;
                return (
                  <View key={sketch.id} style={styles.item}>
                    {sketch.image_url ? (
                      <Image source={{ uri: sketch.image_url }} style={styles.thumbnail} resizeMode="cover" />
                    ) : (
                      <View style={[styles.thumbnail, styles.thumbnailEmpty]}>
                        <Ionicons name="image-outline" size={22} color={C.borderMed} />
                      </View>
                    )}
                    <View style={styles.itemInfo}>
                      <View style={styles.emotionRow}>
                        <EmotionIcon emotion={sketch.emotion} size={18} />
                        <Text style={[styles.emotionLabel, { color: ec.text }]}>
                          {sketch.emotion.charAt(0).toUpperCase() + sketch.emotion.slice(1)}
                        </Text>
                      </View>
                      <Text style={styles.patientName}>{patientName}</Text>
                      <Text style={styles.itemDate}>{formatDateTime(sketch.created_at)}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.mentionBtn}
                      onPress={() => {
                        onSelect({ type: 'drawing', id: sketch.id, title: `Drawing — ${patientName}`,
                          imageUrl: sketch.image_url, emotion: sketch.emotion, date: sketch.created_at,
                          patientName, sessionNum, scores: sketch.scores });
                        onClose();
                      }}
                    >
                      <Ionicons name="at" size={12} color={C.primary} />
                      <Text style={styles.mentionBtnText}>Mention</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}

              {/* ── Result tab ── */}
              {activeTab === 'result' && sketches.map(sketch => {
                const ec = EMOTION_COLORS[sketch.emotion];
                const patientName = patientMap[sketch.patient_id] ?? '';
                const sessionNum = sessionNumMap[sketch.id] ?? 1;
                const scores = normalizeScores(sketch.scores);
                return (
                  <View key={sketch.id} style={styles.item}>
                    {/* Mini score preview */}
                    <View style={styles.scorePreview}>
                      {EMOTIONS.map(e => (
                        <View key={e} style={styles.scoreRow}>
                          <View style={styles.scoreTrack}>
                            <View style={[
                              styles.scoreFill,
                              { width: `${scores?.[e] ?? 0}%`, backgroundColor: EMOTION_COLORS[e].text },
                              e === sketch.emotion && { opacity: 1 },
                            ]} />
                          </View>
                        </View>
                      ))}
                    </View>
                    <View style={styles.itemInfo}>
                      <View style={styles.emotionRow}>
                        <EmotionIcon emotion={sketch.emotion} size={18} />
                        <Text style={[styles.emotionLabel, { color: ec.text }]}>
                          {sketch.emotion.charAt(0).toUpperCase() + sketch.emotion.slice(1)}
                        </Text>
                      </View>
                      <Text style={styles.patientName}>{patientName}</Text>
                      <Text style={styles.itemDate}>{formatDateTime(sketch.created_at)}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.mentionBtn}
                      onPress={() => {
                        onSelect({ type: 'result', id: sketch.id, title: `Result — ${patientName}`,
                          imageUrl: sketch.image_url, emotion: sketch.emotion, date: sketch.created_at,
                          patientName, sessionNum, scores: sketch.scores });
                        onClose();
                      }}
                    >
                      <Ionicons name="at" size={12} color={C.primary} />
                      <Text style={styles.mentionBtnText}>Mention</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}

              {/* ── Graph tab ── */}
              {activeTab === 'graph' && patients.map(patient => {
                const patientSketches = sketchesByPatient[patient.id] ?? [];
                const total = patientSketches.length;
                const timeline = [...patientSketches].reverse().slice(-10);
                const emotionCounts: Record<string, number> = {};
                for (const s of patientSketches) emotionCounts[s.emotion] = (emotionCounts[s.emotion] ?? 0) + 1;
                return (
                  <View key={patient.id} style={styles.item}>
                    {/* Emotion dot timeline */}
                    <View style={styles.timelineWrap}>
                      {timeline.map((s, i) => (
                        <View key={i} style={[styles.dot, { backgroundColor: EMOTION_COLORS[s.emotion].text }]} />
                      ))}
                      {timeline.length === 0 && (
                        <Text style={styles.noData}>—</Text>
                      )}
                    </View>
                    <View style={styles.itemInfo}>
                      <Text style={styles.patientName}>{patient.full_name}</Text>
                      <Text style={styles.itemDate}>{total} sessions total</Text>
                      <Text style={styles.itemDate} numberOfLines={1}>
                        {Object.entries(emotionCounts).map(([e, c]) =>
                          `${e.charAt(0).toUpperCase() + e.slice(1)}: ${c}`
                        ).join(' · ')}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.mentionBtn}
                      onPress={() => {
                        const latest = patientSketches[0];
                        onSelect({ type: 'graph', id: patient.id, title: `Progress — ${patient.full_name}`,
                          imageUrl: null, emotion: latest?.emotion ?? null,
                          date: latest?.created_at ?? new Date().toISOString(),
                          patientName: patient.full_name, sessionNum: total, scores: null,
                          timeline: timeline.map(s => ({ emotion: s.emotion, date: s.created_at })) });
                        onClose();
                      }}
                    >
                      <Ionicons name="at" size={12} color={C.primary} />
                      <Text style={styles.mentionBtnText}>Mention</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}

            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '80%', paddingBottom: 20,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: C.borderMed,
    alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: C.text },

  tabs: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border,
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 13,
  },
  tabActive: { borderBottomWidth: 2, borderBottomColor: C.primary },
  tabLabel: { fontSize: 13, fontWeight: '600', color: C.textMuted },
  tabLabelActive: { color: C.primary, fontWeight: '700' },

  loadingWrap: { paddingVertical: 60, alignItems: 'center' },

  emptyWrap: { alignItems: 'center', paddingVertical: 50, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginTop: 14, marginBottom: 6 },
  emptySub: { fontSize: 13, color: C.textSub, textAlign: 'center', lineHeight: 20 },

  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },

  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border,
  },

  thumbnail: {
    width: 58, height: 58, borderRadius: 10, backgroundColor: C.base,
    overflow: 'hidden', flexShrink: 0,
  },
  thumbnailEmpty: {
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border,
  },

  scorePreview: {
    width: 58, gap: 4, flexShrink: 0, justifyContent: 'center',
  },
  scoreRow: { height: 8 },
  scoreTrack: {
    flex: 1, height: 8, borderRadius: 4,
    backgroundColor: C.base, overflow: 'hidden',
  },
  scoreFill: {
    height: '100%', borderRadius: 4, opacity: 0.65,
  },

  timelineWrap: {
    width: 58, flexDirection: 'row', flexWrap: 'wrap', gap: 3,
    alignContent: 'center', justifyContent: 'center', flexShrink: 0,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  noData: { fontSize: 16, color: C.textMuted },

  itemInfo: { flex: 1, minWidth: 0 },
  emotionRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
  emotionLabel: { fontSize: 14, fontWeight: '700' },
  patientName: { fontSize: 13, fontWeight: '600', color: C.primary, marginBottom: 2 },
  itemDate: { fontSize: 11, color: C.textMuted },

  mentionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderColor: C.primary, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 6, flexShrink: 0,
  },
  mentionBtnText: { fontSize: 12, fontWeight: '700', color: C.primary },
});
