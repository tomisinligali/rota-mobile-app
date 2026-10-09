import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radius } from '../theme/tokens';
import { ApiService, ApiError } from '../services/api';

interface VerifyEmailScreenProps {
  user: any;
  onVerified: (user: any) => void;
  onLogout: () => void;
}

// Mirrors the backend resend policy (AuthService.RESEND_COOLDOWN_SECONDS).
const RESEND_COOLDOWN_SECONDS = 60;
const CODE_LENGTH = 6;

export const VerifyEmailScreen: React.FC<VerifyEmailScreenProps> = ({
  user,
  onVerified,
  onLogout,
}) => {
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Resend cooldown countdown.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleChangeCode = (text: string) => {
    // Digits only; the code is always 6 numeric characters.
    setCode(text.replace(/[^0-9]/g, '').slice(0, CODE_LENGTH));
  };

  const handleVerify = async () => {
    setErrorMessage(null);
    setInfoMessage(null);

    if (!/^[0-9]{6}$/.test(code)) {
      setErrorMessage('Enter the 6-digit code from your email.');
      return;
    }

    setVerifying(true);
    try {
      const res = await ApiService.verifyEmail(code);
      if (res?.emailVerified) {
        onVerified({ ...user, emailVerified: true });
      } else {
        setErrorMessage('We could not verify this email. Please try again.');
      }
    } catch (err: any) {
      const apiErr = err as ApiError;
      setErrorMessage(apiErr?.message || 'Verification failed. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setErrorMessage(null);
    setInfoMessage(null);
    setResending(true);
    try {
      const res = await ApiService.resendVerification();
      if (res?.alreadyVerified) {
        onVerified({ ...user, emailVerified: true });
        return;
      }
      setInfoMessage('A new code is on its way. Check your inbox and spam folder.');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err: any) {
      const apiErr = err as ApiError;
      const retryAfter = Number((apiErr?.details as any)?.retryAfterSeconds);
      if (Number.isFinite(retryAfter) && retryAfter > 0) {
        setCooldown(retryAfter);
      }
      setErrorMessage(apiErr?.message || 'Could not resend the verification code.');
    } finally {
      setResending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardContainer}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconBadge}>
            <Ionicons name="mail-unread-outline" size={32} color={colors.primary} />
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>VERIFY YOUR EMAIL</Text>
          </View>
          <Text style={styles.title}>Enter your code</Text>
          <Text style={styles.subtitle}>
            We emailed a 6-digit verification code to{' '}
            <Text style={styles.emailText}>{user?.email || 'your email address'}</Text>. Enter
            it below to finish setting up your account and continue.
          </Text>
        </View>

        {/* Feedback */}
        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}
        {infoMessage ? (
          <View style={styles.infoBanner}>
            <Text style={styles.infoText}>{infoMessage}</Text>
          </View>
        ) : null}

        <View style={styles.formCard}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Verification code</Text>
            <TextInput
              style={styles.codeInput}
              placeholder="000000"
              placeholderTextColor={colors.onSurfaceVariant}
              value={code}
              onChangeText={handleChangeCode}
              keyboardType="number-pad"
              inputMode="numeric"
              maxLength={CODE_LENGTH}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              cursorColor={colors.primary}
              selectionColor={colors.primary}
            />
          </View>

          <TouchableOpacity
            style={[styles.submitButton, (verifying || code.length < CODE_LENGTH) && styles.submitButtonDisabled]}
            onPress={handleVerify}
            disabled={verifying || code.length < CODE_LENGTH}
          >
            {verifying ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.submitButtonText}>Verify Email</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.resendRow}>
          <Text style={styles.resendHint}>Didn&apos;t get the code?</Text>
          <TouchableOpacity onPress={handleResend} disabled={cooldown > 0 || resending}>
            <Text
              style={[styles.resendText, (cooldown > 0 || resending) && styles.resendTextDisabled]}
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : resending ? 'Sending…' : 'Resend code'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Sign Out Option */}
        <TouchableOpacity style={styles.logoutRow} onPress={onLogout}>
          <Text style={styles.logoutText}>Sign out of {user?.email || 'this account'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scrollContainer: {
    padding: spacing.lg,
    paddingTop: spacing.xxl + spacing.md,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  badge: {
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    marginBottom: spacing.sm,
  },
  badgeText: {
    ...typography.labelSmall,
    color: colors.onPrimaryContainer,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    ...typography.headlineMedium,
    color: colors.onSurface,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.bodyMedium,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    lineHeight: 20,
  },
  emailText: {
    color: colors.onSurface,
    fontWeight: '700',
  },
  errorBanner: {
    backgroundColor: colors.errorContainer,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.error,
  },
  errorText: {
    ...typography.bodyMedium,
    color: colors.onErrorContainer,
  },
  infoBanner: {
    backgroundColor: colors.infoContainer,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.info,
  },
  infoText: {
    ...typography.bodyMedium,
    color: colors.onInfoContainer,
  },
  formCard: {
    backgroundColor: colors.surfaceContainerLow,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.surfaceContainerHigh,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.labelMedium,
    color: colors.onSurface,
    marginBottom: spacing.xs,
  },
  codeInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    height: 60,
    fontSize: 28,
    letterSpacing: 12,
    textAlign: 'center',
    color: colors.onSurface,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    ...typography.labelLarge,
    color: colors.onPrimary,
    fontWeight: '700',
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
  },
  resendHint: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
  resendText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  resendTextDisabled: {
    color: colors.onSurfaceVariant,
    textDecorationLine: 'none',
  },
  logoutRow: {
    alignItems: 'center',
    marginTop: spacing.xl,
    paddingVertical: spacing.sm,
  },
  logoutText: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    textDecorationLine: 'underline',
  },
});
