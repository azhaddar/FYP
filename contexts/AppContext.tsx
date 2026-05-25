import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { Profile, Patient } from '../types';

interface AppContextType {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  unreadMsgCount: number;
  setUnreadMsgCount: (n: number) => void;
  // Shared children data
  children: Patient[];
  lastEmotions: Record<string, string>;
  therapistNames: Record<string, string>;
  childrenLoading: boolean;
  refreshChildren: () => Promise<void>;
  updateProfile: (fullName: string) => void;
}

const AppContext = createContext<AppContextType>({
  session: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  unreadMsgCount: 0,
  setUnreadMsgCount: () => {},
  children: [],
  lastEmotions: {},
  therapistNames: {},
  childrenLoading: false,
  refreshChildren: async () => {},
  updateProfile: () => {},
});

export function AppProvider({ children: appChildren }: { children: React.ReactNode }) {
  const [session, setSession]       = useState<Session | null>(null);
  const [profile, setProfile]       = useState<Profile | null>(null);
  const [loading, setLoading]       = useState(true);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);

  const [children, setChildren]           = useState<Patient[]>([]);
  const [lastEmotions, setLastEmotions]   = useState<Record<string, string>>({});
  const [therapistNames, setTherapistNames] = useState<Record<string, string>>({});
  const [childrenLoading, setChildrenLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id, session.user);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id, session.user);
      else {
        setProfile(null);
        setChildren([]);
        setLastEmotions({});
        setTherapistNames({});
        setLoading(false);
      }
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

      if (authUser && (!data || !data.full_name)) {
        const meta = authUser.user_metadata ?? {};
        setProfile({
          id: userId,
          full_name: meta.full_name ?? '',
          role: data?.role ?? meta.role ?? 'parent',
        } as Profile);
      } else {
        setProfile(data ?? null);
      }

      // Fetch children in parallel — don't block profile display
      fetchChildren(userId);
    } catch (e) {
      console.error('fetchProfile exception:', e);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }

  async function fetchChildren(userId: string) {
    setChildrenLoading(true);
    try {
      const { data: patientData } = await supabase
        .from('patients')
        .select('*')
        .eq('guardian_id', userId)
        .order('full_name');

      const kids = (patientData ?? []) as Patient[];
      setChildren(kids);

      if (kids.length === 0) return;

      const ids = kids.map(k => k.id);

      // Fetch last emotion per child + therapist names in parallel
      const [sketchRes, therapistIds] = await Promise.all([
        supabase
          .from('sketches')
          .select('patient_id, emotion')
          .in('patient_id', ids)
          .order('created_at', { ascending: false }),
        Promise.resolve([...new Set(kids.map(k => k.therapist_id).filter((id): id is string => !!id))]),
      ]);

      if (sketchRes.data) {
        const map: Record<string, string> = {};
        sketchRes.data.forEach(s => { if (!map[s.patient_id]) map[s.patient_id] = s.emotion; });
        setLastEmotions(map);
      }

      if (therapistIds.length) {
        const { data: profiles } = await supabase
          .from('profiles').select('id, full_name').in('id', therapistIds);
        if (profiles) {
          const m: Record<string, string> = {};
          profiles.forEach(p => { m[p.id] = p.full_name; });
          setTherapistNames(m);
        }
      }
    } catch (e) {
      console.error('fetchChildren exception:', e);
    } finally {
      setChildrenLoading(false);
    }
  }

  async function refreshChildren() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await fetchChildren(user.id);
  }

  function updateProfile(fullName: string) {
    setProfile(prev => prev ? { ...prev, full_name: fullName } : prev);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AppContext.Provider value={{
      session, profile, loading, signOut,
      unreadMsgCount, setUnreadMsgCount,
      children, lastEmotions, therapistNames, childrenLoading, refreshChildren, updateProfile,
    }}>
      {appChildren}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
