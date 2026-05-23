import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { Profile } from '../types';

interface AppContextType {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  unreadMsgCount: number;
  setUnreadMsgCount: (n: number) => void;
}

const AppContext = createContext<AppContextType>({
  session: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  unreadMsgCount: 0,
  setUnreadMsgCount: () => {},
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id, session.user);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id, session.user);
      else { setProfile(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string, authUser?: User) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('id', userId)
        .maybeSingle();
      if (error) console.error('fetchProfile error:', error.message);

      // If profile missing or name empty, patch display from auth metadata (no DB write)
      if (authUser && (!data || !data.full_name)) {
        const meta = authUser.user_metadata ?? {};
        setProfile({
          id: userId,
          full_name: meta.full_name ?? '',
          role: data?.role ?? meta.role ?? 'parent',
        } as Profile);
        return;
      }

      setProfile(data ?? null);
    } catch (e) {
      console.error('fetchProfile exception:', e);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AppContext.Provider value={{ session, profile, loading, signOut, unreadMsgCount, setUnreadMsgCount }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
