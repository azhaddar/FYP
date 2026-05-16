import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { Patient, Profile } from '../types';

interface AppContextType {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  activeChild: Patient | null;
  enterChildMode: (child: Patient) => void;
  exitChildMode: () => void;
  signOut: () => Promise<void>;
  unreadBadgeCount: number;
  setUnreadBadgeCount: (n: number) => void;
  unreadMsgCount: number;
  setUnreadMsgCount: (n: number) => void;
}

const AppContext = createContext<AppContextType>({
  session: null,
  profile: null,
  loading: true,
  activeChild: null,
  enterChildMode: () => {},
  exitChildMode: () => {},
  signOut: async () => {},
  unreadBadgeCount: 0,
  setUnreadBadgeCount: () => {},
  unreadMsgCount: 0,
  setUnreadMsgCount: () => {},
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeChild, setActiveChild] = useState<Patient | null>(null);
  const [unreadBadgeCount, setUnreadBadgeCount] = useState(0);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else { setProfile(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', userId)
      .single();
    setProfile(data ?? null);
    setLoading(false);
  }

  function enterChildMode(child: Patient) {
    setActiveChild(child);
  }

  function exitChildMode() {
    setActiveChild(null);
    setUnreadBadgeCount(0);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setActiveChild(null);
  }

  return (
    <AppContext.Provider value={{ session, profile, loading, activeChild, enterChildMode, exitChildMode, signOut, unreadBadgeCount, setUnreadBadgeCount, unreadMsgCount, setUnreadMsgCount }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
