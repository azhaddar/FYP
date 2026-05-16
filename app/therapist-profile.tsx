import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabaseClient';
import { C, MAX_W, SHADOW } from '../constants/theme';

interface TherapistData {
  full_name: string;
  email: string;
  professional_title: string;
  academic_qualifications: string;
  years_of_experience: number | null;
  registered_body: string;
  license_number: string;
  bio: string;
}

function parseQualifications(raw: string): string[] {
  return raw.split('\n').map(s => s.trim()).filter(Boolean);
}

export default function TherapistProfileScreen() {
  const router = useRouter();
  const { therapistId } = useLocalSearchParams<{ therapistId: string }>();
  const [data, setData] = useState<TherapistData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (therapistId) fetchProfile();
  }, [therapistId]);

  async function fetchProfile() {
    const [{ data: profile }, { data: tp }] = await Promise.all([
      supabase.from('profiles').select('full_name, email').eq('id', therapistId!).single(),
      supabase.from('therapist_profiles').select('*').eq('id', therapistId!).maybeSingle(),
    ]);
    setData({
      full_name: profile?.full_name ?? 'Therapist',
      email: profile?.email ?? '',
      professional_title: tp?.professional_title ?? '',
      academic_qualifications: tp?.academic_qualifications ?? '',
      years_of_experience: tp?.years_of_experience ?? null,
      registered_body: tp?.registered_body ?? '',
      license_number: tp?.license_number ?? '',
      bio: tp?.bio ?? '',
    });
    setLoading(false);
  }

  const qualifications = data ? parseQualifications(data.academic_qualifications) : [];
  const isVerified = !!(data?.professional_title && data?.license_number && data?.academic_qualifications);

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerInner}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={C.white} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Therapist Profile</Text>
          <View style={{ width: 80 }} />
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : data ? (
        <ScrollView contentContainerStyle={styles.content}>

          {/* Identity card */}
          <View style={styles.identityCard}>
            <View style={styles.identityRow}>
              <View style={styles.identityInfo}>
                <Text style={styles.name}>{data.full_name.toUpperCase()}</Text>
                {isVerified ? (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="shield-checkmark" size={11} color="#15803d" />
                    <Text style={styles.verifiedText}>Verified</Text>
                  </View>
                ) : (
                  <View style={styles.incompleteBadge}>
                    <Text style={styles.incompleteText}>Profile Incomplete</Text>
                  </View>
                )}
                {data.professional_title ? (
                  <Text style={styles.professionalTitle}>{data.professional_title}</Text>
                ) : null}
                {data.registered_body ? (
                  <Text style={styles.registeredBody}>{data.registered_body}</Text>
                ) : null}
              </View>

              {/* Avatar */}
              <View style={styles.avatar}>
                <Ionicons name="person" size={34} color={C.white} />
              </View>
            </View>

            {/* Contact details */}
            <View style={styles.contactSection}>
              <Text style={styles.contactSectionLabel}>CONTACT DETAILS</Text>
              {data.email ? (
                <View style={styles.contactRow}>
                  <Ionicons name="mail" size={14} color={C.primary} />
                  <Text style={styles.contactText}>{data.email}</Text>
                </View>
              ) : null}
              {data.license_number ? (
                <View style={styles.contactRow}>
                  <Ionicons name="shield-checkmark" size={14} color="#16a34a" />
                  <Text style={styles.contactText}>{data.license_number}</Text>
                </View>
              ) : null}
              {data.years_of_experience != null ? (
                <View style={styles.contactRow}>
                  <Ionicons name="time" size={14} color="#3b82f6" />
                  <Text style={styles.contactText}>
                    {data.years_of_experience} year{data.years_of_experience !== 1 ? 's' : ''} of experience
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Professional Appointment */}
          {data.professional_title ? (
            <Section title="Professional Appointment">
              <View style={styles.appointmentRow}>
                <Text style={styles.appointmentText}>{data.professional_title}</Text>
                {data.years_of_experience != null ? (
                  <View style={styles.expBadge}>
                    <Ionicons name="time-outline" size={11} color="#1d4ed8" />
                    <Text style={styles.expBadgeText}>{data.years_of_experience} yrs experience</Text>
                  </View>
                ) : null}
              </View>
            </Section>
          ) : null}

          {/* Academic Qualifications */}
          {qualifications.length > 0 ? (
            <Section title="Academic Qualification">
              <View style={styles.qualList}>
                {qualifications.map((q, i) => (
                  <View key={i} style={styles.qualItem}>
                    <View style={styles.qualNum}>
                      <Text style={styles.qualNumText}>{i + 1}</Text>
                    </View>
                    <Text style={styles.qualText}>{q}</Text>
                  </View>
                ))}
              </View>
            </Section>
          ) : null}

          {/* Professional Registration */}
          {(data.registered_body || data.license_number) ? (
            <Section title="Professional Registration">
              <View style={styles.regRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.regLabel}>Registered Body</Text>
                  <Text style={styles.regValue}>{data.registered_body || '—'}</Text>
                </View>
                {data.license_number ? (
                  <View style={styles.licenseBadge}>
                    <Text style={styles.licenseBadgeText}>{data.license_number}</Text>
                  </View>
                ) : null}
              </View>
            </Section>
          ) : null}

          {/* About */}
          {data.bio ? (
            <Section title="About">
              <Text style={styles.bioText}>{data.bio}</Text>
            </Section>
          ) : null}

          {/* Chat CTA */}
          <TouchableOpacity
            style={styles.chatCta}
            onPress={() => router.push({
              pathname: '/chat',
              params: { otherId: therapistId, otherName: data.full_name },
            })}
          >
            <Ionicons name="chatbubble-ellipses" size={18} color={C.white} />
            <Text style={styles.chatCtaText}>
              Message {data.full_name.split(' ')[0]}
            </Text>
          </TouchableOpacity>

        </ScrollView>
      ) : null}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={sectionStyles.card}>
      <View style={sectionStyles.cardHeader}>
        <View style={sectionStyles.accent} />
        <Text style={sectionStyles.cardTitle}>{title.toUpperCase()}</Text>
      </View>
      <View style={sectionStyles.cardBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.base },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: { backgroundColor: C.primary, paddingTop: 52, paddingBottom: 16 },
  headerInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, maxWidth: MAX_W, alignSelf: 'center', width: '100%',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 80 },
  backText: { fontSize: 15, color: C.white, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: C.white },

  content: {
    padding: 16, paddingBottom: 40,
    maxWidth: MAX_W, alignSelf: 'center', width: '100%', gap: 12,
  },

  identityCard: { backgroundColor: C.white, borderRadius: 18, padding: 18, ...SHADOW.sm },
  identityRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', marginBottom: 16,
  },
  identityInfo: { flex: 1, marginRight: 14 },
  name: { fontSize: 17, fontWeight: '900', color: C.text, letterSpacing: 0.4, lineHeight: 24 },

  verifiedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#dcfce7', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, alignSelf: 'flex-start', marginTop: 7,
  },
  verifiedText: { fontSize: 11, fontWeight: '700', color: '#15803d' },
  incompleteBadge: {
    backgroundColor: '#fef3c7', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, alignSelf: 'flex-start', marginTop: 7,
  },
  incompleteText: { fontSize: 11, fontWeight: '700', color: '#92400e' },

  professionalTitle: { fontSize: 14, fontWeight: '700', color: C.text, marginTop: 10 },
  registeredBody: { fontSize: 13, color: C.textSub, marginTop: 3 },

  avatar: {
    width: 66, height: 78, borderRadius: 12,
    backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },

  contactSection: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 14 },
  contactSectionLabel: {
    fontSize: 10, fontWeight: '800', color: C.textMuted, letterSpacing: 1.2, marginBottom: 10,
  },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 7 },
  contactText: { fontSize: 13, color: C.textSub },

  appointmentRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
  },
  appointmentText: { fontSize: 14, fontWeight: '600', color: C.text, flex: 1 },
  expBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#dbeafe', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  expBadgeText: { fontSize: 11, fontWeight: '700', color: '#1d4ed8' },

  qualList: { gap: 10 },
  qualItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  qualNum: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: C.primaryLight, justifyContent: 'center', alignItems: 'center',
    marginTop: 1, flexShrink: 0,
  },
  qualNumText: { fontSize: 10, fontWeight: '800', color: C.primary },
  qualText: { fontSize: 13, color: C.text, lineHeight: 20, flex: 1 },

  regRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
  },
  regLabel: { fontSize: 10, fontWeight: '700', color: C.textMuted, letterSpacing: 0.8, marginBottom: 3 },
  regValue: { fontSize: 14, fontWeight: '600', color: C.text },
  licenseBadge: {
    backgroundColor: '#dcfce7', borderWidth: 1, borderColor: '#86efac',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  licenseBadgeText: { fontSize: 13, fontWeight: '700', color: '#15803d' },

  bioText: { fontSize: 14, color: C.textSub, lineHeight: 22 },

  chatCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.primary, borderRadius: 16, paddingVertical: 16, marginTop: 4,
    ...SHADOW.sm,
  },
  chatCtaText: { fontSize: 16, fontWeight: '700', color: C.white },
});

const sectionStyles = StyleSheet.create({
  card: { backgroundColor: C.white, borderRadius: 16, overflow: 'hidden', ...SHADOW.sm },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F9F9FB', borderBottomWidth: 1, borderBottomColor: C.border,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  accent: { width: 3, height: 16, borderRadius: 2, backgroundColor: C.primary },
  cardTitle: { fontSize: 10, fontWeight: '800', color: C.textSub, letterSpacing: 1 },
  cardBody: { padding: 16 },
});
