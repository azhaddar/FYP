import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SHADOW } from '../constants/theme';

const NAVY = '#1A1F3C';
const YELLOW = '#FFD93D';

interface Props {
  name: string;
  email: string;
  onSignOut: () => void;
  onClose: () => void;
}

export function ProfileDropdown({ name, email, onSignOut, onClose }: Props) {
  const router = useRouter();

  return (
    <>
      <TouchableOpacity
        style={s.backdrop}
        onPress={onClose}
        activeOpacity={1}
      />
      <View style={s.panel}>
        <View style={s.userRow}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.userName} numberOfLines={1}>{name}</Text>
            <Text style={s.userEmail} numberOfLines={1}>{email}</Text>
          </View>
        </View>

        <View style={s.divider} />

        <MenuItem
          icon="settings-outline"
          label="Settings"
          onPress={() => { onClose(); router.replace('/settings' as any); }}
        />
        <MenuItem
          icon="people-outline"
          label="Manage Children"
          onPress={() => { onClose(); router.replace('/dashboard' as any); }}
        />
        <MenuItem
          icon="help-circle-outline"
          label="Help & Support"
          onPress={onClose}
        />

        <View style={s.divider} />

        <MenuItem
          icon="log-out-outline"
          label="Sign Out"
          danger
          onPress={() => { onClose(); onSignOut(); }}
        />
      </View>
    </>
  );
}

function MenuItem({
  icon, label, danger, onPress,
}: { icon: any; label: string; danger?: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.menuItem} onPress={onPress} activeOpacity={0.7}>
      <Ionicons
        name={icon}
        size={15}
        color={danger ? '#E53E3E' : NAVY}
        style={{ opacity: danger ? 1 : 0.55 }}
      />
      <Text style={[s.menuLabel, danger && s.menuDanger]}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99,
  },
  panel: {
    position: 'absolute', top: 82, right: 16,
    width: 230,
    backgroundColor: '#fff', borderRadius: 14,
    overflow: 'hidden',
    zIndex: 100,
    ...SHADOW.lg,
  },
  userRow: {
    flexDirection: 'row', alignItems: 'center', gap: 11, padding: 14,
  },
  avatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: YELLOW, justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '800', color: NAVY },
  userName: { fontSize: 13, fontWeight: '700', color: NAVY },
  userEmail: { fontSize: 11, color: '#999', marginTop: 1 },
  divider: { height: 1, backgroundColor: '#F0F0F5' },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  menuLabel: { fontSize: 13, fontWeight: '600', color: NAVY },
  menuDanger: { color: '#E53E3E' },
});
