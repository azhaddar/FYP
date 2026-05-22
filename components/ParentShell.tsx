import React from 'react';
import { View } from 'react-native';
import { ParentNav } from './ParentNav';

export function ParentShell({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flex: 1 }}>
      {children}
      <ParentNav />
    </View>
  );
}
