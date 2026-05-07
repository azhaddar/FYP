import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useApp } from '../contexts/AppContext';

export default function Index() {
  const { session, profile, loading } = useApp();

  // Show spinner while auth OR profile is still loading
  if (loading || (session && !profile)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#e13d7d" />
      </View>
    );
  }

  if (!session) return <Redirect href="/login" />;
  if (profile?.role === 'therapist') return <Redirect href="/therapist" />;
  return <Redirect href="/dashboard" />;
}
