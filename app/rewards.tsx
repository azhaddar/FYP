import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Image,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../lib/supabaseClient";
import { useApp } from "../contexts/AppContext";
import { Patient, Sketch } from "../types";
import { C, SHADOW } from "../constants/theme";
import { ParentShell } from "../components/ParentShell";
import {
  BADGES,
  BadgeDef,
  computeEarnedBadges,
  getSeenBadgeIds,
  markBadgesSeen,
} from "../utils/badges";

const NAVY = "#1A1F3C";
const GOLD = "#f59e0b";
const PARTICLE_COLORS = [
  "#e13d7d",
  "#f59e0b",
  "#06b6d4",
  "#8b5cf6",
  "#f97316",
  "#10b981",
];
const PARTICLE_COUNT = 12;

// ── Monster definitions ────────────────────────────────────────────────────────

type MonsterType = "fire" | "water" | "grass";

const MONSTER_DEFS: Record<
  MonsterType,
  {
    label: string;
    color: string;
    egg: any;
    stages: { id: number; name: string; gif: any; starsNeeded: number; desc: string }[];
  }
> = {
  fire: {
    label: "Fire",
    color: "#f97316",
    egg: require("../assets/gifs/egg-fire.gif"),
    stages: [
      { id: 1, name: "Embyr",  gif: require("../assets/gifs/fire-stage1.gif"), starsNeeded: 0,  desc: "The spark of potential" },
      { id: 2, name: "Burny",  gif: require("../assets/gifs/fire-stage2.gif"), starsNeeded: 10, desc: "Growing stronger with every drawing" },
      { id: 3, name: "Flamy",  gif: require("../assets/gifs/fire-stage3.gif"), starsNeeded: 25, desc: "A blazing champion" },
    ],
  },
  water: {
    label: "Water",
    color: "#06b6d4",
    egg: require("../assets/gifs/egg-water.gif"),
    stages: [
      { id: 1, name: "Dropi",   gif: require("../assets/gifs/water-stage1.gif"), starsNeeded: 0,  desc: "A tiny drop of wonder" },
      { id: 2, name: "Wavey",   gif: require("../assets/gifs/water-stage2.gif"), starsNeeded: 10, desc: "Riding the waves of progress" },
      { id: 3, name: "Tidalon", gif: require("../assets/gifs/water-stage3.gif"), starsNeeded: 25, desc: "Master of the deep" },
    ],
  },
  grass: {
    label: "Grass",
    color: "#10b981",
    egg: require("../assets/gifs/egg-grass.gif"),
    stages: [
      { id: 1, name: "Sproutie", gif: require("../assets/gifs/grass-stage1.gif"), starsNeeded: 0,  desc: "A tiny seed of creativity" },
      { id: 2, name: "Buddie",   gif: require("../assets/gifs/grass-stage2.gif"), starsNeeded: 10, desc: "Blooming with every drawing" },
      { id: 3, name: "Floron",   gif: require("../assets/gifs/grass-stage3.gif"), starsNeeded: 25, desc: "A radiant guardian of nature" },
    ],
  },
};

const COOKIE_GIF = require("../assets/gifs/cookie.gif");

