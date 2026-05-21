import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Modal, Pressable, ScrollView, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { C, EMOTION_COLORS, SHADOW } from '../constants/theme';

const NAVY = '#1A1F3C';
import { EmotionIcon } from './EmotionIcon';
import { useApp } from '../contexts/AppContext';

type PromptType = 'self' | 'house';
type Step = 'category' | 'mood';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TABS: { label: string; active: IoniconName; inactive: IoniconName; path: string }[] = [
  { label: 'Home',    active: 'home',    inactive: 'home-outline',    path: '/child/home'    },
  { label: 'Draw',    active: 'brush',   inactive: 'brush-outline',   path: '/child/draw'    },
  { label: 'Journal', active: 'book',    inactive: 'book-outline',    path: '/child/journal' },
  { label: 'Badges',  active: 'ribbon',  inactive: 'ribbon-outline',  path: '/child/rewards' },
];

const PROMPTS: Record<PromptType, { icon: IoniconName; title: string; desc: string; color: string; light: string }> = {
  self: {
    icon: 'person',
    title: 'Draw Yourself',
    desc: 'Draw a picture of YOU — how you look and feel right now.',
    color: C.primary,
    light: C.primaryLight,
  },
  house: {
    icon: 'home',
    title: 'Draw Your House',
    desc: 'Draw a picture of your home — inside or outside.',
    color: '#7c3aed',
    light: '#ede9fe',
  },
};

