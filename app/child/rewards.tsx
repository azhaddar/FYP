import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Modal, TouchableOpacity,
  useWindowDimensions, ActivityIndicator, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabaseClient';
import { useApp } from '../../contexts/AppContext';
import { Sketch } from '../../types';
import { C, MAX_W } from '../../constants/theme';
import { ChildNav } from '../../components/ChildNav';
import {
  BADGES, BadgeDef, computeEarnedBadges,
  getSeenBadgeIds, markBadgesSeen,
} from '../../utils/badges';

const PARTICLE_COLORS = ['#e13d7d', '#f59e0b', '#06b6d4', '#8b5cf6', '#f97316', '#10b981'];
const PARTICLE_COUNT = 12;

function CelebrationModal({ badge, onDismiss }: { badge: BadgeDef; onDismiss: () => void }) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const particles = useRef(
    Array.from({ length: PARTICLE_COUNT }, () => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      opacity: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
    ]).start(() => {
      const anims = particles.map((p, i) => {
        const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
        const dist = 80 + (i % 3) * 18;
        p.opacity.setValue(1);
        return Animated.parallel([
          Animated.timing(p.x, { toValue: dist * Math.cos(angle), duration: 520, useNativeDriver: true }),
          Animated.timing(p.y, { toValue: dist * Math.sin(angle), duration: 520, useNativeDriver: true }),
          Animated.sequence([
            Animated.delay(180),
            Animated.timing(p.opacity, { toValue: 0, duration: 340, useNativeDriver: true }),
          ]),
        ]);
      });
      Animated.stagger(25, anims).start();
    });
  }, []);

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[celebStyles.backdrop, { opacity }]}>
        <Animated.View style={[celebStyles.card, { transform: [{ scale }] }]}>
          <View style={celebStyles.iconArea}>
            <View style={[celebStyles.iconRing, { borderColor: badge.color + '33' }]}>
              <View style={[celebStyles.iconCircle, { backgroundColor: badge.color }]}>
                <Ionicons name={badge.icon as any} size={50} color="#fff" />
              </View>
            </View>
            {particles.map((p, i) => (
              <Animated.View
                key={i}
                style={[
                  celebStyles.particle,
                  {
                    backgroundColor: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
                    transform: [{ translateX: p.x }, { translateY: p.y }],
                    opacity: p.opacity,
                  },
                ]}
              />
            ))}
          </View>
          <View style={[celebStyles.newTag, { backgroundColor: badge.color + '20' }]}>
            <Ionicons name="sparkles" size={11} color={badge.color} />
            <Text style={[celebStyles.newTagText, { color: badge.color }]}>Badge Claimed!</Text>
          </View>
          <Text style={celebStyles.badgeName}>{badge.name}</Text>
          <Text style={celebStyles.badgeDesc}>{badge.desc}</Text>
          <TouchableOpacity
            style={[celebStyles.btn, { backgroundColor: badge.color }]}
            onPress={onDismiss}
            activeOpacity={0.85}
          >
            <Text style={celebStyles.btnText}>Awesome!</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

