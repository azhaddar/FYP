import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabaseClient';
import { useApp } from '../contexts/AppContext';
import { C, EMOTION_COLORS, SHADOW } from '../constants/theme';
import { ParentShell } from '../components/ParentShell';
import { Patient } from '../types';

const NAVY = '#1A1F3C';
const BG   = '#F2F2F7';

const EMOTION_LIST = ['happy', 'sad', 'angry', 'anxious'] as const;

interface SettingRow {
  icon: string;
  label: string;
  sub?: string;
  onPress?: () => void;
  danger?: boolean;
  chevron?: boolean;
}

export default function ProfileScreen() {
  const { profile, signOut } = useApp();
  const router = useRouter();

  const [email, setEmail]               = useState('');
  const [children, setChildren]         = useState<Patient[]>([]);
  const [lastEmotions, setLastEmotions] = useState<Record<string, string>>({});
  const [therapistNames, setTherapistNames] = useState<Record<string, string>>({});
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }

      setEmail(user.email ?? '');

      const { data: childData } = await supabase
        .from('patients')
        .select('*')
        .eq('guardian_id', user.id)
        .order('full_name');

      if (!childData?.length) { setChildren([]); return; }
      setChildren(childData);

      // Fetch last emotion per child
      const ids = childData.map(c => c.id);
      const { data: sketches } = await supabase
        .from('sketches')
        .select('patient_id, emotion')
        .in('patient_id', ids)
        .order('created_at', { ascending: false });

      if (sketches) {
        const map: Record<string, string> = {};
        sketches.forEach(s => { if (!map[s.patient_id]) map[s.patient_id] = s.emotion; });
        setLastEmotions(map);
      }

      // Fetch therapist names
      const therapistIds = [...new Set(childData.map(c => c.therapist_id).filter((id): id is string => !!id))];
      if (therapistIds.length) {
        const { data: profiles } = await supabase
          .from('profiles').select('id, full_name').in('id', therapistIds);
        if (profiles) {
          const m: Record<string, string> = {};
          profiles.forEach(p => { m[p.id] = p.full_name; });
          setTherapistNames(m);
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => { await signOut(); router.replace('/login'); } },
    ]);
  }

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Parent';

  const accountRows: SettingRow[] = [
    { icon: 'person-outline',       label: 'Edit Profile',     sub: 'Update your name and details', chevron: true },
    { icon: 'notifications-outline', label: 'Notifications',   sub: 'Manage alert preferences',     chevron: true },
    { icon: 'shield-checkmark-outline', label: 'Security',    sub: 'Password and account security', chevron: true, onPress: () => router.push('/change-password' as any) },
    { icon: 'help-circle-outline',  label: 'Help & Support',   sub: 'FAQs and contact info',        chevron: true },
  ];

  const appRows: SettingRow[] = [
    { icon: 'information-circle-outline', label: 'About EmotiSketch', sub: 'Version 1.0.0',     chevron: true },
    { icon: 'code-slash-outline',         label: 'AI Model',          sub: 'Claude Haiku 4.5', chevron: true },
  ];

  return (
    <ParentShell>
      <View style={s.root}>
        {/* ── Header ─────────────────────────────────────── */}
        <View style={s.header}>
          <View style={s.headerAvatar}>
            <Text style={s.headerAvatarText}>{firstName.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={s.headerInfo}>
            <Text style={s.headerName}>{profile?.full_name ?? 'Parent'}</Text>
            <Text style={s.headerEmail}>{email || 'Loading…'}</Text>
          </View>
          <View style={s.headerBadge}>
            <Text style={s.headerBadgeText}>Parent</Text>
          </View>
        </View>

        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={NAVY} />
          }
        >
          {/* ── My Children ───────────────────────────────── */}
          <View style={s.section}>
            <View style={s.sectionRow}>
              <Text style={s.sectionTitle}>My Children</Text>
              <TouchableOpacity style={s.addChildBtn}>
                <Ionicons name="add" size={15} color={C.white} />
                <Text style={s.addChildBtnText}>Add Child</Text>
              </TouchableOpacity>
            </View>

            {loading ? (
              <ActivityIndicator color={NAVY} style={{ marginVertical: 20 }} />
            ) : children.length === 0 ? (
              <View style={s.emptyChildren}>
                <Ionicons name="people-outline" size={32} color={C.borderMed} />
                <Text style={s.emptyChildrenText}>No children registered yet.</Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.childRow}>
                {children.map(child => {
                  const emo = lastEmotions[child.id];
                  const ec  = emo ? EMOTION_COLORS[emo] : null;
                  const therapist = child.therapist_id ? therapistNames[child.therapist_id] : null;
                  return (
                    <TouchableOpacity
                      key={child.id}
                      style={s.childCard}
                      onPress={() => router.push({ pathname: '/child-profile/[id]', params: { id: child.id } })}
                      activeOpacity={0.82}
                    >
                      <View style={[s.childAvatar, ec && { backgroundColor: ec.card }]}>
                        <Text style={[s.childAvatarText, ec && { color: ec.text }]}>
                          {child.full_name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <Text style={s.childName} numberOfLines={1}>{child.full_name.split(' ')[0]}</Text>
                      <Text style={s.childMeta}>{child.age} y/o</Text>
                      {emo ? (
                        <View style={[s.childEmoPill, { backgroundColor: ec!.card }]}>
                          <Text style={[s.childEmoText, { color: ec!.text }]}>
                            {emo.charAt(0).toUpperCase() + emo.slice(1)}
                          </Text>
                        </View>
                      ) : (
                        <View style={s.childEmoPillEmpty}>
                          <Text style={s.childEmoTextEmpty}>No data</Text>
                        </View>
                      )}
                      {therapist && (
                        <Text style={s.childTherapist} numberOfLines={1}>{therapist}</Text>
                      )}
                      <View style={s.childFooter}>
                        <Ionicons name="brush-outline" size={11} color={C.textMuted} />
                        <Text style={s.childSketches}>{child.total_sketches ?? 0}</Text>
                      </View>
                      <View style={s.childChevron}>
                        <Ionicons name="chevron-forward" size={12} color={C.textMuted} />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>

          {/* ── Account Settings ──────────────────────────── */}
          <SettingSection title="Account" rows={accountRows} />

          {/* ── App ───────────────────────────────────────── */}
          <SettingSection title="App" rows={appRows} />

          {/* ── Sign Out ──────────────────────────────────── */}
          <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={18} color={C.white} />
            <Text style={s.signOutText}>Sign Out</Text>
          </TouchableOpacity>

          <Text style={s.buildTag}>EmotiSketch · v1.0.0 · Powered by Claude AI</Text>
        </ScrollView>
      </View>
    </ParentShell>
  );
}

function SettingSection({ title, rows }: { title: string; rows: SettingRow[] }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={s.card}>
        {rows.map((row, i) => (
          <React.Fragment key={row.label}>
            {i > 0 && <View style={s.rowDivider} />}
            <TouchableOpacity style={s.settingRow} onPress={row.onPress} activeOpacity={0.7}>
              <View style={[s.settingIconBox, row.danger && { backgroundColor: '#FEE2E2' }]}>
                <Ionicons
                  name={row.icon as any}
                  size={17}
                  color={row.danger ? C.danger : NAVY}
                />
              </View>
              <View style={s.settingBody}>
                <Text style={[s.settingLabel, row.danger && { color: C.danger }]}>{row.label}</Text>
                {row.sub && <Text style={s.settingSub}>{row.sub}</Text>}
              </View>
              {row.chevron && (
                <Ionicons name="chevron-forward" size={16} color={C.borderMed} />
              )}
            </TouchableOpacity>
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 48 },

  // Header
  header: {
    backgroundColor: NAVY,
    paddingTop: 58, paddingBottom: 24, paddingHorizontal: 22,
    flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  headerAvatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  headerAvatarText:  { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerInfo:        { flex: 1 },
  headerName:        { fontSize: 17, fontWeight: '800', color: '#fff', marginBottom: 3 },
  headerEmail:       { fontSize: 12, color: 'rgba(255,255,255,0.65)', fontWeight: '400' },
  headerBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  headerBadgeText: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.9)' },

  // Sections
  section:    { marginBottom: 22 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: C.textMuted,
    textTransform: 'uppercase', letterSpacing: 1,
  },

  // Add Child
  addChildBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: NAVY, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  addChildBtnText: { fontSize: 11, fontWeight: '700', color: C.white },

  // Children horizontal list
  childRow: { paddingVertical: 4, gap: 10, paddingHorizontal: 2 },
  childCard: {
    width: 110, backgroundColor: C.white, borderRadius: 14, padding: 12,
    alignItems: 'center', ...SHADOW.sm, position: 'relative',
  },
  childAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: C.primaryLight,
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  childAvatarText:  { fontSize: 20, fontWeight: '800', color: C.primary },
  childName:        { fontSize: 13, fontWeight: '700', color: NAVY, marginBottom: 2 },
  childMeta:        { fontSize: 11, color: C.textMuted, marginBottom: 6 },
  childEmoPill:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginBottom: 4 },
  childEmoText:     { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  childEmoPillEmpty:{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginBottom: 4, backgroundColor: '#F0F0F5' },
  childEmoTextEmpty:{ fontSize: 10, color: C.textMuted },
  childTherapist:   { fontSize: 9, color: C.primary, fontWeight: '600', marginBottom: 6, textAlign: 'center' },
  childFooter:      { flexDirection: 'row', alignItems: 'center', gap: 3 },
  childSketches:    { fontSize: 10, color: C.textMuted },
  childChevron:     { position: 'absolute', top: 10, right: 8 },

  emptyChildren: {
    alignItems: 'center', paddingVertical: 28, gap: 8,
    backgroundColor: C.white, borderRadius: 14, ...SHADOW.sm,
  },
  emptyChildrenText: { fontSize: 13, color: C.textMuted },

  // Setting rows
  card: {
    backgroundColor: C.white, borderRadius: 14,
    overflow: 'hidden', ...SHADOW.sm,
  },
  rowDivider: { height: 1, backgroundColor: '#F0F0F5', marginLeft: 58 },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 13,
  },
  settingIconBox: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#EEF0FF',
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  settingBody:  { flex: 1 },
  settingLabel: { fontSize: 14, fontWeight: '600', color: C.text },
  settingSub:   { fontSize: 11, color: C.textMuted, marginTop: 1 },

  // Sign out
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#EF4444', borderRadius: 14, paddingVertical: 15,
    marginTop: 4, marginBottom: 20, ...SHADOW.sm,
  },
  signOutText: { fontSize: 15, fontWeight: '700', color: C.white },

  buildTag: {
    textAlign: 'center', fontSize: 11, color: C.textMuted, marginBottom: 8,
  },
});
