export const C = {
  primary: '#e13d7d',
  primaryLight: '#fce7f3',
  primaryDark: '#b5306a',
  base: '#F2F2F7',
  white: '#FFFFFF',
  border: '#EBEBEB',
  borderMed: '#D8D8D8',
  text: '#1A1A2E',
  textSub: '#6B6B7B',
  textMuted: '#A0A0B0',
  danger: '#ef4444',
  googleBlue: '#4285F4',
};

export const SHADOW = {
  sm: {
    shadowColor: '#1A1A2E',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  md: {
    shadowColor: '#1A1A2E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 5,
  },
  lg: {
    shadowColor: '#1A1A2E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.13,
    shadowRadius: 20,
    elevation: 8,
  },
};

export const EMOTION_COLORS: Record<string, { bg: string; card: string; text: string }> = {
  happy:   { bg: '#fffbeb', card: '#fef3c7', text: '#92400e' },
  sad:     { bg: '#eff6ff', card: '#dbeafe', text: '#1e40af' },
  angry:   { bg: '#fff1f2', card: '#fee2e2', text: '#991b1b' },
  anxious: { bg: '#f5f3ff', card: '#ede9fe', text: '#5b21b6' },
};


export const MAX_W = 720;
