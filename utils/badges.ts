import AsyncStorage from '@react-native-async-storage/async-storage';

export type SketchMini = { emotion: string; created_at: string };

export type BadgeDef = {
  id: string;
  name: string;
  desc: string;
  icon: string;
  color: string;
  earned: (s: SketchMini[]) => boolean;
  progress?: (s: SketchMini[]) => { current: number; total: number };
};

function computeStreak(sketches: SketchMini[]): number {
  if (!sketches.length) return 0;
  const days = [...new Set(sketches.map(s => s.created_at.slice(0, 10)))].sort().reverse();
  let streak = 0;
  let current = new Date();
  current.setHours(0, 0, 0, 0);
  for (const day of days) {
    const d = new Date(day);
    d.setHours(0, 0, 0, 0);
    const diff = Math.round((Number(current) - Number(d)) / 86400000);
    if (diff === 0 || diff === 1) { streak++; current = d; }
    else break;
  }
  return streak;
}

export const BADGES: BadgeDef[] = [
  {
    id: 'first_step',
    name: 'First Step',
    desc: 'Completed your very first drawing.',
    icon: 'star',
    color: '#f59e0b',
    earned: s => s.length >= 1,
  },
  {
    id: 'brave_heart',
    name: 'Brave Heart',
    desc: 'Drew when feeling sad or angry. That took real courage.',
    icon: 'shield-checkmark',
    color: '#e13d7d',
    earned: s => s.some(sk => sk.emotion === 'sad' || sk.emotion === 'angry'),
  },
  {
    id: 'feeling_explorer',
    name: 'Feeling Explorer',
    desc: 'Expressed all 4 different emotions through drawing.',
    icon: 'compass',
    color: '#06b6d4',
    earned: s => ['happy', 'sad', 'angry', 'anxious'].every(e => s.some(sk => sk.emotion === e)),
    progress: s => ({
      current: ['happy', 'sad', 'angry', 'anxious'].filter(e => s.some(sk => sk.emotion === e)).length,
      total: 4,
    }),
  },
  {
    id: 'daily_artist',
    name: 'Daily Artist',
    desc: 'Drew 3 days in a row.',
    icon: 'flame',
    color: '#f97316',
    earned: s => computeStreak(s) >= 3,
    progress: s => ({ current: Math.min(computeStreak(s), 3), total: 3 }),
  },
  {
    id: 'happy_days',
    name: 'Happy Days',
    desc: '5 drawings that showed happiness.',
    icon: 'sunny',
    color: '#eab308',
    earned: s => s.filter(sk => sk.emotion === 'happy').length >= 5,
    progress: s => ({ current: Math.min(s.filter(sk => sk.emotion === 'happy').length, 5), total: 5 }),
  },
  {
    id: 'storyteller',
    name: 'Storyteller',
    desc: 'Created 10 drawings in total.',
    icon: 'book',
    color: '#7c3aed',
    earned: s => s.length >= 10,
    progress: s => ({ current: Math.min(s.length, 10), total: 10 }),
  },
  {
    id: 'week_warrior',
    name: 'Week Warrior',
    desc: 'Drew every day for a whole week.',
    icon: 'calendar',
    color: '#8b5cf6',
    earned: s => computeStreak(s) >= 7,
    progress: s => ({ current: Math.min(computeStreak(s), 7), total: 7 }),
  },
  {
    id: 'true_artist',
    name: 'True Artist',
    desc: '25 drawings — an incredible achievement.',
    icon: 'brush',
    color: '#10b981',
    earned: s => s.length >= 25,
    progress: s => ({ current: Math.min(s.length, 25), total: 25 }),
  },
  {
    id: 'month_master',
    name: 'Month Master',
    desc: '30 days drawing in a row. Legendary.',
    icon: 'trophy',
    color: '#d97706',
    earned: s => computeStreak(s) >= 30,
    progress: s => ({ current: Math.min(computeStreak(s), 30), total: 30 }),
  },
];

export function computeEarnedBadges(sketches: SketchMini[]): BadgeDef[] {
  return BADGES.filter(b => b.earned(sketches));
}

export function computeEarnedBadgeIds(sketches: SketchMini[]): string[] {
  return BADGES.filter(b => b.earned(sketches)).map(b => b.id);
}

export async function getSeenBadgeIds(childId: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(`badges_seen_${childId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function markBadgesSeen(childId: string, ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(`badges_seen_${childId}`, JSON.stringify(ids));
  } catch {}
}