function MonsterDexModal({
  fedCount,
  stages,
  onClose,
}: {
  fedCount: number;
  stages: typeof MONSTER_DEFS.fire.stages;
  onClose: () => void;
}) {
  const slideY = useRef(new Animated.Value(400)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(slideY, { toValue: 0, friction: 8, tension: 90, useNativeDriver: true }),
    ]).start();
  }, []);

  function handleClose() {
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(slideY, { toValue: 400, duration: 220, useNativeDriver: true }),
    ]).start(() => onClose());
  }

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={handleClose}>
      <Animated.View style={[dex.backdrop, { opacity: backdropOpacity }]}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={handleClose} />
        <Animated.View style={[dex.sheet, { transform: [{ translateY: slideY }] }]}>
          <View style={dex.handle} />
          <Text style={dex.title}>Monster Evolution</Text>
          <Text style={dex.sub}>Feed cookies to evolve your companion</Text>

          <View style={dex.grid}>
            {stages.map((stage) => {
              const unlocked = fedCount >= stage.starsNeeded;
              const isCurrent =
                [...stages].reverse().find((s) => fedCount >= s.starsNeeded)?.id === stage.id;
              return (
                <View
                  key={stage.id}
                  style={[
                    dex.cell,
                    unlocked && dex.cellUnlocked,
                    isCurrent && dex.cellCurrent,
                  ]}
                >
                  {isCurrent && (
                    <View style={dex.currentBadge}>
                      <Text style={dex.currentBadgeText}>Current</Text>
                    </View>
                  )}
                  <View style={dex.imgWrap}>
                    <Image source={stage.gif} style={dex.img} />
                    {!unlocked && <View style={dex.silhouette} />}
                  </View>
                  <Text style={[dex.stageName, !unlocked && dex.stageNameLocked]}>
                    {unlocked ? stage.name : "???"}
                  </Text>
                  <Text style={dex.stageDesc} numberOfLines={2}>
                    {stage.desc}
                  </Text>
                  {!unlocked && (
                    <View style={dex.lockRow}>
                      <Image source={COOKIE_GIF} style={{ width: 11, height: 11 }} />
                      <Text style={dex.lockText}>{stage.starsNeeded} feeds</Text>
                    </View>
                  )}
                  {unlocked && (
                    <View style={dex.unlockedTag}>
                      <Ionicons name="checkmark-circle" size={11} color="#10b981" />
                      <Text style={dex.unlockedText}>Unlocked</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ── Egg Picker Modal ───────────────────────────────────────────────────────────

function EggPickerModal({
  onConfirm,
}: {
  onConfirm: (type: MonsterType) => void;
}) {
  const [selected, setSelected] = useState<MonsterType | null>(null);
  const [confirming, setConfirming] = useState(false);
  const scale = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 7, tension: 80, useNativeDriver: true }),
    ]).start();
  }, []);

  const EGGS: { type: MonsterType; label: string; color: string; gif: any }[] = [
    { type: "fire",  label: "Fire",  color: "#f97316", gif: MONSTER_DEFS.fire.egg  },
    { type: "water", label: "Water", color: "#06b6d4", gif: MONSTER_DEFS.water.egg },
    { type: "grass", label: "Grass", color: "#10b981", gif: MONSTER_DEFS.grass.egg },
  ];

  if (confirming && selected) {
    const def = MONSTER_DEFS[selected];
    return (
      <Modal visible transparent animationType="fade" statusBarTranslucent>
        <View style={egg.backdrop}>
          <View style={egg.confirmCard}>
            <Image source={def.egg} style={{ width: 80, height: 80 }} />
            <Text style={egg.confirmTitle}>Choose {def.label} egg?</Text>
            <Text style={egg.confirmSub}>
              Your companion will hatch as{" "}
              <Text style={{ fontWeight: "900", color: def.color }}>
                {def.stages[0].name}
              </Text>
              .{"\n"}This choice is permanent!
            </Text>
            <View style={egg.btnRow}>
              <TouchableOpacity
                style={egg.cancelBtn}
                onPress={() => setConfirming(false)}
                activeOpacity={0.8}
              >
                <Text style={egg.cancelText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[egg.confirmBtn, { backgroundColor: def.color }]}
                onPress={() => onConfirm(selected)}
                activeOpacity={0.85}
              >
                <Text style={egg.confirmText}>Confirm!</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[egg.backdrop, { opacity }]}>
        <Animated.View style={[egg.card, { transform: [{ scale }] }]}>
          <Text style={egg.title}>Choose Your Companion</Text>
          <Text style={egg.sub}>Pick an egg to start your adventure!</Text>

          <View style={egg.eggRow}>
            {EGGS.map((e) => {
              const active = selected === e.type;
              return (
                <TouchableOpacity
                  key={e.type}
                  style={[egg.eggCell, active && { borderColor: e.color, borderWidth: 3 }]}
                  onPress={() => setSelected(e.type)}
                  activeOpacity={0.85}
                >
                  {active && (
                    <View style={[egg.eggCheck, { backgroundColor: e.color }]}>
                      <Ionicons name="checkmark" size={10} color="#fff" />
                    </View>
                  )}
                  <Image source={e.gif} style={{ width: 72, height: 72 }} />
                  <Text style={[egg.eggLabel, active && { color: e.color }]}>{e.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[egg.chooseBtn, !selected && egg.chooseBtnDisabled]}
            onPress={() => selected && setConfirming(true)}
            disabled={!selected}
            activeOpacity={0.85}
          >
            <Text style={egg.chooseBtnText}>Choose Egg</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ── Congrats Modal ─────────────────────────────────────────────────────────────

function CongratsModal({
  monsterType,
  onDismiss,
}: {
  monsterType: MonsterType;
  onDismiss: () => void;
}) {
  const def = MONSTER_DEFS[monsterType];
  const firstName = def.stages[0].name;
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 100, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[congrats.backdrop, { opacity }]}>
        <Animated.View style={[congrats.card, { transform: [{ scale }] }]}>
          <View style={[congrats.ring, { borderColor: def.color + "55" }]}>
            <View style={[congrats.circle, { backgroundColor: def.color + "22" }]}>
              <Image source={def.stages[0].gif} style={{ width: 96, height: 96 }} />
            </View>
          </View>
          <View style={[congrats.tag, { backgroundColor: def.color + "20" }]}>
            <Ionicons name="sparkles" size={12} color={def.color} />
            <Text style={[congrats.tagText, { color: def.color }]}>New Companion!</Text>
          </View>
          <Text style={congrats.title}>Congratulations!</Text>
          <Text style={congrats.msg}>
            Your pet friend is{" "}
            <Text style={{ fontWeight: "900", color: def.color }}>{firstName}</Text>!
            {"\n"}Earn cookies to help them evolve!
          </Text>
          <TouchableOpacity
            style={[congrats.btn, { backgroundColor: def.color }]}
            onPress={onDismiss}
            activeOpacity={0.85}
          >
            <Text style={congrats.btnText}>Let's Go!</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ── Celebration Modal ──────────────────────────────────────────────────────────

function CelebrationModal({
  badge,
  onDismiss,
}: {
  badge: BadgeDef;
  onDismiss: () => void;
}) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const particles = useRef(
    Array.from({ length: PARTICLE_COUNT }, () => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      opacity: new Animated.Value(0),
    })),
  ).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 5,
        tension: 120,
        useNativeDriver: true,
      }),
    ]).start(() => {
      const anims = particles.map((p, i) => {
        const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
        const dist = 80 + (i % 3) * 18;
        p.opacity.setValue(1);
        return Animated.parallel([
          Animated.timing(p.x, {
            toValue: dist * Math.cos(angle),
            duration: 520,
            useNativeDriver: true,
          }),
          Animated.timing(p.y, {
            toValue: dist * Math.sin(angle),
            duration: 520,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.delay(180),
            Animated.timing(p.opacity, {
              toValue: 0,
              duration: 340,
              useNativeDriver: true,
            }),
          ]),
        ]);
      });
      Animated.stagger(25, anims).start();
    });
  }, []);

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[cel.backdrop, { opacity }]}>
        <Animated.View style={[cel.card, { transform: [{ scale }] }]}>
          <View style={cel.iconArea}>
            <View style={[cel.iconRing, { borderColor: badge.color + "33" }]}>
              <View style={[cel.iconCircle, { backgroundColor: badge.color }]}>
                <Ionicons name={badge.icon as any} size={50} color="#fff" />
              </View>
            </View>
            {particles.map((p, i) => (
              <Animated.View
                key={i}
                style={[
                  cel.particle,
                  {
                    backgroundColor:
                      PARTICLE_COLORS[i % PARTICLE_COLORS.length],
                    transform: [{ translateX: p.x }, { translateY: p.y }],
                    opacity: p.opacity,
                  },
                ]}
              />
            ))}
          </View>
          <View style={[cel.newTag, { backgroundColor: badge.color + "20" }]}>
            <Ionicons name="sparkles" size={11} color={badge.color} />
            <Text style={[cel.newTagText, { color: badge.color }]}>
              Badge Claimed!
            </Text>
          </View>
          <Text style={cel.badgeName}>{badge.name}</Text>
          <Text style={cel.badgeDesc}>{badge.desc}</Text>
          <TouchableOpacity
            style={[cel.btn, { backgroundColor: badge.color }]}
            onPress={onDismiss}
            activeOpacity={0.85}
          >
            <Text style={cel.btnText}>Awesome!</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ── Badge Cards ────────────────────────────────────────────────────────────────

