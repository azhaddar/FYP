import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
  FlatList, Image, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabaseClient';
import { C, EMOTION_COLORS, MAX_W, SHADOW } from '../constants/theme';
import { RealtimeChannel } from '@supabase/supabase-js';
import { MentionPicker, PickerAttachment } from '../components/MentionPicker';
import { EmotionIcon } from '../components/EmotionIcon';

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
  attachment?: PickerAttachment | null;
}

type ListItem =
  | { type: 'date'; label: string; key: string }
  | { type: 'msg'; msg: Message; key: string };

const EMOTIONS = ['happy', 'sad', 'angry', 'anxious'] as const;

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

function normalizeScores(raw: Record<string, number> | null | undefined): Record<string, number> | null {
  if (!raw) return null;
  const vals = EMOTIONS.map(e => raw[e] ?? 0);
  const sum = vals.reduce((a, b) => a + b, 0);
  if (sum === 0) return null;
  const max = Math.max(...vals);
  const norm = (v: number) => max <= 1 ? Math.round(v * 100) : Math.round(v);
  return { happy: norm(raw.happy ?? 0), sad: norm(raw.sad ?? 0), angry: norm(raw.angry ?? 0), anxious: norm(raw.anxious ?? 0) };
}

// ── Attachment card rendered inside a bubble ─────────────────────────────────
function AttachmentCard({ att, isMine }: { att: PickerAttachment; isMine: boolean }) {
  const cardBg = isMine ? 'rgba(255,255,255,0.18)' : '#F3EEFF';
  const labelColor = isMine ? 'rgba(255,255,255,0.85)' : C.primary;
  const textColor = isMine ? C.white : C.text;
  const subColor = isMine ? 'rgba(255,255,255,0.7)' : C.textSub;

  const typeLabels = { drawing: 'Drawing', result: 'Result', graph: 'Progress' };
  const typeIcons: Record<string, string> = { drawing: 'pencil', result: 'bar-chart', graph: 'trending-up' };

  const scores = normalizeScores(att.scores);

  return (
    <View style={[attStyles.card, { backgroundColor: cardBg }]}>
      {/* Type badge */}
      <View style={attStyles.typeBadge}>
        <Ionicons name={typeIcons[att.type] as any} size={10} color={labelColor} />
        <Text style={[attStyles.typeLabel, { color: labelColor }]}>{typeLabels[att.type]}</Text>
      </View>

      {/* Drawing: show image */}
      {att.type === 'drawing' && att.imageUrl ? (
        <Image source={{ uri: att.imageUrl }} style={attStyles.image} resizeMode="cover" />
      ) : null}

      {/* Result: show mini score bars */}
      {att.type === 'result' && scores ? (
        <View style={attStyles.scoresWrap}>
          {EMOTIONS.map(e => (
            <View key={e} style={attStyles.scoreRow}>
              <Text style={[attStyles.scoreEmoLabel, { color: subColor }]}>
                {e.charAt(0).toUpperCase()}
              </Text>
              <View style={attStyles.scoreTrack}>
                <View style={[
                  attStyles.scoreFill,
                  { width: `${scores[e]}%`, backgroundColor: EMOTION_COLORS[e].text },
                  e === att.emotion && { opacity: 1 },
                ]} />
              </View>
              <Text style={[attStyles.scorePct, { color: subColor }]}>{scores[e]}%</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Graph: emotion dot timeline */}
      {att.type === 'graph' && att.timeline ? (
        <View style={attStyles.dotsWrap}>
          {att.timeline.map((t, i) => (
            <View key={i} style={[attStyles.dot, { backgroundColor: EMOTION_COLORS[t.emotion]?.text ?? C.borderMed }]} />
          ))}
        </View>
      ) : null}

      {/* Emotion + patient info */}
      <View style={attStyles.infoRow}>
        {att.emotion ? (
          <>
            <EmotionIcon emotion={att.emotion} size={15} />
            <Text style={[attStyles.infoEmotion, { color: textColor }]}>
              {att.emotion.charAt(0).toUpperCase() + att.emotion.slice(1)}
            </Text>
            <Text style={[attStyles.infoDot, { color: subColor }]}>·</Text>
          </>
        ) : null}
        <Text style={[attStyles.infoPatient, { color: textColor }]}>{att.patientName}</Text>
      </View>

      {att.type !== 'graph' ? (
        <Text style={[attStyles.infoSub, { color: subColor }]}>Session {att.sessionNum}</Text>
      ) : (
        <Text style={[attStyles.infoSub, { color: subColor }]}>{att.sessionNum} sessions total</Text>
      )}
    </View>
  );
}

// ── Pending attachment preview above input bar ────────────────────────────────
function AttachmentPreview({ att, onRemove }: { att: PickerAttachment; onRemove: () => void }) {
  return (
    <View style={previewStyles.wrap}>
      {att.type === 'drawing' && att.imageUrl ? (
        <Image source={{ uri: att.imageUrl }} style={previewStyles.thumb} resizeMode="cover" />
      ) : (
        <View style={previewStyles.iconBox}>
          <Ionicons
            name={att.type === 'result' ? 'bar-chart' : 'trending-up'}
            size={18} color={C.primary}
          />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={previewStyles.title} numberOfLines={1}>{att.title}</Text>
        <Text style={previewStyles.sub}>{att.patientName} · Session {att.sessionNum}</Text>
      </View>
      <TouchableOpacity onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="close-circle" size={20} color={C.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ChatScreen() {
  const router = useRouter();
  const { otherId, otherName } = useLocalSearchParams<{ otherId: string; otherName: string }>();

  const [myId, setMyId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<PickerAttachment | null>(null);

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
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${myId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${myId})`)
      .order('created_at', { ascending: true });
    if (error) console.error('fetchMessages error:', error.message);
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
    if ((!content && !pendingAttachment) || !myId || !otherId || sending) return;
    setSending(true);
    const att = pendingAttachment;
    setText('');
    setPendingAttachment(null);

    const payload: Record<string, unknown> = {
      sender_id: myId,
      receiver_id: otherId,
      content: content || ' ',   // use space if empty (attachment-only message)
    };
    if (att) payload.attachment = att;

    const { data, error } = await supabase
      .from('messages')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      Alert.alert('Failed to send', error.message);
      setText(content);               // restore text so user doesn't lose it
      setPendingAttachment(att);
    } else if (data) {
      setMessages(prev => [...prev, data as Message]);
    }
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

  const canSend = (text.trim().length > 0 || !!pendingAttachment) && !sending && !!myId && !!otherId;

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
                  {msg.attachment ? (
                    <AttachmentCard att={msg.attachment} isMine={isMine} />
                  ) : null}
                  {msg.content ? (
                    <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine, msg.attachment && { marginTop: 6 }]}>
                      {msg.content}
                    </Text>
                  ) : null}
                  <Text style={[styles.bubbleTime, isMine && styles.bubbleTimeMine]}>
                    {formatTime(msg.created_at)}{isMine ? (msg.read_at ? '  ✓✓' : '  ✓') : ''}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Attachment preview */}
      {pendingAttachment && (
        <AttachmentPreview att={pendingAttachment} onRemove={() => setPendingAttachment(null)} />
      )}

      {/* Input bar */}
      <View style={styles.inputBar}>
        {/* Mention/@ button */}
        <TouchableOpacity
          style={styles.mentionBtn}
          onPress={() => setShowPicker(true)}
        >
          <Ionicons name="at" size={20} color={C.primary} />
        </TouchableOpacity>

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
          style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!canSend}
        >
          {sending
            ? <ActivityIndicator size="small" color={C.white} />
            : <Ionicons name="send" size={18} color={C.white} />
          }
        </TouchableOpacity>
      </View>

      {/* Mention picker */}
      <MentionPicker
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        myId={myId}
        otherId={otherId ?? ''}
        onSelect={att => setPendingAttachment(att)}
      />
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
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

  bubbleWrap: { marginBottom: 6, flexDirection: 'row' },
  bubbleWrapMine: { justifyContent: 'flex-end' },
  bubbleWrapTheirs: { justifyContent: 'flex-start' },

  bubble: {
    maxWidth: '82%', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 9,
    ...SHADOW.sm,
  },
  bubbleMine: { backgroundColor: C.primary, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: C.white, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14, color: C.text, lineHeight: 20 },
  bubbleTextMine: { color: C.white },
  bubbleTime: { fontSize: 10, color: C.textMuted, marginTop: 4, textAlign: 'right' },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.65)' },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingTop: 10, paddingBottom: 30,
    backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.border,
  },
  mentionBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.primaryLight, justifyContent: 'center', alignItems: 'center',
    flexShrink: 0, alignSelf: 'flex-end', marginBottom: 2,
  },
  input: {
    flex: 1, borderWidth: 1.5, borderColor: C.border, borderRadius: 22,
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 14, color: C.text, backgroundColor: C.base,
    maxHeight: 100, minHeight: 44,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  sendBtnDisabled: { backgroundColor: C.borderMed },
});

const attStyles = StyleSheet.create({
  card: {
    borderRadius: 12, padding: 10, marginBottom: 2,
  },
  typeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8,
  },
  typeLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },

  image: { width: '100%', height: 130, borderRadius: 8, marginBottom: 8 },

  scoresWrap: { gap: 5, marginBottom: 8 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  scoreEmoLabel: { width: 12, fontSize: 10, fontWeight: '700' },
  scoreTrack: { flex: 1, height: 7, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.08)', overflow: 'hidden' },
  scoreFill: { height: '100%', borderRadius: 4, opacity: 0.6 },
  scorePct: { width: 30, fontSize: 10, textAlign: 'right' },

  dotsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },

  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  infoEmotion: { fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },
  infoDot: { fontSize: 13 },
  infoPatient: { fontSize: 13, fontWeight: '600' },
  infoSub: { fontSize: 11, marginTop: 2 },
});

const previewStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F3EEFF', borderTopWidth: 1, borderTopColor: '#DDD6F3',
    paddingHorizontal: 14, paddingVertical: 10,
  },
  thumb: { width: 40, height: 40, borderRadius: 8, flexShrink: 0 },
  iconBox: {
    width: 40, height: 40, borderRadius: 8,
    backgroundColor: C.primaryLight, justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  title: { fontSize: 13, fontWeight: '700', color: C.text },
  sub: { fontSize: 11, color: C.textSub, marginTop: 1 },
});
