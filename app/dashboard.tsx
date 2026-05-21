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
import { C, EMOTION_COLORS, SHADOW } from '../constants/theme';
import { ParentShell } from '../components/ParentShell';
import { EmotionIcon } from '../components/EmotionIcon';

const NAVY = '#1A1F3C';
const YELLOW = '#FFD93D';
const RIGHT_W = 272;

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}


export default function Dashboard() {
  const { profile, activeChild, enterChildMode, signOut } = useApp();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [children, setChildren]           = useState<Patient[]>([]);
  const [lastEmotions, setLastEmotions]   = useState<Record<string, string>>({});
  const [negativeStreaks, setNegativeStreaks] = useState<Record<string, boolean>>({});
  const [therapistNames, setTherapistNames] = useState<Record<string, string>>({});
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [searchQuery, setSearchQuery]     = useState('');
  const [recentActivity, setRecentActivity] = useState<{ childName: string; emotion: string; created_at: string }[]>([]);
  const [weekSketchDates, setWeekSketchDates] = useState<Set<string>>(new Set());
  const [emotionHistory, setEmotionHistory] = useState<Record<string, string[]>>({});
  const [todayEmotions, setTodayEmotions]   = useState<Record<string, number>>({});
  const [weeklyData, setWeeklyData]         = useState<{ date: string; count: number; topEmotion: string }[]>([]);

  const [addModal, setAddModal]     = useState(false);
  const [childName, setChildName]   = useState('');
  const [childAge, setChildAge]     = useState('');
  const [childGender, setChildGender] = useState<'Male' | 'Female' | 'Other' | ''>('');
  const [saving, setSaving]         = useState(false);

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
        .from('patients').select('*').eq('guardian_id', user.id).order('full_name');
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
      .from('sketches').select('patient_id, emotion, created_at, image_url')
      .in('patient_id', ids).order('created_at', { ascending: false });

    if (data) {
      const lastMap: Record<string, string>   = {};
      const recentMap: Record<string, string[]> = {};
      const historyMap: Record<string, string[]> = {};

      data.forEach(s => {
        if (!lastMap[s.patient_id]) lastMap[s.patient_id] = s.emotion;
        if (!historyMap[s.patient_id]) historyMap[s.patient_id] = [];
        if (historyMap[s.patient_id].length < 5) historyMap[s.patient_id].push(s.emotion);
        if (!recentMap[s.patient_id]) recentMap[s.patient_id] = [];
        if (recentMap[s.patient_id].length < 3) recentMap[s.patient_id].push(s.emotion);
      });

      setLastEmotions(lastMap);
      setEmotionHistory(historyMap);

      const NEGATIVE = ['sad', 'angry', 'anxious'];
      const streaks: Record<string, boolean> = {};
      Object.entries(recentMap).forEach(([id, emotions]) => {
        streaks[id] = emotions.length >= 3 && emotions.every(e => NEGATIVE.includes(e));
      });
      setNegativeStreaks(streaks);

      // Today's emotion breakdown
      const todayStr = new Date().toISOString().slice(0, 10);
      const todayCount: Record<string, number> = {};
      data.filter(s => s.created_at.slice(0, 10) === todayStr)
          .forEach(s => { todayCount[s.emotion] = (todayCount[s.emotion] ?? 0) + 1; });
      setTodayEmotions(todayCount);

      // Last 7 days bar chart data
      const weekly = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const dateStr = d.toISOString().slice(0, 10);
        const dayItems = data.filter(s => s.created_at.slice(0, 10) === dateStr);
        const counts: Record<string, number> = {};
        dayItems.forEach(s => { counts[s.emotion] = (counts[s.emotion] ?? 0) + 1; });
        const topEmotion = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
        return { date: dateStr, count: dayItems.length, topEmotion };
      });
      setWeeklyData(weekly);

      const nameMap: Record<string, string> = {};
      patients.forEach(p => { nameMap[p.id] = p.full_name.split(' ')[0]; });
      setRecentActivity(data.slice(0, 10).map(s => ({
        childName: nameMap[s.patient_id] ?? 'Child',
        emotion: s.emotion,
        created_at: s.created_at,
      })));
      setWeekSketchDates(new Set(data.map(s => s.created_at.slice(0, 10))));
    }
  }

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => { await signOut(); router.replace('/login'); } },
    ]);
  }

  function openAddModal() {
    setChildName(''); setChildAge(''); setChildGender('');
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
        full_name: childName.trim(), age, gender: childGender,
        guardian_id: user.id, status: 'Active',
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

  const firstName      = profile?.full_name?.split(' ')[0] ?? 'Parent';
  const totalSketches  = children.reduce((sum, c) => sum + (c.total_sketches ?? 0), 0);
  const happyCount     = Object.values(lastEmotions).filter(e => e === 'happy').length;
  const filtered       = children.filter(c => c.full_name.toLowerCase().includes(searchQuery.toLowerCase()));

  const today = new Date();
  const DOW   = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    const off = today.getDay() === 0 ? -6 : 1 - today.getDay();
    d.setDate(today.getDate() + off + i);
    return d.toISOString().slice(0, 10);
  });

  // ─────────────────────────────────────────────────────────
  // SHARED MODAL (used by both layouts)
  // ─────────────────────────────────────────────────────────
  const addChildModal = (
    <Modal visible={addModal} transparent animationType="slide" onRequestClose={() => setAddModal(false)}>
      <KeyboardAvoidingView style={s.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={s.modalSheet}>
          <View style={s.modalHandle} />
          <Text style={s.modalTitle}>Add Child</Text>
          <Text style={s.modalSub}>Fill in your child's details below</Text>

          <Text style={s.fieldLabel}>FULL NAME</Text>
          <TextInput style={s.fieldInput} value={childName} onChangeText={setChildName}
            placeholder="e.g. Ahmad bin Ali" placeholderTextColor={C.textMuted} autoCapitalize="words" />

          <Text style={[s.fieldLabel, { marginTop: 14 }]}>AGE</Text>
          <TextInput style={s.fieldInput} value={childAge}
            onChangeText={t => setChildAge(t.replace(/[^0-9]/g, ''))}
            placeholder="e.g. 8" placeholderTextColor={C.textMuted} keyboardType="number-pad" maxLength={2} />

          <Text style={[s.fieldLabel, { marginTop: 14 }]}>GENDER</Text>
          <View style={s.genderRow}>
            {(['Male', 'Female', 'Other'] as const).map(g => (
              <TouchableOpacity key={g}
                style={[s.genderPill, childGender === g && s.genderPillActive]}
                onPress={() => setChildGender(g)}>
                <Text style={[s.genderPillText, childGender === g && s.genderPillTextActive]}>{g}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={s.modalActions}>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setAddModal(false)}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.7 }]} onPress={handleAddChild} disabled={saving}>
              {saving ? <ActivityIndicator color={C.white} size="small" /> : <Text style={s.saveBtnText}>Add Child</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  // ─────────────────────────────────────────────────────────
  // iPAD / WIDE LAYOUT
  // ─────────────────────────────────────────────────────────
  if (isWide) {
    return (
      <ParentShell>
        <View style={w.main}>

          {/* Two-column body */}
          <View style={w.columns}>

            {/* ── Center column ── */}
            <ScrollView
              style={w.centerCol}
              contentContainerStyle={w.centerContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchChildren(); }} tintColor={NAVY} />
              }
            >
              {/* Hero card */}
              <View style={w.heroCard}>
                {/* Left: greeting + today glance */}
                <View style={{ flex: 1 }}>
                  <Text style={w.heroTitle}>Hello, {firstName}!</Text>
                  <Text style={w.heroSub}>
                    Monitor your children's emotional wellbeing through their drawings.
                  </Text>
                  <View style={w.heroGlance}>
                    <View style={w.heroGlanceChip}>
                      <Ionicons name="brush-outline" size={13} color={NAVY} style={{ opacity: 0.6 }} />
                      <Text style={w.heroGlanceNum}>
                        {Object.values(todayEmotions).reduce((a, b) => a + b, 0) || totalSketches}
                      </Text>
                      <Text style={w.heroGlanceLbl}>
                        {Object.values(todayEmotions).reduce((a, b) => a + b, 0) > 0 ? 'today' : 'total'}
                      </Text>
                    </View>
                    {Object.entries(todayEmotions).sort((a, b) => b[1] - a[1]).slice(0, 1).map(([emotion]) => (
                      <View key={emotion} style={[w.heroGlanceChip, { backgroundColor: EMOTION_COLORS[emotion]?.card }]}>
                        <EmotionIcon emotion={emotion} size={13} />
                        <Text style={[w.heroGlanceLbl, { color: EMOTION_COLORS[emotion]?.text, fontWeight: '700' }]}>
                          {emotion.charAt(0).toUpperCase() + emotion.slice(1)} today
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Right: 7-day mini bar chart */}
                <View style={w.heroChartWrap}>
                  <Text style={w.heroChartTitle}>This Week</Text>
                  <View style={w.heroChart}>
                    {weeklyData.map((day, i) => {
                      const maxCount = Math.max(...weeklyData.map(d => d.count), 1);
                      const barH = day.count > 0 ? Math.max(Math.round((day.count / maxCount) * 44), 4) : 0;
                      const isToday = i === 6;
                      const barColor = day.topEmotion
                        ? EMOTION_COLORS[day.topEmotion]?.text ?? NAVY
                        : 'rgba(26,31,60,0.12)';
                      return (
                        <View key={day.date} style={w.heroBarCol}>
                          <View style={w.heroBarBg}>
                            <View style={[w.heroBarFill, { height: barH, backgroundColor: barColor }]} />
                          </View>
                          <Text style={[w.heroBarLbl, isToday && w.heroBarLblToday]}>
                            {['M','T','W','T','F','S','T'][i]}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </View>

              {/* Search bar */}
              <View style={w.searchBar}>
                <Ionicons name="search-outline" size={15} color="#A0A0B0" />
                <TextInput
                  style={w.searchInput}
                  placeholder="Search children..."
                  placeholderTextColor="#A0A0B0"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>

              {/* Section header */}
              <View style={w.sectionRow}>
                <Text style={w.sectionTitle}>Children Profiles</Text>
              </View>

              {/* Children list */}
              {loading ? (
                <ActivityIndicator size="large" color={NAVY} style={{ marginVertical: 40 }} />
              ) : filtered.length === 0 ? (
                <View style={w.emptyState}>
                  <Ionicons name="person-add-outline" size={38} color={NAVY} style={{ opacity: 0.2, marginBottom: 10 }} />
                  <Text style={w.emptyTitle}>{searchQuery ? 'No results found' : 'No children yet'}</Text>
                  <Text style={w.emptyDesc}>{searchQuery ? 'Try a different name.' : 'Add your first child to get started.'}</Text>
                </View>
              ) : (
                <View style={w.childList}>
                  {filtered.map((child, index) => {
                    const lastEmotion = lastEmotions[child.id];
                    const ec = lastEmotion ? EMOTION_COLORS[lastEmotion] : null;
                    return (
                      <View key={child.id} style={w.childCard}>
                        <Text style={w.childRank}>{String(index + 1).padStart(2, '0')}</Text>
                        <View style={w.childAvatar}>
                          <Text style={w.childAvatarText}>{child.full_name.charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={w.childInfo}>
                          <Text style={w.childName}>{child.full_name}</Text>
                          <Text style={w.childMeta}>
                            {child.age} y/o · {child.gender}
                            {child.therapist_id && therapistNames[child.therapist_id]
                              ? `  ·  by ${therapistNames[child.therapist_id]}`
                              : ''}
                          </Text>
                          {(emotionHistory[child.id]?.length ?? 0) > 0 && (
                            <View style={w.historyRow}>
                              {emotionHistory[child.id].map((e, i) => (
                                <View key={i} style={[w.historyDot, { backgroundColor: EMOTION_COLORS[e]?.card ?? '#F0F0F5' }]}>
                                  <EmotionIcon emotion={e} size={9} />
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                        <View style={w.childRight}>
                          {ec && lastEmotion ? (
                            <View style={[w.emotionPill, { backgroundColor: ec.card }]}>
                              <EmotionIcon emotion={lastEmotion} size={13} />
                              <Text style={[w.emotionPillText, { color: ec.text }]}>
                                {lastEmotion.charAt(0).toUpperCase() + lastEmotion.slice(1)}
                              </Text>
                            </View>
                          ) : null}
                          <View style={w.sketchRow}>
                            <Ionicons name="brush-outline" size={11} color="#A0A0B0" />
                            <Text style={w.sketchText}>{child.total_sketches ?? 0} sketches</Text>
                            {negativeStreaks[child.id] && (
                              <>
                                <Ionicons name="alert-circle" size={11} color="#e76f51" />
                                <Text style={[w.sketchText, { color: '#e76f51' }]}>alert</Text>
                              </>
                            )}
                          </View>
                        </View>
                        <TouchableOpacity
                          style={w.viewBtn}
                          onPress={() => { pendingRoute.current = '/child/journal'; enterChildMode(child); }}
                        >
                          <Text style={w.viewBtnText}>view activity</Text>
                          <Ionicons name="chevron-forward" size={12} color={NAVY} />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Add child */}
              <TouchableOpacity style={w.addBtn} onPress={openAddModal}>
                <Ionicons name="add" size={17} color={NAVY} />
                <Text style={w.addBtnText}>Add Child</Text>
              </TouchableOpacity>

              <Text style={w.hint}>Pull down to refresh</Text>
            </ScrollView>

            {/* ── Right panel ── */}
            <View style={w.rightPanel}>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 18, gap: 12 }}>

                {/* Stat cards */}
                {[
                  { bg: '#D0F5F5', iconBg: '#38BFBF', icon: 'people',       num: children.length,  lbl: 'Total Children'  },
                  { bg: '#E4DCFF', iconBg: '#8B72E8', icon: 'brush',         num: totalSketches,    lbl: 'Recent Sketches' },
                  { bg: '#FFD9EB', iconBg: '#F06EA0', icon: 'happy-outline', num: happyCount,       lbl: 'Happy Today'     },
                ].map(card => (
                  <View key={card.lbl} style={[w.statCard, { backgroundColor: card.bg }]}>
                    <View style={[w.statIconBox, { backgroundColor: card.iconBg }]}>
                      <Ionicons name={card.icon as any} size={16} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={w.statNum}>{String(card.num).padStart(2, '0')}</Text>
                      <Text style={w.statLbl}>{card.lbl}</Text>
                    </View>
                  </View>
                ))}

                {/* Week calendar */}
                <View style={w.calCard}>
                  <Text style={w.calTitle}>Emotional Review</Text>
                  <Text style={w.calSub}>Calendar</Text>
                  <View style={w.weekRow}>
                    {weekDates.map((date, i) => {
                      const active  = weekSketchDates.has(date);
                      const isToday = date === today.toISOString().slice(0, 10);
                      return (
                        <View key={i} style={w.weekCol}>
                          <Text style={[w.weekLabel, isToday && w.weekLabelToday]}>{DOW[i]}</Text>
                          <View style={[w.weekDot, isToday && w.weekDotToday, active && w.weekDotActive]}>
                            {active && <View style={w.weekDotFill} />}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>

                {/* Activity log */}
                {recentActivity.length > 0 && (
                  <View style={w.actCard}>
                    <Text style={w.actTitle}>Recent Activity</Text>
                    {recentActivity.slice(0, 5).map((item, i) => (
                      <View key={i} style={w.actRow}>
                        <Text style={w.actTime}>{formatTime(item.created_at)}</Text>
                        <View style={w.actDot} />
                        <Text style={w.actText} numberOfLines={1}>
                          <Text style={{ fontWeight: '700' }}>{item.childName}</Text>
                          {' — '}{item.emotion} status recorded
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

              </ScrollView>
            </View>

          </View>

        </View>
        {addChildModal}
      </ParentShell>
    );
  }

  // ─────────────────────────────────────────────────────────
  // PHONE LAYOUT
  // ─────────────────────────────────────────────────────────
  return (
    <ParentShell>
    <View style={s.root}>

      {/* Top bar */}
      <View style={s.topBar}>
        <View style={s.topBarLeft}>
          <View style={s.logoBox}>
            <Ionicons name="brush" size={15} color={NAVY} />
          </View>
          <Text style={s.logoText}>EmotiSketch</Text>
        </View>
        <View style={s.topBarRight}>
          <TouchableOpacity style={s.iconBtn} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={19} color="rgba(255,255,255,0.75)" />
          </TouchableOpacity>
          <View style={s.avatarCircle}>
            <Text style={s.avatarLetter}>{firstName.charAt(0).toUpperCase()}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchChildren(); }} tintColor={NAVY} />
        }
      >
        {/* Greeting card */}
        <View style={s.greetingCard}>
          <View style={{ flex: 1 }}>
            <Text style={s.greetingHello}>Hello, {firstName}!</Text>
            <Text style={s.greetingSub}>Monitor your children's emotional{'\n'}wellbeing through their drawings.</Text>
          </View>
          <Ionicons name="heart" size={48} color={NAVY} style={{ opacity: 0.12 }} />
        </View>

        {/* Stat cards */}
        <View style={s.statsRow}>
          {[
            { bg: '#D0F5F5', iconBg: '#38BFBF', icon: 'people',       num: children.length, lbl: 'Children'    },
            { bg: '#E4DCFF', iconBg: '#8B72E8', icon: 'brush',         num: totalSketches,   lbl: 'Sketches'    },
            { bg: '#FFD9EB', iconBg: '#F06EA0', icon: 'happy-outline', num: happyCount,      lbl: 'Happy Today' },
          ].map(card => (
            <View key={card.lbl} style={[s.statCard, { backgroundColor: card.bg }]}>
              <View style={[s.statIconBox, { backgroundColor: card.iconBg }]}>
                <Ionicons name={card.icon as any} size={15} color="#fff" />
              </View>
              <Text style={s.statNum}>{String(card.num).padStart(2, '0')}</Text>
              <Text style={s.statLbl}>{card.lbl}</Text>
            </View>
          ))}
        </View>

        {/* Section header */}
        <View style={s.sectionRow}>
          <Text style={s.sectionTitle}>Children Profiles</Text>
          <TouchableOpacity style={s.addBtn} onPress={openAddModal}>
            <Ionicons name="add" size={15} color={C.white} />
            <Text style={s.addBtnText}>Add Child</Text>
          </TouchableOpacity>
        </View>

        {/* Children list */}
        {loading ? (
          <ActivityIndicator size="large" color={NAVY} style={{ marginVertical: 40 }} />
        ) : children.length === 0 ? (
          <View style={s.emptyState}>
            <View style={s.emptyIconWrap}>
              <Ionicons name="person-add-outline" size={38} color={NAVY} style={{ opacity: 0.28 }} />
            </View>
            <Text style={s.emptyTitle}>No children yet</Text>
            <Text style={s.emptyDesc}>Add your first child to get started.</Text>
            <TouchableOpacity style={s.emptyAddBtn} onPress={openAddModal}>
              <Ionicons name="add-circle-outline" size={17} color={C.white} />
              <Text style={s.emptyAddBtnText}>Add Child</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.childList}>
            {children.map((child, index) => {
              const lastEmotion = lastEmotions[child.id];
              const ec = lastEmotion ? EMOTION_COLORS[lastEmotion] : null;
              return (
                <View key={child.id} style={s.childCard}>
                  <View style={s.childRow}>
                    <Text style={s.childRank}>{String(index + 1).padStart(2, '0')}</Text>
                    <View style={s.childAvatar}>
                      <Text style={s.childAvatarText}>{child.full_name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={s.childInfo}>
                      <Text style={s.childName}>{child.full_name}</Text>
                      <Text style={s.childMeta}>{child.age} y/o · {child.gender}</Text>
                      {child.therapist_id && therapistNames[child.therapist_id] && (
                        <Text style={s.therapistText}>{therapistNames[child.therapist_id]}</Text>
                      )}
                    </View>
                    <View style={s.childRight}>
                      {ec && lastEmotion ? (
                        <View style={[s.emotionPill, { backgroundColor: ec.card }]}>
                          <EmotionIcon emotion={lastEmotion} size={13} />
                          <Text style={[s.emotionPillText, { color: ec.text }]}>
                            {lastEmotion.charAt(0).toUpperCase() + lastEmotion.slice(1)}
                          </Text>
                        </View>
                      ) : <View style={s.emotionPillEmpty}><Text style={s.emotionPillEmptyText}>No data</Text></View>}
                      <View style={s.sketchCountRow}>
                        <Ionicons name="brush-outline" size={11} color="#A0A0B0" />
                        <Text style={s.sketchCountText}>{child.total_sketches ?? 0} sketches</Text>
                        {negativeStreaks[child.id] && (
                          <Ionicons name="alert-circle" size={11} color="#e76f51" />
                        )}
                      </View>
                    </View>
                  </View>

                  {negativeStreaks[child.id] && (
                    <View style={s.alertBanner}>
                      <Ionicons name="alert-circle" size={13} color="#92400e" />
                      <Text style={s.alertText}>Negative feelings in last 3 drawings. Consider checking in.</Text>
                    </View>
                  )}

                  <View style={s.divider} />

                  <View style={s.cardActions}>
                    <TouchableOpacity style={s.journalBtn}
                      onPress={() => { pendingRoute.current = '/child/journal'; enterChildMode(child); }}>
                      <Ionicons name="book-outline" size={13} color={NAVY} />
                      <Text style={s.journalBtnText}>Journal</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.dashboardBtn}
                      onPress={() => router.push({ pathname: '/parent-dashboard', params: { patientId: child.id, patientName: child.full_name } })}>
                      <Ionicons name="bar-chart-outline" size={13} color={NAVY} />
                      <Text style={s.dashboardBtnText}>Dashboard</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.drawBtn}
                      onPress={() => { pendingRoute.current = '/child/home'; enterChildMode(child); }}>
                      <Ionicons name="brush-outline" size={13} color={C.white} />
                      <Text style={s.drawBtnText}>Draw Now</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <Text style={s.hint}>Pull down to refresh</Text>
      </ScrollView>

      {addChildModal}
    </View>
    </ParentShell>
  );
}

// ─────────────────────────────────────────────────────────
// PHONE STYLES
// ─────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#F4F5FA' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4F5FA' },
  scroll: { flex: 1 },

  topBar: {
    backgroundColor: NAVY, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingTop: 54, paddingBottom: 16, paddingHorizontal: 20,
  },
  topBarLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBox:     { width: 32, height: 32, borderRadius: 9, backgroundColor: YELLOW, justifyContent: 'center', alignItems: 'center' },
  logoText:    { fontSize: 17, fontWeight: '800', color: '#fff' },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn:     { width: 34, height: 34, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  avatarCircle:{ width: 34, height: 34, borderRadius: 17, backgroundColor: YELLOW, justifyContent: 'center', alignItems: 'center' },
  avatarLetter:{ fontSize: 14, fontWeight: '800', color: NAVY },

  content: { padding: 18, paddingBottom: 40 },

  greetingCard: {
    backgroundColor: YELLOW, borderRadius: 18, padding: 20,
    flexDirection: 'row', alignItems: 'center', marginBottom: 14, overflow: 'hidden',
  },
  greetingHello: { fontSize: 23, fontWeight: '900', color: NAVY, marginBottom: 5 },
  greetingSub:   { fontSize: 12, color: NAVY, opacity: 0.6, lineHeight: 19, fontWeight: '500' },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard:    { flex: 1, borderRadius: 14, padding: 12, gap: 4 },
  statIconBox: { width: 30, height: 30, borderRadius: 9, justifyContent: 'center', alignItems: 'center', marginBottom: 2 },
  statNum:     { fontSize: 22, fontWeight: '900', color: NAVY },
  statLbl:     { fontSize: 10, fontWeight: '600', color: NAVY, opacity: 0.5 },

  sectionRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: NAVY },
  addBtn:       { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: NAVY, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 18 },
  addBtnText:   { fontSize: 11, fontWeight: '700', color: C.white },

  emptyState:   { alignItems: 'center', paddingVertical: 50 },
  emptyIconWrap:{ width: 76, height: 76, borderRadius: 38, backgroundColor: '#E8E8F0', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  emptyTitle:   { fontSize: 17, fontWeight: '700', color: NAVY, marginBottom: 5 },
  emptyDesc:    { fontSize: 13, color: C.textSub, textAlign: 'center', lineHeight: 20, marginBottom: 18 },
  emptyAddBtn:  { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: NAVY, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 12 },
  emptyAddBtnText: { fontSize: 13, fontWeight: '700', color: C.white },

  childList: { gap: 10 },
  childCard: { backgroundColor: C.white, borderRadius: 16, padding: 14, ...SHADOW.sm },
  childRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  childRank: { fontSize: 20, fontWeight: '900', color: NAVY, opacity: 0.12, width: 32 },
  childAvatar:     { width: 42, height: 42, borderRadius: 12, backgroundColor: '#EDEDF8', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  childAvatarText: { fontSize: 16, fontWeight: '800', color: NAVY },
  childInfo:       { flex: 1, gap: 1 },
  childName:       { fontSize: 14, fontWeight: '800', color: NAVY },
  childMeta:       { fontSize: 11, color: C.textSub },
  therapistText:   { fontSize: 10, color: NAVY, opacity: 0.5, fontWeight: '600' },
  childRight:      { alignItems: 'flex-end', gap: 4 },
  emotionPill:     { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  emotionPillText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  emotionPillEmpty:{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, backgroundColor: '#F0F0F5' },
  emotionPillEmptyText: { fontSize: 10, color: C.textMuted },
  sketchCountRow:  { flexDirection: 'row', alignItems: 'center', gap: 3 },
  sketchCountText: { fontSize: 10, color: C.textMuted },

  alertBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: '#fef3c7', borderRadius: 9, paddingHorizontal: 9, paddingVertical: 6, marginBottom: 8 },
  alertText:   { flex: 1, fontSize: 11, color: '#92400e', lineHeight: 16 },
  divider:     { height: 1, backgroundColor: '#F0F0F5', marginBottom: 10 },

  cardActions:   { flexDirection: 'row', gap: 7 },
  journalBtn:    { flex: 1, paddingVertical: 9, borderRadius: 9, borderWidth: 1.5, borderColor: '#E8E8F0', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 4, backgroundColor: '#FAFAFA' },
  journalBtnText:{ fontSize: 11, fontWeight: '700', color: NAVY },
  dashboardBtn:  { flex: 1, paddingVertical: 9, borderRadius: 9, borderWidth: 1.5, borderColor: '#E8E8F0', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 4, backgroundColor: '#FAFAFA' },
  dashboardBtnText: { fontSize: 11, fontWeight: '700', color: NAVY },
  drawBtn:       { flex: 1, paddingVertical: 9, borderRadius: 9, backgroundColor: NAVY, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 4 },
  drawBtnText:   { fontSize: 11, fontWeight: '700', color: C.white },

  hint: { textAlign: 'center', fontSize: 11, color: C.textMuted, marginTop: 18 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet:    { backgroundColor: C.white, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 22, paddingBottom: 36, gap: 4 },
  modalHandle:   { width: 34, height: 4, borderRadius: 2, backgroundColor: '#E0E0E8', alignSelf: 'center', marginBottom: 12 },
  modalTitle:    { fontSize: 18, fontWeight: '800', color: NAVY },
  modalSub:      { fontSize: 13, color: C.textSub, marginBottom: 12 },
  fieldLabel:    { fontSize: 10, fontWeight: '700', color: C.textMuted, letterSpacing: 0.8, marginBottom: 5 },
  fieldInput:    { borderWidth: 1.5, borderColor: '#E8E8F0', borderRadius: 11, paddingHorizontal: 13, paddingVertical: 11, fontSize: 14, color: NAVY, backgroundColor: '#FAFAFA' },
  genderRow:     { flexDirection: 'row', gap: 8, marginTop: 2 },
  genderPill:    { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1.5, borderColor: '#E8E8F0', backgroundColor: '#FAFAFA' },
  genderPillActive: { backgroundColor: NAVY, borderColor: NAVY },
  genderPillText:   { fontSize: 13, fontWeight: '600', color: C.textSub },
  genderPillTextActive: { color: C.white },
  modalActions:  { flexDirection: 'row', gap: 10, marginTop: 18 },
  cancelBtn:     { flex: 1, paddingVertical: 13, borderRadius: 11, backgroundColor: '#F4F5FA', borderWidth: 1, borderColor: '#E8E8F0', alignItems: 'center' },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: C.textSub },
  saveBtn:       { flex: 2, paddingVertical: 13, borderRadius: 11, backgroundColor: NAVY, alignItems: 'center' },
  saveBtnText:   { fontSize: 14, fontWeight: '700', color: C.white },
});

// ─────────────────────────────────────────────────────────
// iPAD / WIDE STYLES
// ─────────────────────────────────────────────────────────
const w = StyleSheet.create({

  // Main window
  main: { flex: 1, backgroundColor: '#F4F5FA' },

  // Search bar (above children list)
  searchBar:   { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.white, borderRadius: 11, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 16, ...SHADOW.sm },
  searchInput: { flex: 1, fontSize: 14, color: NAVY },

  // Columns
  columns:    { flex: 1, flexDirection: 'row' },
  centerCol:  { flex: 1, borderRightWidth: 1, borderRightColor: '#EBEBEB' },
  centerContent: { padding: 22, paddingBottom: 40, gap: 0 },

  // Hero card
  heroCard:  { backgroundColor: YELLOW, borderRadius: 18, padding: 22, flexDirection: 'row', alignItems: 'center', marginBottom: 22, overflow: 'hidden' },
  heroTitle: { fontSize: 24, fontWeight: '900', color: NAVY, marginBottom: 6 },
  heroSub:   { fontSize: 13, color: NAVY, opacity: 0.6, lineHeight: 20, fontWeight: '500' },

  sectionRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: NAVY },

  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: NAVY, marginBottom: 5 },
  emptyDesc:  { fontSize: 13, color: C.textSub, textAlign: 'center' },

  childList: { gap: 10, marginBottom: 18 },
  childCard: {
    backgroundColor: C.white, borderRadius: 14, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 0,
    ...SHADOW.sm,
  },
  childRank:       { fontSize: 20, fontWeight: '900', color: NAVY, opacity: 0.12, width: 36 },
  childAvatar:     { width: 44, height: 44, borderRadius: 13, backgroundColor: '#EDEDF8', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  childAvatarText: { fontSize: 17, fontWeight: '800', color: NAVY },
  childInfo:       { flex: 1 },
  childName:       { fontSize: 15, fontWeight: '800', color: NAVY, marginBottom: 3 },
  childMeta:       { fontSize: 12, color: C.textSub },
  childRight:      { alignItems: 'flex-end', gap: 5, marginRight: 14 },
  emotionPill:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  emotionPillText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  sketchRow:       { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sketchText:      { fontSize: 11, color: C.textMuted },
  viewBtn:         { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 9, borderWidth: 1.5, borderColor: '#E8E8F0', backgroundColor: '#FAFAFA' },
  viewBtnText:     { fontSize: 12, fontWeight: '700', color: NAVY },

  addBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13, borderRadius: 13, borderWidth: 1.5, borderColor: NAVY, backgroundColor: 'transparent', marginBottom: 8 },
  addBtnText:{ fontSize: 13, fontWeight: '700', color: NAVY },
  hint:      { textAlign: 'center', fontSize: 11, color: C.textMuted, marginTop: 10 },

  // Right panel
  rightPanel: { width: RIGHT_W, backgroundColor: C.white },
  statCard:   { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, padding: 14 },
  statIconBox:{ width: 36, height: 36, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  statNum:    { fontSize: 24, fontWeight: '900', color: NAVY },
  statLbl:    { fontSize: 11, fontWeight: '600', color: NAVY, opacity: 0.5 },

  calCard:    { backgroundColor: '#F8F8FC', borderRadius: 14, padding: 14 },
  calTitle:   { fontSize: 14, fontWeight: '800', color: NAVY, marginBottom: 1 },
  calSub:     { fontSize: 11, color: C.textMuted, marginBottom: 14 },
  weekRow:    { flexDirection: 'row', justifyContent: 'space-between' },
  weekCol:    { alignItems: 'center', gap: 5 },
  weekLabel:  { fontSize: 10, fontWeight: '600', color: C.textMuted },
  weekLabelToday: { color: NAVY, fontWeight: '800' },
  weekDot:    { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: '#E8E8F0', backgroundColor: '#F0F0F5', justifyContent: 'center', alignItems: 'center' },
  weekDotToday: { borderColor: NAVY },
  weekDotActive:{ borderColor: C.primary, backgroundColor: C.primary + '15' },
  weekDotFill:  { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary },

  actCard:  { backgroundColor: '#F8F8FC', borderRadius: 14, padding: 14 },
  actTitle: { fontSize: 14, fontWeight: '800', color: NAVY, marginBottom: 12 },
  actRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  actTime:  { fontSize: 11, fontWeight: '700', color: C.textMuted, width: 38 },
  actDot:   { width: 6, height: 6, borderRadius: 3, backgroundColor: C.primary },
  actText:  { flex: 1, fontSize: 12, color: NAVY },

  bellBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: C.primary, borderRadius: 8,
    minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 3, borderWidth: 1.5, borderColor: '#fff',
  },
  bellBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },

  // Hero card — glance pills
  heroGlance:    { flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' },
  heroGlanceChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(26,31,60,0.08)',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  heroGlanceNum: { fontSize: 14, fontWeight: '900', color: NAVY },
  heroGlanceLbl: { fontSize: 11, fontWeight: '600', color: NAVY, opacity: 0.7 },

  // Hero card — week chart
  heroChartWrap: { alignItems: 'center', justifyContent: 'flex-end', paddingLeft: 16 },
  heroChartTitle:{ fontSize: 10, fontWeight: '700', color: NAVY, opacity: 0.45, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  heroChart:     { flexDirection: 'row', alignItems: 'flex-end', gap: 5 },
  heroBarCol:    { alignItems: 'center', gap: 4 },
  heroBarBg:     { width: 18, height: 44, justifyContent: 'flex-end', borderRadius: 6, backgroundColor: 'rgba(26,31,60,0.06)' },
  heroBarFill:   { width: 18, borderRadius: 6 },
  heroBarLbl:    { fontSize: 9, fontWeight: '600', color: NAVY, opacity: 0.4 },
  heroBarLblToday: { opacity: 1, fontWeight: '800' },

  // Child card — emotion history
  historyRow: { flexDirection: 'row', gap: 4, marginTop: 5 },
  historyDot: {
    width: 20, height: 20, borderRadius: 6,
    justifyContent: 'center', alignItems: 'center',
  },

});
