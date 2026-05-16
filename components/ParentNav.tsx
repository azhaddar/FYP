import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { C, SHADOW } from '../constants/theme';
import { useApp } from '../contexts/AppContext';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TABS: { label: string; active: IoniconName; inactive: IoniconName; path: string }[] = [
  { label: 'Children', active: 'people',         inactive: 'people-outline',         path: '/dashboard' },
  { label: 'Activity', active: 'bar-chart',      inactive: 'bar-chart-outline',      path: '/activity'  },
  { label: 'Messages', active: 'chatbubble',     inactive: 'chatbubble-outline',     path: '/messages'  },
  { label: 'Settings', active: 'settings',       inactive: 'settings-outline',       path: '/settings'  },
];

export function ParentNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { unreadMsgCount } = useApp();

  return (
    <View style={styles.container}>
      {TABS.map(tab => {
        const active = pathname === tab.path;
        const showBadge = tab.path === '/messages' && unreadMsgCount > 0;
        return (
          <TouchableOpacity
            key={tab.path}
            style={styles.tab}
            onPress={() => router.push(tab.path as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.pill, active && styles.pillActive]}>
              <View style={styles.iconWrap}>
                <Ionicons
                  name={active ? tab.active : tab.inactive}
                  size={20}
                  color={active ? C.primary : C.textMuted}
                />
                {showBadge && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {unreadMsgCount > 9 ? '9+' : unreadMsgCount}
                    </Text>
                  </View>
                )}
              </View>
              {active && <Text style={styles.pillLabel}>{tab.label}</Text>}
            </View>
            {!active && <Text style={styles.inactiveLabel}>{tab.label}</Text>}
          </TouchableOpacity>
        );
      })}
    </View>
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
  tab: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 14,
    borderRadius: 20,
  },
  pillActive: {
    backgroundColor: C.primaryLight,
  },
  iconWrap: { position: 'relative' },
  badge: {
    position: 'absolute', top: -5, right: -8,
    backgroundColor: C.primary, borderRadius: 8,
    minWidth: 16, height: 16,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3,
  },
  badgeText: { fontSize: 9, fontWeight: '800', color: C.white },
  pillLabel: {
    fontSize: 13, fontWeight: '700', color: C.primary,
  },
  inactiveLabel: {
    fontSize: 10, fontWeight: '500', color: C.textMuted,
  },
});
