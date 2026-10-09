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

type TabType = 'schedule' | 'activity' | 'roster' | 'overview';

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ initialUser, onLogout }) => {
  const [activeTab, setActiveTab] = useState<TabType>('schedule');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [activityItems, setActivityItems] = useState<any[]>([]);
  const [activityPage, setActivityPage] = useState(1);
  const [activityHasMore, setActivityHasMore] = useState(false);
  const [loadingMoreActivity, setLoadingMoreActivity] = useState(false);
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

  // Shift Creation Modal
  const [showCreateShiftModal, setShowCreateShiftModal] = useState(false);
  const [shiftRoleName, setShiftRoleName] = useState('Floor Staff');
  const [shiftAssigneeId, setShiftAssigneeId] = useState<string>('');
  const [shiftDate, setShiftDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [shiftStartHour, setShiftStartHour] = useState('09:00');
  const [shiftEndHour, setShiftEndHour] = useState('17:00');
  const [shiftNotes, setShiftNotes] = useState('');
  const [shiftConflictError, setShiftConflictError] = useState<string | null>(null);
  const [creatingShift, setCreatingShift] = useState(false);

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

        const [membersRes, shiftsRes, actRes] = await Promise.all([
          ApiService.getTeamMembers(active.id),
          ApiService.getShifts(active.id),
          ApiService.getActivityFeed(active.id, 1, 15),
        ]);

        setTeamMembers(membersRes);
        setShifts(shiftsRes);
        setActivityItems(actRes.items);
        setActivityHasMore(actRes.pagination.hasMore);
        setActivityPage(1);

        if (membersRes.length > 0 && !shiftAssigneeId) {
          setShiftAssigneeId(membersRes[0].userId);
        }
      } else {
        setSelectedTeam(null);
        setTeamMembers([]);
        setShifts([]);
        setActivityItems([]);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedTeam, shiftAssigneeId]);

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
      const [membersRes, shiftsRes, actRes] = await Promise.all([
        ApiService.getTeamMembers(team.id),
        ApiService.getShifts(team.id),
        ApiService.getActivityFeed(team.id, 1, 15),
      ]);
      setTeamMembers(membersRes);
      setShifts(shiftsRes);
      setActivityItems(actRes.items);
      setActivityHasMore(actRes.pagination.hasMore);
      setActivityPage(1);
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

  const handleCreateShift = async () => {
    if (!selectedTeam) return;
    setShiftConflictError(null);
    setCreatingShift(true);

    const startTimeISO = `${shiftDate}T${shiftStartHour}:00.000Z`;
    const endTimeISO = `${shiftDate}T${shiftEndHour}:00.000Z`;

    try {
      await ApiService.createShift(selectedTeam.id, {
        assignedToId: shiftAssigneeId || undefined,
        roleName: shiftRoleName.trim() || 'Floor Staff',
        startTime: startTimeISO,
        endTime: endTimeISO,
        notes: shiftNotes.trim() || undefined,
      });

      setShowCreateShiftModal(false);
      setShiftNotes('');
      Alert.alert('Success', 'Shift created successfully!');
      // Refresh shifts and activity
      const [shiftsRes, actRes] = await Promise.all([
        ApiService.getShifts(selectedTeam.id),
        ApiService.getActivityFeed(selectedTeam.id, 1, 15),
      ]);
      setShifts(shiftsRes);
      setActivityItems(actRes.items);
    } catch (err: any) {
      if (err.code === 'SHIFT_CONFLICT') {
        setShiftConflictError('Scheduling Conflict: Staff member already has an overlapping shift during these hours.');
      } else {
        setShiftConflictError(err.message || 'Failed to schedule shift');
      }
    } finally {
      setCreatingShift(false);
    }
  };

  const handleCancelShift = async (shiftId: string) => {
    if (!selectedTeam) return;
    Alert.alert('Cancel Shift', 'Are you sure you want to cancel this scheduled shift?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            await ApiService.cancelShift(selectedTeam.id, shiftId);
            const [shiftsRes, actRes] = await Promise.all([
              ApiService.getShifts(selectedTeam.id),
              ApiService.getActivityFeed(selectedTeam.id, 1, 15),
            ]);
            setShifts(shiftsRes);
            setActivityItems(actRes.items);
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to cancel shift');
          }
        },
      },
    ]);
  };

  const loadMoreActivity = async () => {
    if (!selectedTeam || !activityHasMore || loadingMoreActivity) return;
    setLoadingMoreActivity(true);
    try {
      const nextPage = activityPage + 1;
      const res = await ApiService.getActivityFeed(selectedTeam.id, nextPage, 15);
      setActivityItems((prev) => [...prev, ...res.items]);
      setActivityHasMore(res.pagination.hasMore);
      setActivityPage(nextPage);
    } catch {
      // Ignored
    } finally {
      setLoadingMoreActivity(false);
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
          {/* Teams Selector */}
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
                  Create your business team or enter an invitation token to join.
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

          {/* Navigation Sub-Tabs */}
          {selectedTeam && (
            <View style={styles.tabNavRow}>
              <TouchableOpacity
                style={[styles.navTab, activeTab === 'schedule' && styles.navTabActive]}
                onPress={() => setActiveTab('schedule')}
              >
                <Text style={[styles.navTabText, activeTab === 'schedule' && styles.navTabTextActive]}>
                  📅 Shifts ({shifts.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.navTab, activeTab === 'activity' && styles.navTabActive]}
                onPress={() => setActiveTab('activity')}
              >
                <Text style={[styles.navTabText, activeTab === 'activity' && styles.navTabTextActive]}>
                  ⚡ Feed ({activityItems.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.navTab, activeTab === 'roster' && styles.navTabActive]}
                onPress={() => setActiveTab('roster')}
              >
                <Text style={[styles.navTabText, activeTab === 'roster' && styles.navTabTextActive]}>
                  👥 Roster ({teamMembers.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.navTab, activeTab === 'overview' && styles.navTabActive]}
                onPress={() => setActiveTab('overview')}
              >
                <Text style={[styles.navTabText, activeTab === 'overview' && styles.navTabTextActive]}>
                  ℹ️ Info
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* TAB 1: SCHEDULE / CALENDAR */}
          {selectedTeam && activeTab === 'schedule' && (
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={styles.cardTitle}>Shift Schedule</Text>
                  <Text style={styles.cardSubtitle}>
                    Active timezone: {selectedTeam.timezone}
                  </Text>
                </View>
                {canManage && (
                  <TouchableOpacity
                    style={styles.actionPillPrimary}
                    onPress={() => {
                      setShiftConflictError(null);
                      setShowCreateShiftModal(true);
                    }}
                  >
                    <Text style={[styles.actionPillText, styles.actionPillPrimaryText]}>
                      + Add Shift
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {shifts.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>No shifts scheduled yet.</Text>
                  <Text style={styles.emptySubtext}>
                    {canManage
                      ? 'Tap "+ Add Shift" above to schedule your staff members.'
                      : 'Your manager has not posted upcoming shifts yet.'}
                  </Text>
                </View>
              ) : (
                shifts.map((s) => {
                  const startDate = new Date(s.startTime);
                  const endDate = new Date(s.endTime);
                  const dateStr = startDate.toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  });
                  const timeRangeStr = `${startDate.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })} – ${endDate.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`;

                  return (
                    <View key={s.id} style={styles.shiftCard}>
                      <View style={styles.shiftHeaderRow}>
                        <View>
                          <Text style={styles.shiftDateText}>{dateStr}</Text>
                          <Text style={styles.shiftTimeText}>{timeRangeStr}</Text>
                        </View>
                        <View style={styles.shiftBadge}>
                          <Text style={styles.shiftBadgeText}>{s.roleName || 'General'}</Text>
                        </View>
                      </View>

                      <View style={styles.shiftAssigneeRow}>
                        <Text style={styles.shiftAssigneeLabel}>Assignee:</Text>
                        <Text style={styles.shiftAssigneeName}>
                          {s.assigneeName || 'Open Shift'}
                        </Text>
                      </View>

                      {s.notes ? (
                        <Text style={styles.shiftNotesText}>Note: {s.notes}</Text>
                      ) : null}

                      {canManage && (
                        <View style={styles.shiftActionFooter}>
                          <TouchableOpacity
                            style={styles.cancelShiftBtn}
                            onPress={() => handleCancelShift(s.id)}
                          >
                            <Text style={styles.cancelShiftText}>Cancel Shift</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          )}

          {/* TAB 2: PAGINATED ACTIVITY FEED */}
          {selectedTeam && activeTab === 'activity' && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Activity Feed</Text>
              <Text style={styles.cardSubtitle}>
                Real-time audit log of shifts, updates, and workforce events.
              </Text>

              {activityItems.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>No activity recorded yet.</Text>
                </View>
              ) : (
                <View style={styles.activityFeedList}>
                  {activityItems.map((item) => (
                    <View key={item.id} style={styles.activityRow}>
                      <View style={styles.activityDot} />
                      <View style={styles.activityBody}>
                        <View style={styles.activityHeader}>
                          <Text style={styles.activityActor}>{item.actorName}</Text>
                          <View
                            style={[
                              styles.actionTag,
                              item.action === 'CREATED'
                                ? styles.actionTagCreated
                                : item.action === 'CANCELLED'
                                ? styles.actionTagCancelled
                                : styles.actionTagUpdated,
                            ]}
                          >
                            <Text style={styles.actionTagText}>{item.action}</Text>
                          </View>
                        </View>
                        <Text style={styles.activityDesc}>{item.description}</Text>
                        <Text style={styles.activityTime}>
                          {new Date(item.createdAt).toLocaleString()}
                        </Text>
                      </View>
                    </View>
                  ))}

                  {activityHasMore && (
                    <TouchableOpacity
                      style={styles.loadMoreBtn}
                      onPress={loadMoreActivity}
                      disabled={loadingMoreActivity}
                    >
                      {loadingMoreActivity ? (
                        <ActivityIndicator color={colors.primary} />
                      ) : (
                        <Text style={styles.loadMoreText}>Load Older Events</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}

          {/* TAB 3: TEAM ROSTER & MEMBERS */}
          {selectedTeam && activeTab === 'roster' && (
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={styles.cardTitle}>{selectedTeam.name} Roster</Text>
                  <Text style={styles.cardSubtitle}>{teamMembers.length} active members</Text>
                </View>
                {canManage && (
                  <TouchableOpacity
                    style={styles.actionPillPrimary}
                    onPress={() => {
                      setGeneratedInviteLink(null);
                      setShowInviteModal(true);
                    }}
                  >
                    <Text style={[styles.actionPillText, styles.actionPillPrimaryText]}>
                      + Invite
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.membersList}>
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
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* TAB 4: OVERVIEW & SYSTEM INFO */}
          {activeTab === 'overview' && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Account & Database Status</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>User:</Text>
                <Text style={styles.infoValue}>{profile.email || '—'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Status:</Text>
                <View style={styles.badgeSuccess}>
                  <Text style={styles.badgeSuccessText}>{profile.status || 'ACTIVE'}</Text>
                </View>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Team Role:</Text>
                <Text style={styles.infoValue}>{userRole}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Backend Database:</Text>
                <Text style={styles.infoValue}>PostgreSQL (Live)</Text>
              </View>
            </View>
          )}
        </>
      )}

      {/* CREATE SHIFT MODAL */}
      <Modal visible={showCreateShiftModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Schedule Shift</Text>
            <Text style={styles.modalSubtitle}>
              Assign a staff member and specify shift hours. Overlaps are automatically prevented.
            </Text>

            {shiftConflictError ? (
              <View style={styles.conflictBanner}>
                <Text style={styles.conflictText}>{shiftConflictError}</Text>
              </View>
            ) : null}

            <Text style={styles.inputLabel}>Role / Position</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Lead Barista, Cashier"
              placeholderTextColor={colors.onSurfaceVariant}
              value={shiftRoleName}
              onChangeText={setShiftRoleName}
            />

            <Text style={styles.inputLabel}>Assign Staff Member</Text>
            <ScrollView horizontal style={styles.assigneePicker}>
              {teamMembers.map((m) => (
                <TouchableOpacity
                  key={m.userId}
                  style={[
                    styles.assigneeChoice,
                    shiftAssigneeId === m.userId && styles.assigneeChoiceActive,
                  ]}
                  onPress={() => setShiftAssigneeId(m.userId)}
                >
                  <Text
                    style={[
                      styles.assigneeChoiceText,
                      shiftAssigneeId === m.userId && styles.assigneeChoiceTextActive,
                    ]}
                  >
                    {m.firstName} ({m.role})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.rowInputs}>
              <View style={{ flex: 1, marginRight: spacing.xs }}>
                <Text style={styles.inputLabel}>Date (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="2026-10-10"
                  placeholderTextColor={colors.onSurfaceVariant}
                  value={shiftDate}
                  onChangeText={setShiftDate}
                />
              </View>
              <View style={{ width: 85, marginRight: spacing.xs }}>
                <Text style={styles.inputLabel}>Start (HH:MM)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="09:00"
                  placeholderTextColor={colors.onSurfaceVariant}
                  value={shiftStartHour}
                  onChangeText={setShiftStartHour}
                />
              </View>
              <View style={{ width: 85 }}>
                <Text style={styles.inputLabel}>End (HH:MM)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="17:00"
                  placeholderTextColor={colors.onSurfaceVariant}
                  value={shiftEndHour}
                  onChangeText={setShiftEndHour}
                />
              </View>
            </View>

            <Text style={styles.inputLabel}>Notes / Instructions</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Optional notes"
              placeholderTextColor={colors.onSurfaceVariant}
              value={shiftNotes}
              onChangeText={setShiftNotes}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowCreateShiftModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmit, creatingShift && { opacity: 0.6 }]}
                onPress={handleCreateShift}
                disabled={creatingShift}
              >
                <Text style={styles.modalSubmitText}>
                  {creatingShift ? 'Saving...' : 'Confirm Shift'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
              Invite by entering their email address or generate a shareable token.
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
                style={[styles.roleChoice, inviteRole === 'STAFF' && styles.roleChoiceActive]}
                onPress={() => setInviteRole('STAFF')}
              >
                <Text style={[styles.roleChoiceText, inviteRole === 'STAFF' && styles.roleChoiceTextActive]}>
                  STAFF
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.roleChoice, inviteRole === 'MANAGER' && styles.roleChoiceActive]}
                onPress={() => setInviteRole('MANAGER')}
              >
                <Text style={[styles.roleChoiceText, inviteRole === 'MANAGER' && styles.roleChoiceTextActive]}>
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
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
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
  tabNavRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainer,
    borderRadius: radius.md,
    padding: 3,
    marginBottom: spacing.md,
  },
  navTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  navTabActive: {
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  navTabText: {
    ...typography.labelSmall,
    color: colors.onSurfaceVariant,
    fontWeight: '600',
  },
  navTabTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  shiftCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shiftHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  shiftDateText: {
    ...typography.titleMedium,
    color: colors.onSurface,
    fontWeight: '700',
  },
  shiftTimeText: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: '600',
  },
  shiftBadge: {
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  shiftBadgeText: {
    ...typography.labelSmall,
    color: colors.onPrimaryContainer,
    fontWeight: '700',
  },
  shiftAssigneeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  shiftAssigneeLabel: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    marginRight: spacing.xs,
  },
  shiftAssigneeName: {
    ...typography.bodyMedium,
    color: colors.onSurface,
    fontWeight: '600',
  },
  shiftNotesText: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  shiftActionFooter: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: colors.surfaceContainer,
    paddingTop: spacing.xs,
  },
  cancelShiftBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  cancelShiftText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.error,
  },
  activityFeedList: {
    marginTop: spacing.sm,
  },
  activityRow: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceContainer,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 6,
    marginRight: spacing.sm,
  },
  activityBody: {
    flex: 1,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  activityActor: {
    ...typography.labelMedium,
    color: colors.onSurface,
    fontWeight: '700',
  },
  actionTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  actionTagCreated: {
    backgroundColor: colors.successContainer,
  },
  actionTagUpdated: {
    backgroundColor: colors.infoContainer,
  },
  actionTagCancelled: {
    backgroundColor: colors.errorContainer,
  },
  actionTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#1C1A1F',
  },
  activityDesc: {
    ...typography.bodyMedium,
    color: colors.onSurface,
  },
  activityTime: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  loadMoreBtn: {
    backgroundColor: colors.surfaceContainerHigh,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  loadMoreText: {
    ...typography.labelMedium,
    color: colors.primary,
    fontWeight: '700',
  },
  membersList: {
    marginTop: spacing.xs,
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
    maxHeight: '90%',
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
  inputLabel: {
    ...typography.labelSmall,
    color: colors.onSurface,
    fontWeight: '700',
    marginBottom: 4,
    marginTop: 4,
  },
  modalInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    height: 48,
    fontSize: 15,
    color: colors.onSurface,
    marginBottom: spacing.sm,
  },
  rowInputs: {
    flexDirection: 'row',
  },
  assigneePicker: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  assigneeChoice: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.xs,
    backgroundColor: colors.surface,
  },
  assigneeChoiceActive: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primary,
  },
  assigneeChoiceText: {
    ...typography.labelSmall,
    color: colors.onSurface,
  },
  assigneeChoiceTextActive: {
    color: colors.onPrimaryContainer,
    fontWeight: '700',
  },
  conflictBanner: {
    backgroundColor: colors.errorContainer,
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.error,
  },
  conflictText: {
    ...typography.bodySmall,
    color: colors.onErrorContainer,
    fontWeight: '600',
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
    marginTop: spacing.sm,
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
