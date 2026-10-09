import React, { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { SplashScreen } from './src/screens/SplashScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { queryClient } from './src/lib/queryClient';
import { configureGoogleSignIn } from './src/services/googleAuth';
import { colors } from './src/theme/tokens';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<
    'splash' | 'auth' | 'onboarding' | 'dashboard'
  >('splash');
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    // Configure native Google Sign-In once at startup.
    configureGoogleSignIn();
  }, []);

  const handleSplashNavigate = (
    screen: 'auth' | 'onboarding' | 'dashboard',
    user?: any
  ) => {
    if (user) {
      setCurrentUser(user);
    }
    setCurrentScreen(screen);
  };

  const handleAuthSuccess = (user: any, needsOnboarding = false) => {
    setCurrentUser(user);
    setCurrentScreen(needsOnboarding ? 'onboarding' : 'dashboard');
  };

  const handleOnboardingComplete = () => {
    setCurrentScreen('dashboard');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentScreen('auth');
  };

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaView style={styles.container}>
        <StatusBar style="auto" />
        {currentScreen === 'splash' && <SplashScreen onNavigate={handleSplashNavigate} />}
        {currentScreen === 'auth' && <AuthScreen onSuccess={handleAuthSuccess} />}
        {currentScreen === 'onboarding' && (
          <OnboardingScreen
            user={currentUser}
            onComplete={handleOnboardingComplete}
            onLogout={handleLogout}
          />
        )}
        {currentScreen === 'dashboard' && (
          <DashboardScreen initialUser={currentUser} onLogout={handleLogout} />
        )}
      </SafeAreaView>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
});
