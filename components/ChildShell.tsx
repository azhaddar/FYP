import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { C } from '../constants/theme';
import { ChildNav } from './ChildNav';
import { useApp } from '../contexts/AppContext';

const NAVY = '#1A1F3C';
const YELLOW = '#FFD93D';
const SIDEBAR_W = 220;

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const NAV_ITEMS: { id: string; label: string; icon: IoniconName; route: string }[] = [
  { id: 'home',    label: 'Home',    icon: 'home-outline',    route: '/dashboard' },
  { id: 'draw',    label: 'Draw',    icon: 'brush-outline',   route: '/draw'      },
  { id: 'journal', label: 'Journal', icon: 'book-outline',    route: '/journal'   },
  { id: 'badges',  label: 'Badges',  icon: 'ribbon-outline',  route: '/rewards'   },
];

export function ChildShell({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const router = useRouter();
  const pathname = usePathname();
  const { unreadBadgeCount } = useApp();

  if (!isWide) {
    return (
      <View style={{ flex: 1 }}>
        {children}
        <ChildNav />
      </View>
    );
  }

  return (
    <View style={s.root}>
      <View style={s.sidebar}>
        <View style={s.logoRow}>
          <View style={s.logoBox}>
            <Ionicons name="brush" size={18} color={NAVY} />
          </View>
          <Text style={s.logoText}>EmotiSketch</Text>
        </View>

        <View style={s.nav}>
          {NAV_ITEMS.map(item => {
            const isDraw = item.id === 'draw';
            const active = !isDraw && pathname === item.route;
            const showBadge = item.id === 'badges' && unreadBadgeCount > 0;
            return (
              <TouchableOpacity
                key={item.id}
                style={[s.navItem, active && s.navItemActive, isDraw && s.drawItem]}
                onPress={() => router.push(item.route as any)}
                activeOpacity={0.7}
              >
                <View style={{ position: 'relative' }}>
                  <Ionicons
                    name={item.icon}
                    size={18}
                    color={isDraw ? NAVY : active ? C.primary : 'rgba(255,255,255,0.55)'}
                  />
                  {showBadge && <View style={s.badge} />}
                </View>
                <Text style={[
                  s.navLabel,
                  active && s.navLabelActive,
                  isDraw && s.drawLabel,
                ]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={s.version}>v1.0.0</Text>
      </View>

      <View style={s.main}>
        {children}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row' },

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
  drawItem: {
    backgroundColor: C.primary,
    marginVertical: 6,
  },
  navLabel: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.55)' },
  navLabelActive: { color: '#fff', fontWeight: '700' },
  drawLabel: { color: '#fff', fontWeight: '800' },

  badge: {
    position: 'absolute', top: -3, right: -5,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#ef4444', borderWidth: 1.5, borderColor: NAVY,
  },

  version: {
    position: 'absolute', bottom: 24, left: 16,
    fontSize: 11, color: 'rgba(255,255,255,0.3)',
  },

  main: { flex: 1, backgroundColor: '#FFF8F0' },
});
