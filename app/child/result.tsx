import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Easing, ScrollView, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { C, MAX_W, EMOTION_COLORS, SHADOW } from '../../constants/theme';
import { EmotionIcon } from '../../components/EmotionIcon';

type Emotion = 'happy' | 'sad' | 'angry' | 'anxious';

const EMOTION_DATA: Record<Emotion, {
  label: string; bg: string;
  textColor: string; message: string; subMessage: string;
  showBreathing: boolean;
}> = {
  happy: {
    label: 'HAPPY!', bg: '#fffbeb',
    textColor: '#92400e',
    message: "You're glowing with happiness!",
    subMessage: "That's wonderful. Keep spreading that smile! ✨",
    showBreathing: false,
  },
  sad: {
    label: 'SAD', bg: '#eff6ff',
    textColor: '#1e40af',
    message: "It's okay to feel sad.",
    subMessage: "You're brave for sharing your feelings. We're here for you. 💙",
    showBreathing: false,
  },
  angry: {
    label: 'ANGRY', bg: '#fff1f2',
    textColor: '#991b1b',
    message: "Feeling angry is totally normal.",
    subMessage: "Let's take some deep breaths together to feel better. 🌬️",
    showBreathing: true,
  },
  anxious: {
    label: 'ANXIOUS', bg: '#f5f3ff',
    textColor: '#5b21b6',
    message: "You're safe and loved.",
    subMessage: "Everything is going to be okay. Let's breathe together. 💜",
    showBreathing: true,
  },
};

const EMOTION_ORDER: Emotion[] = ['happy', 'sad', 'angry', 'anxious'];

