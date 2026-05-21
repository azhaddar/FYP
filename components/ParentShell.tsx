import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { C } from '../constants/theme';
import { ParentNav } from './ParentNav';
import { NotificationPanel } from './NotificationPanel';
import { ProfileDropdown } from './ProfileDropdown';
import { useApp } from '../contexts/AppContext';
import { useNotifications } from '../hooks/useNotifications';

const NAVY = '#1A1F3C';
const YELLOW = '#FFD93D';
const SIDEBAR_W = 220;

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const NAV_ITEMS: { id: string; label: string; icon: IoniconName; route: string }[] = [
  { id: 'children', label: 'Children', icon: 'people-outline',       route: '/dashboard' },
  { id: 'activity', label: 'Activity',  icon: 'bar-chart-outline',    route: '/activity'  },
  { id: 'messages', label: 'Messages',  icon: 'chatbubbles-outline',  route: '/messages'  },
  { id: 'settings', label: 'Settings',  icon: 'settings-outline',     route: '/settings'  },
];

export function ParentShell({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const router   = useRouter();
  const pathname = usePathname();
  const { unreadMsgCount, profile, session, signOut } = useApp();

  const userId    = profile?.id ?? '';
  const firstName = profile?.full_name?.split(' ')[0] ?? 'Parent';
  const userEmail = session?.user?.email ?? '';

  const [showNotif,   setShowNotif]   = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const { notifications, unreadCount, markAllRead, loading: notifLoading } =
    useNotifications(userId);

  function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => { await signOut(); router.replace('/login' as any); },
      },
    ]);
  }

  // ── Phone layout ──────────────────────────────────────────
  if (!isWide) {
    return (
      <View style={{ flex: 1 }}>
        {children}
        <ParentNav />
      </View>
    );
  }

  // ── iPad / wide layout ────────────────────────────────────
  return (
    <View style={s.root}>

      {/* Sidebar */}
      <View style={s.sidebar}>
        <View style={s.logoRow}>
          <View style={s.logoBox}>
            <Ionicons name="brush" size={18} color={NAVY} />
          </View>
          <Text style={s.logoText}>EmotiSketch</Text>
        </View>

        <View style={s.nav}>
          {NAV_ITEMS.map(item => {
            const active    = pathname === item.route;
            const showBadge = item.id === 'messages' && unreadMsgCount > 0;
            return (
              <TouchableOpacity
                key={item.id}
                style={[s.navItem, active && s.navItemActive]}
                onPress={() => router.replace(item.route as any)}
                activeOpacity={0.7}
              >
                <View style={{ position: 'relative' }}>
                  <Ionicons
                    name={item.icon}
                    size={18}
                    color={active ? C.primary : 'rgba(255,255,255,0.55)'}
                  />
                  {showBadge && <View style={s.badge} />}
                </View>
                <Text style={[s.navLabel, active && s.navLabelActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={s.version}>v1.0.0</Text>
      </View>

      {/* Main area (top bar + page content + overlays) */}
      <View style={s.main}>

        {/* Persistent top bar */}
        <View style={s.topBar}>
          <View style={{ flex: 1 }} />
          <View style={s.topBarRight}>
            <TouchableOpacity
              style={s.iconBtn}
              onPress={() => { setShowProfile(false); setShowNotif(v => !v); }}
            >
              <Ionicons
                name={showNotif ? 'notifications' : 'notifications-outline'}
                size={19}
                color={NAVY}
              />
              {unreadCount > 0 && (
                <View style={s.bellBadge}>
                  <Text style={s.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={s.profileGroup}
              onPress={() => { setShowNotif(false); setShowProfile(v => !v); }}
              activeOpacity={0.7}
            >
              <Text style={s.profileGreeting}>Hello, {firstName}!</Text>
              <Ionicons name="chevron-down" size={13} color={NAVY} />
            </TouchableOpacity>

            <View style={s.avatarCircle}>
              <Text style={s.avatarLetter}>{firstName.charAt(0).toUpperCase()}</Text>
            </View>
          </View>
        </View>

        {/* Page content */}
        {children}

        {/* Overlays */}
        {showNotif && (
          <NotificationPanel
            notifications={notifications}
            loading={notifLoading}
            unreadCount={unreadCount}
            onMarkAllRead={markAllRead}
            onClose={() => setShowNotif(false)}
          />
        )}
        {showProfile && (
          <ProfileDropdown
            name={profile?.full_name ?? firstName}
            email={userEmail}
            onSignOut={handleSignOut}
            onClose={() => setShowProfile(false)}
          />
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row' },

  // ── Sidebar ────────────────────────────────────────────────
  sidebar: {
    width: SIDEBAR_W,
    backgroundColor: NAVY,
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  logoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 36,
  },
  logoBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: YELLOW, justifyContent: 'center', alignItems: 'center',
  },
  logoText: { fontSize: 16, fontWeight: '800', color: '#fff' },

  nav: { gap: 2 },
  navItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 11, paddingHorizontal: 12, borderRadius: 10,
  },
  navItemActive: { backgroundColor: 'rgba(255,255,255,0.08)' },
  navLabel:      { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.55)' },
  navLabelActive:{ color: '#fff', fontWeight: '700' },

  badge: {
    position: 'absolute', top: -3, right: -5,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: C.primary, borderWidth: 1.5, borderColor: NAVY,
  },
  version: {
    position: 'absolute', bottom: 24, left: 16,
    fontSize: 11, color: 'rgba(255,255,255,0.3)',
  },

  // ── Main area ──────────────────────────────────────────────
  main: { flex: 1, backgroundColor: '#F4F5FA' },

  topBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', paddingTop: 52, paddingBottom: 14,
    paddingHorizontal: 22, borderBottomWidth: 1, borderBottomColor: '#EBEBEB',
  },
  topBarRight:     { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconBtn:         { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F4F5FA', justifyContent: 'center', alignItems: 'center' },
  profileGroup:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  profileGreeting: { fontSize: 14, fontWeight: '700', color: NAVY },
  avatarCircle:    { width: 36, height: 36, borderRadius: 18, backgroundColor: YELLOW, justifyContent: 'center', alignItems: 'center' },
  avatarLetter:    { fontSize: 14, fontWeight: '800', color: NAVY },

  bellBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: C.primary, borderRadius: 8,
    minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 3, borderWidth: 1.5, borderColor: '#fff',
  },
  bellBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },
});
