import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
  ScrollView, useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabaseClient';
import { C, MAX_W } from '../constants/theme';

const NAVY = '#1A1F3C';

export default function RegisterScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!fullName.trim()) {
      Alert.alert('Missing field', 'Please enter your full name.');
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
    if (password !== confirmPassword) {
      Alert.alert('Password mismatch', 'Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName.trim(), role: 'parent' } },
      });

      if (error) throw error;

      const userId = data.user?.id;
      if (!userId) throw new Error('Account created but user ID missing. Please try signing in.');

      const { error: profileError } = await supabase.from('profiles').insert({
        id: userId,
        full_name: fullName.trim(),
        role: 'parent',
      });

      if (profileError) throw profileError;

      // If session exists, email confirmation is off — go straight in
      if (data.session) {
        router.replace('/');
      } else {
        Alert.alert(
          'Verify your email',
          'A confirmation link has been sent to your email. Please verify before signing in.',
          [{ text: 'Go to Login', onPress: () => router.replace('/login') }],
        );
      }
    } catch (e: any) {
      Alert.alert('Registration failed', e.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {isWide ? (
          <View style={styles.splitContainer}>
            <View style={styles.brandPanel}>
              <View style={styles.brandLogoCircle}>
                <Text style={styles.brandLogoText}>ES</Text>
              </View>
              <Text style={styles.brandTitle}>EmotiSketch</Text>
              <Text style={styles.brandSubtitle}>
                Helping children express{'\n'}their feelings through art
              </Text>
            </View>
            <View style={styles.formPanel}>
              <FormContent
                fullName={fullName} setFullName={setFullName}
                email={email} setEmail={setEmail}
                password={password} setPassword={setPassword}
                confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword}
                                loading={loading}
                onRegister={handleRegister}
                onLogin={() => router.replace('/login')}
              />
            </View>
          </View>
        ) : (
          <View style={styles.centeredContainer}>
            <View style={styles.cardHeader}>
              <View style={styles.brandLogoCircleSmall}>
                <Text style={styles.brandLogoTextSmall}>ES</Text>
              </View>
              <Text style={styles.cardHeaderTitle}>EmotiSketch</Text>
            </View>
            <FormContent
              fullName={fullName} setFullName={setFullName}
              email={email} setEmail={setEmail}
              password={password} setPassword={setPassword}
              confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword}
                            loading={loading}
              onRegister={handleRegister}
              onLogin={() => router.replace('/login')}
            />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FormContent({
  fullName, setFullName,
  email, setEmail,
  password, setPassword,
  confirmPassword, setConfirmPassword,
  loading, onRegister, onLogin,
}: {
  fullName: string; setFullName: (v: string) => void;
  email: string; setEmail: (v: string) => void;
  password: string; setPassword: (v: string) => void;
  confirmPassword: string; setConfirmPassword: (v: string) => void;
  loading: boolean; onRegister: () => void; onLogin: () => void;
}) {
  return (
    <View style={form.container}>
      <Text style={form.title}>Create account</Text>
      <Text style={form.subtitle}>Register as a parent</Text>

      {/* Full name */}
      <View style={form.fieldGroup}>
        <Text style={form.label}>FULL NAME</Text>
        <TextInput
          style={form.input}
          value={fullName}
          onChangeText={setFullName}
          autoCapitalize="words"
          autoCorrect={false}
          placeholder="Your full name"
          placeholderTextColor={C.textMuted}
        />
      </View>

      {/* Email */}
      <View style={[form.fieldGroup, { marginTop: 14 }]}>
        <Text style={form.label}>EMAIL</Text>
        <TextInput
          style={form.input}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="you@example.com"
          placeholderTextColor={C.textMuted}
        />
      </View>

      {/* Password */}
      <View style={[form.fieldGroup, { marginTop: 14 }]}>
        <Text style={form.label}>PASSWORD</Text>
        <TextInput
          style={form.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          placeholder="Min. 6 characters"
          placeholderTextColor={C.textMuted}
        />
      </View>

      {/* Confirm password */}
      <View style={[form.fieldGroup, { marginTop: 14 }]}>
        <Text style={form.label}>CONFIRM PASSWORD</Text>
        <TextInput
          style={form.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoCapitalize="none"
          placeholder="Re-enter password"
          placeholderTextColor={C.textMuted}
        />
      </View>

      <TouchableOpacity
        style={[form.registerBtn, loading && form.registerBtnDisabled]}
        onPress={onRegister}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading
          ? <ActivityIndicator color={C.white} />
          : <Text style={form.registerBtnText}>Create account</Text>}
      </TouchableOpacity>

      <View style={form.loginRow}>
        <Text style={form.loginText}>Already have an account? </Text>
        <TouchableOpacity onPress={onLogin}>
          <Text style={form.link}>Sign in</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.base },
  scroll: { flexGrow: 1, justifyContent: 'center' },

  splitContainer: {
    flexDirection: 'row',
    minHeight: 500,
    maxWidth: MAX_W,
    width: '90%',
    alignSelf: 'center',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.white,
    marginVertical: 40,
  },
  brandPanel: {
    width: '40%',
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  brandLogoCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  brandLogoText: { fontSize: 26, fontWeight: '800', color: C.white },
  brandTitle: { fontSize: 26, fontWeight: '800', color: C.white, marginBottom: 12 },
  brandSubtitle: {
    fontSize: 15, color: 'rgba(255,255,255,0.85)',
    textAlign: 'center', lineHeight: 22,
  },
  formPanel: {
    flex: 1,
    backgroundColor: C.white,
    justifyContent: 'center',
  },

  centeredContainer: {
    width: '90%',
    maxWidth: 480,
    alignSelf: 'center',
    backgroundColor: C.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    marginVertical: 40,
  },
  cardHeader: {
    backgroundColor: NAVY,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 28,
  },
  brandLogoCircleSmall: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  brandLogoTextSmall: { fontSize: 17, fontWeight: '800', color: C.white },
  cardHeaderTitle: { fontSize: 22, fontWeight: '800', color: C.white },
});

const form = StyleSheet.create({
  container: { padding: 36 },
  title: { fontSize: 26, fontWeight: '700', color: C.text, marginBottom: 4 },
  subtitle: { fontSize: 15, color: C.textSub, marginBottom: 24 },

  fieldGroup: {
    backgroundColor: C.base,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  label: {
    fontSize: 11, fontWeight: '700', color: C.textMuted,
    letterSpacing: 1, marginBottom: 5,
  },
  input: { fontSize: 16, color: C.text, padding: 0, margin: 0 },

  registerBtn: {
    backgroundColor: C.primary, borderRadius: 12,
    paddingVertical: 16, alignItems: 'center', marginTop: 22,
  },
  registerBtnDisabled: { opacity: 0.7 },
  registerBtnText: { color: C.white, fontSize: 16, fontWeight: '700' },

  loginRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', marginTop: 24,
  },
  loginText: { fontSize: 15, color: C.textSub },
  link: { fontSize: 15, color: C.primary, fontWeight: '500' },
});
