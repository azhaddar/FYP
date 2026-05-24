import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { supabase } from '../lib/supabaseClient';
import { UploadBottomSheet, SheetPatient } from './UploadBottomSheet';

const NAVY        = '#1A1F3C';
const ACTIVE_BG   = '#E8EAFF';
const ACTIVE_CLR  = '#4C6EF5';
const INACTIVE    = '#9CA3AF';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TABS: { icon: IoniconName; activeIcon: IoniconName; path: string; center?: boolean }[] = [
  { icon: 'home-outline',      activeIcon: 'home',        path: '/dashboard' },
  { icon: 'bar-chart-outline', activeIcon: 'bar-chart',   path: '/activity'  },
  { icon: 'pencil-outline',    activeIcon: 'pencil',      path: '__upload',  center: true },
  { icon: 'gift-outline',      activeIcon: 'gift',        path: '/rewards'   },
  { icon: 'person-outline',    activeIcon: 'person',      path: '/settings'  },
];

export function ParentNav() {
  const router   = useRouter();
  const pathname = usePathname();

  const [patients, setPatients]     = useState<SheetPatient[]>([]);
  const [sheetOpen, setSheetOpen]   = useState(false);

  // Fetch children once on mount
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('patients')
        .select('id, full_name, age, gender')
        .eq('guardian_id', user.id);
      setPatients(data ?? []);
    })();
  }, []);

  // Navigate to the draw screen for a given child
  function goToDraw(patient: SheetPatient) {
    router.push({
      pathname: '/draw',
      params: { patientId: patient.id, patientName: patient.full_name },
    } as any);
  }

  // ── Center button logic ──────────────────────────────────────────────────────
  function handleUploadPress() {
    if (patients.length === 0) {
      // No children registered yet — go to dashboard to add one
      router.push('/dashboard');
      return;
    }

    if (patients.length === 1) {
      // ── BYPASS: single child — skip sheet, go straight to draw ──────────────
      goToDraw(patients[0]);
      return;
    }

    // ── MULTI-CHILD: open the "Who is uploading?" sheet ──────────────────────
    setSheetOpen(true);
  }

  function handleSelectChild(patient: SheetPatient) {
    setSheetOpen(false);
    // Small delay so the sheet dismisses before the navigation transition fires
    setTimeout(() => goToDraw(patient), 150);
  }

  return (
    <>
      <View style={s.wrapper}>
        <View style={s.card}>
          {TABS.map(tab => {
            const active = pathname === tab.path ||
              (tab.path === '/dashboard' && pathname === '/');

            if (tab.center) {
              return (
                <TouchableOpacity
                  key="upload"
                  style={s.centerBtnWrap}
                  onPress={handleUploadPress}
                  activeOpacity={0.85}
                >
                  <View style={s.centerBtn}>
                    <Ionicons name="pencil" size={22} color="#fff" />
                  </View>
                </TouchableOpacity>
              );
            }

            return (
              <TouchableOpacity
                key={tab.path}
                style={s.tab}
                onPress={() => router.push(tab.path as any)}
                activeOpacity={0.7}
              >
                <View style={[s.iconWrap, active && s.iconWrapActive]}>
                  <Ionicons
                    name={active ? tab.activeIcon : tab.icon}
                    size={22}
                    color={active ? ACTIVE_CLR : INACTIVE}
                  />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Bottom sheet rendered as a Modal — floats above all screen content */}
      <UploadBottomSheet
        visible={sheetOpen}
        patients={patients}
        onSelectChild={handleSelectChild}
        onClose={() => setSheetOpen(false)}
      />
    </>
  );
}

const s = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    paddingTop: 16,
    backgroundColor: 'transparent',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 32,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 20,
    elevation: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: ACTIVE_BG,
  },
  centerBtnWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -24,
  },
  centerBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
});
