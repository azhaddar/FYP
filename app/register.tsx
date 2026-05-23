import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
  ScrollView, StatusBar, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabaseClient';

const NAVY = '#1A1F3C';

export default function RegisterScreen() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleRegister = async () => {
    if (!firstName.trim()) {
      Alert.alert('Missing field', 'Please enter your first name.');
      return;
    }
    if (!email.trim()) {
      Alert.alert('Missing field', 'Please enter your email address.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const full_name = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name, role: 'parent' },
        },
      });

      if (error) throw error;
      if (!data.user?.id) throw new Error('Account created but user ID missing. Please try signing in.');

      // Upsert profile as fallback in case trigger RLS blocks the insert
      if (data.session) {
        await supabase.from('profiles').upsert(
          { id: data.user.id, full_name, role: 'parent', email: email.trim() },
          { onConflict: 'id' },
        );
        // Sign out so user must log in manually after seeing the success modal
        await supabase.auth.signOut();
      }

      setShowSuccess(true);
    } catch (e: any) {
      Alert.alert('Registration failed', e.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#F7F7F5" />

      {/* Success Modal */}
      <Modal visible={showSuccess} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={s.modal}>
            <View style={s.iconCircle}>
              <Ionicons name="checkmark-circle" size={64} color="#22c55e" />
            </View>
            <Text style={s.modalTitle}>Registration Successful!</Text>
            <Text style={s.modalMsg}>Your account has been created. Please log in to continue.</Text>
            <TouchableOpacity
              style={s.confirmBtn}
              onPress={() => {
                setShowSuccess(false);
                router.replace('/login');
              }}
              activeOpacity={0.85}
            >
              <Text style={s.confirmBtnText}>Go to Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {/* Floating card */}
        <View style={s.card}>
          <Text style={s.title}>Create an{'\n'}account</Text>

          {/* Google */}
          <TouchableOpacity style={s.googleBtn} activeOpacity={0.8}>
            <Ionicons name="logo-google" size={18} color="#4285F4" />
            <Text style={s.googleBtnText}>Sign in with Google</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={s.divider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>or</Text>
            <View style={s.dividerLine} />
          </View>

          {/* First + Last name row */}
          <View style={s.nameRow}>
            <View style={[s.field, { flex: 1 }]}>
              <TextInput
                style={s.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="First Name"
                placeholderTextColor="#9ca3af"
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>
            <View style={[s.field, { flex: 1 }]}>
              <TextInput
                style={s.input}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Last Name"
                placeholderTextColor="#9ca3af"
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Email */}
          <View style={s.field}>
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor="#9ca3af"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Password */}
          <View style={s.field}>
            <TextInput
              style={[s.input, { flex: 1 }]}
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor="#9ca3af"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowPassword(v => !v)}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          {/* Create account button */}
          <TouchableOpacity
            style={[s.createBtn, loading && { opacity: 0.7 }]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.createBtnText}>Create account</Text>}
          </TouchableOpacity>

          {/* Terms */}
          <Text style={s.terms}>
            By creating an account you agree to our{' '}
            <Text style={s.termsLink}>Privacy Policy</Text>
            {' '}and{' '}
            <Text style={s.termsLink}>Terms of Service</Text>.
          </Text>

          {/* Login link */}
          <View style={s.loginRow}>
            <Text style={s.loginText}>Have an account? </Text>
            <TouchableOpacity onPress={() => router.replace('/login')}>
              <Text style={s.loginLink}>Log in here</Text>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F7F5' },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 48 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 24,
    elevation: 8,
  },

  title: { fontSize: 32, fontWeight: '800', color: NAVY, lineHeight: 38, marginBottom: 24 },

  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, borderWidth: 1.5, borderColor: '#e5e7eb',
    borderRadius: 12, paddingVertical: 14,
    backgroundColor: '#fff', marginBottom: 20,
  },
  googleBtnText: { fontSize: 15, fontWeight: '600', color: NAVY },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#e5e7eb' },
  dividerText: { fontSize: 14, color: '#9ca3af' },

  nameRow: { flexDirection: 'row', gap: 10, marginBottom: 0 },

  field: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13,
    marginBottom: 12, backgroundColor: '#fafafa',
  },
  input: { flex: 1, fontSize: 15, color: NAVY, padding: 0 },

  createBtn: {
    backgroundColor: '#111', borderRadius: 12,
    paddingVertical: 16, alignItems: 'center',
    marginTop: 4, marginBottom: 16,
  },
  createBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  terms: {
    fontSize: 12, color: '#9ca3af',
    textAlign: 'center', lineHeight: 18, marginBottom: 18,
  },
  termsLink: { color: NAVY, fontWeight: '600' },

  loginRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  loginText: { fontSize: 14, color: '#6b7280' },
  loginLink: { fontSize: 14, color: NAVY, fontWeight: '700' },

  // Success modal
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32,
  },
  modal: {
    backgroundColor: '#fff', borderRadius: 24, padding: 32,
    alignItems: 'center', width: '100%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15, shadowRadius: 24, elevation: 10,
  },
  iconCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: '#f0fdf4', justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 22, fontWeight: '800', color: NAVY, marginBottom: 10, textAlign: 'center' },
  modalMsg: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  confirmBtn: {
    backgroundColor: NAVY, borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 40, alignItems: 'center', width: '100%',
  },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
