import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Alert, ScrollView,
  useWindowDimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../lib/supabaseClient';
import { useApp } from '../../contexts/AppContext';
import { C, MAX_W, SHADOW } from '../../constants/theme';
import { PromptType } from './home';

const PROMPT_LABEL: Record<PromptType, string> = {
  self: 'Draw Yourself',
  house: 'Draw Your Home',
};

export default function UploadScreen() {
  const { activeChild } = useApp();
  const router = useRouter();
  const { promptType, preMood } = useLocalSearchParams<{ promptType: PromptType; preMood: string }>();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  async function pickFromCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access in Settings to use this feature.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setImageBase64(result.assets[0].base64 ?? null);
    }
  }

  async function pickFromGallery() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access in Settings to use this feature.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setImageBase64(result.assets[0].base64 ?? null);
    }
  }

  function handleRetake() {
    setImageUri(null);
    setImageBase64(null);
  }

  async function handleAnalyze() {
    if (!imageBase64) {
      Alert.alert('No photo', 'Please take or choose a photo first!');
      return;
    }
    setAnalyzing(true);

    try {
      const filename = `${activeChild?.id ?? 'unknown'}/${Date.now()}.jpg`;

      const [uploadResult, analyzeResult] = await Promise.all([
        supabase.storage
          .from('sketch-images')
          .upload(filename, decode(imageBase64), { contentType: 'image/jpeg' }),
        supabase.functions.invoke('analyze-sketch', {
          body: { imageBase64, promptType: promptType ?? 'self', preMood: preMood || null },
        }),
      ]);

      if (uploadResult.error) throw uploadResult.error;
      if (analyzeResult.error) throw analyzeResult.error;

      if (analyzeResult.data?.valid === false) {
        Alert.alert('Wrong Drawing Topic', analyzeResult.data.message,
          [{ text: 'Try Again', style: 'default' }]
        );
        setAnalyzing(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('sketch-images')
        .getPublicUrl(filename);

      const emotion: string = analyzeResult.data?.emotion ?? 'happy';
      const scores = analyzeResult.data?.scores ?? null;
      const imageUrl = urlData.publicUrl;

      if (activeChild) {
        await supabase.from('sketches').insert({
          patient_id: activeChild.id,
          emotion,
          notes: null,
          image_url: imageUrl,
          scores: scores ?? null,
          therapist_message: analyzeResult.data?.therapistMessage ?? null,
          htp_features: analyzeResult.data?.htpFeatures ?? null,
          pre_mood: preMood || null,
        });
      }

      router.replace({
        pathname: '/child/result',
        params: {
          emotion,
          scores: scores ? JSON.stringify(scores) : '',
          preMood: preMood || '',
          therapistMessage: analyzeResult.data?.therapistMessage ?? '',
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
        <View style={[styles.headerInner, isWide && { maxWidth: MAX_W }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={20} color={C.primary} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{PROMPT_LABEL[promptType ?? 'self']}</Text>
          <View style={{ width: 80 }} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, isWide && { maxWidth: MAX_W, alignSelf: 'center', width: '100%' }]}
      >
        {!imageUri ? (
          /* Pick source */
          <View style={styles.pickSection}>
            <View style={styles.iconCircle}>
              <Ionicons name="camera-outline" size={56} color={C.primary} />
            </View>
            <Text style={styles.pickTitle}>Upload your drawing</Text>
            <Text style={styles.pickDesc}>Take a photo of your paper drawing or choose one from your photo library</Text>

            <TouchableOpacity style={styles.primaryBtn} onPress={pickFromCamera} activeOpacity={0.85}>
              <Ionicons name="camera" size={22} color={C.white} />
              <Text style={styles.primaryBtnText}>Take a Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryBtn} onPress={pickFromGallery} activeOpacity={0.85}>
              <Ionicons name="images-outline" size={22} color={C.primary} />
              <Text style={styles.secondaryBtnText}>Choose from Library</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Preview + analyze */
          <View style={styles.previewSection}>
            <Text style={styles.previewTitle}>Your Drawing</Text>
            <View style={styles.previewFrame}>
              <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="contain" />
            </View>

            <TouchableOpacity
              style={[styles.analyzeBtn, analyzing && { opacity: 0.8 }]}
              onPress={handleAnalyze}
              disabled={analyzing}
              activeOpacity={0.85}
            >
              {analyzing ? (
                <>
                  <ActivityIndicator color={C.white} />
                  <Text style={styles.analyzeBtnText}>Analyzing your drawing...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="scan-outline" size={22} color={C.white} />
                  <Text style={styles.analyzeBtnText}>Analyze My Drawing!</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.retakeBtn} onPress={handleRetake} disabled={analyzing}>
              <Ionicons name="refresh-outline" size={18} color={C.textSub} />
              <Text style={styles.retakeBtnText}>Use a Different Photo</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.base },

  header: {
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingTop: 52,
    paddingBottom: 14,
  },
  headerInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, alignSelf: 'center', width: '100%',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backText: { fontSize: 15, color: C.primary, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: C.text },

  content: { padding: 20, paddingBottom: 40 },

  pickSection: { alignItems: 'center', paddingTop: 16 },
  iconCircle: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: C.primaryLight, justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
  },
  pickTitle: { fontSize: 20, fontWeight: '800', color: C.text, marginBottom: 8, textAlign: 'center' },
  pickDesc: { fontSize: 14, color: C.textSub, textAlign: 'center', lineHeight: 21, marginBottom: 28, paddingHorizontal: 12 },

  primaryBtn: {
    backgroundColor: C.primary, borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 28,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    width: '100%', justifyContent: 'center', marginBottom: 12,
    ...SHADOW.sm,
  },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: C.white },

  secondaryBtn: {
    backgroundColor: C.white, borderRadius: 14,
    paddingVertical: 15, paddingHorizontal: 28,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    width: '100%', justifyContent: 'center',
    borderWidth: 1.5, borderColor: C.primary,
  },
  secondaryBtnText: { fontSize: 16, fontWeight: '700', color: C.primary },

  previewSection: { alignItems: 'center' },
  previewTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 12, alignSelf: 'flex-start' },
  previewFrame: {
    width: '100%', borderRadius: 18, overflow: 'hidden',
    backgroundColor: C.white, marginBottom: 20, minHeight: 280,
    justifyContent: 'center', alignItems: 'center',
    ...SHADOW.sm,
  },
  previewImage: { width: '100%', height: 320 },

  analyzeBtn: {
    backgroundColor: C.primary, borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    width: '100%', marginBottom: 12,
    ...SHADOW.sm,
  },
  analyzeBtnText: { fontSize: 16, fontWeight: '700', color: C.white },

  retakeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 13,
    width: '100%', borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
    backgroundColor: C.white,
  },
  retakeBtnText: { fontSize: 14, color: C.textSub, fontWeight: '500' },
});