function BreathingExercise({ color }: { color: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const [phase, setPhase] = useState<'in' | 'out'>('in');
  const phaseRef = useRef<'in' | 'out'>('in');

  useEffect(() => {
    let active = true;
    function breatheCycle() {
      if (!active) return;
      const nextPhase = phaseRef.current === 'in' ? 'out' : 'in';
      Animated.timing(scale, {
        toValue: nextPhase === 'in' ? 1.5 : 1,
        duration: 3500,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start(() => {
        if (!active) return;
        phaseRef.current = nextPhase;
        setPhase(nextPhase);
        breatheCycle();
      });
    }
    breatheCycle();
    return () => { active = false; };
  }, []);

  return (
    <View style={breatheStyles.container}>
      <Text style={breatheStyles.title}>Let's breathe together</Text>
      <View style={breatheStyles.circleWrapper}>
        <Animated.View style={[breatheStyles.circle, { backgroundColor: color + '33', transform: [{ scale }] }]}>
          <View style={[breatheStyles.innerCircle, { backgroundColor: color + '66' }]}>
            <Text style={breatheStyles.phaseText}>{phase === 'in' ? 'Breathe\nin...' : 'Breathe\nout...'}</Text>
          </View>
        </Animated.View>
      </View>
      <Text style={breatheStyles.hint}>Follow the circle · 3 deep breaths</Text>
    </View>
  );
}

function EmotionBar({ emotion, pct, isTop }: { emotion: Emotion; pct: number; isTop: boolean }) {
  const anim = useRef(new Animated.Value(0)).current;
  const ec = EMOTION_COLORS[emotion];

  useEffect(() => {
    Animated.timing(anim, {
      toValue: pct,
      duration: 900,
      delay: EMOTION_ORDER.indexOf(emotion) * 120,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [pct]);

  const width = anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

  return (
    <View style={barStyles.row}>
      <View style={barStyles.emojiBox}>
        <EmotionIcon emotion={emotion} size={20} />
      </View>
      <View style={barStyles.barTrack}>
        <Animated.View style={[
          barStyles.barFill,
          { width, backgroundColor: ec.text },
          isTop && barStyles.barFillTop,
        ]} />
      </View>
      <Text style={[barStyles.pct, isTop && { color: ec.text, fontWeight: '800' }]}>
        {pct}%
      </Text>
    </View>
  );
}

export default function ResultScreen() {
  const { emotion, scores: scoresParam, preMood, therapistMessage } = useLocalSearchParams<{
    emotion: string; scores: string; preMood: string; therapistMessage: string;
  }>();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const dominantEmotion = (emotion as Emotion) ?? 'happy';
  const data = EMOTION_DATA[dominantEmotion];

  // Parse scores from route param; fall back to 100% dominant if missing
  const scores: Record<Emotion, number> = (() => {
    if (scoresParam) {
      try { return JSON.parse(scoresParam); } catch {}
    }
    const fallback = { happy: 0, sad: 0, angry: 0, anxious: 0 };
    fallback[dominantEmotion] = 100;
    return fallback;
  })();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, easing: Easing.out(Easing.exp), useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: data.bg }]}
      contentContainerStyle={styles.content}
    >
      <Animated.View style={[
        styles.inner,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        width >= 768 && { maxWidth: MAX_W, alignSelf: 'center', width: '100%' },
      ]}>
        {/* Emoji */}
        <View style={styles.emojiWrapper}>
          <EmotionIcon emotion={dominantEmotion} size={64} />
        </View>

        {/* Header message */}
        <View style={[styles.resultCard, { backgroundColor: EMOTION_COLORS[dominantEmotion].card }]}>
          <Text style={styles.resultLabel}>Your drawing shows you feel mostly...</Text>
          <Text style={[styles.emotionLabel, { color: data.textColor }]}>{data.label}</Text>
          <View style={[styles.messageDivider, { backgroundColor: data.textColor + '33' }]} />
          <Text style={[styles.message, { color: data.textColor }]}>{data.message}</Text>
          <Text style={[styles.subMessage, { color: data.textColor + 'cc' }]}>{data.subMessage}</Text>
        </View>

        {/* Therapist insight card */}
        {(therapistMessage || preMood) ? (
          <View style={styles.therapistCard}>
            <View style={styles.therapistHeader}>
              <View style={styles.therapistIconCircle}>
                <Ionicons name="heart" size={16} color={C.primary} />
              </View>
              <View style={styles.therapistTitleGroup}>
                <Text style={styles.therapistBadge}>Virtual Therapist</Text>
                <Text style={styles.therapistTitle}>A Note For You</Text>
              </View>
            </View>

            {preMood ? (
              <View style={styles.moodCompareRow}>
                <View style={styles.moodPill}>
                  <Text style={styles.moodPillLabel}>You felt</Text>
                  <EmotionIcon emotion={preMood} size={18} />
                  <Text style={styles.moodPillEmotion}>{preMood.charAt(0).toUpperCase() + preMood.slice(1)}</Text>
                </View>
                <Ionicons name="arrow-forward" size={14} color={C.textMuted} />
                <View style={styles.moodPill}>
                  <Text style={styles.moodPillLabel}>Drawing shows</Text>
                  <EmotionIcon emotion={dominantEmotion} size={18} />
                  <Text style={styles.moodPillEmotion}>{dominantEmotion.charAt(0).toUpperCase() + dominantEmotion.slice(1)}</Text>
                </View>
              </View>
            ) : null}

            {therapistMessage ? (
              <Text style={styles.therapistMessage}>{therapistMessage}</Text>
            ) : null}
          </View>
        ) : null}

        {/* Emotion percentage breakdown */}
        <View style={styles.scoresCard}>
          <Text style={styles.scoresTitle}>Emotion Breakdown</Text>
          <Text style={styles.scoresSubtitle}>Based on your drawing's colors, shapes, and themes</Text>
          <View style={styles.barsContainer}>
            {EMOTION_ORDER.map(e => (
              <EmotionBar
                key={e}
                emotion={e}
                pct={scores[e] ?? 0}
                isTop={e === dominantEmotion}
              />
            ))}
          </View>
          <Text style={styles.scoresDisclaimer}>
            Emotions are complex — this is a guide, not a diagnosis.
          </Text>
        </View>

        {/* Breathing exercise for angry/anxious */}
        {data.showBreathing && (
          <View style={[styles.breathingCard, { borderColor: data.textColor + '33' }]}>
            <BreathingExercise color={data.textColor} />
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.drawAgainBtn}
            onPress={() => router.replace('/child/draw')}
            activeOpacity={0.85}
          >
            <Ionicons name="brush-outline" size={18} color={C.text} />
            <Text style={styles.drawAgainText}>Draw Again</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.doneBtn, { backgroundColor: data.textColor }]}
            onPress={() => router.replace('/child/home')}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark-outline" size={18} color={C.white} />
            <Text style={styles.doneBtnText}>I'm Done</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.journalLink}
          onPress={() => router.replace('/child/journal')}
        >
          <Ionicons name="book-outline" size={16} color={C.textSub} />
          <Text style={styles.journalLinkText}>See all my drawings</Text>
        </TouchableOpacity>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 44, paddingBottom: 40 },
  inner: { alignItems: 'center' },

  emojiWrapper: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: C.white,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
    ...SHADOW.lg,
  },
  resultCard: {
    width: '100%', borderRadius: 20, padding: 18,
    alignItems: 'center', marginBottom: 12,
  },
  resultLabel: { fontSize: 13, color: '#6b7280', marginBottom: 6 },
  emotionLabel: { fontSize: 34, fontWeight: '800', marginBottom: 12, textTransform: 'uppercase' },
  messageDivider: { height: 1, width: 40, marginBottom: 12 },
  message: { fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  subMessage: { fontSize: 14, textAlign: 'center', lineHeight: 21 },

  therapistCard: {
    width: '100%', backgroundColor: C.white,
    borderRadius: 18, padding: 16, marginBottom: 12,
    borderLeftWidth: 3, borderLeftColor: C.primary,
    ...SHADOW.sm,
  },
  therapistHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  therapistIconCircle: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: C.primaryLight, justifyContent: 'center', alignItems: 'center',
  },
  therapistTitleGroup: { gap: 1 },
  therapistBadge: { fontSize: 10, fontWeight: '700', color: C.primary, textTransform: 'uppercase', letterSpacing: 0.8 },
  therapistTitle: { fontSize: 15, fontWeight: '800', color: C.text },

  moodCompareRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 12, flexWrap: 'wrap',
  },
  moodPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.base, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 9,
    borderWidth: 1, borderColor: C.border,
  },
  moodPillLabel: { fontSize: 10, color: C.textMuted, fontWeight: '600' },
  moodPillEmotion: { fontSize: 12, fontWeight: '700', color: C.text, textTransform: 'capitalize' },

  therapistMessage: { fontSize: 14, color: C.textSub, lineHeight: 22 },

  scoresCard: {
    width: '100%', backgroundColor: C.white,
    borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: C.border,
    ...SHADOW.sm,
  },
  scoresTitle: { fontSize: 15, fontWeight: '800', color: C.text, marginBottom: 3 },
  scoresSubtitle: { fontSize: 12, color: C.textMuted, marginBottom: 14 },
  barsContainer: { gap: 10 },
  scoresDisclaimer: {
    fontSize: 11, color: C.textMuted, marginTop: 12,
    textAlign: 'center', fontStyle: 'italic',
  },

  breathingCard: {
    width: '100%', backgroundColor: C.white,
    borderRadius: 16, borderWidth: 1, borderColor: C.border,
    marginBottom: 12, paddingVertical: 4,
    ...SHADOW.sm,
  },

  actions: { flexDirection: 'row', gap: 10, width: '100%', marginBottom: 10 },
  drawAgainBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    backgroundColor: C.white, alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
    flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  drawAgainText: { fontSize: 15, fontWeight: '600', color: C.text },
  doneBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  doneBtnText: { fontSize: 15, fontWeight: '700', color: C.white },

  journalLink: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, gap: 6, width: '100%', borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  journalLinkText: { fontSize: 14, color: C.textSub, fontWeight: '500' },
});

const barStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  emojiBox: { width: 28, alignItems: 'center' },
  barTrack: {
    flex: 1, height: 10, borderRadius: 5,
    backgroundColor: C.base, overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 5, opacity: 0.7 },
  barFillTop: { opacity: 1 },
  pct: { width: 38, fontSize: 13, color: C.textMuted, textAlign: 'right' },
});

const breatheStyles = StyleSheet.create({
  container: { width: '100%', alignItems: 'center', paddingVertical: 20 },
  title: { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 22 },
  circleWrapper: { width: 200, height: 200, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  circle: {
    width: 130, height: 130, borderRadius: 65,
    justifyContent: 'center', alignItems: 'center',
  },
  innerCircle: {
    width: 90, height: 90, borderRadius: 45,
    justifyContent: 'center', alignItems: 'center',
  },
  phaseText: { fontSize: 13, fontWeight: '700', color: C.white, textAlign: 'center' },
  hint: { fontSize: 13, color: C.textMuted },
});
