import React, { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, Linking, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { SplashScreen } from './src/screens/SplashScreen';
import { IntroScreen } from './src/screens/IntroScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { VerifyEmailScreen } from './src/screens/VerifyEmailScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { queryClient } from './src/lib/queryClient';
import { configureGoogleSignIn } from './src/services/googleAuth';
import { ApiService } from './src/services/api';
import { StorageService } from './src/services/storage';
import { colors } from './src/theme/tokens';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<
    'splash' | 'intro' | 'auth' | 'verify' | 'onboarding' | 'dashboard'
  >('splash');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [pendingInvite, setPendingInvite] = useState<{
    token: string;
    teamName?: string;
    email?: string;
  } | null>(null);

  useEffect(() => {
    // Configure native Google Sign-In once at startup.
    configureGoogleSignIn();

    // Handle invitation deep links (e.g. rota://invite/:token)
    const handleDeepLink = async (url: string | null) => {
      if (!url) return;
      const match = url.match(/invite\/([a-zA-Z0-9_-]+)/);
      if (!match) return;
      const token = match[1];

      try {
        const inv = await ApiService.verifyInvitation(token);
        const invitePayload = {
          token,
          teamName: inv.teamName || inv.team_name,
          email: inv.email,
        };

        const currentToken = await StorageService.getToken();
        if (currentToken) {
          // Already signed in: accept directly and show dashboard
          await ApiService.acceptInvitation(token);
          queryClient.invalidateQueries({ queryKey: ['teams'] });
          Alert.alert(
            'Joined Team',
            `You have successfully joined ${invitePayload.teamName || 'the team'}!`
          );
          setPendingInvite(null);
          setCurrentScreen('dashboard');
        } else {
          // Not signed in: route to auth with invite pre-filled
          setPendingInvite(invitePayload);
          setCurrentScreen('auth');
        }
      } catch (err: any) {
        Alert.alert('Invitation', err?.message || 'The invitation link is invalid or expired.');
      }
    };

    Linking.getInitialURL().then(handleDeepLink);
    const sub = Linking.addEventListener('url', (e) => handleDeepLink(e.url));
    return () => sub.remove();
  }, []);

  const handleSplashNavigate = (
    screen: 'intro' | 'auth' | 'verify' | 'onboarding' | 'dashboard',
    user?: any
  ) => {
    if (user) {
      setCurrentUser(user);
    }
    setCurrentScreen(screen);
  };

  // First-run walkthrough is only shown once per device.
  const handleIntroDone = async () => {
    await StorageService.setIntroSeen();
    setCurrentScreen('auth');
  };

  const handleAuthSuccess = async (user: any, needsOnboarding = false) => {
    setCurrentUser(user);
    // Unverified accounts must confirm their email before reaching Getting Started.
    if (user && user.emailVerified === false) {
      setCurrentScreen('verify');
      return;
    }

    if (pendingInvite) {
      try {
        await ApiService.acceptInvitation(pendingInvite.token);
        queryClient.invalidateQueries({ queryKey: ['teams'] });
        Alert.alert(
          'Joined Team',
          `You have successfully joined ${pendingInvite.teamName || 'the team'}!`
        );
        setPendingInvite(null);
        setCurrentScreen('dashboard');
        return;
      } catch (err: any) {
        console.warn('Auto-accept invitation failed:', err);
      }
    }

    setCurrentScreen(needsOnboarding ? 'onboarding' : 'dashboard');
  };

  // After email verification, route to Getting Started (no teams yet) or the
  // dashboard (already a member of at least one team).
  const handleEmailVerified = async (user: any) => {
    setCurrentUser({ ...user, emailVerified: true });
    if (pendingInvite) {
      try {
        await ApiService.acceptInvitation(pendingInvite.token);
        queryClient.invalidateQueries({ queryKey: ['teams'] });
        Alert.alert(
          'Joined Team',
          `You have successfully joined ${pendingInvite.teamName || 'the team'}!`
        );
        setPendingInvite(null);
        setCurrentScreen('dashboard');
        return;
      } catch (err: any) {
        console.warn('Auto-accept invitation failed:', err);
      }
    }
    const teams = await ApiService.getTeams().catch(() => []);
    setCurrentScreen(teams.length === 0 ? 'onboarding' : 'dashboard');
  };

  const handleOnboardingComplete = () => {
    setCurrentScreen('dashboard');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setPendingInvite(null);
    setCurrentScreen('auth');
  };

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaView style={styles.container}>
        <StatusBar style="auto" />
        {currentScreen === 'splash' && <SplashScreen onNavigate={handleSplashNavigate} />}
        {currentScreen === 'intro' && <IntroScreen onDone={handleIntroDone} />}
        {currentScreen === 'auth' && (
          <AuthScreen onSuccess={handleAuthSuccess} pendingInvite={pendingInvite} />
        )}
        {currentScreen === 'verify' && (
          <VerifyEmailScreen
            user={currentUser}
            onVerified={handleEmailVerified}
            onLogout={handleLogout}
          />
        )}
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
