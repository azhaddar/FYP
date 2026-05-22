import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, Image, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabaseClient';
import { SHADOW } from '../constants/theme';

const NAVY         = '#1A1F3C';
const YELLOW       = '#FFD93D';
const YELLOW_LIGHT = '#FFFBEB';
const PRIMARY      = '#1E3A8A';
const PRIMARY_LIGHT = '#EFF6FF';
const PRIMARY_MUTED = '#BFDBFE';

const PROMPT_OPTIONS = [
  {
    key:  'self',
    label: 'Draw Yourself',
    icon:  'person-outline' as const,
    desc:  'A self-portrait or figure drawing',
  },
  {
    key:  'house',
    label: 'Draw Your Home',
    icon:  'home-outline' as const,
    desc:  'A drawing of the house',
  },
];

export default function UploadScreen() {
  const router = useRouter();
  const { promptType: paramPromptType, preMood, patientId, patientName } =
    useLocalSearchParams<{ promptType: string; preMood: string; patientId: string; patientName: string }>();

  const [selectedPrompt, setSelectedPrompt] = useState<string>(paramPromptType ?? 'self');
  const [pickedImage, setPickedImage]       = useState<{ uri: string; base64: string } | null>(null);
  const [analyzing, setAnalyzing]           = useState(false);

  const firstName = (patientName ?? '').split(' ')[0] || 'Child';
  const canAnalyze = !!pickedImage && !analyzing;

  if (!patientId) {
    return (
      <View style={st.errorRoot}>
        <Ionicons name="alert-circle-outline" size={56} color="#ef4444" />
        <Text style={st.errorTitle}>No child selected</Text>
        <Text style={st.errorDesc}>Please open Draw from a child's profile on the dashboard.</Text>
        <TouchableOpacity style={st.errorBtn} onPress={() => router.replace('/dashboard')}>
          <Text style={st.errorBtnText}>Go to Dashboard</Text>
        </TouchableOpacity>
      </View>
    );
  }

  async function handleCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access to continue.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      base64: true,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      setPickedImage({ uri: a.uri, base64: a.base64 ?? '' });
    }
  }

  async function handleGallery() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      base64: true,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      setPickedImage({ uri: a.uri, base64: a.base64 ?? '' });
    }
  }

  async function handleAnalyze() {
    if (!pickedImage?.base64) return;
    setAnalyzing(true);
    try {
      const base64  = pickedImage.base64;
      const filename = `${patientId}/${Date.now()}.jpg`;

      const [uploadResult, analyzeResult] = await Promise.all([
        supabase.storage
          .from('sketch-images')
          .upload(filename, decode(base64), { contentType: 'image/jpeg' }),
        supabase.functions.invoke('analyze-sketch', {
          body: { imageBase64: base64, promptType: selectedPrompt, preMood: preMood || null },
        }),
      ]);

      if (uploadResult.error) throw uploadResult.error;
      if (analyzeResult.error) throw analyzeResult.error;

      if (analyzeResult.data?.valid === false) {
        Alert.alert('Wrong Drawing Type', analyzeResult.data.message, [{ text: 'Try Again' }]);
        setAnalyzing(false);
        return;
      }

      const { data: urlData } = supabase.storage.from('sketch-images').getPublicUrl(filename);
      const emotion: string   = analyzeResult.data?.emotion ?? 'happy';
      const scores            = analyzeResult.data?.scores ?? null;

      await supabase.from('sketches').insert({
        patient_id:        patientId,
        emotion,
        notes:             null,
        image_url:         urlData.publicUrl,
        scores:            scores ?? null,
        therapist_message: analyzeResult.data?.therapistMessage ?? null,
        htp_features:      analyzeResult.data?.htpFeatures ?? null,
        pre_mood:          preMood || null,
      });

      router.replace({
        pathname: '/result',
        params: {
          emotion,
          scores:           scores ? JSON.stringify(scores) : '',
          preMood:          preMood || '',
          therapistMessage: analyzeResult.data?.therapistMessage ?? '',
          patientId,
          patientName:      patientName ?? '',
        },
      });
    } catch (e: any) {
      Alert.alert('Analysis failed', e.message ?? 'Something went wrong. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <View style={st.root}>
      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity
          style={st.backBtn}
          onPress={() => router.canGoBack() ? router.back() : router.replace('/dashboard')}
        >
          <Ionicons name="chevron-back" size={22} color="#fff" />
          <Text style={st.backText}>Back</Text>
        </TouchableOpacity>
        <View style={st.headerCenter}>
          <Text style={st.headerTitle}>Upload Drawing</Text>
          <Text style={st.headerSub}>{firstName}</Text>
        </View>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView
        contentContainerStyle={st.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Drawing type selector */}
        <Text style={st.sectionLabel}>What type of drawing?</Text>
        <View style={st.promptRow}>
          {PROMPT_OPTIONS.map(opt => {
            const active = selectedPrompt === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[st.promptCard, active && st.promptCardActive]}
                onPress={() => setSelectedPrompt(opt.key)}
                activeOpacity={0.8}
                disabled={analyzing}
              >
                {active && (
                  <View style={st.promptCheck}>
                    <Ionicons name="checkmark-circle" size={16} color={NAVY} />
                  </View>
                )}
                <View style={[st.promptIconWrap, active && st.promptIconWrapActive]}>
                  <Ionicons name={opt.icon} size={22} color={active ? NAVY : PRIMARY} />
                </View>
                <Text style={[st.promptLabel, active && st.promptLabelActive]}>{opt.label}</Text>
                <Text style={[st.promptDesc, active && st.promptDescActive]}>{opt.desc}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Photo section */}
        <Text style={[st.sectionLabel, { marginTop: 28 }]}>Upload the photo</Text>

        {pickedImage ? (
          /* ── Thumbnail with Retake ── */
          <View style={st.thumbnailWrap}>
            <Image
              source={{ uri: pickedImage.uri }}
              style={st.thumbnail}
              resizeMode="cover"
            />
            <TouchableOpacity
              style={st.retakeBtn}
              onPress={() => setPickedImage(null)}
              disabled={analyzing}
            >
              <Ionicons name="refresh" size={13} color="#fff" />
              <Text style={st.retakeBtnText}>Retake</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* ── Two-action layout ── */
          <View style={st.photoActions}>
            <TouchableOpacity
              style={st.cameraBtn}
              onPress={handleCamera}
              disabled={analyzing}
              activeOpacity={0.88}
            >
              <Ionicons name="camera" size={22} color={NAVY} />
              <Text style={st.cameraBtnText}>Take a Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={st.galleryBtn}
              onPress={handleGallery}
              disabled={analyzing}
              activeOpacity={0.82}
            >
              <Ionicons name="images-outline" size={20} color={PRIMARY} />
              <Text style={st.galleryBtnText}>Upload from Gallery</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={st.footer}>
        <TouchableOpacity
          style={[st.analyzeBtn, !canAnalyze && st.analyzeBtnDisabled]}
          onPress={handleAnalyze}
          disabled={!canAnalyze}
          activeOpacity={0.88}
        >
          {analyzing ? (
            <>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={st.analyzeBtnText}>Analyzing drawing...</Text>
            </>
          ) : (
            <>
              <Ionicons name="scan-outline" size={20} color="#fff" />
              <Text style={st.analyzeBtnText}>Analyze Drawing</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F5FA' },

  errorRoot:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', gap: 12, padding: 40 },
  errorTitle:   { fontSize: 18, fontWeight: '700', color: NAVY },
  errorDesc:    { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },
  errorBtn:     { marginTop: 8, backgroundColor: NAVY, paddingHorizontal: 28, paddingVertical: 13, borderRadius: 12 },
  errorBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  header: {
    backgroundColor: NAVY,
    paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  backBtn:      { flexDirection: 'row', alignItems: 'center', gap: 2, minWidth: 70 },
  backText:     { fontSize: 15, color: '#fff', fontWeight: '600' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle:  { fontSize: 17, fontWeight: '800', color: '#fff' },
  headerSub:    { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 2 },

  body: { padding: 20, paddingBottom: 16 },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: '#6B7280',
    textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 12,
  },

  // ── Prompt cards (centered row) ───────────────────────────────────────────
  promptRow: { flexDirection: 'row', gap: 10 },
  promptCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14, padding: 14,
    borderWidth: 1.5, borderColor: '#E5E7EB',
    gap: 8, position: 'relative',
    ...SHADOW.sm,
  },
  promptCardActive:     { borderColor: YELLOW, backgroundColor: YELLOW_LIGHT },
  promptIconWrap:       { width: 44, height: 44, borderRadius: 13, backgroundColor: PRIMARY_LIGHT, justifyContent: 'center', alignItems: 'center' },
  promptIconWrapActive: { backgroundColor: YELLOW },
  promptLabel:          { fontSize: 13, fontWeight: '700', color: NAVY },
  promptLabelActive:    { color: NAVY },
  promptDesc:           { fontSize: 11, color: '#6B7280', lineHeight: 16 },
  promptDescActive:     { color: '#92400E' },
  promptCheck:          { position: 'absolute', top: 10, right: 10 },

  // ── Photo section ──────────────────────────────────────────────────────────
  photoActions: { gap: 12 },

  // Primary CTA — Take a Photo
  cameraBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: YELLOW,
    borderRadius: 14, paddingVertical: 18,
    ...SHADOW.sm,
  },
  cameraBtnText: { fontSize: 16, fontWeight: '700', color: NAVY },

  // Secondary CTA — Gallery
  galleryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderRadius: 14, paddingVertical: 15,
    borderWidth: 1.5, borderColor: PRIMARY_MUTED,
    backgroundColor: PRIMARY_LIGHT,
  },
  galleryBtnText: { fontSize: 15, fontWeight: '600', color: PRIMARY },

  // ── Thumbnail after photo selected ─────────────────────────────────────────
  thumbnailWrap: {
    borderRadius: 16, overflow: 'hidden',
    aspectRatio: 1, backgroundColor: '#E5E7EB',
    position: 'relative',
    ...SHADOW.md,
  },
  thumbnail: { width: '100%', height: '100%' },
  retakeBtn: {
    position: 'absolute', top: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
  },
  retakeBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  // ── Footer ────────────────────────────────────────────────────────────────
  footer: {
    paddingHorizontal: 20, paddingBottom: 36, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#E5E7EB',
    backgroundColor: '#fff',
    ...SHADOW.lg,
  },
  analyzeBtn: {
    backgroundColor: NAVY, borderRadius: 14, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  analyzeBtnDisabled: {
    backgroundColor: '#9CA3AF',
  },
  analyzeBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