const BASE_CARD: any = {
  width: "47.5%",
  backgroundColor: "#fff",
  borderRadius: 20,
  padding: 14,
  borderWidth: 2,
  alignItems: "center",
  gap: 6,
  ...SHADOW.sm,
};

function ClaimableBadgeCard({
  badge,
  onClaim,
}: {
  badge: BadgeDef;
  onClaim: () => void;
}) {
  const pulse = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.5,
          duration: 750,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <TouchableOpacity
      style={[claimCard.card, { borderColor: badge.color }]}
      onPress={onClaim}
      activeOpacity={0.88}
    >
      <Animated.View
        style={[
          claimCard.glowRing,
          { borderColor: badge.color, opacity: pulse },
        ]}
      />
      <View style={[claimCard.iconCircle, { backgroundColor: badge.color }]}>
        <Ionicons name={badge.icon as any} size={26} color="#fff" />
      </View>
      <Text style={[claimCard.name, { color: badge.color }]}>{badge.name}</Text>
      <Text style={claimCard.desc} numberOfLines={2}>
        {badge.desc}
      </Text>
      <View style={[claimCard.claimBtn, { backgroundColor: badge.color }]}>
        <Ionicons name="gift-outline" size={13} color="#fff" />
        <Text style={claimCard.claimBtnText}>Tap to Claim</Text>
      </View>
    </TouchableOpacity>
  );
}

