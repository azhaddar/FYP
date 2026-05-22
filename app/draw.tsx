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
import { C, SHADOW } from '../constants/theme';

const NAVY = '#1A1F3C';

const PROMPT_OPTIONS = [
  { key: 'self',  label: 'Draw Yourself',   icon: 'person-outline' as const, desc: 'A self-portrait or figure drawing' },
  { key: 'house', label: 'Draw Your Home',  icon: 'home-outline'   as const, desc: 'A drawing of the house' },
];

export default function UploadScreen() {
  const router = useRouter();
  const { promptType: paramPromptType, preMood, patientId, patientName } =
    useLocalSearchParams<{ promptType: string; preMood: string; patientId: string; patientName: string }>();

  const [selectedPrompt, setSelectedPrompt] = useState<string>(paramPromptType ?? 'self');
  const [pickedImage, setPickedImage] = useState<{ uri: string; base64: string } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const firstName = (patientName ?? '').split(' ')[0] || 'Child';

  if (!patientId) {
    return (
      <View style={styles.errorRoot}>
        <Ionicons name="alert-circle-outline" size={56} color="#e76f51" />
        <Text style={styles.errorTitle}>No child selected</Text>
        <Text style={styles.errorDesc}>
          Please open Draw from a child's profile on the dashboard.
        </Text>
        <TouchableOpacity style={styles.errorBtn} onPress={() => router.replace('/dashboard')}>
          <Text style={styles.errorBtnText}>Go to Dashboard</Text>
        </TouchableOpacity>
      </View>
    );
  }

  async function handlePick() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library to continue.');
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
      const asset = result.assets[0];
      setPickedImage({ uri: asset.uri, base64: asset.base64 ?? '' });
    }
  }

  async function handleAnalyze() {
    if (!pickedImage?.base64) {
      Alert.alert('No photo selected', 'Please pick a photo first.');
      return;
    }
    setAnalyzing(true);
    try {
      const base64 = pickedImage.base64;
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
      const emotion: string = analyzeResult.data?.emotion ?? 'happy';
      const scores = analyzeResult.data?.scores ?? null;

      await supabase.from('sketches').insert({
        patient_id: patientId,
        emotion,
        notes: null,
        image_url: urlData.publicUrl,
        scores: scores ?? null,
        therapist_message: analyzeResult.data?.therapistMessage ?? null,
        htp_features: analyzeResult.data?.htpFeatures ?? null,
        pre_mood: preMood || null,
      });

      router.replace({
        pathname: '/result',
        params: {
          emotion,
          scores: scores ? JSON.stringify(scores) : '',
          preMood: preMood || '',
          therapistMessage: analyzeResult.data?.therapistMessage ?? '',
          patientId,
          patientName: patientName ?? '',
        },
      });
    } catch (e: any) {
      Alert.alert('Analysis failed', e.message ?? 'Something went wrong. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.canGoBack() ? router.back() : router.replace('/dashboard')}
        >
          <Ionicons name="chevron-back" size={22} color="#fff" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Upload Drawing</Text>
          <Text style={styles.headerSub}>{firstName}</Text>
        </View>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Prompt type selector */}
        <Text style={styles.sectionLabel}>What type of drawing?</Text>
        <View style={styles.promptRow}>
          {PROMPT_OPTIONS.map(opt => {
            const active = selectedPrompt === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.promptCard, active && styles.promptCardActive]}
                onPress={() => setSelectedPrompt(opt.key)}
                activeOpacity={0.8}
                disabled={analyzing}
              >
                <View style={[styles.promptIconWrap, active && styles.promptIconWrapActive]}>
                  <Ionicons name={opt.icon} size={22} color={active ? '#fff' : C.primary} />
                </View>
                <Text style={[styles.promptLabel, active && styles.promptLabelActive]}>{opt.label}</Text>
                <Text style={[styles.promptDesc, active && styles.promptDescActive]}>{opt.desc}</Text>
                {active && (
                  <View style={styles.promptCheck}>
                    <Ionicons name="checkmark-circle" size={18} color={C.primary} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Upload area */}
        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Upload the photo</Text>
        <TouchableOpacity
          style={[styles.uploadBox, pickedImage && styles.uploadBoxFilled]}
          onPress={handlePick}
          activeOpacity={0.85}
          disabled={analyzing}
        >
          {pickedImage ? (
            <Image source={{ uri: pickedImage.uri }} style={styles.preview} resizeMode="contain" />
          ) : (
            <View style={styles.uploadPlaceholder}>
              <View style={styles.uploadIconWrap}>
                <Ionicons name="cloud-upload-outline" size={44} color={C.primary} />
              </View>
              <Text style={styles.uploadTitle}>Tap to choose a photo</Text>
              <Text style={styles.uploadSub}>Select a drawing from your gallery</Text>
            </View>
          )}
        </TouchableOpacity>

        {pickedImage && !analyzing && (
          <TouchableOpacity style={styles.changeBtn} onPress={handlePick}>
            <Ionicons name="repeat-outline" size={15} color={C.primary} />
            <Text style={styles.changeBtnText}>Choose a different photo</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.analyzeBtn, (!pickedImage || analyzing) && styles.analyzeBtnDisabled]}
          onPress={handleAnalyze}
          disabled={!pickedImage || analyzing}
          activeOpacity={0.85}
        >
          {analyzing ? (
            <>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.analyzeBtnText}>Analyzing drawing...</Text>
            </>
          ) : (
            <>
              <Ionicons name="scan-outline" size={20} color="#fff" />
              <Text style={styles.analyzeBtnText}>Analyze Drawing</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.base },

  errorRoot: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', gap: 12, padding: 40 },
  errorTitle: { fontSize: 18, fontWeight: '700', color: NAVY },
  errorDesc: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },
  errorBtn: { marginTop: 8, backgroundColor: NAVY, paddingHorizontal: 28, paddingVertical: 13, borderRadius: 12 },
  errorBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  header: {
    backgroundColor: NAVY,
    paddingTop: 52, paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, minWidth: 70 },
  backText: { fontSize: 15, color: '#fff', fontWeight: '600' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 2 },

  body: { padding: 20, paddingBottom: 12 },

  sectionLabel: {
    fontSize: 13, fontWeight: '700', color: C.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 12,
  },

  promptRow: { flexDirection: 'row', gap: 12 },
  promptCard: {
    flex: 1,
    backgroundColor: C.white,
    borderRadius: 16, padding: 16,
    borderWidth: 2, borderColor: C.border,
    gap: 8,
    position: 'relative',
  },
  promptCardActive: { borderColor: C.primary, backgroundColor: '#fdf2f8' },
  promptIconWrap: {
    width: 44, height: 44, borderRadius: 13,
    backgroundColor: C.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  promptIconWrapActive: { backgroundColor: C.primary },
  promptLabel: { fontSize: 14, fontWeight: '700', color: C.text },
  promptLabelActive: { color: C.primary },
  promptDesc: { fontSize: 12, color: C.textMuted, lineHeight: 16 },
  promptDescActive: { color: C.primary + 'aa' },
  promptCheck: { position: 'absolute', top: 10, right: 10 },

  uploadBox: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 20,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: C.primary,
    backgroundColor: C.white,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadBoxFilled: {
    borderStyle: 'solid',
    borderColor: C.border,
    backgroundColor: C.base,
  },
  uploadPlaceholder: { alignItems: 'center', gap: 10, paddingHorizontal: 24 },
  uploadIconWrap: {
    width: 88, height: 88, borderRadius: 26,
    backgroundColor: C.primaryLight,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 4,
  },
  uploadTitle: { fontSize: 17, fontWeight: '700', color: C.text },
  uploadSub: { fontSize: 13, color: C.textMuted, textAlign: 'center', lineHeight: 18 },
  preview: { width: '100%', height: '100%' },

  changeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'center',
    marginTop: 12,
    paddingVertical: 10, paddingHorizontal: 20,
    borderRadius: 20, borderWidth: 1.5, borderColor: C.primary,
    backgroundColor: '#fdf2f8',
  },
  changeBtnText: { fontSize: 14, fontWeight: '600', color: C.primary },

  footer: {
    paddingHorizontal: 20, paddingBottom: 36, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: C.border,
    backgroundColor: C.white,
    ...SHADOW.lg,
  },
  analyzeBtn: {
    backgroundColor: NAVY, borderRadius: 14, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  analyzeBtnDisabled: { opacity: 0.35 },
  analyzeBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
