import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabaseClient';
import { useApp } from '../../contexts/AppContext';
import { Patient } from '../../types';
import { C, EMOTION_COLORS, MAX_W, SHADOW } from '../../constants/theme';

const NAVY = '#1A1F3C';
import { EmotionIcon } from '../../components/EmotionIcon';

export default function TherapistHome() {
  const { profile, signOut } = useApp();
  const router = useRouter();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [lastEmotions, setLastEmotions] = useState<Record<string, string>>({});
  const [guardianNames, setGuardianNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { fetchPatients(); }, []);

  async function fetchPatients() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }

      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('therapist_id', user.id)
        .order('full_name');

      if (error) throw error;
      setPatients(data ?? []);
      if (data && data.length > 0) {
        await Promise.all([fetchLastEmotions(data), fetchGuardianNames(data)]);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function fetchGuardianNames(pts: Patient[]) {
    const ids = [...new Set(pts.map(p => p.guardian_id).filter(Boolean))];
    if (!ids.length) return;
    const { data } = await supabase.from('profiles').select('id, full_name').in('id', ids);
    if (data) {
      const map: Record<string, string> = {};
      data.forEach(p => { map[p.id] = p.full_name; });
      setGuardianNames(map);
    }
  }

  async function fetchLastEmotions(pts: Patient[]) {
    const ids = pts.map(p => p.id);
    const { data } = await supabase
      .from('sketches')
      .select('patient_id, emotion, created_at')
      .in('patient_id', ids)
      .order('created_at', { ascending: false });

    if (data) {
      const map: Record<string, string> = {};
      data.forEach(s => { if (!map[s.patient_id]) map[s.patient_id] = s.emotion; });
      setLastEmotions(map);
    }
  }

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => { await signOut(); router.replace('/login'); } },
    ]);
  }

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Therapist';
  const pendingNotes = patients.filter(p => lastEmotions[p.id]).length;

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerInner}>
          <View>
            <Text style={styles.greeting}>Hello, {firstName}! 👋</Text>
            <Text style={styles.subGreeting}>Your assigned patients</Text>
          </View>
          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{patients.length}</Text>
            <Text style={styles.statLabel}>Patients</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{patients.reduce((s, p) => s + (p.total_sketches ?? 0), 0)}</Text>
            <Text style={styles.statLabel}>Total Drawings</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{pendingNotes}</Text>
            <Text style={styles.statLabel}>With Drawings</Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPatients(); }} tintColor={C.primary} />
        }
      >
        <Text style={styles.sectionTitle}>Patients</Text>

        {loading ? (
          <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 40 }} />
        ) : patients.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={72} color={C.borderMed} />
            <Text style={styles.emptyTitle}>No patients assigned</Text>
            <Text style={styles.emptyDesc}>Patients will appear here once assigned to you via the web dashboard.</Text>
          </View>
        ) : (
          patients.map(patient => {
            const lastEmotion = lastEmotions[patient.id];
            const ec = lastEmotion ? EMOTION_COLORS[lastEmotion] : null;
            return (
              <View
                key={patient.id}
                style={styles.patientCard}
              >
                <View style={styles.cardRow}>
                  {/* Avatar */}
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{patient.full_name.charAt(0).toUpperCase()}</Text>
                  </View>

                  {/* Info */}
                  <View style={styles.patientInfo}>
                    <Text style={styles.patientName}>{patient.full_name}</Text>
                    <Text style={styles.patientMeta}>{patient.age} y/o · {patient.gender}</Text>
                    <View style={styles.sketchRow}>
                      <Ionicons name="brush-outline" size={13} color={C.textMuted} />
                      <Text style={styles.sketchCount}>{patient.total_sketches ?? 0} drawings</Text>
                    </View>
                  </View>

                  {/* Last emotion badge */}
                  {ec && lastEmotion ? (
                    <View style={[styles.emotionBadge, { backgroundColor: ec.card }]}>
                      <EmotionIcon emotion={lastEmotion} size={20} />
                      <Text style={[styles.emotionLabel, { color: ec.text }]}>{lastEmotion}</Text>
                    </View>
                  ) : (
                    <View style={styles.noDrawingBadge}>
                      <Text style={styles.noDrawingText}>No drawings</Text>
                    </View>
                  )}
                </View>

                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.viewBtn}
                    onPress={() => router.push({
                      pathname: '/child-profile/[id]',
                      params: { id: patient.id },
                    })}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="document-text-outline" size={13} color={C.primary} />
                    <Text style={styles.viewNotesText}>View Drawings</Text>
                  </TouchableOpacity>
                  {patient.guardian_id && (
                    <TouchableOpacity
                      style={styles.msgBtn}
                      onPress={() => router.push({
                        pathname: '/chat',
                        params: {
                          otherId: patient.guardian_id,
                          otherName: guardianNames[patient.guardian_id] ?? 'Parent',
                        },
                      })}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="chatbubble-ellipses-outline" size={13} color={C.white} />
                      <Text style={styles.msgBtnText}>Message Parent</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}

        <Text style={styles.hint}>Pull down to refresh</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.base },

  header: { backgroundColor: NAVY, paddingTop: 52, paddingBottom: 0 },
  headerInner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 24, paddingBottom: 20,
    maxWidth: MAX_W, alignSelf: 'center', width: '100%',
  },
  greeting: { fontSize: 26, fontWeight: '700', color: C.white },
  subGreeting: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 3 },
  signOutBtn: {
    paddingVertical: 8, paddingHorizontal: 16,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
  },
  signOutText: { fontSize: 13, color: C.white, fontWeight: '600' },

  statsRow: {
    flexDirection: 'row', backgroundColor: C.white,
    marginHorizontal: 20, maxWidth: MAX_W - 40, alignSelf: 'center', width: '100%',
    borderRadius: 14, paddingVertical: 14, marginBottom: -18, marginTop: 8,
    ...SHADOW.md,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNumber: { fontSize: 26, fontWeight: '800', color: C.primary },
  statLabel: { fontSize: 11, color: C.textMuted, marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: C.border, alignSelf: 'center' },

  content: { paddingTop: 32, paddingHorizontal: 20, paddingBottom: 40, maxWidth: MAX_W, alignSelf: 'center', width: '100%' },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 16, marginTop: 8 },

  patientCard: {
    backgroundColor: C.white, borderRadius: 16, padding: 16, marginBottom: 12, ...SHADOW.sm,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: C.primaryLight, justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '800', color: C.primary },
  patientInfo: { flex: 1, marginLeft: 12 },
  patientName: { fontSize: 17, fontWeight: '700', color: C.text },
  patientMeta: { fontSize: 13, color: C.textSub, marginTop: 2 },
  sketchRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  sketchCount: { fontSize: 12, color: C.textMuted },
  emotionBadge: { alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12 },
  emotionLabel: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize', marginTop: 3 },
  noDrawingBadge: {
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12,
    backgroundColor: C.base, borderWidth: 1, borderColor: C.border,
  },
  noDrawingText: { fontSize: 10, color: C.textMuted, fontWeight: '600' },

  cardActions: { flexDirection: 'row', gap: 8 },
  viewBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 9, borderRadius: 10,
    backgroundColor: C.base, borderWidth: 1, borderColor: C.border,
  },
  viewNotesText: { fontSize: 13, fontWeight: '600', color: C.primary },
  msgBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 9, borderRadius: 10,
    backgroundColor: C.primary,
  },
  msgBtnText: { fontSize: 13, fontWeight: '700', color: C.white },

  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: C.text, marginBottom: 8 },
  emptyDesc: { fontSize: 15, color: C.textSub, textAlign: 'center', lineHeight: 22 },

  hint: { textAlign: 'center', fontSize: 12, color: C.textMuted, marginTop: 20 },
});
