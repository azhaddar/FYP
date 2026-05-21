import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '../contexts/AppContext';
import { C, MAX_W } from '../constants/theme';

const NAVY = '#1A1F3C';
import { ParentShell } from '../components/ParentShell';

export default function SettingsScreen() {
  const { profile, signOut } = useApp();
  const router = useRouter();
  const { width } = useWindowDimensions();

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => { await signOut(); router.replace('/login'); },
      },
    ]);
  }

  return (
    <ParentShell>
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, width >= 768 && styles.headerWide]}>
        <View style={[styles.headerInner, width >= 768 && { maxWidth: MAX_W }]}>
          <Text style={[styles.headerTitle, width >= 768 && styles.headerTitleWide]}>Settings</Text>
        </View>
      </View>

      <View style={[styles.content, width >= 768 && styles.contentWide]}>
        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profile?.full_name?.charAt(0).toUpperCase() ?? 'P'}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profile?.full_name ?? 'Parent'}</Text>
            <Text style={styles.profileRole}>Parent Account</Text>
          </View>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.card}>
            <Row label="App" value="EmotiSketch" />
            <Divider />
            <Row label="Version" value="1.0.0" />
            <Divider />
            <Row label="Model" value="Claude Haiku" />
          </View>
        </View>

        {/* Account */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.dangerRow} onPress={handleSignOut}>
              <Text style={styles.dangerText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

    </View>
    </ParentShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={rowStyles.value}>{value}</Text>
    </View>
  );
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: C.border }} />;
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 14, paddingHorizontal: 18,
  },
  label: { fontSize: 15, color: C.text, fontWeight: '500' },
  value: { fontSize: 15, color: C.textMuted },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.base },

  header: { backgroundColor: NAVY, paddingTop: 52, paddingBottom: 20 },
  headerWide:      { backgroundColor: '#fff', paddingTop: 0, borderBottomWidth: 1, borderBottomColor: '#EBEBEB' },
  headerInner: { paddingHorizontal: 24, alignSelf: 'center', width: '100%' },
  headerTitle:     { fontSize: 26, fontWeight: '800', color: C.white },
  headerTitleWide: { color: NAVY },

  content: { flex: 1, padding: 24 },
  contentWide: { maxWidth: MAX_W, alignSelf: 'center', width: '100%' },

  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: C.white, borderRadius: 16, borderWidth: 1,
    borderColor: C.border, padding: 20, marginBottom: 28,
  },
  avatar: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: C.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 26, fontWeight: '800', color: C.primary },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: '700', color: C.text },
  profileRole: { fontSize: 14, color: C.textMuted, marginTop: 3 },

  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: C.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8,
  },
  card: {
    backgroundColor: C.white, borderRadius: 16,
    borderWidth: 1, borderColor: C.border, overflow: 'hidden',
  },
  dangerRow: { paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center' },
  dangerText: { fontSize: 15, fontWeight: '700', color: C.danger },
});
