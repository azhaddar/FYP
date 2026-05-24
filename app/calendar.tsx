import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../lib/supabaseClient';
import { ParentShell } from '../components/ParentShell';

const NAVY = '#1A1F3C';
const BG   = '#F5F7FF';

const EMOTION_DOTS: Record<string, { key: string; color: string }> = {
  happy:   { key: 'happy',   color: '#FBBF24' },
  sad:     { key: 'sad',     color: '#60A5FA' },
  angry:   { key: 'angry',   color: '#F87171' },
  anxious: { key: 'anxious', color: '#C084FC' },
};

const EVENT_COLOR: Record<string, string> = {
  appointment:      '#10B981',
  homework_prompt:  '#F59E0B',
  check_in:         '#3B82F6',
  drawing_schedule: '#7C3AED',
};
const EVENT_LABEL: Record<string, string> = {
  appointment:      'Appointment',
  homework_prompt:  'Homework',
  check_in:         'Check-in',
  drawing_schedule: 'Drawing Session',
};
const EVENT_ICON: Record<string, string> = {
  appointment:      'medical-outline',
  homework_prompt:  'book-outline',
  check_in:         'heart-outline',
  drawing_schedule: 'color-palette-outline',
};

interface Child {
  id: string;
  full_name: string;
}

interface ChildEvent {
  id: string;
  child_id: string;
  title: string;
  description?: string | null;
  event_type: string;
  scheduled_at: string;
  parent_status?: string | null;
}

interface SketchEntry {
  id: string;
  patient_id: string;
  emotion: string;
  created_at: string;
}