function EarnedBadgeCard({ badge }: { badge: BadgeDef }) {
  return (
    <View
      style={[
        earnedCard.card,
        {
          borderColor: badge.color + "55",
          backgroundColor: badge.color + "10",
        },
      ]}
    >
      <View style={[earnedCard.iconCircle, { backgroundColor: badge.color }]}>
        <Ionicons name={badge.icon as any} size={26} color="#fff" />
      </View>
      <Text style={earnedCard.name}>{badge.name}</Text>
      <Text style={earnedCard.desc} numberOfLines={2}>
        {badge.desc}
      </Text>
      <View style={[earnedCard.tag, { backgroundColor: badge.color + "20" }]}>
        <Ionicons name="checkmark-circle" size={11} color={badge.color} />
        <Text style={[earnedCard.tagText, { color: badge.color }]}>Earned</Text>
      </View>
    </View>
  );
}

function LockedBadgeCard({
  badge,
  sketches,
}: {
  badge: BadgeDef;
  sketches: Sketch[];
}) {
  const prog = badge.progress ? badge.progress(sketches) : null;
  return (
    <View style={lockedCard.card}>
      <View style={lockedCard.iconCircle}>
        <Ionicons name={badge.icon as any} size={26} color="#9ca3af" />
        <View style={lockedCard.lockDot}>
          <Ionicons name="lock-closed" size={8} color="#fff" />
        </View>
      </View>
      <Text style={lockedCard.name}>{badge.name}</Text>
      <Text style={lockedCard.desc} numberOfLines={2}>
        {badge.desc}
      </Text>
      {prog && (
        <View style={lockedCard.progWrap}>
          <View style={lockedCard.progTrack}>
            <View
              style={[
                lockedCard.progFill,
                {
                  width: `${(prog.current / prog.total) * 100}%` as any,
                  backgroundColor: badge.color,
                },
              ]}
            />
          </View>
          <Text style={lockedCard.progText}>
            {prog.current}/{prog.total}
          </Text>
        </View>
      )}
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────

export default function RewardsScreen() {
  const { profile } = useApp();
  const router = useRouter();

  const [children, setChildren] = useState<Patient[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [sketches, setSketches] = useState<Sketch[]>([]);
  const [cookies, setCookies] = useState(0);
  const [fedCount, setFedCount] = useState(0);
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const [childrenLoading, setChildrenLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [celebration, setCelebration] = useState<BadgeDef | null>(null);
  const [showDex, setShowDex] = useState(false);
  const [monsterType, setMonsterType] = useState<MonsterType | null>(null);
  const [monsterLoading, setMonsterLoading] = useState(true);
  const [congratsType, setCongratsType] = useState<MonsterType | null>(null);

  // Load monster type when child changes
  useEffect(() => {
    if (!selectedChildId) { setMonsterType(null); setMonsterLoading(false); return; }
    setMonsterLoading(true);
    AsyncStorage.getItem(`monster_type_${selectedChildId}`)
      .then((v) => setMonsterType((v as MonsterType) ?? null))
      .catch(() => setMonsterType(null))
      .finally(() => setMonsterLoading(false));
  }, [selectedChildId]);

  async function handleChooseMonster(type: MonsterType) {
    if (!selectedChildId) return;
    await AsyncStorage.setItem(`monster_type_${selectedChildId}`, type);
    setMonsterType(type);
    setCongratsType(type);
  }

  // Fetch children on mount
  useEffect(() => {
    (async () => {
      if (!profile?.id) return;
      const { data } = await supabase
        .from("patients")
        .select(
          "id, full_name, age, gender, total_sketches, status, guardian_id, therapist_id",
        )
        .eq("guardian_id", profile.id)
        .order("full_name");
      const kids = (data ?? []) as Patient[];
      setChildren(kids);
      if (kids.length > 0) setSelectedChildId(kids[0].id);
      setChildrenLoading(false);
    })();
  }, [profile?.id]);

  // Load sketches + badges + cookie/fed data when child changes
  const loadChildData = useCallback(async (childId: string) => {
    setDataLoading(true);
    const [{ data: sk }, seen, cookieVal, fedVal] = await Promise.all([
      supabase
        .from("sketches")
        .select(
          "id, patient_id, emotion, created_at, notes, therapist_notes, image_url, scores, therapist_message, pre_mood, status, reviewed_at, verified_at",
        )
        .eq("patient_id", childId)
        .order("created_at", { ascending: false }),
      getSeenBadgeIds(childId),
      AsyncStorage.getItem(`cookies_${childId}`)
        .then((v) => (v ? parseInt(v, 10) : 0))
        .catch(() => 0),
      AsyncStorage.getItem(`fed_count_${childId}`)
        .then((v) => (v ? parseInt(v, 10) : 0))
        .catch(() => 0),
    ]);
    setSketches((sk ?? []) as Sketch[]);
    setSeenIds(seen);
    setCookies(cookieVal);
    setFedCount(fedVal);
    setDataLoading(false);
  }, []);

  useEffect(() => {
    if (selectedChildId) loadChildData(selectedChildId);
    else {
      setSketches([]);
      setSeenIds([]);
      setCookies(0);
      setFedCount(0);
    }
  }, [selectedChildId]);

  async function handleClaim(badge: BadgeDef) {
    if (!selectedChildId) return;
    setCelebration(badge);
    const newSeenIds = [...seenIds, badge.id];
    setSeenIds(newSeenIds);
    await markBadgesSeen(selectedChildId, newSeenIds);
  }

  async function handleFeedPet() {
    if (!selectedChildId || cookies <= 0) return;
    const nextCookies = cookies - 1;
    const nextFed = fedCount + 1;
    setCookies(nextCookies);
    setFedCount(nextFed);
    await Promise.all([
      AsyncStorage.setItem(`cookies_${selectedChildId}`, String(nextCookies)),
      AsyncStorage.setItem(`fed_count_${selectedChildId}`, String(nextFed)),
    ]);
  }

  const selectedChild = children.find((c) => c.id === selectedChildId);
  const firstName = selectedChild?.full_name.split(" ")[0] ?? "Child";

  const earnedBadges = computeEarnedBadges(sketches);
  const claimableBadges = earnedBadges.filter((b) => !seenIds.includes(b.id));
  const claimedBadges = earnedBadges.filter((b) => seenIds.includes(b.id));
  const lockedBadges = BADGES.filter((b) => !b.earned(sketches));
  const pct =
    BADGES.length > 0
      ? Math.round((earnedBadges.length / BADGES.length) * 100)
      : 0;

  // ── Empty / loading states ─────────────────────────────────────────────────

  if (childrenLoading) {
    return (
      <ParentShell>
        <View style={s.center}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      </ParentShell>
    );
  }

  if (children.length === 0) {
    return (
      <ParentShell>
        <View style={s.root}>
          <View style={s.header}>
            <Text style={s.headerTitle}>Rewards</Text>
          </View>
          <View style={s.center}>
            <Ionicons name="people-outline" size={56} color={C.borderMed} />
            <Text style={s.emptyTitle}>No children yet</Text>
            <Text style={s.emptyMsg}>
              Add a child first to start tracking their rewards.
            </Text>
          </View>
        </View>
      </ParentShell>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <ParentShell>
      <View style={s.root}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.headerRow}>
            <TouchableOpacity
              style={s.backBtn}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
            <View>
              <Text style={s.headerTitle}>Rewards</Text>
              <Text style={s.headerSub}>
                Track badges and celebrate progress
              </Text>
            </View>
          </View>
        </View>

        {/* Child selector pills */}
        {children.length > 1 && (
          <View style={s.chipRow}>
            {children.map((child) => {
              const active = child.id === selectedChildId;
              return (
                <TouchableOpacity
                  key={child.id}
                  style={[s.chip, active ? s.chipActive : s.chipInactive]}
                  onPress={() => setSelectedChildId(child.id)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.chipText, active && s.chipTextActive]}>
                    {child.full_name.split(" ")[0]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {dataLoading || monsterLoading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color={C.primary} />
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.scroll}
          >
            {/* Pet card */}
            <View style={s.starsCard}>
              <View style={s.starsLeft}>
                <Text style={s.starsLabel}>{firstName}'s Pet</Text>

                {/* Cookie count */}
                <View style={s.cookieRow}>
                  <Image source={COOKIE_GIF} style={{ width: 26, height: 26 }} />
                  <Text style={s.cookieCount}>{cookies}</Text>
                  <Text style={s.cookieUnit}> cookies</Text>
                </View>

                {/* Evolution progress meter */}
                {monsterType && (() => {
                  const stages = MONSTER_DEFS[monsterType].stages;
                  const currentStage = [...stages].reverse().find((st) => fedCount >= st.starsNeeded)!;
                  const nextStage = stages.find((st) => st.starsNeeded > fedCount);
                  if (!nextStage) {
                    return <Text style={s.fullyEvolvedText}>Fully evolved!</Text>;
                  }
                  const barPct = Math.min(
                    100,
                    Math.round(((fedCount - currentStage.starsNeeded) / (nextStage.starsNeeded - currentStage.starsNeeded)) * 100),
                  );
                  return (
                    <>
                      <View style={s.evoTrack}>
                        <View style={[s.evoFill, { width: `${barPct}%` as any }]} />
                      </View>
                      <Text style={s.evoText}>{fedCount}/{nextStage.starsNeeded} feeds to evolve</Text>
                    </>
                  );
                })()}

                {/* Feed button */}
                <TouchableOpacity
                  style={[s.feedBtn, cookies === 0 && s.feedBtnDisabled]}
                  onPress={handleFeedPet}
                  disabled={cookies === 0}
                  activeOpacity={0.8}
                >
                  <Image source={COOKIE_GIF} style={{ width: 15, height: 15 }} />
                  <Text style={s.feedBtnText}>
                    {cookies > 0 ? `Feed Pet (${cookies})` : "No cookies yet"}
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={s.starsIconWrap}
                onPress={() => monsterType && setShowDex(true)}
                activeOpacity={0.8}
              >
                {monsterType ? (
                  <Image
                    source={
                      [...MONSTER_DEFS[monsterType].stages]
                        .reverse()
                        .find((st) => fedCount >= st.starsNeeded)!.gif
                    }
                    style={{ width: 128, height: 128 }}
                  />
                ) : (
                  <Image
                    source={MONSTER_DEFS.fire.egg}
                    style={{ width: 80, height: 80, opacity: 0.5 }}
                  />
                )}
                <View style={s.tapHint}>
                  <Ionicons name="chevron-up" size={10} color="rgba(255,255,255,0.7)" />
                  <Text style={s.tapHintText}>Dex</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Badge progress bar */}
            <View style={s.progCard}>
              <View style={s.progHeader}>
                <Text style={s.progLabel}>Badge Progress</Text>
                <Text style={s.progPct}>
                  {earnedBadges.length} / {BADGES.length}
                </Text>
              </View>
              <View style={s.progTrack}>
                <View style={[s.progFill, { width: `${pct}%` as any }]} />
              </View>
            </View>

            {/* Claimable badges */}
            {claimableBadges.length > 0 && (
              <>
                <View style={s.sectionRow}>
                  <View style={s.claimDot} />
                  <Text style={s.claimTitle}>Ready to Claim!</Text>
                </View>
                <View style={s.grid}>
                  {claimableBadges.map((b) => (
                    <ClaimableBadgeCard
                      key={b.id}
                      badge={b}
                      onClaim={() => handleClaim(b)}
                    />
                  ))}
                </View>
              </>
            )}

            {/* Earned badges */}
            {claimedBadges.length > 0 && (
              <>
                <Text style={s.sectionTitle}>Earned</Text>
                <View style={s.grid}>
                  {claimedBadges.map((b) => (
                    <EarnedBadgeCard key={b.id} badge={b} />
                  ))}
                </View>
              </>
            )}

            {/* Locked badges */}
            {lockedBadges.length > 0 && (
              <>
                <Text style={s.sectionTitle}>
                  {earnedBadges.length === 0
                    ? "Start drawing to unlock badges"
                    : "Keep going"}
                </Text>
                <View style={s.grid}>
                  {lockedBadges.map((b) => (
                    <LockedBadgeCard key={b.id} badge={b} sketches={sketches} />
                  ))}
                </View>
              </>
            )}

            {earnedBadges.length === BADGES.length &&
              claimableBadges.length === 0 && (
                <View style={s.allEarned}>
                  <Ionicons name="trophy" size={26} color="#d97706" />
                  <Text style={s.allEarnedText}>
                    Every badge earned. Amazing!
                  </Text>
                </View>
              )}
          </ScrollView>
        )}
      </View>

      {celebration && (
        <CelebrationModal
          badge={celebration}
          onDismiss={() => setCelebration(null)}
        />
      )}

      {!monsterType && !monsterLoading && selectedChildId && (
        <EggPickerModal onConfirm={handleChooseMonster} />
      )}

      {congratsType && (
        <CongratsModal
          monsterType={congratsType}
          onDismiss={() => setCongratsType(null)}
        />
      )}

      {showDex && monsterType && (
        <MonsterDexModal
          fedCount={fedCount}
          stages={MONSTER_DEFS[monsterType].stages}
          onClose={() => setShowDex(false)}
        />
      )}
    </ParentShell>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5F7FF" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    padding: 32,
  },

  header: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 20,
    backgroundColor: NAVY,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
    alignSelf: "center",
  },
  headerTitle: { fontSize: 26, fontWeight: "800", color: "#fff" },
  headerSub: { fontSize: 13, color: "rgba(255,255,255,0.65)", marginTop: 2 },

  chipRow: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chipInactive: { backgroundColor: "#fff", borderColor: "#E5E7EB" },
  chipActive: { backgroundColor: NAVY, borderColor: NAVY },
  chipText: { fontSize: 13, fontWeight: "600", color: "#374151" },
  chipTextActive: { color: "#fff" },

  scroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40, gap: 0 },

  // Pet / cookie card
  starsCard: {
    backgroundColor: NAVY,
    borderRadius: 20,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
    ...SHADOW.md,
  },
  starsLeft: { gap: 6, paddingTop: 4, flex: 1 },
  starsLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "600",
  },
  cookieRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  cookieCount: { fontSize: 36, fontWeight: "900", color: GOLD, lineHeight: 40 },
  cookieUnit: { fontSize: 14, fontWeight: "600", color: "rgba(255,255,255,0.7)", alignSelf: "flex-end", paddingBottom: 4 },

  evoTrack: {
    height: 6, borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.15)",
    overflow: "hidden", marginRight: 12, marginTop: 2,
  },
  evoFill: { height: "100%", borderRadius: 3, backgroundColor: GOLD },
  evoText: { fontSize: 10, color: "rgba(255,255,255,0.55)", fontWeight: "600", marginTop: 2 },
  fullyEvolvedText: { fontSize: 11, color: GOLD, fontWeight: "700", marginTop: 2 },

  feedBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6,
    backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 7,
    alignSelf: "flex-start",
  },
  feedBtnDisabled: { opacity: 0.45 },
  feedBtnText: { fontSize: 12, fontWeight: "700", color: "#fff" },

  starsIconWrap: { opacity: 0.9, marginRight: -8, alignItems: "center", marginLeft: 8 },
  tapHint: {
    flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2,
  },
  tapHintText: { fontSize: 10, fontWeight: "700", color: "rgba(255,255,255,0.65)" },

  // Progress bar
  progCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    ...SHADOW.sm,
  },
  progHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  progLabel: { fontSize: 13, fontWeight: "700", color: NAVY },
  progPct: { fontSize: 13, fontWeight: "700", color: C.primary },
  progTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F0F0F8",
    overflow: "hidden",
  },
  progFill: { height: "100%", borderRadius: 4, backgroundColor: C.primary },

  // Section headers
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  claimDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ef4444",
  },
  claimTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: "#ef4444",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: C.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 12,
    marginTop: 4,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 24 },

  allEarned: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fef3c7",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    borderColor: "#fde68a",
  },
  allEarnedText: { flex: 1, fontSize: 15, fontWeight: "700", color: "#92400e" },

  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: C.text,
    textAlign: "center",
  },
  emptyMsg: {
    fontSize: 14,
    color: C.textSub,
    textAlign: "center",
    lineHeight: 20,
  },
});

