import React, { useState } from 'react';
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
import { colors, typography, spacing, radius } from '../theme/tokens';
import { ApiService, ApiError } from '../services/api';
import { Ionicons } from '@expo/vector-icons';

interface OnboardingScreenProps {
  user: any;
  onComplete: () => void;
  onLogout: () => void;
}

type OnboardingChoice = 'NONE' | 'START_TEAM' | 'JOIN_TEAM';

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({
  user,
  onComplete,
  onLogout,
}) => {
  const [choice, setChoice] = useState<OnboardingChoice>('NONE');

  // Start Team State
  const [teamName, setTeamName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [creatingTeam, setCreatingTeam] = useState(false);

  // Join Team State
  const [inviteTokenInput, setInviteTokenInput] = useState('');
  const [joiningTeam, setJoiningTeam] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleStartTeamSubmit = async () => {
    setErrorMessage(null);
    setTeamName((v) => v.trimEnd());
    setBusinessName((v) => v.trimEnd());
    const trimmedTeam = teamName.trim();
    if (!trimmedTeam) {
      setErrorMessage('Please enter a team name');
      return;
    }

    setCreatingTeam(true);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      await ApiService.createTeam({
        name: trimmedTeam,
        businessName: businessName.trim() || undefined,
        timezone,
      });
      onComplete();
    } catch (err: any) {
      const apiErr = err as ApiError;
      setErrorMessage(apiErr.message || 'Failed to create team. Please try again.');
    } finally {
      setCreatingTeam(false);
    }
  };

  const handleJoinTeamSubmit = async () => {
    setErrorMessage(null);
    setInviteTokenInput((v) => v.trimEnd());
    const rawInput = inviteTokenInput.trim();
    if (!rawInput) {
      setErrorMessage('Please enter an invitation code or paste your invite link');
      return;
    }

    // Extract token if user pasted full URL (e.g., https://.../invite/ABC-123)
    const token = rawInput.split('/').pop()?.trim() || rawInput;

    setJoiningTeam(true);
    try {
      await ApiService.acceptInvitation(token);
      onComplete();
    } catch (err: any) {
      const apiErr = err as ApiError;
      setErrorMessage(
        apiErr.message || 'Invalid or expired invitation token. Please check and try again.'
      );
    } finally {
      setJoiningTeam(false);
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
          <View style={styles.badge}>
            <Text style={styles.badgeText}>GETTING STARTED</Text>
          </View>
          <Text style={styles.greeting}>
            Welcome{user?.firstName ? `, ${user.firstName}` : ''}!
          </Text>
          <Text style={styles.subtitle}>
            {choice === 'NONE'
              ? 'Choose how you would like to set up your Rota workspace.'
              : choice === 'START_TEAM'
              ? 'Name your team to begin scheduling. You will be the team Owner.'
              : 'Paste your invitation code to join an existing team.'}
          </Text>
        </View>

        {/* Error Banner */}
        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {/* STEP 1: ONE QUESTION: START A TEAM OR JOIN A TEAM */}
        {choice === 'NONE' && (
          <View style={styles.choicesContainer}>
            {/* Option 1: Start a team */}
            <TouchableOpacity
              style={styles.choiceCard}
              onPress={() => {
                setErrorMessage(null);
                setChoice('START_TEAM');
              }}
              activeOpacity={0.8}
            >
              <View style={styles.cardTopRow}>
                <View style={styles.choiceIconBadge}>
                  <Ionicons
                    name="business-outline"
                    size={26}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.roleOwnerBadge}>
                  <Text style={styles.roleOwnerBadgeText}>OWNER</Text>
                </View>
              </View>
              <Text style={styles.choiceTitle}>Start a team</Text>
              <Text style={styles.choiceDescription}>
                Create a new workplace schedule for your business and staff. You will manage shifts and team settings as the Owner.
              </Text>
              <View style={styles.choiceButtonPreview}>
                <View style={styles.choiceButtonPreviewRow}>
                  <Text style={styles.choiceButtonPreviewText}>Set up new team</Text>
                  <Ionicons name="arrow-forward" size={16} color={colors.primary} />
                </View>
              </View>
            </TouchableOpacity>

            {/* Option 2: Join a team */}
            <TouchableOpacity
              style={styles.choiceCard}
              onPress={() => {
                setErrorMessage(null);
                setChoice('JOIN_TEAM');
              }}
              activeOpacity={0.8}
            >
              <View style={styles.cardTopRow}>
                <View style={styles.choiceIconBadge}>
                  <Ionicons
                    name="mail-outline"
                    size={26}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.roleStaffBadge}>
                  <Text style={styles.roleStaffBadgeText}>INVITE ONLY</Text>
                </View>
              </View>
              <Text style={styles.choiceTitle}>Join a team</Text>
              <Text style={styles.choiceDescription}>
                Join an existing workplace using an invite token or link. Your role is automatically assigned by the team owner.
              </Text>
              <View style={styles.choiceButtonPreview}>
                <View style={styles.choiceButtonPreviewRow}>
                  <Text style={styles.choiceButtonPreviewText}>Enter invite token</Text>
                  <Ionicons name="arrow-forward" size={16} color={colors.primary} />
                </View>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 2A: FORM FOR STARTING A TEAM */}
        {choice === 'START_TEAM' && (
          <View style={styles.formCard}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                setErrorMessage(null);
                setChoice('NONE');
              }}
            >
              <View style={styles.backButtonRow}>
                <Ionicons name="arrow-back" size={16} color={colors.primary} />
                <Text style={styles.backButtonText}>Back to options</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.roleExplainer}>
              <Ionicons name="shield-checkmark" size={24} color={colors.primary} />
              <View style={styles.roleExplainerContent}>
                <Text style={styles.roleExplainerTitle}>You will be the team Owner</Text>
                <Text style={styles.roleExplainerText}>
                  As Owner, you have full control over schedules, inviting managers and staff, and team subscription.
                </Text>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Team Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Downtown Cafe, Front Desk"
                placeholderTextColor={colors.onSurfaceVariant}
                value={teamName}
                onChangeText={setTeamName}
                onBlur={() => setTeamName((v) => v.trimEnd())}
                autoFocus
                autoCapitalize="words"
                cursorColor={colors.primary}
                selectionColor={colors.primary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Business / Company Name (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Apex Hospitality Group"
                placeholderTextColor={colors.onSurfaceVariant}
                value={businessName}
                onChangeText={setBusinessName}
                onBlur={() => setBusinessName((v) => v.trimEnd())}
                autoCapitalize="words"
                cursorColor={colors.primary}
                selectionColor={colors.primary}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, creatingTeam && styles.submitButtonDisabled]}
              onPress={handleStartTeamSubmit}
              disabled={creatingTeam}
            >
              {creatingTeam ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.submitButtonText}>Create Team & Go to Dashboard</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 2B: FORM FOR JOINING A TEAM */}
        {choice === 'JOIN_TEAM' && (
          <View style={styles.formCard}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                setErrorMessage(null);
                setChoice('NONE');
              }}
            >
              <View style={styles.backButtonRow}>
                <Ionicons name="arrow-back" size={16} color={colors.primary} />
                <Text style={styles.backButtonText}>Back to options</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.roleExplainer}>
              <Ionicons name="lock-closed" size={24} color={colors.primary} />
              <View style={styles.roleExplainerContent}>
                <Text style={styles.roleExplainerTitle}>Role assigned automatically</Text>
                <Text style={styles.roleExplainerText}>
                  Your role (Staff or Manager) is pre-configured by the team owner who generated your invite link.
                </Text>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Invitation Code or Link *</Text>
              <TextInput
                style={styles.input}
                placeholder="Paste your invite code or full link"
                placeholderTextColor={colors.onSurfaceVariant}
                value={inviteTokenInput}
                onChangeText={setInviteTokenInput}
                onBlur={() => setInviteTokenInput((v) => v.trimEnd())}
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
                cursorColor={colors.primary}
                selectionColor={colors.primary}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, joiningTeam && styles.submitButtonDisabled]}
              onPress={handleJoinTeamSubmit}
              disabled={joiningTeam}
            >
              {joiningTeam ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.submitButtonText}>Join Team & Go to Dashboard</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

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
  greeting: {
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
  choicesContainer: {
    gap: spacing.md,
  },
  choiceCard: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.surfaceContainerHigh,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  choiceIconBadge: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceIcon: {
    fontSize: 24,
  },
  roleOwnerBadge: {
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  roleOwnerBadgeText: {
    ...typography.labelSmall,
    color: colors.onPrimaryContainer,
    fontWeight: '800',
  },
  roleStaffBadge: {
    backgroundColor: colors.secondaryContainer,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  roleStaffBadgeText: {
    ...typography.labelSmall,
    color: colors.onSecondaryContainer,
    fontWeight: '800',
  },
  choiceTitle: {
    ...typography.titleLarge,
    color: colors.onSurface,
    marginBottom: spacing.xs,
    fontWeight: '700',
  },
  choiceDescription: {
    ...typography.bodyMedium,
    color: colors.onSurfaceVariant,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  choiceButtonPreview: {
    paddingVertical: spacing.sm,
    alignItems: 'flex-start',
  },
  choiceButtonPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  choiceButtonPreviewText: {
    ...typography.labelLarge,
    color: colors.primary,
    fontWeight: '700',
  },
  formCard: {
    backgroundColor: colors.surfaceContainerLow,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.surfaceContainerHigh,
  },
  backButton: {
    marginBottom: spacing.md,
    alignSelf: 'flex-start',
  },
  backButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  backButtonText: {
    ...typography.labelMedium,
    color: colors.primary,
    fontWeight: '700',
  },
  roleExplainer: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainer,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
    alignItems: 'center',
  },
  roleExplainerIcon: {
    fontSize: 22,
  },
  roleExplainerContent: {
    flex: 1,
  },
  roleExplainerTitle: {
    ...typography.titleSmall,
    color: colors.onSurface,
    fontWeight: '700',
  },
  roleExplainerText: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    marginTop: 2,
    lineHeight: 16,
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
