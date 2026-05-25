import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, Image, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const NAVY = '#1A1F3C';
const RED  = '#C0392B';

export default function AboutScreen() {
  const router = useRouter();
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <TouchableOpacity style={s.backRow} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={NAVY} />
          <Text style={s.backText}>Back</Text>
        </TouchableOpacity>

        {/* Book cover card */}
        <TouchableOpacity style={s.coverCard} onPress={() => setFullscreen(true)} activeOpacity={0.9}>
          <Image
            source={require('../assets/cover_page.png')}
            style={s.coverImage}
            resizeMode="cover"
          />
          <View style={s.coverDim} />
          <View style={s.coverOverlay}>
            <View style={s.coverBadge}>
              <Text style={s.coverBadgeText}>Core Methodology</Text>
            </View>
          </View>
          <View style={s.coverTapHint}>
            <Ionicons name="expand-outline" size={16} color="#fff" />
          </View>
        </TouchableOpacity>

        {/* Book credit */}
        <View style={s.bookCredit}>
          <Text style={s.bookTitle}>Pengamal Master AD-HTP</Text>
          <Text style={s.bookSubtitle}>Art Drawing — House, Tree & Person</Text>
          <View style={s.authorRow}>
            <Ionicons name="person-outline" size={12} color="#6b7280" />
            <Text style={s.authorText}>Mohd Radhi Abu Shahim</Text>
          </View>
          <View style={s.authorRow}>
            <Ionicons name="person-outline" size={12} color="#6b7280" />
            <Text style={s.authorText}>Mohammad Aziz Shah Mohamed Arip</Text>
          </View>
        </View>

        {/* Divider */}
        <View style={s.divider} />

        {/* App info */}
        <View style={s.appHeader}>
          <View style={s.appIconBox}>
            <Ionicons name="brush" size={22} color={NAVY} />
          </View>
          <View>
            <Text style={s.appName}>EmotiSketch</Text>
            <Text style={s.appVersion}>Version 1.0.0</Text>
          </View>
        </View>

        <Text style={s.appDesc}>
          EmotiSketch is a child emotional wellness app built on the AD-HTP
          (Art Drawing — House, Tree & Person) methodology. Children express
          their emotions through drawings, which are analysed using AI to help
          parents and therapists understand their emotional state.
        </Text>

        {/* Tech stack */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Powered By</Text>
          <View style={s.techCard}>
            <TechRow
              icon="sparkles-outline"
              color="#7C3AED"
              label="Claude AI"
              sub="Emotion detection & drawing analysis"
            />
            <View style={s.techDivider} />
            <TechRow
              icon="server-outline"
              color="#059669"
              label="Supabase"
              sub="Secure cloud backend & storage"
            />
            <View style={s.techDivider} />
            <TechRow
              icon="phone-portrait-outline"
              color="#0284C7"
              label="React Native + Expo"
              sub="Cross-platform mobile framework"
            />
          </View>
        </View>

        {/* Built for */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Built For</Text>
          <View style={s.techCard}>
            <TechRow
              icon="people-outline"
              color={NAVY}
              label="Parents"
              sub="Monitor children's emotional wellbeing"
            />
            <View style={s.techDivider} />
            <TechRow
              icon="medkit-outline"
              color={RED}
              label="Therapists"
              sub="Track progress and verify drawings"
            />
          </View>
        </View>

        <Text style={s.footer}>EmotiSketch · Final Year Project · 2025{'\n'}Powered by Claude AI</Text>
      </ScrollView>

      {/* Fullscreen cover modal */}
      <Modal visible={fullscreen} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setFullscreen(false)}>
        <TouchableOpacity style={s.fsBackdrop} activeOpacity={1} onPress={() => setFullscreen(false)}>
          <TouchableOpacity style={s.fsClose} onPress={() => setFullscreen(false)}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          <Image
            source={require('../assets/cover_page.png')}
            style={s.fsImage}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function TechRow({ icon, color, label, sub }: { icon: string; color: string; label: string; sub: string }) {
  return (
    <View style={t.row}>
      <View style={[t.iconBox, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <View style={t.body}>
        <Text style={t.label}>{label}</Text>
        <Text style={t.sub}>{sub}</Text>
      </View>
    </View>
  );
}

const t = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  iconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  body:    { flex: 1 },
  label:   { fontSize: 14, fontWeight: '700', color: NAVY },
  sub:     { fontSize: 11, color: '#6b7280', marginTop: 1 },
});

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#fff' },
  scroll: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 48 },

  backRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 28 },
  backText: { fontSize: 14, fontWeight: '600', color: NAVY },

  // Cover
  coverCard: {
    borderRadius: 20, overflow: 'hidden',
    height: 280, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18, shadowRadius: 16, elevation: 10,
  },
  coverImage:   { width: '100%', height: '100%' },
  coverDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  coverOverlay: {
    position: 'absolute', bottom: 12, left: 12,
  },
  coverTapHint: {
    position: 'absolute', top: 12, right: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
    width: 30, height: 30, borderRadius: 15,
    justifyContent: 'center', alignItems: 'center',
  },

  // Fullscreen
  fsBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center', alignItems: 'center',
  },
  fsClose: {
    position: 'absolute', top: 54, right: 20,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
    zIndex: 10,
  },
  fsImage: {
    width: '85%',
    height: '80%',
  },
  coverBadge: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20,
  },
  coverBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },

  // Book credit
  bookCredit:   { marginBottom: 20 },
  bookTitle:    { fontSize: 16, fontWeight: '800', color: NAVY, marginBottom: 2 },
  bookSubtitle: { fontSize: 13, color: '#6b7280', marginBottom: 8 },
  authorRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  authorText:   { fontSize: 12, color: '#6b7280' },

  divider: { height: 1, backgroundColor: '#F0F0F5', marginVertical: 20 },

  // App info
  appHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  appIconBox: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: '#EEF0FF',
    justifyContent: 'center', alignItems: 'center',
  },
  appName:    { fontSize: 20, fontWeight: '900', color: NAVY },
  appVersion: { fontSize: 12, color: '#6b7280', marginTop: 2 },

  appDesc: {
    fontSize: 14, color: '#374151', lineHeight: 22,
    marginBottom: 24,
  },

  // Sections
  section:      { marginBottom: 20 },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: '#9ca3af',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8,
  },
  techCard: {
    backgroundColor: '#FAFAFA', borderRadius: 16,
    borderWidth: 1, borderColor: '#F0F0F5',
    overflow: 'hidden',
  },
  techDivider: { height: 1, backgroundColor: '#F0F0F5', marginLeft: 64 },

  footer: {
    textAlign: 'center', fontSize: 11,
    color: '#9ca3af', lineHeight: 18, marginTop: 8,
  },
});
