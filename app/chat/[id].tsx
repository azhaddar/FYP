import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  FlatList, Image, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabaseClient';
import { C, EMOTION_COLORS, SHADOW } from '../../constants/theme';
import { MentionPicker, PickerAttachment } from '../../components/MentionPicker';
import { EmotionIcon } from '../../components/EmotionIcon';
import { useApp } from '../../contexts/AppContext';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SessionCardBubble } from '../../components/SessionCardBubble';
import { ProgressReportBubble, aggregateTimeline } from '../../components/ProgressReportBubble';

// ── Constants ─────────────────────────────────────────────────────────────────
const NAVY     = '#1A1F3C';
const CHAT_BG  = '#F4F2FA';
const OUT_BG   = NAVY;
const IN_BG    = '#FFFFFF';
const EMOTIONS = ['happy', 'sad', 'angry', 'anxious'] as const;

// ── Types ─────────────────────────────────────────────────────────────────────
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
  | { type: 'msg';  msg: Message; key: string };

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yest  = new Date(today); yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yest.toDateString())  return 'Yesterday';
  return d.toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'short' });
}

function fmtShortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
}

function normaliseScores(raw: Record<string, number> | null): Record<string, number> | null {
  if (!raw) return null;
  const vals = EMOTIONS.map(e => raw[e] ?? 0);
  const sum  = vals.reduce((a, b) => a + b, 0);
  if (sum === 0) return null;
  const max  = Math.max(...vals);
  const norm = (v: number) => max <= 1 ? Math.round(v * 100) : Math.round(v);
  return { happy: norm(raw.happy ?? 0), sad: norm(raw.sad ?? 0), angry: norm(raw.angry ?? 0), anxious: norm(raw.anxious ?? 0) };
}

// ── AttachmentBubble — dispatches to the correct rich card ───────────────────
function AttachmentBubble({
  att, isMine, router,
}: {
  att: PickerAttachment;
  isMine: boolean;
  router: ReturnType<typeof useRouter>;
}) {
  if (att.type === 'result') {
    const scores = normaliseScores(att.scores);
    const dom    = att.emotion ?? 'happy';
    const pct    = scores ? scores[dom] : 0;
    return (
      <SessionCardBubble
        isMine={isMine}
        data={{
          patientName:     att.patientName,
          date:            att.date,
          dominantEmotion: dom,
          scores:          att.scores,
          imageUrl:        att.imageUrl,
          sessionLabel:    `Session ${att.sessionNum}`,
        }}
        onViewDetails={() => router.push({ pathname: '/sketch-detail', params: { id: att.id } })}
      />
    );
  }

  if (att.type === 'graph') {
    const chartData  = att.timeline ? aggregateTimeline(att.timeline) : [];
    const dom        = att.emotion ?? 'happy';
    const dateRange  = chartData.length >= 2
      ? `${fmtShortDate(chartData[0].date)} – ${fmtShortDate(chartData[chartData.length - 1].date)}`
      : fmtShortDate(att.date);
    const happyTrend = chartData.length >= 2
      ? chartData[chartData.length - 1].happy - chartData[0].happy
      : 0;
    return (
      <ProgressReportBubble
        data={{
          patientName:     att.patientName,
          dateRange,
          data:            chartData,
          dominantEmotion: dom,
          totalSessions:   att.sessionNum,
          trend:           happyTrend > 5 ? 'improving' : happyTrend < -5 ? 'declining' : 'stable',
        }}
        onViewReport={() => router.push({ pathname: '/child-profile/[id]', params: { id: att.id } })}
      />
    );
  }

  // 'drawing' — simple image card
  return (
    <View style={drawingCardStyle.card}>
      <View style={drawingCardStyle.badge}>
        <Ionicons name="pencil" size={10} color={isMine ? 'rgba(255,255,255,0.7)' : '#6B6B7B'} />
        <Text style={[drawingCardStyle.badgeText, isMine && { color: 'rgba(255,255,255,0.85)' }]}>DRAWING</Text>
      </View>
      {att.imageUrl ? (
        <Image source={{ uri: att.imageUrl }} style={drawingCardStyle.img} resizeMode="cover" />
      ) : (
        <View style={drawingCardStyle.imgEmpty}>
          <Ionicons name="image-outline" size={28} color={isMine ? 'rgba(255,255,255,0.4)' : C.borderMed} />
        </View>
      )}
      <View style={drawingCardStyle.footer}>
        {att.emotion && (
          <View style={drawingCardStyle.emoPill}>
            <EmotionIcon emotion={att.emotion} size={12} />
            <Text style={drawingCardStyle.emoText}>
              {att.emotion.charAt(0).toUpperCase() + att.emotion.slice(1)}
            </Text>
          </View>
        )}
        <Text style={[drawingCardStyle.patient, isMine && { color: 'rgba(255,255,255,0.75)' }]}>
          {att.patientName}
        </Text>
      </View>
    </View>
  );
}

