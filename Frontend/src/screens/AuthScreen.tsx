import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radius } from '../theme/tokens';
import { ApiService, ApiError } from '../services/api';
import { getGoogleIdToken, isGoogleSignInCancelled } from '../services/googleAuth';

interface AuthScreenProps {
  onSuccess: (user: any, needsOnboarding?: boolean) => void;
}

// Order matters: the length rule intentionally renders last.
const PASSWORD_RULES: { label: string; test: (value: string) => boolean }[] = [
  { label: 'Password must contain a lowercase letter', test: (v) => /[a-z]/.test(v) },
  { label: 'Password must contain an uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { label: 'Password must contain a number', test: (v) => /[0-9]/.test(v) },
  { label: 'Password must contain a special character (#@>^)', test: (v) => /[#@>^]/.test(v) },
  { label: 'Maximum Of 64 Characters', test: (v) => v.length <= 64 },
  { label: 'Minimum Of 8 Characters', test: (v) => v.length >= 8 },
];

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});
  const [showPassword, setShowPassword] = useState(false);

  const firstNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);

  // Focus the first field of the current mode (Email on Log In, First Name on Register).
  const focusFirstField = (login: boolean) => {
    // Dismiss any existing keyboard so the target field clearly becomes the active one.
    Keyboard.dismiss();
    setTimeout(() => {
      if (login) {
        emailRef.current?.focus();
      } else {
        firstNameRef.current?.focus();
      }
    }, 300);
  };

  useEffect(() => {
    focusFirstField(isLogin);
  }, [isLogin]);

  const FIELD_LABELS: Record<string, string> = {
    firstName: 'First Name',
    lastName: 'Last Name',
    email: 'Email Address',
    password: 'Password',
  };

  const getVisibleFields = (): string[] =>
    isLogin ? ['email', 'password'] : ['firstName', 'lastName', 'email', 'password'];

  const getValue = (field: string): string => {
    switch (field) {
      case 'firstName':
        return firstName;
      case 'lastName':
        return lastName;
      case 'email':
        return email;
      case 'password':
        return password;
      default:
        return '';
    }
  };

  const clearFieldError = (field: string) =>
    setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: null } : prev));

  // Names may contain letters only — no digits or special characters.
  const NAME_REGEX = /^[A-Za-z]+$/;
  const isNameField = (field: string) => field === 'firstName' || field === 'lastName';

  // Real-time (on change) validation for name fields.
  const handleNameChange = (field: string, text: string, setter: (value: string) => void) => {
    setter(text);
    if (text.length > 0 && !/^[A-Za-z]*$/.test(text)) {
      setFieldErrors((prev) => ({ ...prev, [field]: 'Name Must Use Only Letters' }));
    } else {
      setFieldErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  // Real-time (on change) validation for email. The message clears as soon as a
  // domain character follows the "@".
  const EMAIL_LIVE_REGEX = /^[^\s@]+@[^\s@]+$/;
  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (text.trim().length > 0 && !EMAIL_LIVE_REGEX.test(text.trim())) {
      setFieldErrors((prev) => ({ ...prev, email: 'Enter A Valid Email Address' }));
    } else {
      setFieldErrors((prev) => ({ ...prev, email: null }));
    }
  };

  // Client-side UX rule: a field left empty on blur is not allowed.
  // Trims empty spaces at the end of the input field.
  const handleFieldBlur = (field: string) => {
    if (field === 'firstName') setFirstName((v) => v.trimEnd());
    else if (field === 'lastName') setLastName((v) => v.trimEnd());
    else if (field === 'email') setEmail((v) => v.trimEnd());
    else if (field === 'password') setPassword((v) => v.trimEnd());

    const value = getValue(field).trimEnd();
    if (!value.trim()) {
      setFieldErrors((prev) => ({
        ...prev,
        [field]: `${FIELD_LABELS[field]} field cannot be empty`,
      }));
    } else if (isNameField(field) && !NAME_REGEX.test(value.trim())) {
      setFieldErrors((prev) => ({ ...prev, [field]: 'Name Must Use Only Letters' }));
    } else if (field === 'email' && !EMAIL_LIVE_REGEX.test(value.trim())) {
      setFieldErrors((prev) => ({ ...prev, [field]: 'Enter A Valid Email Address' }));
    } else {
      setFieldErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const validate = (): string | null => {
    const trimmedEmail = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail) return 'Email is required';
    if (!emailRegex.test(trimmedEmail)) return 'Enter A Valid Email Address';
    if (!password) return 'Password is required';
    const unmetPasswordRule = PASSWORD_RULES.find((rule) => !rule.test(password));
    if (unmetPasswordRule) return unmetPasswordRule.label;

    if (!isLogin) {
      if (!firstName.trim()) return 'First name is required';
    }
    return null;
  };

  const handleSubmit = async () => {
    setErrorMessage(null);

    // Trim all fields for empty spaces at the end
    const cleanFirstName = firstName.trimEnd();
    const cleanLastName = lastName.trimEnd();
    const cleanEmail = email.trimEnd();
    const cleanPassword = password.trimEnd();

    setFirstName(cleanFirstName);
    setLastName(cleanLastName);
    setEmail(cleanEmail);
    setPassword(cleanPassword);

    // Block submission while any visible field is empty, surfacing per-field errors.
    const emptyErrors: Record<string, string> = {};
    getVisibleFields().forEach((field) => {
      const raw = getValue(field);
      const value = raw.trimEnd();
      if (!value.trim()) {
        emptyErrors[field] = `${FIELD_LABELS[field]} field cannot be empty`;
      } else if (isNameField(field) && !NAME_REGEX.test(value.trim())) {
        emptyErrors[field] = 'Name Must Use Only Letters';
      }
    });
    if (Object.keys(emptyErrors).length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...emptyErrors }));
      return;
    }

    const validationError = validate();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        const res = await ApiService.login({
          email: cleanEmail.trim(),
          password: cleanPassword,
        });
        const teams = await ApiService.getTeams().catch(() => []);
        onSuccess(res.user, teams.length === 0);
      } else {
        const res = await ApiService.register({
          email: cleanEmail.trim(),
          password: cleanPassword,
          firstName: cleanFirstName.trim(),
          lastName: cleanLastName.trim() || undefined,
        });
        // After signup, always route to Onboarding ("Start a team" or "Join a team")
        onSuccess(res.user, true);
      }
    } catch (err: any) {
      const apiErr = err as ApiError;
      setErrorMessage(apiErr.message || 'An error occurred during authentication');
    } finally {
      setLoading(false);
    }
  };

  // The submit button stays disabled until every visible field has data.
  const isFormFilled = getVisibleFields().every(
    (field) => getValue(field).trim().length > 0
  );
  const isSubmitDisabled = loading || !isFormFilled;

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setLoading(true);
    try {
      const idToken = await getGoogleIdToken();
      const res = await ApiService.googleLogin(idToken);
      const teams = await ApiService.getTeams().catch(() => []);
      onSuccess(res.user, teams.length === 0);
    } catch (err: any) {
      if (isGoogleSignInCancelled(err)) return;
      const apiErr = err as ApiError;
      setErrorMessage(apiErr.message || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  // Hidden by default; while typing, each rule is shown and checked off as it passes.
  const passwordRuleItems = isLogin || password.length === 0 ? [] : PASSWORD_RULES;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardContainer}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>ROTA</Text>
          </View>
          <Text style={styles.title}>{isLogin ? 'Welcome Back' : 'Create an Account'}</Text>
          <Text style={styles.subtitle}>
            {isLogin
              ? 'Sign in to view schedules and manage shifts'
              : 'Sign up to start organizing shifts for your team'}
          </Text>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, isLogin && styles.activeTab]}
            onPress={() => {
              setIsLogin(true);
              setErrorMessage(null);
              setFieldErrors({});
              focusFirstField(true);
            }}
          >
            <Text style={[styles.tabText, isLogin && styles.activeTabText]}>Log In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, !isLogin && styles.activeTab]}
            onPress={() => {
              setIsLogin(false);
              setErrorMessage(null);
              setFieldErrors({});
              focusFirstField(false);
            }}
          >
            <Text style={[styles.tabText, !isLogin && styles.activeTabText]}>Register</Text>
          </TouchableOpacity>
        </View>

        {/* Error Banner */}
        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {/* Form Fields */}
        <View style={styles.form}>
          <TouchableOpacity
            style={[styles.googleButton, loading && styles.submitButtonDisabled]}
            onPress={handleGoogleSignIn}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
          >
            <Image
              source={require('../../assets/google-g.png')}
              style={styles.googleLogo}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          </TouchableOpacity>

          <View style={styles.orDivider}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>OR</Text>
            <View style={styles.orLine} />
          </View>

          {!isLogin && (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>First Name *</Text>
                <TextInput
                  ref={firstNameRef}
                  style={[styles.input, fieldErrors.firstName ? styles.inputError : null]}
                  placeholder="e.g. Alex"
                  placeholderTextColor={colors.onSurfaceVariant}
                  value={firstName}
                  onChangeText={(text) => handleNameChange('firstName', text, setFirstName)}
                  onBlur={() => handleFieldBlur('firstName')}
                  autoCapitalize="words"
                  autoCorrect={false}
                  cursorColor={colors.primary}
                  selectionColor={colors.primary}
                />
                {fieldErrors.firstName ? (
                  <Text style={styles.fieldErrorText}>{fieldErrors.firstName}</Text>
                ) : null}
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Last Name *</Text>
                <TextInput
                  style={[styles.input, fieldErrors.lastName ? styles.inputError : null]}
                  placeholder="e.g. Smith"
                  placeholderTextColor={colors.onSurfaceVariant}
                  value={lastName}
                  onChangeText={(text) => handleNameChange('lastName', text, setLastName)}
                  onBlur={() => handleFieldBlur('lastName')}
                  autoCapitalize="words"
                  autoCorrect={false}
                  cursorColor={colors.primary}
                  selectionColor={colors.primary}
                />
                {fieldErrors.lastName ? (
                  <Text style={styles.fieldErrorText}>{fieldErrors.lastName}</Text>
                ) : null}
              </View>
            </>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address *</Text>
            <TextInput
              ref={emailRef}
              style={[styles.input, fieldErrors.email ? styles.inputError : null]}
              placeholder="you@company.com"
              placeholderTextColor={colors.onSurfaceVariant}
              value={email}
              onChangeText={handleEmailChange}
              onBlur={() => handleFieldBlur('email')}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              cursorColor={colors.primary}
              selectionColor={colors.primary}
            />
            {fieldErrors.email ? (
              <Text style={styles.fieldErrorText}>{fieldErrors.email}</Text>
            ) : null}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password * (8-64 characters)</Text>
            <View style={styles.passwordField}>
              <TextInput
                style={[
                  styles.input,
                  styles.passwordInput,
                  fieldErrors.password ? styles.inputError : null,
                ]}
                placeholder="••••••••"
                placeholderTextColor={colors.onSurfaceVariant}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  clearFieldError('password');
                }}
                onBlur={() => handleFieldBlur('password')}
                secureTextEntry={!showPassword}
                maxLength={64}
                autoCapitalize="none"
                autoCorrect={false}
                cursorColor={colors.primary}
                selectionColor={colors.primary}
              />
              {password.length > 0 ? (
                <TouchableOpacity
                  style={styles.passwordToggle}
                  onPress={() => setShowPassword((prev) => !prev)}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={22}
                    color={colors.onSurfaceVariant}
                  />
                </TouchableOpacity>
              ) : null}
            </View>
            {fieldErrors.password ? (
              <Text style={styles.fieldErrorText}>{fieldErrors.password}</Text>
            ) : null}

            {passwordRuleItems.length > 0 ? (
              <View style={styles.passwordRequirements}>
                {passwordRuleItems.map((rule) => {
                  const met = rule.test(password);
                  return (
                    <View key={rule.label} style={styles.requirementRow}>
                      <Ionicons
                        name={met ? 'checkmark-circle' : 'ellipse-outline'}
                        size={met ? 16 : 14}
                        color={met ? colors.onSuccessContainer : colors.onSurfaceVariant}
                      />
                      <Text
                        style={[styles.requirementText, met && styles.requirementTextMet]}
                      >
                        {rule.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>

          <TouchableOpacity
            style={[styles.submitButton, isSubmitDisabled && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitDisabled}
            accessibilityState={{ disabled: isSubmitDisabled }}
          >
            {loading ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.submitButtonText}>{isLogin ? 'Log In' : 'Create Account'}</Text>
            )}
          </TouchableOpacity>
        </View>
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
    fontWeight: '700',
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
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainer,
    borderRadius: radius.md,
    padding: 4,
    marginBottom: spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  activeTab: {
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    ...typography.labelLarge,
    color: colors.onSurfaceVariant,
  },
  activeTabText: {
    color: colors.primary,
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
  form: {
    backgroundColor: colors.surfaceContainerLow,
    padding: spacing.md,
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
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    height: 52,
    fontSize: 16,
    fontWeight: '400',
    color: colors.onSurface,
    textAlignVertical: 'center',
    letterSpacing: 0,
  },
  passwordField: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: spacing.xxl + spacing.sm,
  },
  passwordToggle: {
    position: 'absolute',
    right: spacing.md,
    height: '100%',
    justifyContent: 'center',
  },
  inputError: {
    borderColor: colors.error,
  },
  fieldErrorText: {
    ...typography.bodySmall,
    color: colors.error,
    marginTop: spacing.xs,
  },
  passwordRequirements: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  requirementText: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    flexShrink: 1,
  },
  requirementTextMet: {
    color: colors.onSuccessContainer,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
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
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.surfaceContainerHigh,
  },
  orText: {
    ...typography.labelSmall,
    color: colors.onSurfaceVariant,
    marginHorizontal: spacing.sm,
    fontWeight: '700',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
  },
  googleLogo: {
    width: 18,
    height: 18,
  },
  googleButtonText: {
    ...typography.labelLarge,
    color: colors.onSurface,
    fontWeight: '700',
  },
});
