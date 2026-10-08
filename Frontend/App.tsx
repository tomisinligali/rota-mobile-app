import React, { useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SplashScreen } from './src/screens/SplashScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { colors } from './src/theme/tokens';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'splash' | 'auth' | 'dashboard'>('splash');
  const [currentUser, setCurrentUser] = useState<any>(null);

  const handleSplashNavigate = (screen: 'auth' | 'dashboard', user?: any) => {
    if (user) {
      setCurrentUser(user);
    }
    setCurrentScreen(screen);
  };

  const handleAuthSuccess = (user: any) => {
    setCurrentUser(user);
    setCurrentScreen('dashboard');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentScreen('auth');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      {currentScreen === 'splash' && <SplashScreen onNavigate={handleSplashNavigate} />}
      {currentScreen === 'auth' && <AuthScreen onSuccess={handleAuthSuccess} />}
      {currentScreen === 'dashboard' && (
        <DashboardScreen initialUser={currentUser} onLogout={handleLogout} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
});