const drawingCardStyle = StyleSheet.create({
  card:     { borderRadius: 12, overflow: 'hidden', minWidth: 180 },
  badge:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 7 },
  badgeText:{ fontSize: 9, fontWeight: '800', color: '#6B6B7B', letterSpacing: 0.8 },
  img:      { width: '100%', height: 130, borderRadius: 10, marginBottom: 8 },
  imgEmpty: { width: '100%', height: 90, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.08)', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  footer:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  emoPill:  { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  emoText:  { fontSize: 11, fontWeight: '700', color: '#fff', textTransform: 'capitalize' },
  patient:  { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
});

// ── Pending attachment preview (above input bar) ──────────────────────────────
function AttachmentPreview({ att, onRemove }: { att: PickerAttachment; onRemove: () => void }) {
  return (
    <View style={prevStyles.wrap}>
      {att.imageUrl ? (
        <Image source={{ uri: att.imageUrl }} style={prevStyles.thumb} resizeMode="cover" />
      ) : (
        <View style={prevStyles.iconBox}>
          <Ionicons name={att.type === 'result' ? 'bar-chart' : 'trending-up'} size={16} color={C.primary} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={prevStyles.title} numberOfLines={1}>{att.title}</Text>
        <Text style={prevStyles.sub}>{att.patientName}</Text>
      </View>
      <TouchableOpacity onPress={onRemove} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="close-circle" size={20} color={C.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function ChatScreen() {
  const router   = useRouter();
  const { id }   = useLocalSearchParams<{ id: string }>();
  const { otherName, otherRole } = useLocalSearchParams<{ otherName: string; otherRole: string }>();
  const { profile } = useApp();

  const [myId, setMyId]           = useState('');
  const [messages, setMessages]   = useState<Message[]>([]);
  const [text, setText]           = useState('');
  const [loading, setLoading]     = useState(true);
  const [sending, setSending]     = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pendingAtt, setPendingAtt] = useState<PickerAttachment | null>(null);
  const [online, setOnline]       = useState(false);

  const flatRef    = useRef<FlatList>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // conversationId matches web format: therapistId_guardianId
  const conversationId = profile?.role === 'therapist'
    ? `${myId}_${id}`
    : `${id}_${myId}`;

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setMyId(user.id);
    });
    return () => { channelRef.current?.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (myId && id) {
      fetchMessages();
      markRead();
      subscribeToNew();
    }
  }, [myId, id]);

  async function fetchMessages() {
    setLoading(true);
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${myId},receiver_id.eq.${id}),and(sender_id.eq.${id},receiver_id.eq.${myId})`)
      .order('created_at', { ascending: true });
    if (error) console.error('fetchMessages:', error.message);
    setMessages(data ?? []);
    setLoading(false);
  }

  async function markRead() {
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('receiver_id', myId)
      .eq('sender_id', id)
      .is('read_at', null);
  }

  function subscribeToNew() {
    channelRef.current = supabase
      .channel(`chat-${[myId, id].sort().join('-')}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `receiver_id=eq.${myId}`,
      }, (payload) => {
        const msg = payload.new as Message;
        if (msg.sender_id !== id) return;
        setMessages(prev => [...prev, msg]);
        supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('id', msg.id);
      })
      .subscribe();
  }

  async function sendMessage() {
    const content = text.trim();
    if ((!content && !pendingAtt) || !myId || !id || sending) return;
    setSending(true);
    const att = pendingAtt;
    setText('');
    setPendingAtt(null);

    const payload: Record<string, unknown> = {
      sender_id: myId,
      receiver_id: id,
      conversation_id: conversationId,
      content: content || ' ',
    };
    if (att) payload.attachment = att;

    const { data, error } = await supabase
      .from('messages').insert(payload).select('*').single();

    if (error) {
      Alert.alert('Failed to send', error.message);
      setText(content);
      setPendingAtt(att);
    } else if (data) {
      setMessages(prev => [...prev, data as Message]);
    }
    setSending(false);
  }

  // Build list items with date separators
  const listItems: ListItem[] = [];
  let lastDate = '';
  for (const msg of messages) {
    const dateKey = msg.created_at.slice(0, 10);
    if (dateKey !== lastDate) {
      listItems.push({ type: 'date', label: fmtDate(msg.created_at), key: `d-${dateKey}` });
      lastDate = dateKey;
    }
    listItems.push({ type: 'msg', msg, key: msg.id });
  }

  const canSend = (text.trim().length > 0 || !!pendingAtt) && !sending && !!myId && !!id;
  const displayName = otherName ?? 'Therapist';

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* ── Header ───────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={C.white} />
        </TouchableOpacity>

        <View style={s.headerCenter}>
          <View style={s.avatarWrap}>
            <View style={s.avatarCircle}>
              <Text style={s.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={s.onlineDot} />
          </View>
          <View>
            <Text style={s.headerName}>{displayName}</Text>
            <Text style={s.headerRole}>{otherRole || 'Therapist'}</Text>
          </View>
        </View>

        <TouchableOpacity style={s.moreBtn}>
          <Ionicons name="ellipsis-vertical" size={18} color="rgba(255,255,255,0.75)" />
        </TouchableOpacity>
      </View>

      {/* ── Message list ─────────────────────────────────── */}
      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={NAVY} />
        </View>
      ) : (
        <FlatList
          ref={flatRef}
          data={listItems}
          keyExtractor={item => item.key}
          contentContainerStyle={[
            s.msgList,
            listItems.length === 0 && s.msgListEmpty,
          ]}
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.emptyChat}>
              <View style={s.emptyChatIcon}>
                <Ionicons name="chatbubble-ellipses-outline" size={40} color={C.primary} />
              </View>
              <Text style={s.emptyChatTitle}>Start the conversation</Text>
              <Text style={s.emptyChatSub}>
                Send a message or share a session result with {displayName}.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            if (item.type === 'date') {
              return (
                <View style={s.dateSep}>
                  <View style={s.dateSepLine} />
                  <Text style={s.dateSepText}>{item.label}</Text>
                  <View style={s.dateSepLine} />
                </View>
              );
            }

            const { msg } = item;
            const isMine  = msg.sender_id === myId;
            const hasAtt  = !!msg.attachment;
            const hasText = msg.content && msg.content.trim() && msg.content !== ' ';

            return (
              <View style={[s.bubbleWrap, isMine ? s.bubbleWrapMine : s.bubbleWrapTheirs]}>
                {/* Avatar for incoming only */}
                {!isMine && (
                  <View style={s.incomingAvatar}>
                    <Text style={s.incomingAvatarText}>{displayName.charAt(0).toUpperCase()}</Text>
                  </View>
                )}

                <View style={s.bubbleCol}>
                  <View style={[
                    s.bubble,
                    isMine  ? s.bubbleMine  : s.bubbleTheirs,
                    hasAtt  ? s.bubbleWithCard : null,
                  ]}>
                    {/* Rich media card */}
                    {hasAtt && msg.attachment ? (
                      <AttachmentBubble att={msg.attachment} isMine={isMine} router={router} />
                    ) : null}

                    {/* Text content */}
                    {hasText ? (
                      <Text style={[s.bubbleText, isMine && s.bubbleTextMine, hasAtt && { marginTop: 8 }]}>
                        {msg.content}
                      </Text>
                    ) : null}

                    {/* Timestamp + tick */}
                    <View style={s.timeRow}>
                      <Text style={[s.timeText, isMine && s.timeTextMine]}>
                        {fmtTime(msg.created_at)}
                      </Text>
                      {isMine && (
                        <Ionicons
                          name={msg.read_at ? 'checkmark-done' : 'checkmark'}
                          size={13}
                          color={msg.read_at ? '#82CFFF' : 'rgba(255,255,255,0.55)'}
                        />
                      )}
                    </View>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* ── Attachment preview ───────────────────────────── */}
      {pendingAtt && (
        <AttachmentPreview att={pendingAtt} onRemove={() => setPendingAtt(null)} />
      )}

      {/* ── Input bar ────────────────────────────────────── */}
      <View style={s.inputBar}>
        <TouchableOpacity style={s.attachBtn} onPress={() => setShowPicker(true)}>
          <Ionicons name="add" size={22} color={NAVY} />
        </TouchableOpacity>

        <TextInput
          style={s.input}
          value={text}
          onChangeText={setText}
          placeholder="Type a message…"
          placeholderTextColor={C.textMuted}
          multiline
          maxLength={500}
        />

        <TouchableOpacity
          style={[s.sendBtn, !canSend && s.sendBtnOff]}
          onPress={sendMessage}
          disabled={!canSend}
          activeOpacity={0.8}
        >
          {sending
            ? <ActivityIndicator size="small" color={C.white} />
            : <Ionicons name="send" size={17} color={C.white} />
          }
        </TouchableOpacity>
      </View>

      {/* ── Attachment picker modal ───────────────────────── */}
      <MentionPicker
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        myId={myId}
        otherId={id ?? ''}
        onSelect={att => setPendingAtt(att)}
      />
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CHAT_BG },

  // Header
  header: {
    backgroundColor: NAVY,
    paddingTop: 52, paddingBottom: 14, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1, marginHorizontal: 10 },
  avatarWrap:   { position: 'relative' },
  avatarCircle: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarText:  { fontSize: 17, fontWeight: '800', color: C.white },
  onlineDot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 11, height: 11, borderRadius: 6,
    backgroundColor: '#4ade80', borderWidth: 2, borderColor: NAVY,
  },
  headerName:  { fontSize: 16, fontWeight: '700', color: C.white },
  headerRole:  { fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: '500', marginTop: 1 },
  moreBtn:     { width: 38, height: 38, justifyContent: 'center', alignItems: 'center' },

  // Message list
  loadingWrap:   { flex: 1, justifyContent: 'center', alignItems: 'center' },
  msgList:       { paddingHorizontal: 16, paddingVertical: 18 },
  msgListEmpty:  { flex: 1, justifyContent: 'center' },

  emptyChat: { alignItems: 'center', paddingHorizontal: 32, paddingVertical: 24 },
  emptyChatIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: C.primaryLight,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  emptyChatTitle: { fontSize: 18, fontWeight: '700', color: NAVY, marginBottom: 8 },
  emptyChatSub:   { fontSize: 13, color: C.textMuted, textAlign: 'center', lineHeight: 20 },

  // Date separator
  dateSep: {
    flexDirection: 'row', alignItems: 'center',
    marginVertical: 20, gap: 10,
  },
  dateSepLine: { flex: 1, height: 1, backgroundColor: '#DDD8F0' },
  dateSepText: {
    fontSize: 11, fontWeight: '600', color: '#A099CC',
    paddingHorizontal: 12, paddingVertical: 4,
    backgroundColor: '#EAE7F8', borderRadius: 12,
  },

  // Bubbles
  bubbleWrap:       { marginBottom: 14, flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  bubbleWrapMine:   { justifyContent: 'flex-end' },
  bubbleWrapTheirs: { justifyContent: 'flex-start' },

  incomingAvatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: C.primaryLight,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  incomingAvatarText: { fontSize: 12, fontWeight: '800', color: C.primary },

  bubbleCol:   { maxWidth: '78%' },
  bubble: {
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 11,
    ...SHADOW.sm,
  },
  bubbleMine:     { backgroundColor: OUT_BG, borderBottomRightRadius: 5 },
  bubbleTheirs:   { backgroundColor: IN_BG,  borderBottomLeftRadius: 5  },
  bubbleWithCard: { paddingHorizontal: 10, paddingVertical: 10 },

  bubbleText:     { fontSize: 14.5, color: NAVY, lineHeight: 21 },
  bubbleTextMine: { color: C.white },

  timeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    gap: 4, marginTop: 5,
  },
  timeText:     { fontSize: 10, color: C.textMuted },
  timeTextMine: { color: 'rgba(255,255,255,0.55)' },

  // Input bar
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 9,
    paddingHorizontal: 14, paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 30 : 14,
    backgroundColor: C.white,
    borderTopWidth: 1, borderTopColor: '#EDEAF5',
  },
  attachBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#EEF0FF',
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
    alignSelf: 'flex-end', marginBottom: 1,
  },
  input: {
    flex: 1, minHeight: 42, maxHeight: 110,
    borderWidth: 1.5, borderColor: '#DDD8F0', borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 11 : 9,
    paddingBottom: Platform.OS === 'ios' ? 11 : 9,
    fontSize: 14.5, color: NAVY, backgroundColor: '#FAFBFF',
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: NAVY, justifyContent: 'center', alignItems: 'center',
    flexShrink: 0, alignSelf: 'flex-end',
  },
  sendBtnOff: { backgroundColor: '#C8C4DC' },
});


// ── Attachment preview strip styles ──────────────────────────────────────────
const prevStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F3EEFF', paddingHorizontal: 14, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: '#DDD6F3',
  },
  thumb:   { width: 38, height: 38, borderRadius: 8, flexShrink: 0 },
  iconBox: {
    width: 38, height: 38, borderRadius: 8,
    backgroundColor: C.primaryLight, justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  title: { fontSize: 13, fontWeight: '700', color: NAVY },
  sub:   { fontSize: 11, color: C.textMuted, marginTop: 1 },
});