function ClaimableBadgeCard({ badge, onClaim }: { badge: BadgeDef; onClaim: () => void }) {
  const pulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 750, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <TouchableOpacity
      style={[claimCardStyles.card, { borderColor: badge.color }]}
      onPress={onClaim}
      activeOpacity={0.88}
    >
      {/* Pulsing glow ring */}
      <Animated.View style={[
        claimCardStyles.glowRing,
        { borderColor: badge.color, opacity: pulse },
      ]} />

      <View style={[claimCardStyles.iconCircle, { backgroundColor: badge.color }]}>
        <Ionicons name={badge.icon as any} size={26} color="#fff" />
      </View>

      <Text style={[claimCardStyles.name, { color: badge.color }]}>{badge.name}</Text>
      <Text style={claimCardStyles.desc} numberOfLines={2}>{badge.desc}</Text>

      <View style={[claimCardStyles.claimBtn, { backgroundColor: badge.color }]}>
        <Ionicons name="gift-outline" size={13} color="#fff" />
        <Text style={claimCardStyles.claimBtnText}>Tap to Claim</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function RewardsScreen() {
  const { activeChild, setUnreadBadgeCount } = useApp();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [sketches, setSketches] = useState<Sketch[]>([]);
  const [loading, setLoading] = useState(true);
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const [celebration, setCelebration] = useState<BadgeDef | null>(null);

  useEffect(() => {
    if (!activeChild) { router.replace('/dashboard'); return; }
    fetchData();
  }, [activeChild]);

  async function fetchData() {
    if (!activeChild) return;
    const { data } = await supabase
      .from('sketches')
      .select('emotion, created_at')
      .eq('patient_id', activeChild.id)
      .order('created_at', { ascending: false });

    const fetched = (data ?? []) as Sketch[];
    setSketches(fetched);

    const loadedSeenIds = await getSeenBadgeIds(activeChild.id);
    setSeenIds(loadedSeenIds);

    // Clear the nav dot now that user has opened the page
    setUnreadBadgeCount(0);
    setLoading(false);
  }

  async function handleClaim(badge: BadgeDef) {
    if (!activeChild) return;
    setCelebration(badge);
    const newSeenIds = [...seenIds, badge.id];
    setSeenIds(newSeenIds);
    await markBadgesSeen(activeChild.id, newSeenIds);
  }

  if (!activeChild) return null;

  const firstName = activeChild.full_name.split(' ')[0];
  const earnedBadges = computeEarnedBadges(sketches);
  const claimableBadges = earnedBadges.filter(b => !seenIds.includes(b.id));
  const claimedBadges = earnedBadges.filter(b => seenIds.includes(b.id));
  const lockedBadges = BADGES.filter(b => !b.earned(sketches));
  const pct = Math.round((earnedBadges.length / BADGES.length) * 100);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{firstName}'s Badges</Text>
        <Text style={styles.headerSub}>{earnedBadges.length} of {BADGES.length} earned</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct}%` as any }]} />
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            width >= 768 && { maxWidth: MAX_W, alignSelf: 'center', width: '100%' },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Claimable — shown first, most prominent */}
          {claimableBadges.length > 0 && (
            <>
              <View style={styles.claimHeader}>
                <View style={styles.claimDot} />
                <Text style={styles.claimTitle}>Ready to Claim!</Text>
              </View>
              <View style={styles.grid}>
                {claimableBadges.map(b => (
                  <ClaimableBadgeCard key={b.id} badge={b} onClaim={() => handleClaim(b)} />
                ))}
              </View>
            </>
          )}

          {/* Already claimed */}
          {claimedBadges.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Earned</Text>
              <View style={styles.grid}>
                {claimedBadges.map(b => (
                  <EarnedBadgeCard key={b.id} badge={b} />
                ))}
              </View>
            </>
          )}

          {/* Locked */}
          {lockedBadges.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>
                {earnedBadges.length === 0 ? 'Start drawing to unlock badges' : 'Keep going'}
              </Text>
              <View style={styles.grid}>
                {lockedBadges.map(b => (
                  <LockedBadgeCard key={b.id} badge={b} sketches={sketches} />
                ))}
              </View>
            </>
          )}

          {earnedBadges.length === BADGES.length && claimableBadges.length === 0 && (
            <View style={styles.allEarnedBanner}>
              <Ionicons name="trophy" size={26} color="#d97706" />
              <Text style={styles.allEarnedText}>You have earned every badge. Amazing!</Text>
            </View>
          )}
        </ScrollView>
      )}

      <ChildNav />

      {celebration && (
        <CelebrationModal badge={celebration} onDismiss={() => setCelebration(null)} />
      )}
    </View>
  );
}

function EarnedBadgeCard({ badge }: { badge: BadgeDef }) {
  return (
    <View style={[earnedCardStyles.card, { borderColor: badge.color + '55', backgroundColor: badge.color + '10' }]}>
      <View style={[earnedCardStyles.iconCircle, { backgroundColor: badge.color }]}>
        <Ionicons name={badge.icon as any} size={26} color="#fff" />
      </View>
      <Text style={earnedCardStyles.name}>{badge.name}</Text>
      <Text style={earnedCardStyles.desc} numberOfLines={2}>{badge.desc}</Text>
      <View style={[earnedCardStyles.tag, { backgroundColor: badge.color + '20' }]}>
        <Ionicons name="checkmark-circle" size={11} color={badge.color} />
        <Text style={[earnedCardStyles.tagText, { color: badge.color }]}>Earned</Text>
      </View>
    </View>
  );
}

function LockedBadgeCard({ badge, sketches }: { badge: BadgeDef; sketches: Sketch[] }) {
  const prog = badge.progress ? badge.progress(sketches) : null;
  return (
    <View style={lockedCardStyles.card}>
      <View style={lockedCardStyles.iconCircle}>
        <Ionicons name={badge.icon as any} size={26} color="#9ca3af" />
        <View style={lockedCardStyles.lockDot}>
          <Ionicons name="lock-closed" size={8} color="#fff" />
        </View>
      </View>
      <Text style={lockedCardStyles.name}>{badge.name}</Text>
      <Text style={lockedCardStyles.desc} numberOfLines={2}>{badge.desc}</Text>
      {prog && (
        <View style={lockedCardStyles.progWrap}>
          <View style={lockedCardStyles.progTrack}>
            <View style={[lockedCardStyles.progFill, { width: `${(prog.current / prog.total) * 100}%` as any, backgroundColor: badge.color }]} />
          </View>
          <Text style={lockedCardStyles.progText}>{prog.current}/{prog.total}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFF8F0' },
  header: {
    backgroundColor: C.primary,
    paddingTop: 52, paddingBottom: 22, paddingHorizontal: 24,
  },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#fff', marginBottom: 2 },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '600', marginBottom: 12 },
  progressTrack: { height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: '#fff' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 18, paddingBottom: 40 },

  claimHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, marginTop: 4 },
  claimDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' },
  claimTitle: { fontSize: 13, fontWeight: '900', color: '#ef4444', textTransform: 'uppercase', letterSpacing: 0.8 },

  sectionTitle: {
    fontSize: 11, fontWeight: '800', color: C.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12, marginTop: 4,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  allEarnedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fef3c7', borderRadius: 16, padding: 18,
    borderWidth: 1.5, borderColor: '#fde68a',
  },
  allEarnedText: { flex: 1, fontSize: 15, fontWeight: '700', color: '#92400e' },
});

const BASE_CARD: any = {
  width: '47.5%', backgroundColor: '#fff',
  borderRadius: 20, padding: 14, borderWidth: 2,
  alignItems: 'center', gap: 6,
  shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
};

const claimCardStyles = StyleSheet.create({
  card: { ...BASE_CARD, borderWidth: 2.5, overflow: 'visible' },
  glowRing: {
    position: 'absolute', top: -5, left: -5, right: -5, bottom: -5,
    borderRadius: 25, borderWidth: 3,
  },
  iconCircle: {
    width: 60, height: 60, borderRadius: 30,
    justifyContent: 'center', alignItems: 'center', marginBottom: 2,
  },
  name: { fontSize: 13, fontWeight: '900', textAlign: 'center' },
  desc: { fontSize: 11, color: C.textSub, textAlign: 'center', lineHeight: 16 },
  claimBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginTop: 2,
  },
  claimBtnText: { fontSize: 11, fontWeight: '900', color: '#fff' },
});

const earnedCardStyles = StyleSheet.create({
  card: { ...BASE_CARD },
  iconCircle: {
    width: 60, height: 60, borderRadius: 30,
    justifyContent: 'center', alignItems: 'center', marginBottom: 2,
  },
  name: { fontSize: 13, fontWeight: '800', color: C.text, textAlign: 'center' },
  desc: { fontSize: 11, color: C.textSub, textAlign: 'center', lineHeight: 16 },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginTop: 2,
  },
  tagText: { fontSize: 10, fontWeight: '800' },
});

const lockedCardStyles = StyleSheet.create({
  card: { ...BASE_CARD, borderColor: '#F0E6FF' },
  iconCircle: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: '#e5e7eb',
    justifyContent: 'center', alignItems: 'center', marginBottom: 2,
  },
  lockDot: {
    position: 'absolute', bottom: 2, right: 2,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#9ca3af', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#fff',
  },
  name: { fontSize: 13, fontWeight: '800', color: C.textMuted, textAlign: 'center' },
  desc: { fontSize: 11, color: C.textSub, textAlign: 'center', lineHeight: 16 },
  progWrap: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  progTrack: { flex: 1, height: 5, borderRadius: 3, backgroundColor: '#e5e7eb', overflow: 'hidden' },
  progFill: { height: '100%', borderRadius: 3 },
  progText: { fontSize: 10, fontWeight: '700', color: C.textMuted },
});

const celebStyles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  card: {
    backgroundColor: '#fff', borderRadius: 28, padding: 28,
    alignItems: 'center', width: '100%', gap: 8,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 24, elevation: 12,
  },
  iconArea: { width: 140, height: 140, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  iconRing: {
    width: 112, height: 112, borderRadius: 56,
    borderWidth: 3, justifyContent: 'center', alignItems: 'center',
  },
  iconCircle: {
    width: 88, height: 88, borderRadius: 44,
    justifyContent: 'center', alignItems: 'center',
  },
  particle: {
    position: 'absolute', width: 10, height: 10, borderRadius: 5,
    left: 65, top: 65,
  },
  newTag: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20,
  },
  newTagText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  badgeName: { fontSize: 26, fontWeight: '900', color: C.text, textAlign: 'center' },
  badgeDesc: { fontSize: 14, color: C.textSub, textAlign: 'center', lineHeight: 20, marginBottom: 6 },
  btn: { width: '100%', paddingVertical: 16, borderRadius: 18, alignItems: 'center', marginTop: 4 },
  btnText: { fontSize: 18, fontWeight: '900', color: '#fff' },
});
