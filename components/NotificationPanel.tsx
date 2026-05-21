import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AppNotification } from '../hooks/useNotifications';
import { C, SHADOW } from '../constants/theme';

const NAVY = '#1A1F3C';

const TYPE_CFG = {
  sketch:  { icon: 'brush',        bg: '#E4DCFF', color: '#8B72E8' },
  alert:   { icon: 'alert-circle', bg: '#FFE4D6', color: '#E76F51' },
  message: { icon: 'chatbubble',   bg: '#D0F5F5', color: '#38BFBF' },
} as const;

function timeAgo(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

interface Props {
  notifications: AppNotification[];
  loading: boolean;
  unreadCount: number;
  onMarkAllRead: () => void;
  onClose: () => void;
}

export function NotificationPanel({
  notifications, loading, unreadCount, onMarkAllRead, onClose,
}: Props) {
  return (
    <>
      <TouchableOpacity
        style={s.backdrop}
        onPress={onClose}
        activeOpacity={1}
      />
      <View style={s.panel}>
        <View style={s.header}>
          <Text style={s.title}>Notifications</Text>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={onMarkAllRead} style={s.markBtn}>
              <Text style={s.markText}>Mark all read</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <ActivityIndicator color={NAVY} style={{ margin: 28 }} />
        ) : notifications.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="notifications-off-outline" size={36} color="#D0D0D8" />
            <Text style={s.emptyText}>All caught up!</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            {notifications.map(n => {
              const cfg = TYPE_CFG[n.type];
              return (
                <View key={n.id} style={[s.item, !n.read && s.itemUnread]}>
                  <View style={[s.iconBox, { backgroundColor: cfg.bg }]}>
                    <Ionicons name={cfg.icon as any} size={15} color={cfg.color} />
                  </View>
                  <View style={s.body}>
                    <Text style={[s.itemTitle, !n.read && s.itemTitleBold]} numberOfLines={1}>
                      {n.title}
                    </Text>
                    <Text style={s.itemBody} numberOfLines={2}>{n.body}</Text>
                    <Text style={s.itemTime}>{timeAgo(n.created_at)}</Text>
                  </View>
                  {!n.read && <View style={s.dot} />}
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>
    </>
  );
}

const s = StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99,
  },
  panel: {
    position: 'absolute', top: 82, right: 60,
    width: 340, maxHeight: 460,
    backgroundColor: '#fff', borderRadius: 16,
    overflow: 'hidden',
    zIndex: 100,
    ...SHADOW.lg,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F5',
  },
  title: { fontSize: 14, fontWeight: '800', color: NAVY, flex: 1 },
  markBtn: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8, backgroundColor: C.primaryLight,
  },
  markText: { fontSize: 11, fontWeight: '700', color: C.primary },

  empty: { alignItems: 'center', paddingVertical: 36, gap: 10 },
  emptyText: { fontSize: 13, color: '#B0B0C0', fontWeight: '500' },

  item: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 11,
    paddingHorizontal: 16, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: '#F8F8FC',
  },
  itemUnread: { backgroundColor: '#FAFBFF' },
  iconBox: {
    width: 34, height: 34, borderRadius: 9,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0, marginTop: 1,
  },
  body: { flex: 1 },
  itemTitle: { fontSize: 12, color: NAVY, fontWeight: '500', marginBottom: 2 },
  itemTitleBold: { fontWeight: '700' },
  itemBody: { fontSize: 11, color: '#888', lineHeight: 16 },
  itemTime: { fontSize: 10, color: '#C0C0CC', marginTop: 3, fontWeight: '500' },
  dot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: C.primary, marginTop: 5, flexShrink: 0,
  },
});