const claimCard = StyleSheet.create({
  card: { ...BASE_CARD, borderWidth: 2.5, overflow: "visible" },
  glowRing: {
    position: "absolute",
    top: -5,
    left: -5,
    right: -5,
    bottom: -5,
    borderRadius: 25,
    borderWidth: 3,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
  },
  name: { fontSize: 13, fontWeight: "900", textAlign: "center" },
  desc: { fontSize: 11, color: C.textSub, textAlign: "center", lineHeight: 16 },
  claimBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 2,
  },
  claimBtnText: { fontSize: 11, fontWeight: "900", color: "#fff" },
});

const earnedCard = StyleSheet.create({
  card: { ...BASE_CARD },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
  },
  name: { fontSize: 13, fontWeight: "800", color: C.text, textAlign: "center" },
  desc: { fontSize: 11, color: C.textSub, textAlign: "center", lineHeight: 16 },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 2,
  },
  tagText: { fontSize: 10, fontWeight: "800" },
});

const lockedCard = StyleSheet.create({
  card: { ...BASE_CARD, borderColor: "#F0E6FF" },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#e5e7eb",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
  },
  lockDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#9ca3af",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  name: {
    fontSize: 13,
    fontWeight: "800",
    color: C.textMuted,
    textAlign: "center",
  },
  desc: { fontSize: 11, color: C.textSub, textAlign: "center", lineHeight: 16 },
  progWrap: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  progTrack: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#e5e7eb",
    overflow: "hidden",
  },
  progFill: { height: "100%", borderRadius: 3 },
  progText: { fontSize: 10, fontWeight: "700", color: C.textMuted },
});

