import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../lib/supabaseClient';

const NAVY   = '#1A1F3C';
const VIOLET = '#7C3AED';

interface EventDetail {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  child_id: string;
  therapist_id: string;
  parent_status: string;
}

export default function ScheduleRequestScreen() {
  const router = useRouter();
  const { eventId, childId, selectedDate } = useLocalSearchParams<{
    eventId: string;
    childId: string;
    selectedDate: string;
  }>();

  const [event, setEvent]               = useState<EventDetail | null>(null);
  const [therapistName, setTherapistName] = useState('');
  const [childName, setChildName]       = useState('');
  const [loading, setLoading]           = useState(true);
  const [responding, setResponding]     = useState(false);

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      try {
        const { data: ev } = await supabase
          .from('child_events')
          .select('id, title, description, scheduled_at, child_id, therapist_id, parent_status')
          .eq('id', eventId)
          .single();
        if (!ev) return;
        setEvent(ev);

        const [{ data: therapist }, { data: patient }] = await Promise.all([
          supabase.from('profiles').select('full_name').eq('id', ev.therapist_id).single(),
          supabase.from('patients').select('full_name').eq('id', ev.child_id).single(),
        ]);
        setTherapistName(therapist?.full_name ?? 'Your therapist');
        setChildName(patient?.full_name ?? '');
      } finally {
        setLoading(false);
      }
    })();
  }, [eventId]);

  async function respond(status: 'accepted' | 'rejected') {
    if (!eventId || !event) return;
    setResponding(true);
    try {
      const { error } = await supabase
        .from('child_events')
        .update({ parent_status: status })
        .eq('id', eventId);
      if (error) throw error;

      // Activity log
      await supabase.from('activity_logs').insert({
        actor_id:     (await supabase.auth.getUser()).data.user?.id ?? null,
        actor_name:   'Parent',
        action:       status === 'accepted' ? 'session.accepted' : 'session.rejected',
        entity_type:  'child_event',
        entity_id:    eventId,
        entity_label: event.title,
        meta:         { child_id: event.child_id, child_name: childName },
      }).then(() => {}).catch(() => {});

      // Notify the therapist
      const { data: therapistProfile } = await supabase
        .from('profiles')
        .select('expo_push_token')
        .eq('id', event.therapist_id)
        .single();
      const token = (therapistProfile as any)?.expo_push_token as string | null;
      if (token) {
        const dateLabel = new Date(event.scheduled_at).toLocaleDateString('en-MY', {
          weekday: 'short', day: 'numeric', month: 'short',
        });
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({
            to:    token,
            title: status === 'accepted' ? 'Session Accepted ✅' : 'Session Rejected ❌',
            body:  `${childName}'s parent has ${status} the drawing session on ${dateLabel}.`,
            data:  {
              screen:       'calendar',
              childId:      event.child_id,
              selectedDate: event.scheduled_at.split('T')[0],
            },
            sound:    'default',
            priority: 'high',
            channelId: 'default',
          }),
        });
      }

      Alert.alert(
        status === 'accepted' ? 'Session Accepted' : 'Session Rejected',
        status === 'accepted'
          ? 'Great! The drawing session has been confirmed.'
          : 'The session has been declined.',
        [{
          text: 'OK',
          onPress: () => router.replace({
            pathname: '/calendar',
            params: { selectedDate: selectedDate ?? '', childId: childId ?? '' },
          } as any),
        }],
      );
    } catch {
      Alert.alert('Error', 'Failed to update. Please try again.');
    } finally {
      setResponding(false);
    }
  }

  if (loading) {
    return (
      <View style={st.center}>
        <ActivityIndicator size="large" color={VIOLET} />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={st.center}>
        <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
        <Text style={st.errorText}>Session not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={st.backLink}>
          <Text style={st.backLinkText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const scheduledDate = new Date(event.scheduled_at).toLocaleDateString('en-MY', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const scheduledTime = new Date(event.scheduled_at).toLocaleTimeString('en-MY', {
    hour: '2-digit', minute: '2-digit',
  });
  const childFirst = childName.split(' ')[0] || 'your child';

  const alreadyResponded = event.parent_status !== 'pending';

  return (
    <View style={st.root}>
      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity
          style={st.backBtn}
          onPress={() => router.canGoBack() ? router.back() : router.replace('/calendar' as any)}
        >
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={st.headerCenter}>
          <Text style={st.headerTitle}>Drawing Session</Text>
          <Text style={st.headerSub}>Request from therapist</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={st.body} showsVerticalScrollIndicator={false}>
        {/* Icon */}
        <View style={st.iconWrap}>
          <Ionicons name="color-palette" size={40} color={VIOLET} />
        </View>

        {/* Event title */}
        <Text style={st.eventTitle}>{event.title}</Text>
        <Text style={st.therapistLine}>Requested by {therapistName}</Text>

        {/* Info cards */}
        <View style={st.infoCard}>
          <View style={st.infoRow}>
            <Ionicons name="person-outline" size={18} color={VIOLET} />
            <View style={st.infoText}>
              <Text style={st.infoLabel}>Child</Text>
              <Text style={st.infoValue}>{childName}</Text>
            </View>
          </View>
          <View style={st.divider} />
          <View style={st.infoRow}>
            <Ionicons name="calendar-outline" size={18} color={VIOLET} />
            <View style={st.infoText}>
              <Text style={st.infoLabel}>Date</Text>
              <Text style={st.infoValue}>{scheduledDate}</Text>
            </View>
          </View>
          <View style={st.divider} />
          <View style={st.infoRow}>
            <Ionicons name="time-outline" size={18} color={VIOLET} />
            <View style={st.infoText}>
              <Text style={st.infoLabel}>Time</Text>
              <Text style={st.infoValue}>{scheduledTime}</Text>
            </View>
          </View>
          {event.description ? (
            <>
              <View style={st.divider} />
              <View style={st.infoRow}>
                <Ionicons name="document-text-outline" size={18} color={VIOLET} />
                <View style={st.infoText}>
                  <Text style={st.infoLabel}>Note from therapist</Text>
                  <Text style={st.infoValue}>{event.description}</Text>
                </View>
              </View>
            </>
          ) : null}
        </View>

        {/* Already responded */}
        {alreadyResponded ? (
          <View style={[
            st.statusBanner,
            event.parent_status === 'accepted' ? st.statusAccepted : st.statusRejected,
          ]}>
            <Ionicons
              name={event.parent_status === 'accepted' ? 'checkmark-circle' : 'close-circle'}
              size={20}
              color={event.parent_status === 'accepted' ? '#065F46' : '#991B1B'}
            />
            <Text style={[
              st.statusText,
              { color: event.parent_status === 'accepted' ? '#065F46' : '#991B1B' },
            ]}>
              You have {event.parent_status} this session
            </Text>
          </View>
        ) : (
          <Text style={st.prompt}>
            Would you like {childFirst} to attend this drawing session?
          </Text>
        )}
      </ScrollView>

      {/* Footer buttons */}
      {!alreadyResponded && (
        <View style={st.footer}>
          <TouchableOpacity
            style={[st.rejectBtn, responding && st.btnDisabled]}
            onPress={() => respond('rejected')}
            disabled={responding}
            activeOpacity={0.82}
          >
            {responding ? <ActivityIndicator size="small" color={VIOLET} /> : (
              <>
                <Ionicons name="close" size={18} color={VIOLET} />
                <Text style={st.rejectBtnText}>Reject</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[st.acceptBtn, responding && st.btnDisabled]}
            onPress={() => respond('accepted')}
            disabled={responding}
            activeOpacity={0.88}
          >
            {responding ? <ActivityIndicator size="small" color="#fff" /> : (
              <>
                <Ionicons name="checkmark" size={18} color="#fff" />
                <Text style={st.acceptBtnText}>Accept</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {alreadyResponded && (
        <View style={st.footer}>
          <TouchableOpacity
            style={st.doneBtn}
            onPress={() => router.replace({
              pathname: '/calendar',
              params: { selectedDate: selectedDate ?? '', childId: childId ?? '' },
            } as any)}
            activeOpacity={0.88}
          >
            <Text style={st.doneBtnText}>Back to Calendar</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#F5F7FF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 32 },

  header: {
    backgroundColor: NAVY,
    paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle:  { fontSize: 17, fontWeight: '800', color: '#fff' },
  headerSub:    { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 2 },

  body: { padding: 20, paddingBottom: 20 },

  iconWrap: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: '#EDE9FE',
    alignSelf: 'center', alignItems: 'center', justifyContent: 'center',
    marginBottom: 16, marginTop: 8,
  },
  eventTitle:   { fontSize: 22, fontWeight: '800', color: NAVY, textAlign: 'center', marginBottom: 4 },
  therapistLine:{ fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 24 },

  infoCard: {
    backgroundColor: '#fff', borderRadius: 18,
    borderWidth: 1, borderColor: '#E5E7EB',
    paddingVertical: 4, marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  infoRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16 },
  infoText: { flex: 1 },
  infoLabel:{ fontSize: 11, fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  infoValue:{ fontSize: 14, fontWeight: '600', color: '#1F2937', lineHeight: 20 },
  divider:  { height: 1, backgroundColor: '#F3F4F6', marginHorizontal: 16 },

  prompt: { fontSize: 15, color: '#374151', textAlign: 'center', lineHeight: 22, fontWeight: '500' },

  statusBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderRadius: 14,
    borderWidth: 1,
  },
  statusAccepted: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  statusRejected: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  statusText:     { fontSize: 14, fontWeight: '700', flex: 1 },

  footer: {
    flexDirection: 'row', gap: 12,
    paddingHorizontal: 20, paddingBottom: 36, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  rejectBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, borderRadius: 14,
    borderWidth: 2, borderColor: VIOLET, backgroundColor: '#EDE9FE',
  },
  rejectBtnText: { fontSize: 16, fontWeight: '700', color: VIOLET },
  acceptBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, borderRadius: 14, backgroundColor: VIOLET,
  },
  acceptBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  btnDisabled:   { opacity: 0.5 },
  doneBtn: {
    flex: 1, paddingVertical: 16, borderRadius: 14,
    backgroundColor: NAVY, alignItems: 'center', justifyContent: 'center',
  },
  doneBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  errorText:   { fontSize: 16, fontWeight: '700', color: '#374151' },
  backLink:    { marginTop: 8 },
  backLinkText:{ fontSize: 14, color: VIOLET, fontWeight: '600' },
});
