import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, StatusBar,
  Modal, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabaseClient';
import { useApp } from '../contexts/AppContext';

const NAVY = '#1A1F3C';

export default function EditProfileScreen() {
  const router = useRouter();
  const { profile, updateProfile } = useApp();

  const [fullName, setFullName]     = useState(profile?.full_name ?? '');
  const [saving, setSaving]         = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  async function handleSave() {
    if (!fullName.trim()) {
      Alert.alert('Required', 'Please enter your full name.');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated.');

      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName.trim() })
        .eq('id', user.id);

      if (error) throw error;

      updateProfile(fullName.trim());
      setShowSuccess(true);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <TouchableOpacity style={s.backRow} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={NAVY} />
          <Text style={s.backText}>Back</Text>
        </TouchableOpacity>

        {/* Icon + title */}
        <View style={s.iconBox}>
          <Ionicons name="person-outline" size={28} color={NAVY} />
        </View>
        <Text style={s.title}>Edit Profile</Text>
        <Text style={s.sub}>Update your display name.</Text>

        {/* Form */}
        <View style={s.form}>
          <Text style={s.fieldLabel}>Full Name</Text>
          <View style={s.field}>
            <Ionicons name="person-outline" size={18} color="#9ca3af" style={s.fieldIcon} />
            <TextInput
              style={s.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your full name"
              placeholderTextColor="#9ca3af"
              autoCapitalize="words"
              autoFocus
            />
          </View>

          <TouchableOpacity
            style={[s.saveBtn, saving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />}
            <Text style={s.saveBtnText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Success modal */}
      <Modal visible={showSuccess} transparent animationType="fade" statusBarTranslucent>
        <View style={m.backdrop}>
          <View style={m.card}>
            <Ionicons name="checkmark-circle" size={60} color="#22c55e" />
            <Text style={m.title}>Profile Updated!</Text>
            <Text style={m.sub}>Your name has been saved successfully.</Text>
            <TouchableOpacity
              style={m.doneBtn}
              onPress={() => { setShowSuccess(false); router.back(); }}
              activeOpacity={0.85}
            >
              <Text style={m.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#fff' },
  scroll: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 60, paddingBottom: 40 },

  backRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 40 },
  backText: { fontSize: 14, fontWeight: '600', color: NAVY },

  iconBox: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: '#EEF0FF',
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  title: { fontSize: 30, fontWeight: '800', color: NAVY, marginBottom: 8 },
  sub:   { fontSize: 14, color: '#6b7280', marginBottom: 32, lineHeight: 21 },

  form: { gap: 16 },

  fieldLabel: {
    fontSize: 12, fontWeight: '700', color: '#6b7280',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  field: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 14, backgroundColor: '#fafafa',
  },
  fieldIcon: { marginRight: 10 },
  input:     { flex: 1, fontSize: 16, color: NAVY, padding: 0 },

  saveBtn: {
    backgroundColor: NAVY, borderRadius: 14,
    paddingVertical: 17, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center', gap: 8,
    marginTop: 8,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

const m = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center', padding: 40,
  },
  card: {
    backgroundColor: '#fff', borderRadius: 28,
    padding: 32, width: '100%', alignItems: 'center', gap: 10,
  },
  title:       { fontSize: 26, fontWeight: '900', color: NAVY },
  sub:         { fontSize: 14, color: '#6b7280', textAlign: 'center' },
  doneBtn:     { marginTop: 8, width: '100%', paddingVertical: 14, borderRadius: 14, backgroundColor: NAVY, alignItems: 'center' },
  doneBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
