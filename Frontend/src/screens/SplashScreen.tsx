import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { colors, typography, spacing, radius } from '../theme/tokens';
import { ApiService } from '../services/api';
import { StorageService } from '../services/storage';

interface SplashScreenProps {
  onNavigate: (screen: 'auth' | 'dashboard', user?: any) => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onNavigate }) => {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const checkSession = async () => {
    setErrorMsg(null);
    try {
      const token = await StorageService.getToken();
      if (!token) {
        onNavigate('auth');
        return;
      }

      // Validate session against authoritative backend
      const res = await ApiService.getMe();
      if (res?.user) {
        onNavigate('dashboard', res.user);
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
      <View style={styles.logoBadge}>
        <Text style={styles.logoText}>R</Text>
      </View>
      <Text style={styles.brandTitle}>Rota</Text>
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
  logoBadge: {
    width: 80,
    height: 80,
    borderRadius: radius.lg,
    backgroundColor: colors.onPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  logoText: {
    ...typography.displayLarge,
    color: colors.primary,
    fontWeight: '800',
  },
  brandTitle: {
    ...typography.headlineLarge,
    color: colors.onPrimary,
    marginBottom: spacing.xs,
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
    borderRadius: radius.sm,
  },
  retryText: {
    ...typography.labelMedium,
    color: colors.onError,
  },
});