const cel = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 28,
    padding: 28,
    alignItems: "center",
    width: "100%",
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  iconArea: {
    width: 140,
    height: 140,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  iconRing: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 3,
    justifyContent: "center",
    alignItems: "center",
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  particle: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    left: 65,
    top: 65,
  },
  newTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
  },
  newTagText: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  badgeName: {
    fontSize: 26,
    fontWeight: "900",
    color: C.text,
    textAlign: "center",
  },
  badgeDesc: {
    fontSize: 14,
    color: C.textSub,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 6,
  },
  btn: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: "center",
    marginTop: 4,
  },
  btnText: { fontSize: 18, fontWeight: "900", color: "#fff" },
});

const dex = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 40,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: "#D1D5DB",
    alignSelf: "center", marginBottom: 18,
  },
  title: { fontSize: 20, fontWeight: "900", color: NAVY, textAlign: "center" },
  sub: { fontSize: 13, color: C.textSub, textAlign: "center", marginTop: 4, marginBottom: 20 },

  grid: { flexDirection: "row", gap: 10 },
  cell: {
    flex: 1, borderRadius: 18, borderWidth: 2, borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB", padding: 12,
    alignItems: "center", gap: 6, overflow: "hidden",
  },
  cellUnlocked: { borderColor: "#fde68a", backgroundColor: "#fffbeb" },
  cellCurrent: { borderColor: GOLD, borderWidth: 2.5 },

  currentBadge: {
    backgroundColor: GOLD, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 2, marginBottom: 2,
  },
  currentBadgeText: { fontSize: 9, fontWeight: "900", color: NAVY },

  imgWrap: { width: 80, height: 80, position: "relative" },
  img: { width: 80, height: 80 },
  silhouette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10,8,15,0.88)",
    borderRadius: 8,
  },

  stageName: { fontSize: 13, fontWeight: "800", color: NAVY, textAlign: "center" },
  stageNameLocked: { color: "#9CA3AF" },
  stageDesc: { fontSize: 10, color: C.textSub, textAlign: "center", lineHeight: 14 },

  lockRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  lockText: { fontSize: 10, fontWeight: "700", color: "#9CA3AF" },

  unlockedTag: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#d1fae5", borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  unlockedText: { fontSize: 10, fontWeight: "800", color: "#065f46" },
});

