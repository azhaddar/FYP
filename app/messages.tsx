import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabaseClient';
import { useApp } from '../contexts/AppContext';
import { C, MAX_W, SHADOW } from '../constants/theme';

const NAVY = '#1A1F3C';
import { ParentShell } from '../components/ParentShell';

interface Conversation {
  therapistId: string;
  therapistName: string;
  professionalTitle: string;
  lastMessage: string;
  lastAt: string;
  unread: number;
}

function timeAgo(iso: string) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function MessagesScreen() {
  const { setUnreadMsgCount } = useApp();
  const router = useRouter();
  const [myId, setMyId] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setMyId(user.id);
    });
  }, []);

  useEffect(() => {
    if (myId) fetchConversations();
  }, [myId]);

  async function fetchConversations() {
    try {
      const { data: children } = await supabase
        .from('patients')
        .select('therapist_id')
        .eq('guardian_id', myId)
        .not('therapist_id', 'is', null);

      if (!children?.length) {
        setConversations([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const therapistIds = [...new Set(children.map(c => c.therapist_id as string))];

      const [{ data: profiles }, { data: tProfiles }, { data: msgs }] = await Promise.all([
        supabase.from('profiles').select('id, full_name').in('id', therapistIds),
        supabase.from('therapist_profiles').select('id, professional_title').in('id', therapistIds),
        supabase
          .from('messages')
          .select('id, sender_id, receiver_id, content, created_at, read_at')
          .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
          .order('created_at', { ascending: false })
          .limit(300),
      ]);

      const nameMap: Record<string, string> = {};
      (profiles ?? []).forEach(p => { nameMap[p.id] = p.full_name; });

      const titleMap: Record<string, string> = {};
      (tProfiles ?? []).forEach(p => { titleMap[p.id] = p.professional_title ?? ''; });

      const convs: Conversation[] = therapistIds.map(therapistId => {
        const thread = (msgs ?? []).filter(m =>
          (m.sender_id === myId && m.receiver_id === therapistId) ||
          (m.sender_id === therapistId && m.receiver_id === myId)
        );
        const last = thread[0];
        const unread = thread.filter(m => m.sender_id === therapistId && !m.read_at).length;
        return {
          therapistId,
          therapistName: nameMap[therapistId] ?? 'Therapist',
          professionalTitle: titleMap[therapistId] ?? '',
          lastMessage: last?.content ?? '',
          lastAt: last?.created_at ?? '',
          unread,
        };
      });

      convs.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
      setConversations(convs);
      setUnreadMsgCount(convs.reduce((s, c) => s + c.unread, 0));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  return (
    <ParentShell>
    <View style={styles.root}>
      <View style={[styles.header, isWide && styles.headerWide]}>
        <View style={styles.headerInner}>
          <Text style={[styles.headerTitle, isWide && styles.headerTitleWide]}>Messages</Text>
          <Text style={[styles.headerSub, isWide && styles.headerSubWide]}>Chat with your child's therapist</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchConversations(); }}
            tintColor={C.primary}
          />
        }
      >
        {loading ? (
          <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 60 }} />
        ) : conversations.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={72} color={C.borderMed} />
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptyDesc}>
              Conversations appear here once your child is assigned a therapist.
            </Text>
          </View>
        ) : (
          conversations.map(conv => (
            <TouchableOpacity
              key={conv.therapistId}
              style={styles.convCard}
              onPress={() => router.push({
                pathname: '/chat',
                params: { otherId: conv.therapistId, otherName: conv.therapistName },
              })}
              activeOpacity={0.85}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{conv.therapistName.charAt(0).toUpperCase()}</Text>
              </View>

              <View style={styles.convInfo}>
                <View style={styles.convTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.convName}>{conv.therapistName}</Text>
                    {conv.professionalTitle ? (
                      <Text style={styles.convTitle}>{conv.professionalTitle}</Text>
                    ) : null}
                  </View>
                  {conv.lastAt ? (
                    <Text style={styles.convTime}>{timeAgo(conv.lastAt)}</Text>
                  ) : null}
                </View>

                <View style={styles.convBottom}>
                  <Text
                    style={[styles.convLast, conv.unread > 0 && styles.convLastBold]}
                    numberOfLines={1}
                  >
                    {conv.lastMessage || 'No messages yet — say hello!'}
                  </Text>
                  {conv.unread > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText}>{conv.unread > 9 ? '9+' : conv.unread}</Text>
                    </View>
                  )}
                </View>
              </View>

              <Ionicons name="chevron-forward" size={16} color={C.borderMed} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

    </View>
    </ParentShell>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.base },

  header: { backgroundColor: NAVY, paddingTop: 52, paddingBottom: 20 },
  headerWide:      { backgroundColor: '#fff', paddingTop: 0, borderBottomWidth: 1, borderBottomColor: '#EBEBEB' },
  headerInner: {
    paddingHorizontal: 24, maxWidth: MAX_W, alignSelf: 'center', width: '100%',
  },
  headerTitle:     { fontSize: 26, fontWeight: '700', color: C.white },
  headerTitleWide: { color: NAVY },
  headerSub:       { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 3 },
  headerSubWide:   { color: '#888' },

  content: {
    padding: 20, paddingBottom: 40,
    maxWidth: MAX_W, alignSelf: 'center', width: '100%',
  },

  empty: { alignItems: 'center', paddingVertical: 80, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: C.text, marginTop: 16, marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: C.textSub, textAlign: 'center', lineHeight: 21 },

  convCard: {
    backgroundColor: C.white, borderRadius: 16, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10,
    ...SHADOW.sm,
  },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: C.primaryLight, justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  avatarText: { fontSize: 20, fontWeight: '800', color: C.primary },

  convInfo: { flex: 1, minWidth: 0 },
  convTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  convName: { fontSize: 15, fontWeight: '700', color: C.text },
  convTitle: { fontSize: 12, color: C.primary, fontWeight: '600', marginTop: 1 },
  convTime: { fontSize: 11, color: C.textMuted, flexShrink: 0, marginLeft: 8, marginTop: 2 },

  convBottom: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginTop: 5,
  },
  convLast: { fontSize: 13, color: C.textMuted, flex: 1 },
  convLastBold: { color: C.text, fontWeight: '600' },
  unreadBadge: {
    backgroundColor: C.primary, borderRadius: 10,
    minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 5, marginLeft: 8,
  },
  unreadText: { fontSize: 10, fontWeight: '800', color: C.white },
});
