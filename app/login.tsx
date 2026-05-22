import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
  ScrollView, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabaseClient';

const NAVY = '#1A1F3C';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      Alert.alert('Sign in failed', error.message);
    } else {
      router.replace('/');
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        <Text style={s.appName}>EmotiSketch</Text>
        <Text style={s.title}>Login</Text>

        {/* Email */}
        <View style={s.field}>
          <Ionicons name="mail-outline" size={18} color="#9ca3af" style={s.fieldIcon} />
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
          <Ionicons name="lock-closed-outline" size={18} color="#9ca3af" style={s.fieldIcon} />
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

        <TouchableOpacity style={s.forgotRow}>
          <Text style={s.forgotText}>Forgot Password?</Text>
        </TouchableOpacity>

        {/* Login button */}
        <TouchableOpacity
          style={[s.loginBtn, loading && { opacity: 0.7 }]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.loginBtnText}>Login</Text>}
        </TouchableOpacity>

        {/* Divider */}
        <View style={s.divider}>
          <View style={s.dividerLine} />
          <Text style={s.dividerText}>or</Text>
          <View style={s.dividerLine} />
        </View>

        {/* Google */}
        <TouchableOpacity style={s.socialBtn} activeOpacity={0.8}>
          <Ionicons name="logo-google" size={18} color="#4285F4" />
          <Text style={s.socialBtnText}>Continue with Google</Text>
        </TouchableOpacity>

        {/* Apple */}
        <TouchableOpacity style={[s.socialBtn, s.appleBtn]} activeOpacity={0.8}>
          <Ionicons name="logo-apple" size={18} color="#fff" />
          <Text style={[s.socialBtnText, { color: '#fff' }]}>Continue with Apple</Text>
        </TouchableOpacity>

        {/* Sign up link */}
        <View style={s.signupRow}>
          <Text style={s.signupText}>Need an account? </Text>
          <TouchableOpacity onPress={() => router.push('/register' as any)}>
            <Text style={s.signupLink}>Sign up</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  scroll: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 80, paddingBottom: 40 },

  appName: {
    fontSize: 13, fontWeight: '700', color: '#9ca3af',
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 24,
  },
  title: { fontSize: 38, fontWeight: '800', color: NAVY, marginBottom: 32 },

  field: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 14,
    marginBottom: 14, backgroundColor: '#fafafa',
  },
  fieldIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16, color: NAVY, padding: 0 },

  forgotRow: { alignItems: 'flex-end', marginBottom: 24 },
  forgotText: { fontSize: 14, color: NAVY, fontWeight: '600' },

  loginBtn: {
    backgroundColor: NAVY, borderRadius: 14,
    paddingVertical: 17, alignItems: 'center', marginBottom: 28,
  },
  loginBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#e5e7eb' },
  dividerText: { fontSize: 14, color: '#9ca3af' },

  socialBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 14,
    paddingVertical: 15, marginBottom: 12, backgroundColor: '#fff',
  },
  appleBtn: { backgroundColor: '#111', borderColor: '#111' },
  socialBtnText: { fontSize: 15, fontWeight: '600', color: NAVY },

  signupRow: {
    flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', marginTop: 16,
  },
  signupText: { fontSize: 15, color: '#6b7280' },
  signupLink: { fontSize: 15, color: NAVY, fontWeight: '700' },
});
