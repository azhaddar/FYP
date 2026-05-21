import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabaseClient';
import { useApp } from '../../contexts/AppContext';
import { C, SHADOW } from '../../constants/theme';

const PROMPT_LABEL: Record<string, string> = {
  self:  'Draw Yourself',
  house: 'Draw Your Home',
};

export default function UploadScreen() {
  const { activeChild } = useApp();
  const router = useRouter();
  const { promptType, preMood } = useLocalSearchParams<{ promptType: string; preMood: string }>();

  const [pickedImage, setPickedImage] = useState<{ uri: string; base64: string } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

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
      const filename = `${activeChild?.id ?? 'unknown'}/${Date.now()}.jpg`;

      const [uploadResult, analyzeResult] = await Promise.all([
        supabase.storage
          .from('sketch-images')
          .upload(filename, decode(base64), { contentType: 'image/jpeg' }),
        supabase.functions.invoke('analyze-sketch', {
          body: { imageBase64: base64, promptType: promptType ?? 'self', preMood: preMood || null },
        }),
      ]);

      if (uploadResult.error) throw uploadResult.error;
      if (analyzeResult.error) throw analyzeResult.error;

      if (analyzeResult.data?.valid === false) {
        Alert.alert('Wrong Photo Topic', analyzeResult.data.message, [{ text: 'Try Again' }]);
        setAnalyzing(false);
        return;
      }

      const { data: urlData } = supabase.storage.from('sketch-images').getPublicUrl(filename);
      const emotion: string = analyzeResult.data?.emotion ?? 'happy';
      const scores = analyzeResult.data?.scores ?? null;

      if (activeChild) {
        await supabase.from('sketches').insert({
          patient_id: activeChild.id,
          emotion,
          notes: null,
          image_url: urlData.publicUrl,
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
      {/* Top bar */}
      <View style={styles.toolbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={C.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.toolbarTitle} numberOfLines={1}>
          {PROMPT_LABEL[promptType ?? 'self']}
        </Text>
        <View style={{ minWidth: 60 }} />
      </View>

      {/* Upload area */}
      <View style={styles.body}>
        <TouchableOpacity
          style={[styles.uploadBox, pickedImage ? styles.uploadBoxFilled : null]}
          onPress={handlePick}
          activeOpacity={0.85}
          disabled={analyzing}
        >
          {pickedImage ? (
            <Image
              source={{ uri: pickedImage.uri }}
              style={styles.preview}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.uploadPlaceholder}>
              <View style={styles.iconWrap}>
                <Ionicons name="image-outline" size={56} color={C.primary} />
              </View>
              <Text style={styles.uploadTitle}>Upload a Photo</Text>
              <Text style={styles.uploadSub}>
                Tap to choose a drawing{'\n'}from your gallery
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {pickedImage && !analyzing && (
          <TouchableOpacity style={styles.changeBtn} onPress={handlePick}>
            <Ionicons name="repeat-outline" size={16} color={C.primary} />
            <Text style={styles.changeBtnText}>Choose a different photo</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.analyzeBtn,
            (!pickedImage || analyzing) && styles.analyzeBtnDisabled,
          ]}
          onPress={handleAnalyze}
          disabled={!pickedImage || analyzing}
          activeOpacity={0.85}
        >
          {analyzing ? (
            <>
              <ActivityIndicator color={C.white} size="small" />
              <Text style={styles.analyzeBtnText}>Analyzing your photo...</Text>
            </>
          ) : (
            <>
              <Ionicons name="scan-outline" size={20} color={C.white} />
              <Text style={styles.analyzeBtnText}>Analyze My Photo!</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.white },

  toolbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12,
    backgroundColor: C.white,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, minWidth: 60 },
  backText: { fontSize: 15, color: C.primary, fontWeight: '600' },
  toolbarTitle: {
    flex: 1, textAlign: 'center',
    fontSize: 17, fontWeight: '800', color: C.text,
  },

  body: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },

  uploadBox: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 24,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: C.primary,
    backgroundColor: '#fdf2f8',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadBoxFilled: {
    borderStyle: 'solid',
    borderColor: C.border,
    backgroundColor: C.base,
  },

  uploadPlaceholder: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  iconWrap: {
    width: 96, height: 96, borderRadius: 28,
    backgroundColor: '#fce7f3',
    justifyContent: 'center', alignItems: 'center',
  },
  uploadTitle: {
    fontSize: 20, fontWeight: '800', color: C.text, textAlign: 'center',
  },
  uploadSub: {
    fontSize: 14, color: C.textSub, textAlign: 'center', lineHeight: 20,
  },

  preview: {
    width: '100%', height: '100%',
  },

  changeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10, paddingHorizontal: 20,
    borderRadius: 20, borderWidth: 1.5, borderColor: C.primary,
    backgroundColor: '#fdf2f8',
  },
  changeBtnText: {
    fontSize: 14, fontWeight: '600', color: C.primary,
  },

  footer: {
    paddingHorizontal: 24, paddingBottom: 36, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: C.border,
    backgroundColor: C.white,
    ...SHADOW.lg,
  },
  analyzeBtn: {
    backgroundColor: C.primary, borderRadius: 14, paddingVertical: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  analyzeBtnDisabled: {
    opacity: 0.4,
  },
  analyzeBtnText: { fontSize: 16, fontWeight: '700', color: C.white },
});