export function ChildNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { unreadBadgeCount, activeChild } = useApp();

  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<Step>('category');
  const [prompt, setPrompt] = useState<PromptType | null>(null);
  const [preMood, setPreMood] = useState<string | null>(null);

  function openDrawModal() {
    if (activeChild?.status === 'Complete') {
      Alert.alert(
        '🎉 Therapy Complete!',
        "Your therapy journey is complete. Great job! You can still look back at your drawings in the Journal.",
        [{ text: 'OK' }]
      );
      return;
    }
    if (activeChild?.status === 'Inactive') {
      Alert.alert(
        'Sessions Paused',
        'Your drawing sessions are currently paused. Please check with your therapist.',
        [{ text: 'OK' }]
      );
      return;
    }
    setStep('category');
    setPrompt(null);
    setPreMood(null);
    setVisible(true);
  }

  function handleTabPress(tab: typeof TABS[0]) {
    if (tab.label === 'Draw') {
      openDrawModal();
    } else {
      router.push(tab.path as any);
    }
  }

  function goToMood() {
    if (!prompt) return;
    setStep('mood');
  }

  function startDrawing() {
    router.push({ pathname: '/child/upload' as any, params: { promptType: prompt!, preMood: preMood ?? '' } });
    setVisible(false);
  }

  return (
    <>
      <View style={styles.container}>
        {TABS.map(tab => {
          const active = pathname === tab.path;
          return (
            <TouchableOpacity
              key={tab.path}
              style={styles.tab}
              onPress={() => handleTabPress(tab)}
              activeOpacity={0.7}
            >
              <View style={[styles.pill, active && styles.pillActive]}>
                <View style={{ position: 'relative' }}>
                  <Ionicons
                    name={active ? tab.active : tab.inactive}
                    size={20}
                    color={active ? NAVY : C.textMuted}
                  />
                  {tab.label === 'Badges' && unreadBadgeCount > 0 && (
                    <View style={styles.badgeDot} />
                  )}
                </View>
                {active && <Text style={styles.pillLabel}>{tab.label}</Text>}
              </View>
              {!active && <Text style={styles.inactiveLabel}>{tab.label}</Text>}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Draw modal ────────────────────────────────────────── */}
      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
        <Pressable style={modal.backdrop} onPress={() => setVisible(false)}>
          <Pressable style={modal.sheet} onPress={() => {}}>
            <View style={modal.handle} />

            {step === 'category' ? (
              /* ── Step 1: Category + Method ─────────────────── */
              <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                <Text style={modal.title}>What will you draw?</Text>
                <Text style={modal.subtitle}>Pick a topic for your drawing</Text>

                {/* Category cards */}
                <View style={modal.promptList}>
                  {(Object.keys(PROMPTS) as PromptType[]).map(key => {
                    const p = PROMPTS[key];
                    const selected = prompt === key;
                    return (
                      <TouchableOpacity
                        key={key}
                        style={[modal.promptCard, selected && { borderColor: p.color, backgroundColor: p.light }]}
                        onPress={() => setPrompt(key)}
                        activeOpacity={0.82}
                      >
                        <View style={[modal.promptIcon, { backgroundColor: selected ? p.color : C.base }]}>
                          <Ionicons name={p.icon} size={26} color={selected ? C.white : p.color} />
                        </View>
                        <View style={modal.promptInfo}>
                          <Text style={[modal.promptTitle, selected && { color: p.color }]}>{p.title}</Text>
                          <Text style={modal.promptDesc}>{p.desc}</Text>
                        </View>
                        {selected
                          ? <View style={[modal.check, { backgroundColor: p.color }]}>
                              <Ionicons name="checkmark" size={13} color={C.white} />
                            </View>
                          : <Ionicons name="chevron-forward" size={16} color={C.borderMed} />
                        }
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Next */}
                <TouchableOpacity
                  style={[modal.nextBtn, !prompt && { opacity: 0.4 }]}
                  onPress={goToMood}
                  disabled={!prompt}
                  activeOpacity={0.85}
                >
                  <Text style={modal.nextBtnText}>Next →  How are you feeling?</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : (
              /* ── Step 2: Mood check-in ──────────────────────── */
              <>
                <TouchableOpacity style={modal.backRow} onPress={() => setStep('category')}>
                  <Ionicons name="chevron-back" size={16} color={C.primary} />
                  <Text style={modal.backText}>Change topic</Text>
                </TouchableOpacity>

                <Text style={modal.title}>How are you feeling{'\n'}right now?</Text>
                <Text style={modal.subtitle}>Tap the one that feels most like you</Text>

                <View style={mood.emotionRow}>
                  {(['happy', 'sad', 'angry', 'anxious'] as const).map(e => {
                    const ec = EMOTION_COLORS[e];
                    const selected = preMood === e;
                    return (
                      <TouchableOpacity
                        key={e}
                        style={[mood.emotionBtn, selected && { borderColor: ec.text, backgroundColor: ec.card }]}
                        onPress={() => setPreMood(e)}
                        activeOpacity={0.8}
                      >
                        <EmotionIcon emotion={e} size={38} />
                        <Text style={[mood.emotionLabel, selected && { color: ec.text, fontWeight: '700' }]}>
                          {e.charAt(0).toUpperCase() + e.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  style={[mood.okayBtn, preMood === 'okay' && mood.okayBtnSelected]}
                  onPress={() => setPreMood('okay')}
                  activeOpacity={0.8}
                >
                  <EmotionIcon emotion="okay" size={24} />
                  <Text style={[mood.okayLabel, preMood === 'okay' && mood.okayLabelSelected]}>
                    Just okay · Neither
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[mood.goBtn, !preMood && { opacity: 0.4 }]}
                  onPress={startDrawing}
                  disabled={!preMood}
                  activeOpacity={0.85}
                >
                  <Ionicons name="camera-outline" size={18} color={C.white} />
                  <Text style={mood.goBtnText}>Let's Go!</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={startDrawing} style={mood.skipBtn}>
                  <Text style={mood.skipText}>Skip for now</Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: C.white,
    paddingBottom: 26,
    paddingTop: 10,
    paddingHorizontal: 16,
    ...SHADOW.md,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20 },
  pillActive: { backgroundColor: 'rgba(26,31,60,0.08)' },
  pillLabel: { fontSize: 13, fontWeight: '700', color: NAVY },
  inactiveLabel: { fontSize: 10, fontWeight: '500', color: C.textMuted },
  badgeDot: {
    position: 'absolute', top: -3, right: -5,
    width: 9, height: 9, borderRadius: 5,
    backgroundColor: '#ef4444', borderWidth: 1.5, borderColor: C.white,
  },
});

const modal = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFF8F0', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 36,
    maxHeight: '88%',
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#F9A8C9', alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '800', color: C.text, marginBottom: 4, lineHeight: 30 },
  subtitle: { fontSize: 14, color: C.textSub, marginBottom: 20 },

  promptList: { gap: 10, marginBottom: 22 },
  promptCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.white, borderRadius: 18,
    padding: 14, borderWidth: 2, borderColor: '#F0E6FF',
  },
  promptIcon: { width: 50, height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  promptInfo: { flex: 1, gap: 2 },
  promptTitle: { fontSize: 15, fontWeight: '800', color: C.text },
  promptDesc: { fontSize: 12, color: C.textSub, lineHeight: 17 },
  check: { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },

  nextBtn: {
    backgroundColor: C.primary, borderRadius: 18, paddingVertical: 16,
    alignItems: 'center',
  },
  nextBtnText: { fontSize: 15, fontWeight: '700', color: C.white },

  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 16 },
  backText: { fontSize: 13, fontWeight: '600', color: C.primary },
});

const mood = StyleSheet.create({
  emotionRow: { flexDirection: 'row', gap: 10, marginBottom: 14, flexWrap: 'wrap', justifyContent: 'center' },
  emotionBtn: {
    width: 74, alignItems: 'center', gap: 7, paddingVertical: 12,
    borderRadius: 18, borderWidth: 2, borderColor: C.border, backgroundColor: C.white,
  },
  emotionLabel: { fontSize: 12, fontWeight: '500', color: C.textSub, textTransform: 'capitalize' },
  okayBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    width: '100%', paddingVertical: 12, paddingHorizontal: 20,
    borderRadius: 18, borderWidth: 2, borderColor: C.border,
    backgroundColor: C.white, marginBottom: 18, justifyContent: 'center',
  },
  okayBtnSelected: { borderColor: C.textMuted, backgroundColor: '#f3f4f6' },
  okayLabel: { fontSize: 14, fontWeight: '600', color: C.textMuted },
  okayLabelSelected: { color: C.text, fontWeight: '700' },
  goBtn: {
    backgroundColor: C.primary, borderRadius: 18, paddingVertical: 16, width: '100%',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10,
  },
  goBtnText: { fontSize: 16, fontWeight: '700', color: C.white },
  skipBtn: { paddingVertical: 8, alignItems: 'center' },
  skipText: { fontSize: 13, color: C.textMuted },
});
