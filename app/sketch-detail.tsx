import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert,
  Image, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView,
  Platform, Animated, Easing, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabaseClient';
import { useApp } from '../contexts/AppContext';
import { C, EMOTION_COLORS, MAX_W, SHADOW } from '../constants/theme';

const NAVY = '#1A1F3C';
import { Sketch } from '../types';
import { EmotionIcon } from '../components/EmotionIcon';

const EMOTION_ORDER = ['happy', 'sad', 'angry', 'anxious'] as const;

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    time: d.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' }),
  };
}

function EmotionBar({ emotion, pct, isTop }: { emotion: string; pct: number; isTop: boolean }) {
  const anim = useRef(new Animated.Value(0)).current;
  const ec = EMOTION_COLORS[emotion];

  useEffect(() => {
    Animated.timing(anim, {
      toValue: pct,
      duration: 800,
      delay: EMOTION_ORDER.indexOf(emotion as any) * 100,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [pct]);

  const width = anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

  return (
    <View style={barStyles.row}>
      <View style={barStyles.emojiBox}>
        <EmotionIcon emotion={emotion} size={18} />
      </View>
      <View style={barStyles.track}>
        <Animated.View style={[barStyles.fill, { width, backgroundColor: ec.text }, isTop && barStyles.fillTop]} />
      </View>
      <Text style={[barStyles.pct, isTop && { color: ec.text, fontWeight: '800' }]}>{pct}%</Text>
    </View>
  );
}

export default function SketchDetailScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { profile } = useApp();
  const { sketchId } = useLocalSearchParams<{ sketchId: string; editable: string }>();
  const isTherapist = profile?.role === 'therapist';
  const isParentView = !isTherapist;

  const [sketch, setSketch] = useState<Sketch | null>(null);
  const [loading, setLoading] = useState(true);
  const [noteModal, setNoteModal] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [therapistNoteModal, setTherapistNoteModal] = useState(false);
  const [therapistNoteText, setTherapistNoteText] = useState('');
  const [savingTherapistNote, setSavingTherapistNote] = useState(false);

  useEffect(() => {
    fetchSketch();
  }, [sketchId]);

  async function fetchSketch() {
    if (!sketchId) return;
    const { data } = await supabase
      .from('sketches')
      .select('*')
      .eq('id', sketchId)
      .single();
    setSketch(data ?? null);
    setLoading(false);
  }

  async function saveNote() {
    if (!sketch) return;
    setSavingNote(true);
    const note = noteText.trim() || null;
    const { error } = await supabase
      .from('sketches')
      .update({ notes: note })
      .eq('id', sketch.id);
    if (!error) setSketch(prev => prev ? { ...prev, notes: note } : prev);
    setSavingNote(false);
    setNoteModal(false);
  }

  function openNoteEditor() {
    setNoteText(sketch?.notes ?? '');
    setNoteModal(true);
  }

  async function saveTherapistNote() {
    if (!sketch) return;
    setSavingTherapistNote(true);
    const note = therapistNoteText.trim() || null;
    const { error } = await supabase
      .from('sketches')
      .update({ therapist_notes: note })
      .eq('id', sketch.id);
    setSavingTherapistNote(false);
    if (error) {
      Alert.alert('Save failed', error.message);
      return;
    }
    setSketch(prev => prev ? { ...prev, therapist_notes: note } : prev);
    setTherapistNoteModal(false);
  }

  function openTherapistNoteEditor() {
    setTherapistNoteText(sketch?.therapist_notes ?? '');
    setTherapistNoteModal(true);
  }

  if (loading) {
    return (
      <View style={styles.loadingRoot}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  if (!sketch) {
    return (
      <View style={styles.loadingRoot}>
        <Text style={{ color: C.textSub }}>Drawing not found.</Text>
      </View>
    );
  }

  const ec = EMOTION_COLORS[sketch.emotion];
  const { date, time } = formatDateTime(sketch.created_at);
  const scores = sketch.scores;
  const hasMoodContrast = sketch.pre_mood && sketch.pre_mood !== sketch.emotion;

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.headerInner, false]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={C.white} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Drawing Detail</Text>
          <View style={{ width: 80 }} />
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, false]}>

        {/* Drawing image */}
        <View style={styles.imageCard}>
          {sketch.image_url ? (
            <Image
              source={{ uri: sketch.image_url }}
              style={styles.image}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="image-outline" size={48} color={C.borderMed} />
              <Text style={styles.imagePlaceholderText}>No image saved</Text>
            </View>
          )}
        </View>

        {/* Emotion + date row */}
        <View style={[styles.emotionCard, { backgroundColor: ec.card }]}>
          <View style={styles.emotionLeft}>
            <EmotionIcon emotion={sketch.emotion} size={38} />
            <View style={styles.emotionInfo}>
              <Text style={[styles.emotionLabel, { color: ec.text }]}>
                {sketch.emotion.charAt(0).toUpperCase() + sketch.emotion.slice(1)}
              </Text>
              <Text style={[styles.emotionSub, { color: ec.text + 'aa' }]}>Dominant emotion</Text>
            </View>
          </View>
          <View style={styles.dateBlock}>
            <Text style={[styles.dateText, { color: ec.text }]}>{time}</Text>
            <Text style={[styles.dateSubText, { color: ec.text + 'aa' }]}>{date}</Text>
          </View>
        </View>

        {/* Before → After mood comparison */}
        {sketch.pre_mood ? (
          <View style={styles.moodCompareCard}>
            <Text style={styles.moodCompareTitle}>Mood Check-in</Text>
            <View style={styles.moodCompareRow}>
              <View style={styles.moodPill}>
                <Text style={styles.moodPillLabel}>Before drawing</Text>
                <EmotionIcon emotion={sketch.pre_mood} size={22} />
                <Text style={styles.moodPillEmotion}>
                  {sketch.pre_mood.charAt(0).toUpperCase() + sketch.pre_mood.slice(1)}
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color={C.textMuted} />
              <View style={[styles.moodPill, { borderColor: hasMoodContrast ? ec.text + '44' : C.border }]}>
                <Text style={styles.moodPillLabel}>Drawing shows</Text>
                <EmotionIcon emotion={sketch.emotion} size={22} />
                <Text style={[styles.moodPillEmotion, hasMoodContrast && { color: ec.text }]}>
                  {sketch.emotion.charAt(0).toUpperCase() + sketch.emotion.slice(1)}
                </Text>
              </View>
            </View>
            {hasMoodContrast && (
              <Text style={styles.moodContrastNote}>
                The drawing showed a different emotion than reported — this is normal and clinically meaningful.
              </Text>
            )}
          </View>
        ) : null}

        {/* Therapist message */}
        {sketch.therapist_message ? (
          <View style={styles.therapistCard}>
            <View style={styles.therapistHeader}>
              <View style={styles.therapistIconCircle}>
                <Ionicons name="heart" size={14} color={C.primary} />
              </View>
              <View>
                <Text style={styles.therapistBadge}>Virtual Therapist</Text>
                <Text style={styles.therapistTitle}>A Note For You</Text>
              </View>
            </View>
            <Text style={styles.therapistMessage}>{sketch.therapist_message}</Text>
          </View>
        ) : null}

        {/* Emotion breakdown */}
        {scores ? (
          <View style={styles.scoresCard}>
            <Text style={styles.scoresTitle}>Emotion Breakdown</Text>
            <Text style={styles.scoresSub}>Based on drawing colors, shapes, and themes</Text>
            <View style={styles.barsWrap}>
              {EMOTION_ORDER.map(e => (
                <EmotionBar
                  key={e}
                  emotion={e}
                  pct={scores[e] ?? 0}
                  isTop={e === sketch.emotion}
                />
              ))}
            </View>
          </View>
        ) : null}

        {/* Therapist note */}
        {(isTherapist || sketch.therapist_notes) ? (
          <View style={styles.therapistNoteCard}>
            <View style={styles.noteHeader}>
              <View style={styles.noteTitleRow}>
                <View style={styles.therapistNoteIconCircle}>
                  <Ionicons name="person-circle" size={14} color="#0d9488" />
                </View>
                <Text style={styles.therapistNoteTitle}>Therapist's Note</Text>
              </View>
              {isTherapist && (
                <TouchableOpacity style={styles.editTherapistNoteBtn} onPress={openTherapistNoteEditor}>
                  <Text style={styles.editTherapistNoteBtnText}>
                    {sketch.therapist_notes ? 'Edit' : '+ Add Note'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            {sketch.therapist_notes ? (
              <Text style={styles.therapistNoteText}>{sketch.therapist_notes}</Text>
            ) : (
              <Text style={styles.noteEmpty}>No note added yet. Tap "+ Add Note" to write one.</Text>
            )}
          </View>
        ) : null}

        {/* Parent note */}
        <View style={styles.noteCard}>
          <View style={styles.noteHeader}>
            <View style={styles.noteTitleRow}>
              <Ionicons name="document-text-outline" size={18} color={C.textSub} />
              <Text style={styles.noteTitle}>Parent's Note</Text>
            </View>
            {isParentView && (
              <TouchableOpacity style={styles.editNoteBtn} onPress={openNoteEditor}>
                <Text style={styles.editNoteBtnText}>{sketch.notes ? 'Edit' : '+ Add Note'}</Text>
              </TouchableOpacity>
            )}
          </View>
          {sketch.notes ? (
            <Text style={styles.noteText}>{sketch.notes}</Text>
          ) : (
            <Text style={styles.noteEmpty}>No note added yet.</Text>
          )}
        </View>

      </ScrollView>

      {/* Therapist note modal */}
      <Modal visible={therapistNoteModal} transparent animationType="slide" onRequestClose={() => setTherapistNoteModal(false)}>
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{sketch?.therapist_notes ? 'Edit Note' : 'Add Therapist Note'}</Text>
            <Text style={styles.modalSub}>This note is visible to the parent/guardian only</Text>
            <TextInput
              style={[styles.noteInput, styles.therapistNoteInput]}
              value={therapistNoteText}
              onChangeText={setTherapistNoteText}
              placeholder="e.g. Child seems more expressive this week..."
              placeholderTextColor={C.textMuted}
              multiline
              maxLength={500}
              autoFocus
            />
            <Text style={styles.charCount}>{therapistNoteText.length}/500</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setTherapistNoteModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveTherapistBtn, savingTherapistNote && { opacity: 0.7 }]}
                onPress={saveTherapistNote}
                disabled={savingTherapistNote}
              >
                {savingTherapistNote
                  ? <ActivityIndicator color={C.white} size="small" />
                  : <Text style={styles.saveBtnText}>Save Note</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Parent note modal */}
      <Modal visible={noteModal} transparent animationType="slide" onRequestClose={() => setNoteModal(false)}>
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{sketch.notes ? 'Edit Note' : 'Add Note'}</Text>
            <Text style={styles.modalSub}>Add context about this drawing session</Text>
            <TextInput
              style={styles.noteInput}
              value={noteText}
              onChangeText={setNoteText}
              placeholder="e.g. This was after school today..."
              placeholderTextColor={C.textMuted}
              multiline
              maxLength={300}
              autoFocus
            />
            <Text style={styles.charCount}>{noteText.length}/300</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setNoteModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, savingNote && { opacity: 0.7 }]}
                onPress={saveNote}
                disabled={savingNote}
              >
                {savingNote
                  ? <ActivityIndicator color={C.white} size="small" />
                  : <Text style={styles.saveBtnText}>Save Note</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F2F2F7' },
  loadingRoot: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F2F2F7' },

  header: { backgroundColor: NAVY, paddingTop: 52, paddingBottom: 16 },
  headerInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, alignSelf: 'center', width: '100%',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 80 },
  backText: { fontSize: 15, color: C.white, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: C.white },

  content: { padding: 16, paddingBottom: 40, gap: 12 },
  contentWide: { maxWidth: MAX_W, alignSelf: 'center', width: '100%' },

  imageCard: {
    backgroundColor: C.white, borderRadius: 18,
    overflow: 'hidden', minHeight: 260,
    justifyContent: 'center', alignItems: 'center',
    ...SHADOW.sm,
  },
  image: { width: '100%', height: 300 },
  imagePlaceholder: { paddingVertical: 50, alignItems: 'center', gap: 12 },
  imagePlaceholderText: { fontSize: 13, color: C.textMuted },

  emotionCard: {
    borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  emotionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emotionInfo: { gap: 2 },
  emotionLabel: { fontSize: 20, fontWeight: '800', textTransform: 'capitalize' },
  emotionSub: { fontSize: 11, fontWeight: '600' },
  dateBlock: { alignItems: 'flex-end', gap: 2 },
  dateText: { fontSize: 14, fontWeight: '700' },
  dateSubText: { fontSize: 11, fontWeight: '500', textAlign: 'right', maxWidth: 130 },

  moodCompareCard: {
    backgroundColor: C.white, borderRadius: 16,
    padding: 16, gap: 10,
    ...SHADOW.sm,
  },
  moodCompareTitle: { fontSize: 13, fontWeight: '700', color: C.textSub },
  moodCompareRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  moodPill: {
    flex: 1, alignItems: 'center', gap: 5,
    backgroundColor: C.base, borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 8,
    borderWidth: 1, borderColor: C.border,
  },
  moodPillLabel: { fontSize: 10, color: C.textMuted, fontWeight: '600', textTransform: 'uppercase' },
  moodPillEmotion: { fontSize: 12, fontWeight: '700', color: C.text, textTransform: 'capitalize' },
  moodContrastNote: {
    fontSize: 11, color: C.textSub, fontStyle: 'italic', lineHeight: 17,
    borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8,
  },

  therapistCard: {
    backgroundColor: C.white, borderRadius: 16,
    padding: 16, borderLeftWidth: 3, borderLeftColor: C.primary, gap: 10,
    ...SHADOW.sm,
  },
  therapistHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  therapistIconCircle: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: C.primaryLight, justifyContent: 'center', alignItems: 'center',
  },
  therapistBadge: { fontSize: 10, fontWeight: '700', color: C.primary, textTransform: 'uppercase', letterSpacing: 0.8 },
  therapistTitle: { fontSize: 14, fontWeight: '800', color: C.text },
  therapistMessage: { fontSize: 14, color: C.textSub, lineHeight: 22 },

  scoresCard: {
    backgroundColor: C.white, borderRadius: 16,
    padding: 16, gap: 3,
    ...SHADOW.sm,
  },
  scoresTitle: { fontSize: 14, fontWeight: '800', color: C.text },
  scoresSub: { fontSize: 11, color: C.textMuted, marginBottom: 10 },
  barsWrap: { gap: 10 },

  therapistNoteCard: {
    backgroundColor: '#f0fdfa', borderRadius: 16,
    padding: 16, gap: 8, borderLeftWidth: 3, borderLeftColor: '#0d9488',
    ...SHADOW.sm,
  },
  therapistNoteIconCircle: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#ccfbf1', justifyContent: 'center', alignItems: 'center',
  },
  therapistNoteTitle: { fontSize: 14, fontWeight: '700', color: '#0d9488' },
  editTherapistNoteBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 9, backgroundColor: '#ccfbf1',
  },
  editTherapistNoteBtnText: { fontSize: 12, fontWeight: '700', color: '#0d9488' },
  therapistNoteText: { fontSize: 14, color: '#134e4a', lineHeight: 21 },
  therapistNoteInput: { borderColor: '#99f6e4' },
  saveTherapistBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 12,
    backgroundColor: '#0d9488', alignItems: 'center',
  },

  noteCard: {
    backgroundColor: C.white, borderRadius: 16,
    padding: 16, gap: 8,
    ...SHADOW.sm,
  },
  noteHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  noteTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  noteTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  editNoteBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 9, backgroundColor: C.primaryLight,
  },
  editNoteBtnText: { fontSize: 12, fontWeight: '700', color: C.primary },
  noteText: { fontSize: 14, color: C.textSub, lineHeight: 21 },
  noteEmpty: { fontSize: 13, color: C.textMuted, fontStyle: 'italic' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#FFF8F0', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 36, gap: 4,
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: '#F9A8C9',
    alignSelf: 'center', marginBottom: 14,
  },
  modalTitle: { fontSize: 19, fontWeight: '800', color: C.text },
  modalSub: { fontSize: 13, color: C.textSub, marginBottom: 14 },
  noteInput: {
    borderWidth: 1.5, borderColor: '#F9A8C9', borderRadius: 14,
    padding: 14, fontSize: 14, color: C.text, minHeight: 110,
    textAlignVertical: 'top', backgroundColor: C.white, marginBottom: 4,
  },
  charCount: { fontSize: 11, color: C.textMuted, textAlign: 'right', marginBottom: 14 },
  modalActions: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    backgroundColor: C.base, borderWidth: 1, borderColor: C.border,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: C.textSub },
  saveBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 12,
    backgroundColor: C.primary, alignItems: 'center',
  },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: C.white },
});

const barStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  emojiBox: { width: 26, alignItems: 'center' },
  track: { flex: 1, height: 10, borderRadius: 5, backgroundColor: C.base, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5, opacity: 0.7 },
  fillTop: { opacity: 1 },
  pct: { width: 38, fontSize: 13, color: C.textMuted, textAlign: 'right' },
});
