import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { EMOTION_COLORS } from '../constants/theme';

const ICON_NAMES: Record<string, string> = {
  happy: 'emoticon-happy-outline',
  sad: 'emoticon-sad-outline',
  angry: 'emoticon-angry-outline',
  anxious: 'emoticon-confused-outline',
  okay: 'emoticon-neutral-outline',
};

export function EmotionIcon({ emotion, size = 24 }: { emotion: string; size?: number }) {
  const color = EMOTION_COLORS[emotion]?.text ?? '#9E9E9E';
  return (
    <MaterialCommunityIcons
      name={(ICON_NAMES[emotion] ?? 'emoticon-outline') as any}
      size={size}
      color={color}
    />
  );
}
