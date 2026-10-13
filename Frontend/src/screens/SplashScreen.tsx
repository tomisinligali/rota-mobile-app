import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { colors, typography, spacing, radius } from '../theme/tokens';
import { BrandLogo } from '../components/BrandLogo';
import { ApiService } from '../services/api';
import { StorageService } from '../services/storage';

interface SplashScreenProps {
  onNavigate: (
    screen: 'intro' | 'auth' | 'verify' | 'onboarding' | 'dashboard',
    user?: any
  ) => void;
}

// Dev-only preview switch. When true, every launch replays the splash -> intro
// walkthrough so all three onboarding slides can be reviewed on reload, even if
// the walkthrough was already seen or a saved session exists. It is guarded by
// __DEV__, so it can never affect a production build. Flip to `false` to restore
// the normal "show the intro once per device" behavior.
const PREVIEW_INTRO_ON_LAUNCH = false;

export const SplashScreen: React.FC<SplashScreenProps> = ({ onNavigate }) => {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const checkSession = async () => {
    setErrorMsg(null);

    // Dev preview: always replay the first-run walkthrough from the splash.
    if (PREVIEW_INTRO_ON_LAUNCH) {
      onNavigate('intro');
      return;
    }

    try {
      const token = await StorageService.getToken();
      if (!token) {
        // First-run users see the intro walkthrough before sign-up; returning
        // users go straight to auth.
        const seenIntro = await StorageService.hasSeenIntro();
        onNavigate(seenIntro ? 'auth' : 'intro');
        return;
      }

      // Validate session against authoritative backend
      const res = await ApiService.getMe();
      if (res?.user) {
        // Unverified accounts must confirm their email before Getting Started.
        if (res.user.emailVerified === false) {
          onNavigate('verify', res.user);
          return;
        }
        const teams = await ApiService.getTeams().catch(() => []);
        if (teams.length === 0) {
          onNavigate('onboarding', res.user);
        } else {
          onNavigate('dashboard', res.user);
        }
      } else {
        await StorageService.clearToken();
        onNavigate('auth');
      }
    } catch {
      // If unauthorized or network error
      await StorageService.clearToken();
      onNavigate('auth');
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      checkSession();
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <BrandLogo iconSize={44} textSize={40} onDark plate style={styles.brandLogo} />
      <Text style={styles.brandSubtitle}>Shift Scheduling for Small Businesses</Text>

      <View style={styles.statusContainer}>
        {errorMsg ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={checkSession}>
              <Text style={styles.retryText}>Retry Connection</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ActivityIndicator size="large" color={colors.onPrimary} />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  brandLogo: {
    marginBottom: spacing.md,
  },
  brandSubtitle: {
    ...typography.bodyMedium,
    color: colors.primaryContainer,
    textAlign: 'center',
  },
  statusContainer: {
    marginTop: spacing.xxl,
    minHeight: 60,
    alignItems: 'center',
  },
  errorBox: {
    backgroundColor: colors.errorContainer,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  errorText: {
    ...typography.bodyMedium,
    color: colors.onErrorContainer,
    marginBottom: spacing.sm,
  },
  retryButton: {
    backgroundColor: colors.error,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  retryText: {
    ...typography.labelMedium,
    color: colors.onError,
  },
});
