import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { colors, typography, spacing, radius } from '../theme/tokens';
import { ApiService } from '../services/api';

interface DashboardScreenProps {
  initialUser?: any;
  onLogout: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ initialUser, onLogout }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modals
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [creatingTeam, setCreatingTeam] = useState(false);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'STAFF' | 'MANAGER'>('STAFF');
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinToken, setJoinToken] = useState('');
  const [joining, setJoining] = useState(false);

  const loadData = useCallback(async () => {
    setErrorMsg(null);
    try {
      const [dashRes, teamsRes] = await Promise.all([
        ApiService.getDashboardSummary(),
        ApiService.getTeams(),
      ]);
      setDashboardData(dashRes);
      setTeams(teamsRes);

      if (teamsRes.length > 0) {
        const active = selectedTeam
          ? teamsRes.find((t) => t.id === selectedTeam.id) || teamsRes[0]
          : teamsRes[0];
        setSelectedTeam(active);

        const membersRes = await ApiService.getTeamMembers(active.id);
        setTeamMembers(membersRes);
      } else {
        setSelectedTeam(null);
        setTeamMembers([]);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedTeam]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleSelectTeam = async (team: any) => {
    setSelectedTeam(team);
    try {
      const membersRes = await ApiService.getTeamMembers(team.id);
      setTeamMembers(membersRes);
    } catch {
      // Ignored
    }
  };

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    setCreatingTeam(true);
    try {
      await ApiService.createTeam({ name: newTeamName.trim() });
      setNewTeamName('');
      setShowCreateTeamModal(false);
      await loadData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not create team');
    } finally {
      setCreatingTeam(false);
    }
  };

  const handleCreateInvite = async () => {
    if (!selectedTeam) return;
    setInviting(true);
    try {
      const res = await ApiService.createInvitation(selectedTeam.id, {
        email: inviteEmail.trim() || undefined,
        role: inviteRole,
        expiresInDays: 7,
      });
      const link = `${ApiService.getBaseUrl()}/invitations/verify/${res.token}`;
      setGeneratedInviteLink(link);
      setInviteEmail('');
      Alert.alert('Invitation Created', `Share this invite token with your team member:\n\n${res.token}`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create invitation');
    } finally {
      setInviting(false);
    }
  };

  const handleJoinTeam = async () => {
    if (!joinToken.trim()) return;
    setJoining(true);
    try {
      // Clean token if full URL was pasted
      const cleanToken = joinToken.includes('/')
        ? joinToken.split('/').pop()!
        : joinToken.trim();

      await ApiService.acceptInvitation(cleanToken);
      setShowJoinModal(false);
      setJoinToken('');
      Alert.alert('Success', 'You have successfully joined the team!');
      await loadData();
    } catch (err: any) {
      Alert.alert('Join Failed', err.message || 'Invalid or expired invitation token');
    } finally {
      setJoining(false);
    }
  };

  const handleRoleChange = async (member: any, nextRole: 'MANAGER' | 'STAFF') => {
    if (!selectedTeam) return;
    try {
      await ApiService.updateMemberRole(selectedTeam.id, member.membershipId, nextRole);
      const membersRes = await ApiService.getTeamMembers(selectedTeam.id);
      setTeamMembers(membersRes);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update role');
    }
  };

  const handleLogout = async () => {
    await ApiService.logout();
    onLogout();
  };

  const profile = dashboardData?.profile || initialUser || {};
  const userRole = selectedTeam?.userRole || 'STAFF';
  const canManage = userRole === 'OWNER' || userRole === 'MANAGER';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Top Bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.brandBadge}>ROTA WORKFORCE</Text>
          <Text style={styles.greeting}>Hello, {profile.firstName || 'User'}</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>
      </View>

      {errorMsg ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity onPress={loadData} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading live team and schedule data...</Text>
        </View>
      ) : (
        <>
          {/* Teams Selector & Actions */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>Teams & Locations</Text>
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.actionPill}
                  onPress={() => setShowJoinModal(true)}
                >
                  <Text style={styles.actionPillText}>+ Join Team</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionPill, styles.actionPillPrimary]}
                  onPress={() => setShowCreateTeamModal(true)}
                >
                  <Text style={[styles.actionPillText, styles.actionPillPrimaryText]}>
                    + New Team
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {teams.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>You do not belong to any team yet.</Text>
                <Text style={styles.emptySubtext}>
                  Create your business team or enter an invitation code to join.
                </Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.teamPillsContainer}>
                {teams.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    style={[
                      styles.teamPill,
                      selectedTeam?.id === t.id && styles.activeTeamPill,
                    ]}
                    onPress={() => handleSelectTeam(t)}
                  >
                    <Text
                      style={[
                        styles.teamPillText,
                        selectedTeam?.id === t.id && styles.activeTeamPillText,
                      ]}
                    >
                      {t.name}
                    </Text>
                    <View
                      style={[
                        styles.roleBadge,
                        t.userRole === 'OWNER'
                          ? styles.roleOwner
                          : t.userRole === 'MANAGER'
                          ? styles.roleManager
                          : styles.roleStaff,
                      ]}
                    >
                      <Text style={styles.roleBadgeText}>{t.userRole}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Active Team Detail & Member Management */}
          {selectedTeam && (
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={styles.cardTitle}>{selectedTeam.name}</Text>
                  <Text style={styles.cardSubtitle}>
                    Timezone: {selectedTeam.timezone} • {teamMembers.length} Members
                  </Text>
                </View>
                {canManage && (
                  <TouchableOpacity
                    style={styles.inviteButton}
                    onPress={() => {
                      setGeneratedInviteLink(null);
                      setShowInviteModal(true);
                    }}
                  >
                    <Text style={styles.inviteButtonText}>+ Invite Staff</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Members List */}
              <View style={styles.membersList}>
                <Text style={styles.sectionHeading}>Team Roster & Roles</Text>
                {teamMembers.map((member) => (
                  <View key={member.membershipId} style={styles.memberRow}>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>
                        {member.firstName} {member.lastName || ''}
                      </Text>
                      <Text style={styles.memberEmail}>{member.email}</Text>
                    </View>

                    <View style={styles.memberRoleContainer}>
                      <View
                        style={[
                          styles.roleBadge,
                          member.role === 'OWNER'
                            ? styles.roleOwner
                            : member.role === 'MANAGER'
                            ? styles.roleManager
                            : styles.roleStaff,
                        ]}
                      >
                        <Text style={styles.roleBadgeText}>{member.role}</Text>
                      </View>

                      {/* Role Promotion for Owners */}
                      {userRole === 'OWNER' && member.role !== 'OWNER' && (
                        <TouchableOpacity
                          style={styles.roleToggleBtn}
                          onPress={() =>
                            handleRoleChange(
                              member,
                              member.role === 'STAFF' ? 'MANAGER' : 'STAFF'
                            )
                          }
                        >
                          <Text style={styles.roleToggleText}>
                            {member.role === 'STAFF' ? 'Make Mgr' : 'Make Staff'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* User Account & Verification Overview */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Your Account</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email:</Text>
              <Text style={styles.infoValue}>{profile.email || '—'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Account Status:</Text>
              <View style={styles.badgeSuccess}>
                <Text style={styles.badgeSuccessText}>{profile.status || 'ACTIVE'}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Role in Current Team:</Text>
              <Text style={styles.infoValue}>{userRole}</Text>
            </View>
          </View>
        </>
      )}

      {/* CREATE TEAM MODAL */}
      <Modal visible={showCreateTeamModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Create New Team</Text>
            <Text style={styles.modalSubtitle}>
              You will become the Owner of this team and its location.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. London Central Store"
              placeholderTextColor={colors.onSurfaceVariant}
              value={newTeamName}
              onChangeText={setNewTeamName}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowCreateTeamModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmit, creatingTeam && { opacity: 0.6 }]}
                onPress={handleCreateTeam}
                disabled={creatingTeam}
              >
                <Text style={styles.modalSubmitText}>
                  {creatingTeam ? 'Creating...' : 'Create Team'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* INVITE TEAM MEMBER MODAL */}
      <Modal visible={showInviteModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Invite Team Member</Text>
            <Text style={styles.modalSubtitle}>
              Invite by entering their email address or generate a shareable link.
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Email address (optional)"
              placeholderTextColor={colors.onSurfaceVariant}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <View style={styles.rolePickerRow}>
              <Text style={styles.rolePickerLabel}>Role:</Text>
              <TouchableOpacity
                style={[
                  styles.roleChoice,
                  inviteRole === 'STAFF' && styles.roleChoiceActive,
                ]}
                onPress={() => setInviteRole('STAFF')}
              >
                <Text
                  style={[
                    styles.roleChoiceText,
                    inviteRole === 'STAFF' && styles.roleChoiceTextActive,
                  ]}
                >
                  STAFF
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.roleChoice,
                  inviteRole === 'MANAGER' && styles.roleChoiceActive,
                ]}
                onPress={() => setInviteRole('MANAGER')}
              >
                <Text
                  style={[
                    styles.roleChoiceText,
                    inviteRole === 'MANAGER' && styles.roleChoiceTextActive,
                  ]}
                >
                  MANAGER
                </Text>
              </TouchableOpacity>
            </View>

            {generatedInviteLink ? (
              <View style={styles.linkBox}>
                <Text style={styles.linkLabel}>Shareable Token Generated:</Text>
                <Text selectable style={styles.linkText}>
                  {generatedInviteLink}
                </Text>
              </View>
            ) : null}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowInviteModal(false)}
              >
                <Text style={styles.modalCancelText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmit, inviting && { opacity: 0.6 }]}
                onPress={handleCreateInvite}
                disabled={inviting}
              >
                <Text style={styles.modalSubmitText}>
                  {inviting ? 'Generating...' : 'Generate Invite'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* JOIN TEAM MODAL */}
      <Modal visible={showJoinModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Join Team via Invite</Text>
            <Text style={styles.modalSubtitle}>
              Paste your invitation token or link to accept membership.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Paste invite token here..."
              placeholderTextColor={colors.onSurfaceVariant}
              value={joinToken}
              onChangeText={setJoinToken}
              autoCapitalize="none"
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowJoinModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmit, joining && { opacity: 0.6 }]}
                onPress={handleJoinTeam}
                disabled={joining}
              >
                <Text style={styles.modalSubmitText}>
                  {joining ? 'Joining...' : 'Join Team'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  contentContainer: {
    padding: spacing.md,
    paddingTop: spacing.xxl + spacing.sm,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  brandBadge: {
    ...typography.labelSmall,
    color: colors.primary,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  greeting: {
    ...typography.headlineMedium,
    color: colors.onSurface,
  },
  logoutButton: {
    backgroundColor: colors.errorContainer,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  logoutButtonText: {
    ...typography.labelMedium,
    color: colors.onErrorContainer,
    fontWeight: '700',
  },
  loadingContainer: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  loadingText: {
    ...typography.bodyMedium,
    color: colors.onSurfaceVariant,
    marginTop: spacing.md,
  },
  errorBox: {
    backgroundColor: colors.errorContainer,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    ...typography.bodyMedium,
    color: colors.onErrorContainer,
    flex: 1,
  },
  retryButton: {
    backgroundColor: colors.error,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  retryText: {
    ...typography.labelSmall,
    color: colors.onError,
  },
  card: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.surfaceContainerHigh,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cardTitle: {
    ...typography.titleMedium,
    color: colors.onSurface,
    fontWeight: '700',
  },
  cardSubtitle: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  actionPill: {
    backgroundColor: colors.surfaceContainerHigh,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  actionPillPrimary: {
    backgroundColor: colors.primary,
  },
  actionPillText: {
    ...typography.labelSmall,
    color: colors.onSurface,
    fontWeight: '600',
  },
  actionPillPrimaryText: {
    color: colors.onPrimary,
  },
  emptyBox: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.bodyLarge,
    color: colors.onSurface,
    fontWeight: '600',
  },
  emptySubtext: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    marginTop: 4,
    textAlign: 'center',
  },
  teamPillsContainer: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  teamPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    marginRight: spacing.sm,
    gap: spacing.xs,
  },
  activeTeamPill: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryContainer,
  },
  teamPillText: {
    ...typography.labelLarge,
    color: colors.onSurface,
  },
  activeTeamPillText: {
    color: colors.onPrimaryContainer,
    fontWeight: '700',
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  roleOwner: {
    backgroundColor: '#EADDFF',
  },
  roleManager: {
    backgroundColor: '#D1E4FF',
  },
  roleStaff: {
    backgroundColor: '#CEFDDE',
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1C1A1F',
    letterSpacing: 0.5,
  },
  inviteButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  inviteButtonText: {
    ...typography.labelMedium,
    color: colors.onPrimary,
    fontWeight: '700',
  },
  membersList: {
    marginTop: spacing.sm,
  },
  sectionHeading: {
    ...typography.labelMedium,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.sm,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceContainer,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    ...typography.bodyLarge,
    color: colors.onSurface,
    fontWeight: '600',
  },
  memberEmail: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
  memberRoleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  roleToggleBtn: {
    backgroundColor: colors.surfaceContainerHigh,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  roleToggleText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceContainer,
  },
  infoLabel: {
    ...typography.bodyMedium,
    color: colors.onSurfaceVariant,
  },
  infoValue: {
    ...typography.bodyMedium,
    color: colors.onSurface,
    fontWeight: '600',
  },
  badgeSuccess: {
    backgroundColor: colors.successContainer,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  badgeSuccessText: {
    ...typography.labelSmall,
    color: colors.onSuccessContainer,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  modalTitle: {
    ...typography.headlineSmall,
    color: colors.onSurface,
    marginBottom: 4,
  },
  modalSubtitle: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.md,
  },
  modalInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    height: 50,
    fontSize: 16,
    color: colors.onSurface,
    marginBottom: spacing.md,
  },
  rolePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  rolePickerLabel: {
    ...typography.bodyMedium,
    color: colors.onSurface,
    fontWeight: '600',
  },
  roleChoice: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roleChoiceActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  roleChoiceText: {
    ...typography.labelMedium,
    color: colors.onSurface,
  },
  roleChoiceTextActive: {
    color: colors.onPrimary,
    fontWeight: '700',
  },
  linkBox: {
    backgroundColor: colors.surfaceContainer,
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
  },
  linkLabel: {
    ...typography.labelSmall,
    color: colors.onSurfaceVariant,
    marginBottom: 2,
  },
  linkText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  modalCancel: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  modalCancelText: {
    ...typography.labelMedium,
    color: colors.onSurfaceVariant,
  },
  modalSubmit: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  modalSubmitText: {
    ...typography.labelMedium,
    color: colors.onPrimary,
    fontWeight: '700',
  },
});
