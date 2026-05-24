import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, StatusBar, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabaseClient';

const NAVY = '#1A1F3C';
const WEB_RESET_URL = 'http://localhost:5173/reset-password'; // update to deployed URL for production

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);

  const handleSend = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: WEB_RESET_URL,
    });
    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setSent(true);
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
          <Text style={s.backText}>Back to login</Text>
        </TouchableOpacity>

        {sent ? (
          <View style={s.successBox}>
            <View style={s.successIcon}>
              <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
            </View>
            <Text style={s.successTitle}>Check your email</Text>
            <Text style={s.successSub}>
              We sent a reset link to{'\n'}<Text style={s.successEmail}>{email}</Text>
            </Text>
            <Text style={s.successHint}>
              Open the link on the same device as the web dashboard to reset your password.
            </Text>
            <TouchableOpacity style={s.tryAgainBtn} onPress={() => setSent(false)}>
              <Text style={s.tryAgainText}>Didn't receive it? Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={s.iconBox}>
              <Ionicons name="mail-outline" size={28} color="#e13d7d" />
            </View>
            <Text style={s.title}>Reset password</Text>
            <Text style={s.sub}>Enter your account email and we'll send you a reset link.</Text>

            <View style={s.field}>
              <Ionicons name="mail-outline" size={18} color="#9ca3af" style={s.fieldIcon} />
              <TextInput
                style={s.input}
                value={email}
                onChangeText={setEmail}
                placeholder="your@email.com"
                placeholderTextColor="#9ca3af"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <TouchableOpacity
              style={[s.sendBtn, loading && { opacity: 0.7 }]}
              onPress={handleSend}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Ionicons name="send-outline" size={16} color="#fff" />
              <Text style={s.sendBtnText}>{loading ? 'Sending…' : 'Send reset link'}</Text>
            </TouchableOpacity>
          </>
        )}

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

  field: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 14,
    marginBottom: 16, backgroundColor: '#fafafa',
  },
  fieldIcon: { marginRight: 10 },
  input:     { flex: 1, fontSize: 16, color: NAVY, padding: 0 },

  sendBtn: {
    backgroundColor: '#e13d7d', borderRadius: 14,
    paddingVertical: 17, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center', gap: 8,
  },
  sendBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Success state
  successBox:   { alignItems: 'center', paddingTop: 40, gap: 12 },
  successIcon:  { marginBottom: 8 },
  successTitle: { fontSize: 26, fontWeight: '800', color: NAVY, textAlign: 'center' },
  successSub:   { fontSize: 15, color: '#374151', textAlign: 'center', lineHeight: 22 },
  successEmail: { fontWeight: '700', color: NAVY },
  successHint:  { fontSize: 12, color: '#9ca3af', textAlign: 'center', lineHeight: 18, marginTop: 4 },
  tryAgainBtn:  { marginTop: 16 },
  tryAgainText: { fontSize: 14, color: '#2563eb', fontWeight: '600' },
});
