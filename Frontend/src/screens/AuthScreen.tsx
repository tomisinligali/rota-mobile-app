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
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radius } from '../theme/tokens';
import { BrandLogo } from '../components/BrandLogo';
import { ApiService, ApiError } from '../services/api';
import { getGoogleIdToken, isGoogleSignInCancelled } from '../services/googleAuth';

interface AuthScreenProps {
  onSuccess: (user: any, needsOnboarding?: boolean) => void;
  pendingInvite?: {
    token: string;
    teamName?: string;
    email?: string;
  } | null;
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

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSuccess, pendingInvite }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});
  const [showPassword, setShowPassword] = useState(false);

  // Forgot / Reset Password state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [showNewPasswordModal, setShowNewPasswordModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<'request' | 'verify'>('request');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotCode, setForgotCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [newPasswordLoading, setNewPasswordLoading] = useState(false);
  const [newPasswordError, setNewPasswordError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);

  const firstNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);

  useEffect(() => {
    if (pendingInvite?.email) {
      setEmail(pendingInvite.email);
    }
  }, [pendingInvite]);

  // Focus the first field of the current mode (Email on Log In, First Name on Register).
  const focusFirstField = (login: boolean) => {
    // Dismiss any existing keyboard so the target field clearly becomes the active one.
    Keyboard.dismiss();
    setTimeout(() => {
      if (login) {
        emailRef.current?.focus();
      } else {
        // Register UI: never auto-focus the email. The email input is shared
        // across both tabs, so blur it explicitly to drop any login-mode focus
        // that would otherwise carry over into the Register tab.
        emailRef.current?.blur();
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

  const handleRequestReset = async () => {
    if (!forgotEmail || !forgotEmail.trim()) {
      setForgotError('Please enter your email address');
      return;
    }
    setForgotLoading(true);
    setForgotError(null);
    try {
      const res = await ApiService.forgotPassword(forgotEmail.trim());
      setForgotStep('verify');
      setForgotSuccess(res.message || 'Check your email for the 6-digit reset code.');
    } catch (err: any) {
      setForgotError(err?.message || 'Failed to send reset code.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleVerifyResetCode = async () => {
    if (!forgotCode || forgotCode.trim().length !== 6) {
      setForgotError('Please enter the 6-digit reset code from your email.');
      return;
    }
    setForgotLoading(true);
    setForgotError(null);
    try {
      await ApiService.verifyResetCode(forgotEmail.trim(), forgotCode.trim());
      // Code verified! Close verification modal and open the new password creation modal
      setShowForgotModal(false);
      setNewPassword('');
      setConfirmPassword('');
      setNewPasswordError(null);
      setShowNewPasswordModal(true);
    } catch (err: any) {
      setForgotError(err?.message || 'Invalid or expired verification code.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleSaveNewPassword = async () => {
    if (newPassword.length < 8) {
      setNewPasswordError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setNewPasswordError('Passwords do not match.');
      return;
    }
    setNewPasswordLoading(true);
    setNewPasswordError(null);
    try {
      const res = await ApiService.resetPassword(
        forgotEmail.trim(),
        forgotCode.trim(),
        newPassword
      );
      setShowNewPasswordModal(false);
      setIsLogin(true);
      setEmail(forgotEmail.trim());
      setPassword('');
      setErrorMessage(null);
      setForgotSuccess(res.message || 'Password reset successfully. Please log in.');
      setForgotStep('request');
      setForgotCode('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setNewPasswordError(err?.message || 'Failed to reset password.');
    } finally {
      setNewPasswordLoading(false);
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

  // Hidden by default; while typing, only unmet rules stay visible and each one
  // disappears as soon as the password satisfies it.
  const passwordRuleItems =
    isLogin || password.length === 0
      ? []
      : PASSWORD_RULES.filter((rule) => !rule.test(password));

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardContainer}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <BrandLogo iconSize={48} showText={false} style={styles.headerLogo} />
          <Text style={styles.title}>{isLogin ? 'Welcome Back' : 'Create an Account'}</Text>
          <Text style={styles.subtitle}>
            {isLogin
              ? 'Sign in to view schedules and manage shifts'
              : 'Sign up to start organizing shifts for your team'}
          </Text>
        </View>

        {/* Pending Invitation Banner */}
        {pendingInvite ? (
          <View style={styles.inviteBanner}>
            <Ionicons name="mail-unread-outline" size={22} color={colors.primary} />
            <View style={styles.inviteBannerTextContainer}>
              <Text style={styles.inviteBannerTitle}>Team invitation</Text>
              <Text style={styles.inviteBannerSubtitle}>
                You were invited to join{' '}
                <Text style={styles.inviteTeamHighlight}>
                  {pendingInvite.teamName || 'a team'}
                </Text>
                . Sign in or register to accept.
              </Text>
            </View>
          </View>
        ) : null}

        {/* Success Banner */}
        {forgotSuccess && !showForgotModal && !showNewPasswordModal ? (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#2E7D32" />
            <Text style={styles.successText}>{forgotSuccess}</Text>
          </View>
        ) : null}

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
            <Text style={styles.label}>Password * (Min 8 Characters)</Text>
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
                {passwordRuleItems.map((rule) => (
                  <View key={rule.label} style={styles.requirementRow}>
                    <Ionicons name="ellipse-outline" size={14} color={colors.onSurfaceVariant} />
                    <Text style={styles.requirementText}>{rule.label}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          {isLogin && (
            <TouchableOpacity
              style={styles.forgotPasswordButton}
              onPress={() => {
                setErrorMessage(null);
                setForgotError(null);
                setForgotSuccess(null);
                setForgotEmail(email);
                setForgotStep('request');
                setShowForgotModal(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Forgot password"
            >
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </TouchableOpacity>
          )}

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

      {/* MODAL 1: Request & Verify Code Modal */}
      <Modal
        visible={showForgotModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowForgotModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <TouchableWithoutFeedback
            onPress={() => {
              Keyboard.dismiss();
              setShowForgotModal(false);
            }}
            accessibilityRole="button"
            accessibilityLabel="Dismiss modal"
          >
            <View style={styles.modalBackdrop} />
          </TouchableWithoutFeedback>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <Text style={styles.modalTitle}>
                  {forgotStep === 'request' ? 'Reset password' : 'Enter reset code'}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {forgotStep === 'request'
                    ? 'Enter your account email to receive a single-use 6-digit verification code.'
                    : `Enter the 6-digit verification code sent to ${forgotEmail}.`}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowForgotModal(false)}
                style={styles.modalCloseBtn}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close-outline" size={24} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            {forgotError ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{forgotError}</Text>
              </View>
            ) : null}

            {forgotStep === 'request' ? (
              <View style={styles.modalForm}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Email address *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="you@company.com"
                    placeholderTextColor={colors.onSurfaceVariant}
                    value={forgotEmail}
                    onChangeText={setForgotEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.submitButton, forgotLoading && styles.submitButtonDisabled]}
                  onPress={handleRequestReset}
                  disabled={forgotLoading}
                >
                  {forgotLoading ? (
                    <ActivityIndicator color={colors.onPrimary} />
                  ) : (
                    <Text style={styles.submitButtonText}>Send reset code</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalSecondaryBtn}
                  onPress={() => setShowForgotModal(false)}
                >
                  <Text style={styles.modalSecondaryBtnText}>Back to log in</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.modalForm}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>6-digit verification code *</Text>
                  <TextInput
                    style={[styles.input, styles.codeInput]}
                    placeholder="123456"
                    placeholderTextColor={colors.onSurfaceVariant}
                    value={forgotCode}
                    onChangeText={setForgotCode}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.submitButton, forgotLoading && styles.submitButtonDisabled]}
                  onPress={handleVerifyResetCode}
                  disabled={forgotLoading}
                >
                  {forgotLoading ? (
                    <ActivityIndicator color={colors.onPrimary} />
                  ) : (
                    <Text style={styles.submitButtonText}>Verify code</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalSecondaryBtn}
                  onPress={() => setForgotStep('request')}
                >
                  <Text style={styles.modalSecondaryBtnText}>Request new code</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL 2: Create New Password Modal */}
      <Modal
        visible={showNewPasswordModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowNewPasswordModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <TouchableWithoutFeedback
            onPress={() => {
              Keyboard.dismiss();
              setShowNewPasswordModal(false);
            }}
            accessibilityRole="button"
            accessibilityLabel="Dismiss modal"
          >
            <View style={styles.modalBackdrop} />
          </TouchableWithoutFeedback>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <Text style={styles.modalTitle}>Create new password</Text>
                <Text style={styles.modalSubtitle}>
                  Set a new, secure password (at least 8 characters) for your account.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowNewPasswordModal(false)}
                style={styles.modalCloseBtn}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close-outline" size={24} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            {newPasswordError ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{newPasswordError}</Text>
              </View>
            ) : null}

            <View style={styles.modalForm}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>New password * (min 8 characters)</Text>
                <View style={styles.passwordField}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    placeholder="••••••••"
                    placeholderTextColor={colors.onSurfaceVariant}
                    value={newPassword}
                    onChangeText={(val) => {
                      setNewPassword(val);
                      if (newPasswordError) setNewPasswordError(null);
                    }}
                    secureTextEntry={!showNewPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    style={styles.passwordToggle}
                    onPress={() => setShowNewPassword((p) => !p)}
                  >
                    <Ionicons
                      name={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={colors.onSurfaceVariant}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirm new password *</Text>
                <View style={styles.passwordField}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    placeholder="••••••••"
                    placeholderTextColor={colors.onSurfaceVariant}
                    value={confirmPassword}
                    onChangeText={(val) => {
                      setConfirmPassword(val);
                      if (newPasswordError) setNewPasswordError(null);
                    }}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    style={styles.passwordToggle}
                    onPress={() => setShowConfirmPassword((p) => !p)}
                  >
                    <Ionicons
                      name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={colors.onSurfaceVariant}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.submitButton, newPasswordLoading && styles.submitButtonDisabled]}
                onPress={handleSaveNewPassword}
                disabled={newPasswordLoading}
              >
                {newPasswordLoading ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <Text style={styles.submitButtonText}>Save new password</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSecondaryBtn}
                onPress={() => setShowNewPasswordModal(false)}
              >
                <Text style={styles.modalSecondaryBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  headerLogo: {
    marginBottom: spacing.sm,
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
    borderRadius: radius.full,
    padding: 4,
    marginBottom: spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.full,
  },
  activeTab: {
    backgroundColor: colors.surface,
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
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  submitButtonDisabled: {
    opacity: 0.38,
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
    borderRadius: radius.full,
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
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    // Net 4px (spacing.xs) between the password field and this link:
    // the input group contributes marginBottom 16px, so pull up by 12px.
    marginTop: -(spacing.md - spacing.xs),
    // 100% more than before: 8px -> 16px between the link and the submit button.
    marginBottom: spacing.md,
    paddingVertical: spacing.xs,
  },
  forgotPasswordText: {
    ...typography.labelSmall,
    color: colors.primary,
    fontWeight: '600',
  },
  inviteBanner: {
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#D8B4FE',
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  inviteBannerTextContainer: {
    flex: 1,
  },
  inviteBannerTitle: {
    ...typography.labelLarge,
    color: colors.primary,
    fontWeight: '700',
  },
  inviteBannerSubtitle: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  inviteTeamHighlight: {
    color: colors.primary,
    fontWeight: '700',
  },
  successBanner: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#A5D6A7',
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  successText: {
    ...typography.bodySmall,
    color: '#1B5E20',
    fontWeight: '500',
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? spacing.xxl + spacing.md : spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  modalTitleContainer: {
    flex: 1,
    paddingRight: spacing.md,
  },
  modalTitle: {
    ...typography.titleLarge,
    color: colors.onSurface,
    fontWeight: '700',
  },
  modalSubtitle: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    marginTop: spacing.xs,
  },
  modalCloseBtn: {
    padding: spacing.xs,
  },
  modalForm: {
    gap: spacing.xs,
  },
  codeInput: {
    letterSpacing: 4,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
  },
  modalSecondaryBtn: {
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  modalSecondaryBtnText: {
    ...typography.labelMedium,
    color: colors.onSurfaceVariant,
    fontWeight: '600',
  },
});
