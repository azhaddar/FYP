import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, useWindowDimensions, Modal, Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '../../contexts/AppContext';
import { supabase } from '../../lib/supabaseClient';
import { Ionicons } from '@expo/vector-icons';
import { C, EMOTION_COLORS, MAX_W } from '../../constants/theme';
import { ChildNav } from '../../components/ChildNav';
import { EmotionIcon } from '../../components/EmotionIcon';
import { computeEarnedBadgeIds, getSeenBadgeIds } from '../../utils/badges';

export type PromptType = 'self' | 'house';

const DRAWING_PROMPTS: Record<PromptType, {
  icon: string; title: string; desc: string;
  tip: string; color: string; lightColor: string;
}> = {
  self: {
    icon: 'person',
    title: 'Draw Yourself',
    desc: 'Draw a picture of YOU — how you look and feel right now.',
    tip: 'Include your face, body, and anything that shows how you feel!',
    color: C.primary,
    lightColor: '#FFE4F0',
  },
  house: {
    icon: 'home',
    title: 'Draw Your Home',
    desc: 'Draw your home — the house, any trees outside, and the people who live with you.',
    tip: 'Try adding the house, a tree in the garden, and your family — the more detail, the better!',
    color: '#7c3aed',
    lightColor: '#EDE9FE',
  },
};

function computeStreak(sketches: { created_at: string }[]): number {
  if (!sketches.length) return 0;
  const days = [...new Set(sketches.map(s => s.created_at.slice(0, 10)))].sort().reverse();
  let streak = 0;
  let current = new Date();
  current.setHours(0, 0, 0, 0);
  for (const day of days) {
    const d = new Date(day);
    d.setHours(0, 0, 0, 0);
    const diff = Math.round((Number(current) - Number(d)) / 86400000);
    if (diff === 0 || diff === 1) { streak++; current = d; }
    else break;
  }
  return streak;
}

