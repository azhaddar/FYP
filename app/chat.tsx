import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabaseClient';
import { C, MAX_W, SHADOW } from '../constants/theme';
import { RealtimeChannel } from '@supabase/supabase-js';

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
}

type ListItem =
  | { type: 'date'; label: string; key: string }
  | { type: 'msg'; msg: Message; key: string };

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });
}

function formatDateLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'short' });
}

export default function ChatScreen() {
  const router = useRouter();
  const { otherId, otherName } = useLocalSearchParams<{ otherId: string; otherName: string }>();

  const [myId, setMyId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const flatRef = useRef<FlatList>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setMyId(user.id);
    });
    return () => { channelRef.current?.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (myId && otherId) {
      fetchMessages();
      markRead();
      subscribeToNew();
    }
  }, [myId, otherId]);

  async function fetchMessages() {
    setLoading(true);
    const { data } = await supabase
      .from('messages')
      .select('id, sender_id, receiver_id, content, created_at, read_at')
      .or(`and(sender_id.eq.${myId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${myId})`)
      .order('created_at', { ascending: true });
    setMessages(data ?? []);
    setLoading(false);
  }

  async function markRead() {
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('receiver_id', myId)
      .eq('sender_id', otherId)
      .is('read_at', null);
  }

  function subscribeToNew() {
    channelRef.current = supabase
      .channel(`chat-${[myId, otherId].sort().join('-')}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `receiver_id=eq.${myId}`,
      }, (payload) => {
        const msg = payload.new as Message;
        if (msg.sender_id !== otherId) return;
        setMessages(prev => [...prev, msg]);
        supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('id', msg.id);
      })
      .subscribe();
  }

  async function sendMessage() {
    const content = text.trim();
    if (!content || !myId || !otherId || sending) return;
    setSending(true);
    setText('');
    const { data, error } = await supabase
      .from('messages')
      .insert({ sender_id: myId, receiver_id: otherId, content })
      .select()
      .single();
    if (!error && data) setMessages(prev => [...prev, data as Message]);
    setSending(false);
  }

  // Build flat list with date separators
  const listItems: ListItem[] = [];
  let lastDate = '';
  for (const msg of messages) {
    const dateKey = msg.created_at.slice(0, 10);
    if (dateKey !== lastDate) {
      listItems.push({ type: 'date', label: formatDateLabel(msg.created_at), key: `date-${dateKey}` });
      lastDate = dateKey;
    }
    listItems.push({ type: 'msg', msg, key: msg.id });
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerInner}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={C.white} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={styles.headerAvatar}>
              <Text style={styles.headerAvatarText}>
                {(otherName ?? 'T').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={styles.headerName}>{otherName ?? 'Therapist'}</Text>
              <Text style={styles.headerRole}>Therapist</Text>
            </View>
          </View>
          <View style={{ width: 36 }} />
        </View>
      </View>

      {/* Message list */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : (
        <FlatList
          ref={flatRef}
          data={listItems}
          keyExtractor={item => item.key}
          contentContainerStyle={[
            styles.msgList,
            listItems.length === 0 && styles.msgListEmpty,
          ]}
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Ionicons name="chatbubble-ellipses-outline" size={52} color={C.borderMed} />
              <Text style={styles.emptyChatText}>No messages yet</Text>
              <Text style={styles.emptyChatSub}>Send a message to start the conversation.</Text>
            </View>
          }
          renderItem={({ item }) => {
            if (item.type === 'date') {
              return (
                <View style={styles.dateSep}>
                  <Text style={styles.dateSepText}>{item.label}</Text>
                </View>
              );
            }
            const { msg } = item;
            const isMine = msg.sender_id === myId;
            return (
              <View style={[styles.bubbleWrap, isMine ? styles.bubbleWrapMine : styles.bubbleWrapTheirs]}>
                <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>
                    {msg.content}
                  </Text>
                  <Text style={[styles.bubbleTime, isMine && styles.bubbleTimeMine]}>
                    {formatTime(msg.created_at)}{isMine ? (msg.read_at ? '  ✓✓' : '  ✓') : ''}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Input bar */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Type a message…"
          placeholderTextColor={C.textMuted}
          multiline
          maxLength={500}
          returnKeyType="default"
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!text.trim() || sending}
        >
          {sending
            ? <ActivityIndicator size="small" color={C.white} />
            : <Ionicons name="send" size={18} color={C.white} />
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F0FB' },

  header: { backgroundColor: C.primary, paddingTop: 52, paddingBottom: 14 },
  headerInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, maxWidth: MAX_W, alignSelf: 'center', width: '100%',
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'flex-start' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerAvatarText: { fontSize: 16, fontWeight: '800', color: C.white },
  headerName: { fontSize: 16, fontWeight: '700', color: C.white },
  headerRole: { fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },

  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  msgList: { padding: 16, paddingBottom: 8 },
  msgListEmpty: { flex: 1, justifyContent: 'center' },

  emptyChat: { alignItems: 'center', paddingVertical: 40 },
  emptyChatText: { fontSize: 17, fontWeight: '700', color: C.text, marginTop: 14 },
  emptyChatSub: { fontSize: 13, color: C.textMuted, marginTop: 5 },

  dateSep: { alignItems: 'center', marginVertical: 14 },
  dateSepText: {
    fontSize: 11, fontWeight: '600', color: C.textMuted,
    backgroundColor: '#E4DAF5', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 12,
  },

  bubbleWrap: { marginBottom: 4, flexDirection: 'row' },
  bubbleWrapMine: { justifyContent: 'flex-end' },
  bubbleWrapTheirs: { justifyContent: 'flex-start' },

  bubble: {
    maxWidth: '78%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9,
    ...SHADOW.sm,
  },
  bubbleMine: {
    backgroundColor: C.primary,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: C.white,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 14, color: C.text, lineHeight: 20 },
  bubbleTextMine: { color: C.white },
  bubbleTime: {
    fontSize: 10, color: C.textMuted, marginTop: 4, textAlign: 'right',
  },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.65)' },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 30,
    backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.border,
  },
  input: {
    flex: 1, borderWidth: 1.5, borderColor: C.border, borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 14, color: C.text, backgroundColor: C.base,
    maxHeight: 100, minHeight: 44,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: C.borderMed },
});
