import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, StatusBar, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabaseClient';

const NAVY = '#1A1F3C';

interface PasswordField {
  label: string;
  value: string;
  set: (v: string) => void;
  show: boolean;
  toggle: () => void;
}

export default function ChangePasswordScreen() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword]   = useState('');
  const [newPassword, setNewPassword]           = useState('');
  const [confirmPassword, setConfirmPassword]   = useState('');
  const [showCurrent, setShowCurrent]           = useState(false);
  const [showNew, setShowNew]                   = useState(false);
  const [showConfirm, setShowConfirm]           = useState(false);
  const [loading, setLoading]                   = useState(false);

  const fields: PasswordField[] = [
    { label: 'Current Password',     value: currentPassword, set: setCurrentPassword, show: showCurrent, toggle: () => setShowCurrent(p => !p) },
    { label: 'New Password',         value: newPassword,     set: setNewPassword,     show: showNew,     toggle: () => setShowNew(p => !p)     },
    { label: 'Confirm New Password', value: confirmPassword, set: setConfirmPassword, show: showConfirm, toggle: () => setShowConfirm(p => !p) },
  ];

  const handleUpdate = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields.'); return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Error', 'New password must be at least 8 characters.'); return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match.'); return;
    }

    setLoading(true);

    // Re-authenticate with current password first
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      Alert.alert('Error', 'Could not verify your account.');
      setLoading(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (signInError) {
      Alert.alert('Error', 'Current password is incorrect.');
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Success', 'Password updated successfully!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        <TouchableOpacity style={s.backRow} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={NAVY} />
          <Text style={s.backText}>Back</Text>
        </TouchableOpacity>

        <View style={s.iconBox}>
          <Ionicons name="lock-closed-outline" size={28} color="#e13d7d" />
        </View>
        <Text style={s.title}>Change password</Text>
        <Text style={s.sub}>Enter your current password then choose a new one.</Text>

        <View style={s.form}>
          {fields.map(({ label, value, set, show, toggle }) => (
            <View key={label} style={s.fieldWrapper}>
              <Text style={s.fieldLabel}>{label}</Text>
              <View style={s.field}>
                <Ionicons name="lock-closed-outline" size={18} color="#9ca3af" style={s.fieldIcon} />
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  value={value}
                  onChangeText={set}
                  placeholder="••••••••"
                  placeholderTextColor="#9ca3af"
                  secureTextEntry={!show}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={toggle}>
                  <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={20} color="#9ca3af" />
                </TouchableOpacity>
              </View>
            </View>
          ))}

          <Text style={s.hint}>Minimum 8 characters.</Text>

          <TouchableOpacity
            style={[s.updateBtn, loading && { opacity: 0.7 }]}
            onPress={handleUpdate}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
            <Text style={s.updateBtnText}>{loading ? 'Updating…' : 'Update Password'}</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
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
    backgroundColor: '#FFF0F6',
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  title: { fontSize: 30, fontWeight: '800', color: NAVY, marginBottom: 8 },
  sub:   { fontSize: 14, color: '#6b7280', marginBottom: 32, lineHeight: 21 },

  form: { gap: 16 },

  fieldWrapper: { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  field: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 14, backgroundColor: '#fafafa',
  },
  fieldIcon: { marginRight: 10 },
  input:     { fontSize: 16, color: NAVY, padding: 0 },

  hint: { fontSize: 12, color: '#9ca3af', marginTop: -8 },

  updateBtn: {
    backgroundColor: '#e13d7d', borderRadius: 14,
    paddingVertical: 17, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center', gap: 8,
    marginTop: 8,
  },
  updateBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
