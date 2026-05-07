import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
  ScrollView, useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabaseClient';
import { C, MAX_W } from '../constants/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

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
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {isWide ? (
          <View style={styles.splitContainer}>
            {/* Left pink panel */}
            <View style={styles.brandPanel}>
              <View style={styles.brandLogoCircle}>
                <Text style={styles.brandLogoText}>ES</Text>
              </View>
              <Text style={styles.brandTitle}>EmotiSketch</Text>
              <Text style={styles.brandSubtitle}>
                Helping children express{'\n'}their feelings through art
              </Text>
            </View>

            {/* Right form panel */}
            <View style={styles.formPanel}>
              <FormContent
                email={email}
                setEmail={setEmail}
                password={password}
                setPassword={setPassword}
                loading={loading}
                onLogin={handleLogin}
                onRegister={() => router.push('/register')}
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
              email={email}
              setEmail={setEmail}
              password={password}
              setPassword={setPassword}
              loading={loading}
              onLogin={handleLogin}
              onRegister={() => router.push('/register')}
            />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FormContent({
  email, setEmail, password, setPassword, loading, onLogin, onRegister,
}: {
  email: string; setEmail: (v: string) => void;
  password: string; setPassword: (v: string) => void;
  loading: boolean; onLogin: () => void; onRegister: () => void;
}) {
  return (
    <View style={form.container}>
      <Text style={form.title}>Sign in</Text>
      <Text style={form.subtitle}>Welcome back, parent</Text>

      <TouchableOpacity style={form.googleBtn} activeOpacity={0.8}>
        <View style={form.googleIcon}>
          <Text style={form.googleIconText}>G</Text>
        </View>
        <Text style={form.googleText}>Continue with Google</Text>
      </TouchableOpacity>

      <View style={form.divider}>
        <View style={form.dividerLine} />
        <Text style={form.dividerText}>or</Text>
        <View style={form.dividerLine} />
      </View>

      <View style={form.fieldGroup}>
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

      <View style={[form.fieldGroup, { marginTop: 14 }]}>
        <Text style={form.label}>PASSWORD</Text>
        <TextInput
          style={form.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          placeholder="••••••••"
          placeholderTextColor={C.textMuted}
        />
      </View>

      <TouchableOpacity
        style={[form.loginBtn, loading && form.loginBtnDisabled]}
        onPress={onLogin}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading
          ? <ActivityIndicator color={C.white} />
          : <Text style={form.loginBtnText}>Log in</Text>}
      </TouchableOpacity>

      <View style={form.links}>
        <TouchableOpacity>
          <Text style={form.link}>Reset password</Text>
        </TouchableOpacity>
        <View style={form.registerRow}>
          <Text style={form.registerText}>No account? </Text>
          <TouchableOpacity onPress={onRegister}>
            <Text style={form.link}>Create one</Text>
          </TouchableOpacity>
        </View>
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
    backgroundColor: C.primary,
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
    backgroundColor: C.primary,
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
  subtitle: { fontSize: 15, color: C.textSub, marginBottom: 28 },

  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, borderWidth: 1, borderColor: C.borderMed,
    borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16,
    backgroundColor: C.white, marginBottom: 22,
  },
  googleIcon: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: C.googleBlue, alignItems: 'center', justifyContent: 'center',
  },
  googleIconText: { color: C.white, fontSize: 13, fontWeight: '700' },
  googleText: { fontSize: 15, fontWeight: '500', color: C.text },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 22 },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.border },
  dividerText: { fontSize: 13, color: C.textMuted },

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

  loginBtn: {
    backgroundColor: C.primary, borderRadius: 12,
    paddingVertical: 16, alignItems: 'center', marginTop: 22,
  },
  loginBtnDisabled: { opacity: 0.7 },
  loginBtnText: { color: C.white, fontSize: 16, fontWeight: '700' },

  links: { marginTop: 24, alignItems: 'center', gap: 12 },
  link: { fontSize: 15, color: C.primary, fontWeight: '500' },
  registerRow: { flexDirection: 'row', alignItems: 'center' },
  registerText: { fontSize: 15, color: C.textSub },
});
