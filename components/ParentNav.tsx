import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { C, SHADOW } from '../constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TABS: { label: string; active: IoniconName; inactive: IoniconName; path: string }[] = [
  { label: 'Children', active: 'people',    inactive: 'people-outline',    path: '/dashboard' },
  { label: 'Activity', active: 'bar-chart', inactive: 'bar-chart-outline', path: '/activity'  },
  { label: 'Settings', active: 'settings',  inactive: 'settings-outline',  path: '/settings'  },
];

export function ParentNav() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View style={styles.container}>
      {TABS.map(tab => {
        const active = pathname === tab.path;
        return (
          <TouchableOpacity
            key={tab.path}
            style={styles.tab}
            onPress={() => router.push(tab.path as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.pill, active && styles.pillActive]}>
              <Ionicons
                name={active ? tab.active : tab.inactive}
                size={20}
                color={active ? C.primary : C.textMuted}
              />
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
  pillLabel: {
    fontSize: 13, fontWeight: '700', color: C.primary,
  },
  inactiveLabel: {
    fontSize: 10, fontWeight: '500', color: C.textMuted,
  },
});
