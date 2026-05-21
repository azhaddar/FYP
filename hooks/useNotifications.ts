import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabaseClient';

export type NotifType = 'sketch' | 'alert' | 'message';

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
  const [loading, setLoading] = useState(true);

  const storageKey = `notif_read_${guardianId}`;

  const loadReadIds = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(storageKey);
      if (raw) setReadIds(new Set(JSON.parse(raw) as string[]));
    } catch {}
  }, [storageKey]);

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

      const [{ data: sketches }, { data: msgs }, { data: allRecent }] = await Promise.all([
        supabase
          .from('sketches')
          .select('id, patient_id, emotion, created_at')
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
      ]);

      // Negative streak alerts
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

      const sketchItems: AppNotification[] = (sketches ?? []).map(s => ({
        id: `sketch_${s.id}`,
        type: 'sketch' as const,
        title: `${nameOf[s.patient_id] ?? 'Your child'} added a new drawing`,
        body: `Feeling ${s.emotion.charAt(0).toUpperCase() + s.emotion.slice(1)} today`,
        created_at: s.created_at,
        read: false,
        meta: { sketchId: s.id, patientId: s.patient_id },
      }));

      const msgItems: AppNotification[] = (msgs ?? []).map((m: any) => ({
        id: `msg_${m.id}`,
        type: 'message' as const,
        title: 'New message from therapist',
        body: m.content.length > 80 ? m.content.slice(0, 80) + '…' : m.content,
        created_at: m.created_at,
        read: false,
        meta: { senderId: m.sender_id },
      }));

      const all = [...alertItems, ...sketchItems, ...msgItems];
      all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setItems(all);
    } finally {
      setLoading(false);
    }
  }, [guardianId]);

  const markAllRead = useCallback(async () => {
    const ids = items.map(n => n.id);
    setReadIds(new Set(ids));
    try { await AsyncStorage.setItem(storageKey, JSON.stringify(ids)); } catch {}
  }, [items, storageKey]);

  useEffect(() => {
    if (!guardianId) return;
    loadReadIds();
    refresh();
  }, [guardianId]);

  const notifications = items.map(n => ({ ...n, read: readIds.has(n.id) }));
  const unreadCount = notifications.filter(n => !n.read).length;

  return { notifications, unreadCount, markAllRead, refresh, loading };
}
