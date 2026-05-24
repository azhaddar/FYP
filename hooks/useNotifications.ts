import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabaseClient';

export type NotifType = 'sketch' | 'alert' | 'message' | 'status' | 'schedule';

export interface AppNotification {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  created_at: string;
  read: boolean;
  meta?: Record<string, string>;
}

const NEGATIVE = new Set(['sad', 'angry', 'anxious']);

export function useNotifications(guardianId: string) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);

  const readKey    = `notif_read_${guardianId}`;
  const dismissKey = `notif_dismissed_${guardianId}`;

  const loadStored = useCallback(async () => {
    try {
      const [rawRead, rawDismiss] = await Promise.all([
        AsyncStorage.getItem(readKey),
        AsyncStorage.getItem(dismissKey),
      ]);
      if (rawRead)    setReadIds(new Set(JSON.parse(rawRead) as string[]));
      if (rawDismiss) setDismissedIds(new Set(JSON.parse(rawDismiss) as string[]));
    } catch {}
  }, [readKey, dismissKey]);

  const refresh = useCallback(async () => {
    if (!guardianId) return;
    setLoading(true);
    try {
      const { data: children } = await supabase
        .from('patients')
        .select('id, full_name, therapist_id')
        .eq('guardian_id', guardianId);

      if (!children?.length) return;

      const childIds = children.map(c => c.id);
      const nameOf: Record<string, string> = {};
      children.forEach(c => { nameOf[c.id] = c.full_name.split(' ')[0]; });

      const therapistIds = [...new Set(
        children.map(c => c.therapist_id).filter((id): id is string => !!id)
      )];

      const since14d = new Date(Date.now() - 14 * 86400000).toISOString();

      const [{ data: sketches }, { data: msgs }, { data: allRecent }, { data: scheduleEvents }] = await Promise.all([
        supabase
          .from('sketches')
          .select('id, patient_id, emotion, created_at, status, reviewed_at, verified_at')
          .in('patient_id', childIds)
          .gte('created_at', since14d)
          .order('created_at', { ascending: false })
          .limit(30),
        therapistIds.length
          ? supabase
              .from('messages')
              .select('id, sender_id, content, created_at')
              .in('sender_id', therapistIds)
              .eq('receiver_id', guardianId)
              .is('read_at', null)
              .order('created_at', { ascending: false })
              .limit(10)
          : Promise.resolve({ data: [] as any[] }),
        supabase
          .from('sketches')
          .select('patient_id, emotion')
          .in('patient_id', childIds)
          .order('created_at', { ascending: false })
          .limit(childIds.length * 5),
        supabase
          .from('child_events')
          .select('id, title, scheduled_at, child_id, therapist_id')
          .in('child_id', childIds)
          .eq('event_type', 'drawing_schedule')
          .eq('parent_status', 'pending')
          .order('scheduled_at', { ascending: true }),
      ]);

      const alertItems: AppNotification[] = [];
      children.forEach(child => {
        const recent = (allRecent ?? [])
          .filter(s => s.patient_id === child.id)
          .slice(0, 3);
        if (recent.length === 3 && recent.every(s => NEGATIVE.has(s.emotion))) {
          alertItems.push({
            id: `alert_${child.id}`,
            type: 'alert',
            title: `${nameOf[child.id]} needs your attention`,
            body: 'Last 3 drawings show negative emotions. Consider checking in.',
            created_at: new Date().toISOString(),
            read: false,
            meta: { patientId: child.id },
          });
        }
      });

      // Only show "new drawing" notification for submitted sketches
      const sketchItems: AppNotification[] = (sketches ?? [])
        .filter(s => s.status === 'submitted' || !s.status)
        .map(s => ({
          id: `sketch_${s.id}`,
          type: 'sketch' as const,
          title: `${nameOf[s.patient_id] ?? 'Your child'} added a new drawing`,
          body: `Feeling ${s.emotion.charAt(0).toUpperCase() + s.emotion.slice(1)} today`,
          created_at: s.created_at,
          read: false,
          meta: { sketchId: s.id, patientId: s.patient_id },
        }));

      // Status update notifications — use the actual timestamp the status changed
      const statusItems: AppNotification[] = (sketches ?? [])
        .filter(s => s.status === 'reviewing' || s.status === 'verified')
        .map(s => {
          const child = nameOf[s.patient_id] ?? 'Your child';
          const isVerified = s.status === 'verified';
          const statusTimestamp = isVerified
            ? (s.verified_at ?? s.created_at)
            : (s.reviewed_at ?? s.created_at);
          return {
            id: `${s.status}_${s.id}`,
            type: 'status' as const,
            title: isVerified
              ? `${child}'s drawing has been verified!`
              : `Therapist is reviewing ${child}'s drawing`,
            body: isVerified
              ? 'The therapist has completed their review and verified this session.'
              : 'Your child\'s drawing is currently being reviewed by the therapist.',
            created_at: statusTimestamp,
            read: false,
            meta: { sketchId: s.id, patientId: s.patient_id },
          };
        });

      setUnreadMsgCount(msgs?.length ?? 0);

      const msgItems: AppNotification[] = (msgs ?? []).map((m: any) => ({
        id: `msg_${m.id}`,
        type: 'message' as const,
        title: 'New message from therapist',
        body: m.content.length > 80 ? m.content.slice(0, 80) + '…' : m.content,
        created_at: m.created_at,
        read: false,
        meta: { senderId: m.sender_id },
      }));

      // Fetch therapist names for pending drawing sessions
      let scheduleItems: AppNotification[] = [];
      if (scheduleEvents?.length) {
        const schedTherapistIds = [...new Set(scheduleEvents.map(e => e.therapist_id))];
        const { data: therapistProfiles } = await supabase
          .from('profiles').select('id, full_name').in('id', schedTherapistIds);
        const therapistNameOf: Record<string, string> = {};
        (therapistProfiles ?? []).forEach(t => { therapistNameOf[t.id] = t.full_name; });

        scheduleItems = scheduleEvents.map(ev => {
          const childFirst = nameOf[ev.child_id] ?? 'your child';
          const therapistName = therapistNameOf[ev.therapist_id] ?? 'Your therapist';
          const dateLabel = new Date(ev.scheduled_at).toLocaleDateString('en-MY', {
            weekday: 'short', day: 'numeric', month: 'short',
          });
          return {
            id: `schedule_${ev.id}`,
            type: 'schedule' as const,
            title: `Drawing session scheduled for ${childFirst}`,
            body: `${therapistName} · ${dateLabel} · Tap to respond`,
            created_at: ev.scheduled_at,
            read: false,
            meta: {
              eventId:      ev.id,
              childId:      ev.child_id,
              selectedDate: ev.scheduled_at.split('T')[0],
            },
          };
        });
      }

      const all = [...scheduleItems, ...alertItems, ...statusItems, ...sketchItems, ...msgItems];
      all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setItems(all);
    } finally {
      setLoading(false);
    }
  }, [guardianId]);

  const markAllRead = useCallback(async () => {
    const ids = items.map(n => n.id);
    setReadIds(new Set(ids));
    try { await AsyncStorage.setItem(readKey, JSON.stringify(ids)); } catch {}
  }, [items, readKey]);

  const markOneRead = useCallback((id: string) => {
    setReadIds(prev => {
      const next = new Set(prev);
      next.add(id);
      AsyncStorage.setItem(readKey, JSON.stringify([...next])).catch(() => {});
      return next;
    });
  }, [readKey]);

  const dismissItem = useCallback((id: string) => {
    setDismissedIds(prev => {
      const next = new Set(prev);
      next.add(id);
      AsyncStorage.setItem(dismissKey, JSON.stringify([...next])).catch(() => {});
      return next;
    });
  }, [dismissKey]);

  useEffect(() => {
    if (!guardianId) return;
    loadStored();
    refresh();
  }, [guardianId]);

  const notifications = items
    .filter(n => !dismissedIds.has(n.id))
    .map(n => ({ ...n, read: readIds.has(n.id) }));
  const unreadCount = notifications.filter(n => !n.read).length;

  return { notifications, unreadCount, unreadMsgCount, markAllRead, markOneRead, dismissItem, refresh, loading };
}
