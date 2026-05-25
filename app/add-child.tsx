import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, StatusBar,
  Modal, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabaseClient';
import { logActivity } from '../lib/activityLog';

const NAVY = '#1A1F3C';
const PINK = '#e13d7d';

const GENDER_OPTIONS = ['Male', 'Female', 'Other'] as const;
type Gender = typeof GENDER_OPTIONS[number];

export default function AddChildScreen() {
  const router = useRouter();

  const [fullName, setFullName]       = useState('');
  const [age, setAge]                 = useState('');
  const [gender, setGender]           = useState<Gender>('Male');
  const [notes, setNotes]             = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [addedName, setAddedName]     = useState('');

  async function handleSubmit() {
    if (!fullName.trim()) { Alert.alert('Required', 'Please enter the child\'s full name.'); return; }
    if (!age || isNaN(Number(age)) || Number(age) < 1) { Alert.alert('Required', 'Please enter a valid age.'); return; }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated.');

      // Ensure profile row exists (guard against trigger failure)
      const { data: prof } = await supabase
        .from('profiles').select('full_name, email').eq('id', user.id).single();

      await supabase.from('profiles').upsert({
        id:        user.id,
        full_name: prof?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Parent',
        email:     prof?.email || user.email || '',
        role:      'user',
      }, { onConflict: 'id' });

      const { error } = await supabase.from('patients').insert([{
        full_name:     fullName.trim(),
        age:           parseInt(age, 10),
        gender,
        personality:   notes.trim(),
        guardian_id:   user.id,
        status:        'Active',
        total_sketches: 0,
        therapist_id:  null,
      }]);

      if (error) throw error;

      logActivity({ action: 'patient.created', entity_type: 'patient', entity_label: fullName.trim() });

      setAddedName(fullName.trim());
      setShowSuccess(true);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleAddAnother() {
    setShowSuccess(false);
    setFullName('');
    setAge('');
    setGender('Male');
    setNotes('');
    setAddedName('');
  }

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Register New Child</Text>
          <Text style={s.headerSub}>Fill in the details below</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Full Name */}
        <Text style={s.label}>Full Name</Text>
        <View style={s.inputWrap}>
          <Ionicons name="person-outline" size={17} color="#9ca3af" style={s.inputIcon} />
          <TextInput
            style={s.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Child's full name"
            placeholderTextColor="#9ca3af"
            autoCapitalize="words"
          />
        </View>

        {/* Age */}
        <Text style={s.label}>Age</Text>
        <View style={s.inputWrap}>
          <Ionicons name="calendar-outline" size={17} color="#9ca3af" style={s.inputIcon} />
          <TextInput
            style={s.input}
            value={age}
            onChangeText={setAge}
            placeholder="Years old"
            placeholderTextColor="#9ca3af"
            keyboardType="number-pad"
            maxLength={2}
          />
        </View>

        {/* Gender */}
        <Text style={s.label}>Gender</Text>
        <View style={s.genderRow}>
          {GENDER_OPTIONS.map(g => (
            <TouchableOpacity
              key={g}
              style={[s.genderChip, gender === g && s.genderChipActive]}
              onPress={() => setGender(g)}
              activeOpacity={0.75}
            >
              <Text style={[s.genderChipText, gender === g && s.genderChipTextActive]}>{g}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Personality / Notes */}
        <Text style={s.label}>Personality Notes <Text style={s.labelOptional}>(optional)</Text></Text>
        <View style={[s.inputWrap, s.textAreaWrap]}>
          <TextInput
            style={[s.input, s.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Brief behaviour or therapy notes…"
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[s.submitBtn, submitting && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting
            ? <ActivityIndicator color="#fff" size="small" />
            : <Ionicons name="save-outline" size={18} color="#fff" />}
          <Text style={s.submitBtnText}>
            {submitting ? 'Saving…' : 'Save Child Profile'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Success Modal ── */}
      <Modal visible={showSuccess} transparent animationType="fade" statusBarTranslucent>
        <View style={m.backdrop}>
          <View style={m.card}>
            {/* Checkmark */}
            <View style={m.iconCircle}>
              <Ionicons name="checkmark-circle" size={56} color="#22c55e" />
            </View>

            <Text style={m.title}>All done!</Text>
            <Text style={m.sub}>Child profile created for</Text>
            <Text style={m.childName}>{addedName}</Text>

            {/* Buttons */}
            <TouchableOpacity style={m.btnOutline} onPress={handleAddAnother} activeOpacity={0.8}>
              <Ionicons name="person-add-outline" size={16} color={PINK} />
              <Text style={m.btnOutlineText}>Add Another Child</Text>
            </TouchableOpacity>

            <TouchableOpacity style={m.btnFill} onPress={() => router.replace('/' as any)} activeOpacity={0.85}>
              <Text style={m.btnFillText}>Go to Dashboard</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#F4F5FA' },

  header: {
    backgroundColor: NAVY,
    paddingTop: 54, paddingBottom: 16, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle:  { fontSize: 17, fontWeight: '800', color: '#fff' },
  headerSub:    { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },

  body: { padding: 20, paddingBottom: 48 },

  label: { fontSize: 11, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8, marginTop: 18 },
  labelOptional: { fontSize: 10, fontWeight: '500', color: '#9ca3af', textTransform: 'none' },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1.5, borderColor: '#e5e7eb',
    paddingHorizontal: 14, paddingVertical: 13,
  },
  inputIcon: { marginRight: 10 },
  input:     { flex: 1, fontSize: 15, color: NAVY, padding: 0 },

  textAreaWrap: { alignItems: 'flex-start', paddingVertical: 12 },
  textArea:     { height: 80, textAlignVertical: 'top' },

  genderRow: { flexDirection: 'row', gap: 10 },
  genderChip: {
    flex: 1, paddingVertical: 11, borderRadius: 12,
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  genderChipActive:     { backgroundColor: PINK, borderColor: PINK },
  genderChipText:       { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  genderChipTextActive: { color: '#fff', fontWeight: '700' },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: PINK, borderRadius: 14,
    paddingVertical: 16, marginTop: 28,
  },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});

const m = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  card: {
    backgroundColor: '#fff', borderRadius: 28,
    padding: 32, width: '100%',
    alignItems: 'center', gap: 6,
  },
  iconCircle: { marginBottom: 8 },
  title:      { fontSize: 26, fontWeight: '900', color: NAVY },
  sub:        { fontSize: 14, color: '#6b7280' },
  childName:  { fontSize: 20, fontWeight: '800', color: PINK, marginBottom: 12 },

  btnOutline: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    width: '100%', paddingVertical: 14, borderRadius: 14,
    borderWidth: 2, borderColor: PINK, marginTop: 4,
  },
  btnOutlineText: { fontSize: 14, fontWeight: '700', color: PINK },

  btnFill: {
    width: '100%', paddingVertical: 14, borderRadius: 14,
    backgroundColor: NAVY, alignItems: 'center', marginTop: 8,
  },
  btnFillText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
