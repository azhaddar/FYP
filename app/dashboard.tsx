import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, RefreshControl,
  useWindowDimensions, Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabaseClient';
import { useApp } from '../contexts/AppContext';
import { Patient } from '../types';
import { Ionicons } from '@expo/vector-icons';
import { C, EMOTION_COLORS, MAX_W, SHADOW } from '../constants/theme';
import { ParentNav } from '../components/ParentNav';
import { EmotionIcon } from '../components/EmotionIcon';
import { computeEarnedBadgeIds } from '../utils/badges';

export default function Dashboard() {
  const { profile, activeChild, enterChildMode, signOut } = useApp();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [children, setChildren] = useState<Patient[]>([]);
  const [lastEmotions, setLastEmotions] = useState<Record<string, string>>({});
  const [negativeStreaks, setNegativeStreaks] = useState<Record<string, boolean>>({});
  const [badgeCounts, setBadgeCounts] = useState<Record<string, number>>({});
  const [therapistNames, setTherapistNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Add child modal
  const [addModal, setAddModal] = useState(false);
  const [childName, setChildName] = useState('');
  const [childAge, setChildAge] = useState('');
  const [childGender, setChildGender] = useState<'Male' | 'Female' | 'Other' | ''>('');
  const [saving, setSaving] = useState(false);

  const isWide = width >= 768;
  const cardWidth = isWide
    ? (Math.min(width, MAX_W) - 48 - 14) / 2
    : '100%' as any;

  const pendingRoute = useRef<string>('/child/home');

  useEffect(() => {
    if (activeChild) router.replace(pendingRoute.current as any);
    else fetchChildren();
  }, [activeChild]);

  async function fetchChildren() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }

      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('guardian_id', user.id)
        .order('full_name');

      if (error) throw error;
      setChildren(data ?? []);
      if (data && data.length > 0) {
        await Promise.all([fetchLastEmotions(data), fetchTherapists(data)]);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function fetchTherapists(patients: Patient[]) {
    const ids = patients.map(p => p.therapist_id).filter((id): id is string => !!id);
    if (!ids.length) return;
    const { data } = await supabase.from('profiles').select('id, full_name').in('id', ids);
    if (data) {
      const map: Record<string, string> = {};
      data.forEach(p => { map[p.id] = p.full_name; });
      setTherapistNames(map);
    }
  }

  async function fetchLastEmotions(patients: Patient[]) {
    const ids = patients.map(p => p.id);
    const { data } = await supabase
      .from('sketches')
      .select('patient_id, emotion, created_at')
      .in('patient_id', ids)
      .order('created_at', { ascending: false });

    if (data) {
      const lastMap: Record<string, string> = {};
      const recentMap: Record<string, string[]> = {};

      data.forEach(s => {
        if (!lastMap[s.patient_id]) lastMap[s.patient_id] = s.emotion;
        if (!recentMap[s.patient_id]) recentMap[s.patient_id] = [];
        if (recentMap[s.patient_id].length < 3) recentMap[s.patient_id].push(s.emotion);
      });

      setLastEmotions(lastMap);

      const NEGATIVE = ['sad', 'angry', 'anxious'];
      const streaks: Record<string, boolean> = {};
      Object.entries(recentMap).forEach(([id, emotions]) => {
        streaks[id] = emotions.length >= 3 && emotions.every(e => NEGATIVE.includes(e));
      });
      setNegativeStreaks(streaks);

      // Badge counts per child from the same sketch data
      const sketchesByChild: Record<string, { emotion: string; created_at: string }[]> = {};
      data.forEach(s => {
        if (!sketchesByChild[s.patient_id]) sketchesByChild[s.patient_id] = [];
        sketchesByChild[s.patient_id].push(s);
      });
      const counts: Record<string, number> = {};
      Object.entries(sketchesByChild).forEach(([id, sketches]) => {
        counts[id] = computeEarnedBadgeIds(sketches).length;
      });
      setBadgeCounts(counts);
    }
  }

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => { await signOut(); router.replace('/login'); } },
    ]);
  }

  function openAddModal() {
    setChildName('');
    setChildAge('');
    setChildGender('');
    setAddModal(true);
  }

  async function handleAddChild() {
    if (!childName.trim()) { Alert.alert('Missing info', 'Please enter the child\'s name.'); return; }
    const age = parseInt(childAge);
    if (!childAge || isNaN(age) || age < 1 || age > 17) { Alert.alert('Invalid age', 'Please enter an age between 1 and 17.'); return; }
    if (!childGender) { Alert.alert('Missing info', 'Please select a gender.'); return; }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');
      const { error } = await supabase.from('patients').insert({
        full_name: childName.trim(),
        age,
        gender: childGender,
        guardian_id: user.id,
        status: 'Active',
      });
      if (error) throw error;
      setAddModal(false);
      fetchChildren();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Parent';
  const totalSketches = children.reduce((sum, c) => sum + (c.total_sketches ?? 0), 0);
  const happyCount = Object.values(lastEmotions).filter(e => e === 'happy').length;

  return (
    <View style={styles.root}>
      {/* Pink header band */}
      <View style={styles.header}>
        <View style={styles.headerInner}>
          <View>
            <Text style={styles.greeting}>Hello, {firstName}! 👋</Text>
            <Text style={styles.subGreeting}>Here are your children's profiles</Text>
          </View>
          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </View>

        {/* Stats row inside header */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{children.length}</Text>
            <Text style={styles.statLabel}>Children</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{totalSketches}</Text>
            <Text style={styles.statLabel}>Total Sketches</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{happyCount}</Text>
            <Text style={styles.statLabel}>Happy Today</Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchChildren(); }} tintColor={C.primary} />
        }
      >
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Children Profiles</Text>
          <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
            <Ionicons name="add" size={18} color={C.white} />
            <Text style={styles.addBtnText}>Add Child</Text>
          </TouchableOpacity>
        </View>

        {children.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="person-add-outline" size={72} color={C.borderMed} />
            <Text style={styles.emptyTitle}>No children yet</Text>
            <Text style={styles.emptyDesc}>Add your first child to get started.</Text>
            <TouchableOpacity style={styles.emptyAddBtn} onPress={openAddModal}>
              <Ionicons name="add-circle-outline" size={20} color={C.white} />
              <Text style={styles.emptyAddBtnText}>Add Child</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.grid, isWide && styles.gridWide]}>
            {children.map(child => {
              const lastEmotion = lastEmotions[child.id];
              const ec = lastEmotion ? EMOTION_COLORS[lastEmotion] : null;
              return (
                <View key={child.id} style={[styles.childCard, isWide && { width: cardWidth }]}>
                  {/* Top row */}
                  <View style={styles.childRow}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {child.full_name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.childInfo}>
                      <Text style={styles.childName}>{child.full_name}</Text>
                      <Text style={styles.childMeta}>{child.age} y/o · {child.gender}</Text>
                      <View style={styles.sketchRow}>
                        <Ionicons name="brush-outline" size={13} color={C.textMuted} />
                        <Text style={styles.childSketches}>{child.total_sketches ?? 0} sketches</Text>
                        {(badgeCounts[child.id] ?? 0) > 0 && (
                          <>
                            <Text style={styles.childSketches}> · </Text>
                            <Ionicons name="ribbon-outline" size={13} color="#d97706" />
                            <Text style={[styles.childSketches, { color: '#d97706' }]}>
                              {badgeCounts[child.id]} badge{badgeCounts[child.id] > 1 ? 's' : ''}
                            </Text>
                          </>
                        )}
                      </View>
                      {child.therapist_id && therapistNames[child.therapist_id] && (
                        <TouchableOpacity
                          style={styles.therapistRow}
                          onPress={() => router.push({
                            pathname: '/therapist-profile',
                            params: { therapistId: child.therapist_id! },
                          })}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="person-circle-outline" size={13} color={C.primary} />
                          <Text style={styles.therapistText}>{therapistNames[child.therapist_id]}</Text>
                          <Ionicons name="chevron-forward" size={11} color={C.primary} />
                        </TouchableOpacity>
                      )}
                    </View>
                    {ec && lastEmotion && (
                      <View style={[styles.emotionBadge, { backgroundColor: ec.card }]}>
                        <EmotionIcon emotion={lastEmotion} size={22} />
                        <Text style={[styles.emotionLabel, { color: ec.text }]}>{lastEmotion}</Text>
                      </View>
                    )}
                  </View>

                  {negativeStreaks[child.id] && (
                    <View style={styles.alertBanner}>
                      <Ionicons name="alert-circle" size={15} color="#92400e" />
                      <Text style={styles.alertText}>
                        {child.full_name.split(' ')[0]} has shown negative feelings in the last 3 drawings. Consider checking in.
                      </Text>
                    </View>
                  )}

                  <View style={styles.divider} />

                  {/* Action buttons */}
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={styles.journalBtn}
                      onPress={() => { pendingRoute.current = '/child/journal'; enterChildMode(child); }}
                    >
                      <Ionicons name="book-outline" size={15} color={C.textSub} />
                      <Text style={styles.journalBtnText}>View Journal</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.drawBtn}
                      onPress={() => { pendingRoute.current = '/child/home'; enterChildMode(child); }}
                    >
                      <Ionicons name="brush-outline" size={15} color={C.white} />
                      <Text style={styles.drawBtnText}>Draw Now</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Parent dashboard link */}
                  <TouchableOpacity
                    style={styles.dashboardLink}
                    onPress={() => router.push({
                      pathname: '/parent-dashboard',
                      params: { patientId: child.id, patientName: child.full_name },
                    })}
                  >
                    <Ionicons name="bar-chart-outline" size={15} color={C.primary} />
                    <Text style={styles.dashboardLinkText}>View {child.full_name.split(' ')[0]}'s Dashboard</Text>
                    <Ionicons name="chevron-forward" size={14} color={C.primary} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        <Text style={styles.hint}>Pull down to refresh</Text>
      </ScrollView>

      <ParentNav />

      {/* ── Add Child Modal ───────────────────────────────────── */}
      <Modal visible={addModal} transparent animationType="slide" onRequestClose={() => setAddModal(false)}>
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Add Child</Text>
            <Text style={styles.modalSub}>Fill in your child's details below</Text>

            {/* Name */}
            <Text style={styles.fieldLabel}>FULL NAME</Text>
            <TextInput
              style={styles.fieldInput}
              value={childName}
              onChangeText={setChildName}
              placeholder="e.g. Ahmad bin Ali"
              placeholderTextColor={C.textMuted}
              autoCapitalize="words"
            />

            {/* Age */}
            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>AGE</Text>
            <TextInput
              style={styles.fieldInput}
              value={childAge}
              onChangeText={t => setChildAge(t.replace(/[^0-9]/g, ''))}
              placeholder="e.g. 8"
              placeholderTextColor={C.textMuted}
              keyboardType="number-pad"
              maxLength={2}
            />

            {/* Gender */}
            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>GENDER</Text>
            <View style={styles.genderRow}>
              {(['Male', 'Female', 'Other'] as const).map(g => (
                <TouchableOpacity
                  key={g}
                  style={[styles.genderPill, childGender === g && styles.genderPillActive]}
                  onPress={() => setChildGender(g)}
                >
                  <Text style={[styles.genderPillText, childGender === g && styles.genderPillTextActive]}>
                    {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setAddModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                onPress={handleAddChild}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color={C.white} size="small" />
                  : <Text style={styles.saveBtnText}>Add Child</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.base },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.base },

  header: {
    backgroundColor: C.primary,
    paddingTop: 52,
    paddingBottom: 0,
  },
  headerInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingBottom: 20,
    maxWidth: MAX_W,
    alignSelf: 'center',
    width: '100%',
  },
  greeting: { fontSize: 26, fontWeight: '700', color: C.white },
  subGreeting: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 3 },
  signOutBtn: {
    paddingVertical: 8, paddingHorizontal: 16,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
  },
  signOutText: { fontSize: 13, color: C.white, fontWeight: '600' },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: C.white,
    marginHorizontal: 20,
    maxWidth: MAX_W - 40,
    alignSelf: 'center',
    width: '100%',
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: -18,
    marginTop: 8,
    ...SHADOW.md,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNumber: { fontSize: 26, fontWeight: '800', color: C.primary },
  statLabel: { fontSize: 11, color: C.textMuted, marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: C.border, alignSelf: 'center' },

  content: {
    paddingTop: 32,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxWidth: MAX_W,
    alignSelf: 'center',
    width: '100%',
  },

  grid: { width: '100%' },
  gridWide: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },

  childCard: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    ...SHADOW.sm,
  },
  childRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: C.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '800', color: C.primary },
  childInfo: { flex: 1, marginLeft: 12 },
  childName: { fontSize: 17, fontWeight: '700', color: C.text },
  childMeta: { fontSize: 13, color: C.textSub, marginTop: 2 },
  sketchRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  childSketches: { fontSize: 12, color: C.textMuted },
  therapistRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  therapistText: { fontSize: 12, color: C.primary, fontWeight: '600' },
  emotionBadge: {
    alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12,
  },
  emotionLabel: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize', marginTop: 3 },

  alertBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 7,
    backgroundColor: '#fef3c7', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8, marginBottom: 10,
  },
  alertText: { flex: 1, fontSize: 12, color: '#92400e', lineHeight: 17, fontWeight: '500' },

  divider: { height: 1, backgroundColor: C.border, marginBottom: 12 },

  cardActions: { flexDirection: 'row', gap: 8 },
  journalBtn: {
    flex: 1, paddingVertical: 11, borderRadius: 11,
    borderWidth: 1, borderColor: C.border, alignItems: 'center',
    backgroundColor: C.base, flexDirection: 'row', justifyContent: 'center', gap: 5,
  },
  journalBtnText: { fontSize: 13, fontWeight: '600', color: C.textSub },
  drawBtn: {
    flex: 1, paddingVertical: 11, borderRadius: 11,
    backgroundColor: C.primary, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center', gap: 5,
  },
  drawBtnText: { fontSize: 13, fontWeight: '700', color: C.white },

  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: C.text, marginBottom: 8 },
  emptyDesc: { fontSize: 15, color: C.textSub, textAlign: 'center', lineHeight: 22 },

  dashboardLink: {
    marginTop: 8, paddingVertical: 9, alignItems: 'center',
    borderRadius: 10, backgroundColor: C.base,
    borderWidth: 1, borderColor: C.border,
    flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  dashboardLinkText: { fontSize: 13, fontWeight: '600', color: C.primary },

  hint: { textAlign: 'center', fontSize: 12, color: C.textMuted, marginTop: 20 },

  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, marginTop: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: C.text },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.primary, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
  },
  addBtnText: { fontSize: 13, fontWeight: '700', color: C.white },

  emptyAddBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.primary, paddingHorizontal: 24, paddingVertical: 13,
    borderRadius: 14, marginTop: 20,
  },
  emptyAddBtnText: { fontSize: 15, fontWeight: '700', color: C.white },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 36, gap: 4,
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: C.borderMed,
    alignSelf: 'center', marginBottom: 14,
  },
  modalTitle: { fontSize: 19, fontWeight: '800', color: C.text },
  modalSub: { fontSize: 13, color: C.textSub, marginBottom: 14 },

  fieldLabel: { fontSize: 11, fontWeight: '700', color: C.textMuted, letterSpacing: 0.8, marginBottom: 6 },
  fieldInput: {
    borderWidth: 1.5, borderColor: C.borderMed, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: C.text, backgroundColor: C.base,
  },

  genderRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  genderPill: {
    flex: 1, paddingVertical: 11, borderRadius: 11, alignItems: 'center',
    borderWidth: 1.5, borderColor: C.border, backgroundColor: C.base,
  },
  genderPillActive: { backgroundColor: C.primary, borderColor: C.primary },
  genderPillText: { fontSize: 14, fontWeight: '600', color: C.textSub },
  genderPillTextActive: { color: C.white },

  modalActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    backgroundColor: C.base, borderWidth: 1, borderColor: C.border, alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: C.textSub },
  saveBtn: { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: C.primary, alignItems: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: C.white },
});