const egg = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center", alignItems: "center", padding: 28,
  },
  card: {
    backgroundColor: "#fff", borderRadius: 28, padding: 28,
    alignItems: "center", width: "100%", gap: 10,
  },
  title: { fontSize: 22, fontWeight: "900", color: NAVY, textAlign: "center" },
  sub: { fontSize: 13, color: C.textSub, textAlign: "center" },
  eggRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  eggCell: {
    flex: 1, borderRadius: 18, borderWidth: 2, borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB", paddingVertical: 14,
    alignItems: "center", gap: 6, position: "relative",
  },
  eggCheck: {
    position: "absolute", top: 6, right: 6,
    width: 18, height: 18, borderRadius: 9,
    justifyContent: "center", alignItems: "center",
  },
  eggLabel: { fontSize: 12, fontWeight: "700", color: "#6B7280" },
  chooseBtn: {
    width: "100%", paddingVertical: 16, borderRadius: 16,
    alignItems: "center", backgroundColor: NAVY, marginTop: 4,
  },
  chooseBtnDisabled: { backgroundColor: "#9CA3AF" },
  chooseBtnText: { fontSize: 16, fontWeight: "800", color: "#fff" },
  confirmCard: {
    backgroundColor: "#fff", borderRadius: 24, padding: 28,
    alignItems: "center", gap: 10, margin: 28,
  },
  confirmTitle: { fontSize: 20, fontWeight: "900", color: NAVY },
  confirmSub: { fontSize: 13, color: C.textSub, textAlign: "center", lineHeight: 20 },
  btnRow: { flexDirection: "row", gap: 10, width: "100%", marginTop: 4 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: "center",
    backgroundColor: "#F5F5F8", borderWidth: 1.5, borderColor: "#E5E7EB",
  },
  cancelText: { fontSize: 15, fontWeight: "700", color: C.textSub },
  confirmBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: "center",
  },
  confirmText: { fontSize: 15, fontWeight: "800", color: "#fff" },
});

const congrats = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center", alignItems: "center", padding: 28,
  },
  card: {
    backgroundColor: "#fff", borderRadius: 28, padding: 28,
    alignItems: "center", width: "100%", gap: 10,
  },
  ring: {
    width: 140, height: 140, borderRadius: 70,
    borderWidth: 3, justifyContent: "center", alignItems: "center",
    marginBottom: 4,
  },
  circle: {
    width: 116, height: 116, borderRadius: 58,
    justifyContent: "center", alignItems: "center",
  },
  tag: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20,
  },
  tagText: { fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 },
  title: { fontSize: 26, fontWeight: "900", color: NAVY },
  msg: { fontSize: 14, color: C.textSub, textAlign: "center", lineHeight: 22, marginBottom: 4 },
  btn: { width: "100%", paddingVertical: 16, borderRadius: 18, alignItems: "center" },
  btnText: { fontSize: 18, fontWeight: "900", color: "#fff" },
});