export default function ChildHome() {
  const { activeChild, exitChildMode, setUnreadBadgeCount } = useApp();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [streak, setStreak] = useState(0);
  const [recentEmotion, setRecentEmotion] = useState<string | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<PromptType | null>(null);
  const [pendingMethod, setPendingMethod] = useState(false);
  const [preMood, setPreMood] = useState<string | null>(null);
  const [emotionCounts, setEmotionCounts] = useState<Record<string, number>>({});
  const [weekActivity, setWeekActivity] = useState<{ date: string; emotion: string | null }[]>([]);
  const [totalSessions, setTotalSessions] = useState(0);

  useEffect(() => {
    if (!activeChild) { router.replace('/dashboard'); return; }
    fetchStats();
  }, [activeChild]);

  async function fetchStats() {
    if (!activeChild) return;
    const { data } = await supabase
      .from('sketches')
      .select('created_at, emotion')
      .eq('patient_id', activeChild.id)
      .order('created_at', { ascending: false });
    if (data) {
      setStreak(computeStreak(data));
      if (data[0]) setRecentEmotion(data[0].emotion);
      setTotalSessions(data.length);

      const counts: Record<string, number> = {};
      data.forEach(s => { if (s.emotion) counts[s.emotion] = (counts[s.emotion] ?? 0) + 1; });
      setEmotionCounts(counts);

      const last7 = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d.toISOString().slice(0, 10);
      });
      setWeekActivity(last7.map(date => {
        const s = data.find(sk => sk.created_at.slice(0, 10) === date);
        return { date, emotion: s?.emotion ?? null };
      }));

      // Check for new unread badges to show dot on nav
      const earnedIds = computeEarnedBadgeIds(data);
      const seenIds = await getSeenBadgeIds(activeChild.id);
      const newCount = earnedIds.filter(id => !seenIds.includes(id)).length;
      setUnreadBadgeCount(newCount);
    }
  }

  function handleExit() {
    Alert.alert(
      'Switch back?',
      `Leave ${activeChild?.full_name}'s view and go back to the parent dashboard?`,
      [
        { text: 'Stay', style: 'cancel' },
        { text: 'Yes, go back', onPress: () => { exitChildMode(); router.replace('/dashboard'); } },
      ]
    );
  }

  function openMoodCheck() {
    if (!selectedPrompt) {
      Alert.alert('Pick a drawing topic', 'Please choose what you want to draw first!');
      return;
    }
    setPreMood(null);
    setPendingMethod(true);
  }

  function confirmMoodAndNavigate() {
    if (!selectedPrompt) return;
    router.push({ pathname: '/child/upload', params: { promptType: selectedPrompt, preMood: preMood ?? '' } });
    setPendingMethod(false);
  }

  if (!activeChild) return null;

  const firstName = activeChild.full_name.split(' ')[0];

  return (
    <View style={styles.root}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.exitBtn} onPress={handleExit}>
          <Ionicons name="chevron-back" size={18} color="rgba(255,255,255,0.85)" />
          <Text style={styles.exitText}>Parent</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>EmotiSketch</Text>
        <View style={{ width: 72 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, isWide && styles.contentWide]}>

        {/* Hero greeting card */}
        <View style={styles.heroCard}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="sunny" size={28} color={C.primary} />
          </View>
          <Text style={styles.heroTitle}>Hi, {firstName}!</Text>
          <Text style={styles.heroSub}>Ready to draw today?</Text>
          <View style={styles.heroBadgeRow}>
            {streak > 0 && (
              <View style={styles.streakBadge}>
                <Text style={styles.streakBadgeText}>🔥 {streak} day{streak > 1 ? 's' : ''} streak!</Text>
              </View>
            )}
            {recentEmotion && (
              <View style={[styles.moodBadge, { backgroundColor: EMOTION_COLORS[recentEmotion].card }]}>
                <EmotionIcon emotion={recentEmotion} size={14} />
                <Text style={[styles.moodBadgeText, { color: EMOTION_COLORS[recentEmotion].text }]}>
                  Last: {recentEmotion}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Charts ──────────────────────────────────────── */}
        {totalSessions > 0 && (
          <>
            {/* My Feelings bar chart */}
            <View style={chartStyles.card}>
              <View style={chartStyles.cardHeader}>
                <View style={[chartStyles.cardIconPill, { backgroundColor: '#FFE4F0' }]}>
                  <Ionicons name="heart" size={18} color={C.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={chartStyles.cardTitle}>My Feelings</Text>
                  <Text style={chartStyles.cardSub}>How I've felt across all my drawings</Text>
                </View>
              </View>
              {(['happy', 'sad', 'angry', 'anxious'] as const).map(e => {
                const count = emotionCounts[e] ?? 0;
                const pct = totalSessions > 0 ? count / totalSessions : 0;
                const ec = EMOTION_COLORS[e];
                return (
                  <View key={e} style={chartStyles.barRow}>
                    <EmotionIcon emotion={e} size={22} />
                    <Text style={chartStyles.barLabel}>{e.charAt(0).toUpperCase() + e.slice(1)}</Text>
                    <View style={chartStyles.barTrack}>
                      {pct > 0 && <View style={[chartStyles.barFill, { flex: pct, backgroundColor: ec.text }]} />}
                      <View style={{ flex: Math.max(1 - pct, 0) }} />
                    </View>
                    <Text style={[chartStyles.barCount, pct > 0 && { color: ec.text }]}>{count}</Text>
                  </View>
                );
              })}
            </View>

            {/* This week activity dots */}
            <View style={chartStyles.card}>
              <View style={chartStyles.cardHeader}>
                <View style={[chartStyles.cardIconPill, { backgroundColor: '#EDE9FE' }]}>
                  <Ionicons name="calendar" size={18} color="#7c3aed" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={chartStyles.cardTitle}>This Week</Text>
                  <Text style={chartStyles.cardSub}>Days I drew something this week</Text>
                </View>
              </View>
              <View style={chartStyles.weekRow}>
                {weekActivity.map((day, i) => {
                  const ec = day.emotion ? EMOTION_COLORS[day.emotion] : null;
                  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                  const label = DOW[new Date(day.date + 'T12:00:00').getDay()];
                  return (
                    <View key={i} style={chartStyles.weekCol}>
                      <View style={[
                        chartStyles.weekDot,
                        ec
                          ? { backgroundColor: ec.card, borderColor: ec.text, borderWidth: 2 }
                          : { backgroundColor: '#f3f4f6', borderColor: '#e5e7eb', borderWidth: 1.5 },
                      ]}>
                        {day.emotion
                          ? <EmotionIcon emotion={day.emotion} size={20} />
                          : <Ionicons name="remove" size={14} color="#d1d5db" />
                        }
                      </View>
                      <Text style={chartStyles.weekDayLabel}>{label}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Total drawings milestone card */}
            <View style={chartStyles.milestoneCard}>
              <View style={chartStyles.milestoneIconWrap}>
                <Ionicons
                  name={totalSessions >= 20 ? 'trophy' : totalSessions >= 10 ? 'ribbon' : totalSessions >= 5 ? 'star' : 'brush'}
                  size={26}
                  color="#C2410C"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={chartStyles.milestoneTitle}>
                  {totalSessions} drawing{totalSessions !== 1 ? 's' : ''} done!
                </Text>
                <Text style={chartStyles.milestoneSub}>
                  {totalSessions >= 20
                    ? 'Wow, you\'re a drawing superstar! 🌈'
                    : totalSessions >= 10
                    ? 'Amazing progress! Keep it up!'
                    : totalSessions >= 5
                    ? 'Great start! You\'re doing fantastic!'
                    : 'Keep drawing, you\'re doing great!'}
                </Text>
              </View>
            </View>
          </>
        )}

        {/* Status banners */}
        {activeChild.status === 'Complete' && (
          <View style={styles.completeBanner}>
            <Text style={styles.completeBannerEmoji}>🎉</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.completeBannerTitle}>Therapy Complete!</Text>
              <Text style={styles.completeBannerSub}>
                You've finished your therapy journey. Amazing work! Check your past drawings in the Journal.
              </Text>
            </View>
          </View>
        )}

        {activeChild.status === 'Inactive' && (
          <View style={styles.inactiveBanner}>
            <Ionicons name="pause-circle-outline" size={24} color="#92400e" />
            <View style={{ flex: 1 }}>
              <Text style={styles.inactiveBannerTitle}>Sessions Paused</Text>
              <Text style={styles.inactiveBannerSub}>Your drawing sessions are currently paused. Check with your therapist.</Text>
            </View>
          </View>
        )}

        {/* Drawing flow — hidden when Complete or Inactive */}
        {activeChild.status !== 'Complete' && activeChild.status !== 'Inactive' && (
          <>
            {/* Step 1 */}
            <View style={styles.stepHeader}>
              <View style={styles.stepBubble}>
                <Text style={styles.stepBubbleText}>1</Text>
              </View>
              <Text style={styles.stepLabel}>What will you draw?</Text>
            </View>

            <View style={styles.promptCol}>
              {(Object.keys(DRAWING_PROMPTS) as PromptType[]).map(type => {
                const p = DRAWING_PROMPTS[type];
                const isSelected = selectedPrompt === type;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[styles.promptCard, isSelected && { borderColor: p.color, borderWidth: 3, backgroundColor: p.lightColor }]}
                    onPress={() => setSelectedPrompt(type)}
                    activeOpacity={0.82}
                  >
                    <View style={[styles.promptIconWrap, { backgroundColor: isSelected ? p.color : p.lightColor }]}>
                      <Ionicons name={p.icon as any} size={26} color={isSelected ? '#fff' : p.color} />
                    </View>
                    <View style={styles.promptText}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                        <Text style={[styles.promptCardTitle, { color: isSelected ? p.color : C.text }]}>{p.title}</Text>
                        {type === 'house' && (
                          <View style={[styles.htpBadge, { backgroundColor: isSelected ? p.color : p.lightColor }]}>
                            <Text style={[styles.htpBadgeText, { color: isSelected ? '#fff' : p.color }]}>HTP</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.promptCardDesc}>{p.desc}</Text>
                      {isSelected && (
                        <View style={[styles.tipRow, { backgroundColor: p.color + '18' }]}>
                          <Text style={[styles.tipText, { color: p.color }]}>💡 {p.tip}</Text>
                        </View>
                      )}
                    </View>
                    {isSelected
                      ? <View style={[styles.checkCircle, { backgroundColor: p.color }]}>
                          <Ionicons name="checkmark" size={15} color={C.white} />
                        </View>
                      : <Ionicons name="chevron-forward" size={20} color={C.borderMed} />
                    }
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Step 2 */}
            <View style={styles.stepHeader}>
              <View style={[styles.stepBubble, !selectedPrompt && styles.stepBubbleOff]}>
                <Text style={styles.stepBubbleText}>2</Text>
              </View>
              <Text style={[styles.stepLabel, !selectedPrompt && { color: C.textMuted }]}>
                Upload your drawing
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.uploadBtn, !selectedPrompt && styles.uploadBtnDisabled]}
              onPress={openMoodCheck}
              activeOpacity={0.85}
              disabled={!selectedPrompt}
            >
              <Ionicons name="camera-outline" size={28} color={selectedPrompt ? C.white : C.textMuted} />
              <View>
                <Text style={[styles.uploadBtnTitle, !selectedPrompt && { color: C.textMuted }]}>Upload Photo</Text>
                <Text style={[styles.uploadBtnSub, !selectedPrompt && { color: C.textMuted }]}>Take a photo or choose from gallery</Text>
              </View>
            </TouchableOpacity>
          </>
        )}

        {/* Journal link */}
        <TouchableOpacity style={styles.journalLink} onPress={() => router.push('/child/journal')}>
          <Ionicons name="book-outline" size={18} color={C.textSub} />
          <Text style={styles.journalLinkText}>See my past drawings</Text>
          <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
        </TouchableOpacity>

      </ScrollView>

      <ChildNav />

      {/* Pre-draw mood modal */}
      <Modal visible={pendingMethod} transparent animationType="slide" onRequestClose={() => setPendingMethod(false)}>
        <Pressable style={moodStyles.backdrop} onPress={() => setPendingMethod(false)}>
          <Pressable style={moodStyles.sheet} onPress={() => {}}>
            <View style={moodStyles.handle} />
            <View style={moodStyles.iconWrap}>
              <Ionicons name="heart-outline" size={28} color={C.primary} />
            </View>
            <Text style={moodStyles.title}>How are you feeling{'\n'}right now?</Text>
            <Text style={moodStyles.subtitle}>Tap the one that feels most like you</Text>
            <View style={moodStyles.emotionRow}>
              {(['happy', 'sad', 'angry', 'anxious'] as const).map(e => {
                const ec = EMOTION_COLORS[e];
                const selected = preMood === e;
                return (
                  <TouchableOpacity
                    key={e}
                    style={[moodStyles.emotionBtn, selected && { borderColor: ec.text, backgroundColor: ec.card }]}
                    onPress={() => setPreMood(e)}
                    activeOpacity={0.8}
                  >
                    <EmotionIcon emotion={e} size={40} />
                    <Text style={[moodStyles.emotionLabel, selected && { color: ec.text, fontWeight: '700' }]}>
                      {e.charAt(0).toUpperCase() + e.slice(1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              style={[moodStyles.okayBtn, preMood === 'okay' && moodStyles.okayBtnSelected]}
              onPress={() => setPreMood('okay')}
              activeOpacity={0.8}
            >
              <EmotionIcon emotion="okay" size={26} />
              <Text style={[moodStyles.okayLabel, preMood === 'okay' && moodStyles.okayLabelSelected]}>
                Just okay / Neither
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[moodStyles.goBtn, !preMood && { opacity: 0.4 }]}
              onPress={confirmMoodAndNavigate}
              disabled={!preMood}
              activeOpacity={0.85}
            >
              <Ionicons name="camera-outline" size={20} color={C.white} />
              <Text style={moodStyles.goBtnText}>Let's Go!</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={confirmMoodAndNavigate} style={moodStyles.skipBtn}>
              <Text style={moodStyles.skipText}>Skip for now</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFF8F0' },

  topBar: {
    backgroundColor: C.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 52, paddingBottom: 16, paddingHorizontal: 20,
  },
  exitBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  exitText: { fontSize: 14, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
  topBarTitle: { fontSize: 17, fontWeight: '800', color: C.white },

  content: { paddingHorizontal: 18, paddingBottom: 40, paddingTop: 16, gap: 0 },
  contentWide: { maxWidth: MAX_W, alignSelf: 'center', width: '100%' },

  // Hero card
  heroCard: {
    backgroundColor: '#FFE4F0',
    borderRadius: 24, padding: 22,
    alignItems: 'center', marginBottom: 24,
    borderWidth: 2, borderColor: '#F9A8C9',
  },
  heroIconWrap: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center',
    marginBottom: 10, shadowColor: C.primary, shadowOpacity: 0.15, shadowRadius: 8, elevation: 2,
  },
  heroTitle: { fontSize: 30, fontWeight: '900', color: C.primary, marginBottom: 2 },
  heroSub: { fontSize: 15, color: '#b5306a', fontWeight: '600', marginBottom: 12 },
  heroBadgeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  streakBadge: {
    backgroundColor: '#FFF7ED', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6,
    borderWidth: 1.5, borderColor: '#FED7AA',
  },
  streakBadgeText: { fontSize: 13, fontWeight: '700', color: '#C2410C' },
  moodBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
  },
  moodBadgeText: { fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },

  // Steps
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  stepBubble: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center',
  },
  stepBubbleOff: { backgroundColor: C.borderMed },
  stepBubbleText: { fontSize: 13, fontWeight: '900', color: C.white },
  stepLabel: { fontSize: 15, fontWeight: '800', color: C.text },

  // Prompt cards
  promptCol: { gap: 12, marginBottom: 26 },
  promptCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: C.white, borderRadius: 22,
    padding: 16, borderWidth: 2, borderColor: '#F0E6FF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  promptIconWrap: {
    width: 58, height: 58, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  promptText: { flex: 1, gap: 3 },
  promptCardTitle: { fontSize: 17, fontWeight: '900', color: C.text },
  promptCardDesc: { fontSize: 13, color: C.textSub, lineHeight: 18 },
  tipRow: { flexDirection: 'row', padding: 8, borderRadius: 10, marginTop: 6 },
  tipText: { fontSize: 12, flex: 1, lineHeight: 17, fontWeight: '600' },
  checkCircle: {
    width: 28, height: 28, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },

  // Upload button
  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: C.primary, borderRadius: 22,
    paddingVertical: 20, paddingHorizontal: 24,
    marginBottom: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  uploadBtnDisabled: { backgroundColor: '#e5e7eb' },
  uploadBtnTitle: { fontSize: 16, fontWeight: '900', color: C.white },
  uploadBtnSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '500', marginTop: 2 },

  // Status banners
  completeBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#f0fdf4', borderRadius: 18, padding: 16,
    borderWidth: 2, borderColor: '#86efac', marginBottom: 20,
  },
  completeBannerEmoji: { fontSize: 28, lineHeight: 34 },
  completeBannerTitle: { fontSize: 16, fontWeight: '800', color: '#166534', marginBottom: 3 },
  completeBannerSub: { fontSize: 13, color: '#15803d', lineHeight: 18 },

  inactiveBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#fffbeb', borderRadius: 18, padding: 16,
    borderWidth: 2, borderColor: '#fcd34d', marginBottom: 20,
  },
  inactiveBannerTitle: { fontSize: 15, fontWeight: '800', color: '#92400e', marginBottom: 3 },
  inactiveBannerSub: { fontSize: 13, color: '#b45309', lineHeight: 18 },

  // HTP badge
  htpBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  htpBadgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },

  // Journal link
  journalLink: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, gap: 8, borderRadius: 18,
    backgroundColor: C.white,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  journalLinkText: { fontSize: 14, color: C.textSub, fontWeight: '600', flex: 1, textAlign: 'center' },
});

const chartStyles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 22, padding: 18, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
    borderWidth: 1.5, borderColor: '#F0E6FF',
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16,
  },
  cardIconPill: {
    width: 42, height: 42, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  cardTitle: { fontSize: 16, fontWeight: '900', color: C.text, marginBottom: 2 },
  cardSub: { fontSize: 12, color: C.textSub, lineHeight: 17 },

  barRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10,
  },
  barLabel: { fontSize: 12, fontWeight: '700', color: C.textSub, width: 52 },
  barTrack: {
    flex: 1, height: 14, borderRadius: 7,
    backgroundColor: '#f3f4f6', flexDirection: 'row', overflow: 'hidden',
  },
  barFill: { borderRadius: 7, minWidth: 10 },
  barCount: { fontSize: 13, fontWeight: '800', color: C.textMuted, width: 22, textAlign: 'right' },

  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  weekCol: { alignItems: 'center', gap: 6, flex: 1 },
  weekDot: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  weekDayLabel: { fontSize: 10, fontWeight: '700', color: C.textMuted },

  milestoneCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#FFF7ED', borderRadius: 20, padding: 16,
    borderWidth: 2, borderColor: '#FED7AA', marginBottom: 16,
  },
  milestoneIconWrap: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: '#FFEDD5', justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  milestoneTitle: { fontSize: 16, fontWeight: '900', color: '#C2410C', marginBottom: 2 },
  milestoneSub: { fontSize: 13, color: '#92400e', lineHeight: 18 },
});

const moodStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFF8F0', borderTopLeftRadius: 32, borderTopRightRadius: 32,
    paddingHorizontal: 24, paddingTop: 14, paddingBottom: 36, alignItems: 'center',
  },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: '#F9A8C9', marginBottom: 12 },
  iconWrap: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#FFE4F0', justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  title: { fontSize: 24, fontWeight: '900', color: C.text, textAlign: 'center', lineHeight: 32, marginBottom: 6 },
  subtitle: { fontSize: 14, color: C.textSub, marginBottom: 22, textAlign: 'center' },
  emotionRow: { flexDirection: 'row', gap: 10, marginBottom: 14, flexWrap: 'wrap', justifyContent: 'center' },
  emotionBtn: {
    width: 76, alignItems: 'center', gap: 7, paddingVertical: 14,
    borderRadius: 20, borderWidth: 2.5, borderColor: C.border, backgroundColor: C.white,
  },
  emotionLabel: { fontSize: 12, fontWeight: '600', color: C.textSub, textTransform: 'capitalize' },
  okayBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    width: '100%', paddingVertical: 13, paddingHorizontal: 20,
    borderRadius: 16, borderWidth: 2, borderColor: C.border,
    backgroundColor: C.white, marginBottom: 20, justifyContent: 'center',
  },
  okayBtnSelected: { borderColor: C.textMuted, backgroundColor: '#f3f4f6' },
  okayLabel: { fontSize: 14, fontWeight: '600', color: C.textMuted },
  okayLabelSelected: { color: C.text, fontWeight: '700' },
  goBtn: {
    backgroundColor: C.primary, borderRadius: 18, paddingVertical: 16, width: '100%',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10,
  },
  goBtnText: { fontSize: 18, fontWeight: '900', color: C.white },
  skipBtn: { paddingVertical: 8 },
  skipText: { fontSize: 13, color: C.textMuted },
});
