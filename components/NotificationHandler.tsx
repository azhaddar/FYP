import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabaseClient';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowList: true,
  }),
});

export function NotificationHandler() {
  const router = useRouter();
  const responseSub = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'EmotiSketch',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
        });
      }

      try {
        const { data: token } = await Notifications.getExpoPushTokenAsync();
        const { data: { user } } = await supabase.auth.getUser();
        if (user && token) {
          await supabase.from('profiles').update({ expo_push_token: token }).eq('id', user.id);
        }
      } catch {
        // Token registration fails in Expo Go without a project ID — non-critical
      }
    })();

    responseSub.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as Record<string, string>;
      if (data?.screen === 'drawing-schedule') {
        router.push({
          pathname: '/schedule-request',
          params: {
            eventId:      data.eventId ?? '',
            childId:      data.childId ?? '',
            selectedDate: data.selectedDate ?? '',
          },
        } as any);
      } else if (data?.screen === 'calendar') {
        router.push({
          pathname: '/calendar',
          params: {
            selectedDate: data.selectedDate ?? '',
            childId:      data.childId ?? '',
          },
        } as any);
      }
    });

    return () => {
      if (responseSub.current) Notifications.removeNotificationSubscription(responseSub.current);
    };
  }, []);

  return null;
}