export default function CalendarScreen() {
  const params = useLocalSearchParams<{ selectedDate?: string; childId?: string }>();

  const [children, setChildren]           = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [events, setEvents]               = useState<ChildEvent[]>([]);
  const [sketches, setSketches]           = useState<SketchEntry[]>([]);
  const [loading, setLoading]             = useState(true);
  const [selectedDate, setSelectedDate]   = useState<string>(
    params.selectedDate ?? new Date().toISOString().split('T')[0]
  );
  const [showAll, setShowAll]             = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('patients')
        .select('id, full_name')
        .eq('guardian_id', user.id);
      const kids = data ?? [];
      setChildren(kids);
      const firstId = params.childId ?? kids[0]?.id ?? null;
      setSelectedChildId(firstId);
      if (!firstId) setLoading(false);
    })();
  }, []);

  const loadData = useCallback(async (childId: string) => {
    setLoading(true);
    try {
      const since3m = new Date(Date.now() - 90 * 86400000).toISOString();
      const [{ data: evts }, { data: sk }] = await Promise.all([
        supabase
          .from('child_events')
          .select('id, child_id, title, description, event_type, scheduled_at, parent_status')
          .eq('child_id', childId)
          .order('scheduled_at', { ascending: true }),
        supabase
          .from('sketches')
          .select('id, patient_id, emotion, created_at')
          .eq('patient_id', childId)
          .gte('created_at', since3m)
          .order('created_at', { ascending: false }),
      ]);
      setEvents(evts ?? []);
      setSketches(sk ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedChildId) loadData(selectedChildId);
  }, [selectedChildId]);

  // Sync incoming param changes (e.g. from notification tap)
  useEffect(() => {
    if (params.selectedDate) setSelectedDate(params.selectedDate);
    if (params.childId)      setSelectedChildId(params.childId);
  }, [params.selectedDate, params.childId]);

  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};

    sketches.forEach(s => {
      const day = s.created_at.split('T')[0];
      if (!marks[day]) marks[day] = { dots: [] };
      const dot = EMOTION_DOTS[s.emotion];
      if (dot && !marks[day].dots.find((d: any) => d.key === dot.key)) {
        marks[day].dots.push(dot);
      }
    });

    events.forEach(ev => {
      const day = ev.scheduled_at.split('T')[0];
      if (!marks[day]) marks[day] = { dots: [] };
      const evKey = `evt_${ev.event_type}`;
      if (!marks[day].dots.find((d: any) => d.key === evKey)) {
        marks[day].dots.push({ key: evKey, color: EVENT_COLOR[ev.event_type] ?? '#10B981' });
      }
    });

    if (selectedDate) {
      marks[selectedDate] = {
        ...(marks[selectedDate] ?? {}),
        selected: true,
        selectedColor: NAVY,
      };
    }

    return marks;
  }, [sketches, events, selectedDate]);

  const dayEvents   = events.filter(ev => ev.scheduled_at.split('T')[0] === selectedDate);
  const daySketches = sketches.filter(s => s.created_at.split('T')[0] === selectedDate);
  const selectedChild = children.find(c => c.id === selectedChildId);

  const DAILY_LIMIT = 5;
  const allDayItems = [
    ...dayEvents.map(e  => ({ type: 'event'  as const, data: e,  key: e.id  })),
    ...daySketches.map(s => ({ type: 'sketch' as const, data: s,  key: s.id  })),
  ];
  const visibleItems = showAll ? allDayItems : allDayItems.slice(0, DAILY_LIMIT);
  const hiddenCount  = allDayItems.length - DAILY_LIMIT;

  // Reset "show more" whenever the selected date changes
  useEffect(() => { setShowAll(false); }, [selectedDate]);

  const dayLabel = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-MY', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <ParentShell>
      <View style={s.root}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerTitle}>Calendar</Text>
          {selectedChild && (
            <Text style={s.headerSub}>
              {selectedChild.full_name.split(' ')[0]}'s schedule
            </Text>
          )}
        </View>

        {/* Child chips (multi-child only) */}
        {children.length > 1 && (
          <View style={s.chipRow}>
            {children.map(c => (
              <TouchableOpacity
                key={c.id}
                style={[s.chip, selectedChildId === c.id ? s.chipActive : s.chipInactive]}
                onPress={() => setSelectedChildId(c.id)}
                activeOpacity={0.75}
              >
                <Text style={[s.chipText, selectedChildId === c.id && s.chipTextActive]}>
                  {c.full_name.split(' ')[0]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          {/* Calendar */}
          <View style={s.calWrap}>
            <Calendar
              markingType="multi-dot"
              markedDates={markedDates}
              onDayPress={day => setSelectedDate(day.dateString)}
              theme={{
                backgroundColor: 'transparent',
                calendarBackground: '#fff',
                todayTextColor: '#4C6EF5',
                selectedDayBackgroundColor: NAVY,
                selectedDayTextColor: '#fff',
                arrowColor: NAVY,
                monthTextColor: NAVY,
                textDayFontWeight: '600',
                textMonthFontWeight: '800',
                dotColor: NAVY,
                textDayFontSize: 14,
                textMonthFontSize: 15,
              }}
            />
          </View>

          {/* Dot legend */}
          <View style={s.legend}>
            {Object.entries(EMOTION_DOTS).map(([key, dot]) => (
              <View key={key} style={s.legendItem}>
                <View style={[s.dot, { backgroundColor: dot.color }]} />
                <Text style={s.legendLabel}>{key.charAt(0).toUpperCase() + key.slice(1)}</Text>
              </View>
            ))}
            <View style={s.legendItem}>
              <View style={[s.dot, { backgroundColor: '#10B981' }]} />
              <Text style={s.legendLabel}>Events</Text>
            </View>
          </View>

          {/* Day detail */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>{dayLabel}</Text>

            {loading ? (
              <ActivityIndicator color={NAVY} style={{ marginTop: 24 }} />
            ) : allDayItems.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="calendar-outline" size={36} color="#D1D5DB" />
                <Text style={s.emptyText}>Nothing on this day</Text>
              </View>
            ) : (
              <>
                {visibleItems.map(item =>
                  item.type === 'event'
                    ? <ScheduledEventCard key={item.key} event={item.data as ChildEvent} />
                    : <DrawingHistoryCard key={item.key} sketch={item.data as SketchEntry} />
                )}
                {!showAll && hiddenCount > 0 && (
                  <TouchableOpacity style={s.showMoreBtn} onPress={() => setShowAll(true)} activeOpacity={0.75}>
                    <Text style={s.showMoreText}>Show {hiddenCount} more</Text>
                    <Ionicons name="chevron-down" size={14} color={NAVY} />
                  </TouchableOpacity>
                )}
                {showAll && allDayItems.length > DAILY_LIMIT && (
                  <TouchableOpacity style={s.showMoreBtn} onPress={() => setShowAll(false)} activeOpacity={0.75}>
                    <Text style={s.showMoreText}>Show less</Text>
                    <Ionicons name="chevron-up" size={14} color={NAVY} />
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </ScrollView>
      </View>
    </ParentShell>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  pending:  { label: 'Pending',  bg: '#FFFBEB', text: '#92400E' },
  accepted: { label: 'Accepted', bg: '#ECFDF5', text: '#065F46' },
  rejected: { label: 'Rejected', bg: '#FEF2F2', text: '#991B1B' },
};

function ScheduledEventCard({ event }: { event: ChildEvent }) {
  const router = useRouter();
  const color  = EVENT_COLOR[event.event_type] ?? '#10B981';
  const label  = EVENT_LABEL[event.event_type] ?? event.event_type;
  const icon   = EVENT_ICON[event.event_type]  ?? 'calendar-outline';
  const time   = new Date(event.scheduled_at).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });

  const isDrawing = event.event_type === 'drawing_schedule';
  const badge = isDrawing ? STATUS_BADGE[event.parent_status ?? 'pending'] : null;

  const inner = (
    <>
      <View style={[card.icon, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <View style={card.body}>
        <View style={card.titleRow}>
          <Text style={card.title}>{event.title}</Text>
          {badge && (
            <View style={[card.badge, { backgroundColor: badge.bg }]}>
              <Text style={[card.badgeText, { color: badge.text }]}>{badge.label}</Text>
            </View>
          )}
        </View>
        <Text style={card.meta}>{label} · {time}</Text>
        {event.description ? <Text style={card.desc}>{event.description}</Text> : null}
        {isDrawing && event.parent_status === 'pending' && (
          <Text style={card.tapHint}>Tap to accept or reject</Text>
        )}
      </View>
    </>
  );

  if (isDrawing) {
    return (
      <TouchableOpacity
        style={[card.wrap, { borderLeftColor: color }]}
        activeOpacity={0.75}
        onPress={() => router.push({
          pathname: '/schedule-request',
          params: {
            eventId:      event.id,
            childId:      event.child_id,
            selectedDate: event.scheduled_at.split('T')[0],
          },
        } as any)}
      >
        {inner}
      </TouchableOpacity>
    );
  }

  return <View style={[card.wrap, { borderLeftColor: color }]}>{inner}</View>;
}

function DrawingHistoryCard({ sketch }: { sketch: SketchEntry }) {
  const emo   = sketch.emotion;
  const color = EMOTION_DOTS[emo]?.color ?? '#94A3B8';
  const time  = new Date(sketch.created_at).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });
  return (
    <View style={[card.wrap, { borderLeftColor: color }]}>
      <View style={[card.icon, { backgroundColor: color + '22' }]}>
        <Ionicons name="color-palette-outline" size={18} color={color} />
      </View>
      <View style={card.body}>
        <Text style={card.title}>Drawing session</Text>
        <Text style={card.meta}>
          {emo.charAt(0).toUpperCase() + emo.slice(1)} · {time}
        </Text>
      </View>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: BG },
  header:     { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  headerTitle:{ fontSize: 26, fontWeight: '800', color: NAVY },
  headerSub:  { fontSize: 13, color: '#6B7280', marginTop: 2 },
  chipRow: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16, paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chipInactive: {
    backgroundColor: '#fff',
    borderColor: '#E5E7EB',
  },
  chipActive:     { backgroundColor: NAVY, borderColor: NAVY },
  chipText:       { fontSize: 13, fontWeight: '600', color: '#374151' },
  chipTextActive: { color: '#fff' },
  scroll:   { paddingBottom: 30 },
  calWrap:  { marginHorizontal: 16, borderRadius: 18, overflow: 'hidden', backgroundColor: '#fff' },
  legend:   { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, paddingTop: 12, gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot:        { width: 8, height: 8, borderRadius: 4 },
  legendLabel:{ fontSize: 11, color: '#6B7280' },
  section:    { paddingHorizontal: 16, paddingTop: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: NAVY, marginBottom: 12 },
  empty: { alignItems: 'center', paddingVertical: 36, gap: 8 },
  emptyText: { fontSize: 13, color: '#9CA3AF' },
  showMoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: 12,
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB',
    marginBottom: 10,
  },
  showMoreText: { fontSize: 13, fontWeight: '700', color: NAVY },
});

const card = StyleSheet.create({
  wrap: {
    backgroundColor: '#fff', borderRadius: 14,
    borderLeftWidth: 3, padding: 14,
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  icon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  title:    { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  badge:    { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  badgeText:{ fontSize: 10, fontWeight: '700' },
  meta:     { fontSize: 12, color: '#6B7280', marginTop: 2 },
  desc:     { fontSize: 12, color: '#9CA3AF', marginTop: 4, lineHeight: 18 },
  tapHint:  { fontSize: 11, color: '#7C3AED', marginTop: 4, fontWeight: '600' },
});
