import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
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
  Platform,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useQueryClient } from '@tanstack/react-query';
import { colors, typography, spacing, radius } from '../theme/tokens';
import { ApiService } from '../services/api';
import { StorageService } from '../services/storage';
import {
  useDashboardSummaryQuery,
  useTeamsQuery,
  useNotificationsQuery,
  useUserSettingsQuery,
  useTeamMembersQuery,
  useTeamShiftsQuery,
  useTeamActivityInfiniteQuery,
  useTeamSwapsQuery,
  useSubscriptionQuery,
  useMarkNotificationReadMutation,
} from '../services/queries';
import { useUiStore } from '../store/uiStore';
import { Ionicons } from '@expo/vector-icons';

interface DashboardScreenProps {
  initialUser?: any;
  onLogout: () => void;
}

type TabType = 'feed' | 'swaps' | 'shifts' | 'roster' | 'profile';
type ProfileSubTab = 'info' | 'settings' | 'billing';

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ initialUser, onLogout }) => {
  // Client UI state (which tab is open, selected team) lives in a persisted store.
  const {
    activeTab,
    setActiveTab,
    profileSubTab,
    setProfileSubTab,
    selectedTeamId,
    setSelectedTeamId,
  } = useUiStore();
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [teamSwaps, setTeamSwaps] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Notifications State
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState<number>(0);
  const [showNotificationsModal, setShowNotificationsModal] = useState<boolean>(false);

  // User Settings State (synced cross-device)
  const [userSettings, setUserSettings] = useState<any>(null);

  // Offline Mode State
  const [isOffline, setIsOffline] = useState<boolean>(false);

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

  // Shift Swap State
  const [showRequestSwapModal, setShowRequestSwapModal] = useState(false);
  const [swapTargetShift, setSwapTargetShift] = useState<any>(null);
  const [swapType, setSwapType] = useState<'DIRECT_SWAP' | 'OPEN_SHIFT'>('DIRECT_SWAP');
  const [swapTargetUserId, setSwapTargetUserId] = useState<string>('');
  const [swapReason, setSwapReason] = useState<string>('');
  const [submittingSwap, setSubmittingSwap] = useState(false);
  const [swapConflictError, setSwapConflictError] = useState<string | null>(null);
  const [processingSwapId, setProcessingSwapId] = useState<string | null>(null);

  // Subscription & Billing State (Seats, Tier plans, Proration)
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [selectedPlanTier, setSelectedPlanTier] = useState<string>('STARTER');
  const [targetSeatCount, setTargetSeatCount] = useState<number>(5);
  const [prorationPreview, setProrationPreview] = useState<any>(null);
  const [calculatingProration, setCalculatingProration] = useState(false);
  const [updatingSubscription, setUpdatingSubscription] = useState(false);

  // ---- Server state via TanStack Query (fetch + cache + refresh) ----
  const dashboardQuery = useDashboardSummaryQuery();
  const teamsQuery = useTeamsQuery();
  const notificationsQuery = useNotificationsQuery();
  const settingsQuery = useUserSettingsQuery();

  // The selected team is derived from persisted client state + cached server data.
  const selectedTeam = selectedTeamId
    ? teams.find((t: any) => t.id === selectedTeamId) ?? teams[0] ?? null
    : teams[0] ?? null;

  const activeTeamId = selectedTeam?.id;
  const membersQuery = useTeamMembersQuery(activeTeamId);
  const shiftsQuery = useTeamShiftsQuery(activeTeamId);
  const activityInfiniteQuery = useTeamActivityInfiniteQuery(activeTeamId, 20);
  const swapsQuery = useTeamSwapsQuery(activeTeamId);
  const subscriptionQuery = useSubscriptionQuery(
    selectedTeam?.businessId,
    selectedTeam?.userRole === 'OWNER'
  );

  const markNotificationRead = useMarkNotificationReadMutation();

  const isFetchingActivityRef = useRef(false);

  const activityFeedItems = useMemo(() => {
    if (!activityInfiniteQuery.data?.pages) return [];
    const seen = new Set<string>();
    const items: any[] = [];
    for (const page of activityInfiniteQuery.data.pages) {
      if (page?.items) {
        for (const item of page.items) {
          if (!seen.has(item.id)) {
            seen.add(item.id);
            items.push(item);
          }
        }
      }
    }
    return items;
  }, [activityInfiniteQuery.data]);

  const handleLoadMoreActivity = useCallback(() => {
    if (
      !activityInfiniteQuery.hasNextPage ||
      activityInfiniteQuery.isFetchingNextPage ||
      activityInfiniteQuery.isLoading ||
      isFetchingActivityRef.current
    ) {
      return;
    }
    isFetchingActivityRef.current = true;
    activityInfiniteQuery.fetchNextPage().finally(() => {
      isFetchingActivityRef.current = false;
    });
  }, [
    activityInfiniteQuery.hasNextPage,
    activityInfiniteQuery.isFetchingNextPage,
    activityInfiniteQuery.isLoading,
    activityInfiniteQuery.fetchNextPage,
  ]);

  // Mirror cached query data into the existing render state.
  useEffect(() => {
    if (dashboardQuery.data) setDashboardData(dashboardQuery.data);
  }, [dashboardQuery.data]);

  useEffect(() => {
    if (teamsQuery.data) setTeams(teamsQuery.data);
  }, [teamsQuery.data]);

  useEffect(() => {
    if (notificationsQuery.data) {
      setNotifications(notificationsQuery.data.items || []);
      setUnreadNotifCount(notificationsQuery.data.unreadCount || 0);
    }
  }, [notificationsQuery.data]);

  useEffect(() => {
    if (settingsQuery.data) {
      setUserSettings(settingsQuery.data);
      StorageService.cacheUserSettings(settingsQuery.data);
    }
  }, [settingsQuery.data]);

  useEffect(() => {
    if (membersQuery.data) {
      setTeamMembers(membersQuery.data);
      if (membersQuery.data.length > 0) {
        setShiftAssigneeId((prev) => prev || membersQuery.data[0].userId);
      }
    }
  }, [membersQuery.data]);

  useEffect(() => {
    if (shiftsQuery.data) {
      setShifts(shiftsQuery.data);
      // Persist for read-only offline viewing.
      StorageService.cacheUpcomingShifts(shiftsQuery.data);
    }
  }, [shiftsQuery.data]);

  useEffect(() => {
    if (swapsQuery.data) setTeamSwaps(swapsQuery.data);
  }, [swapsQuery.data]);

  useEffect(() => {
    if (subscriptionQuery.data) {
      setSubscriptionData(subscriptionQuery.data);
      setSelectedPlanTier(subscriptionQuery.data.planTier);
      setTargetSeatCount(subscriptionQuery.data.seatCount);
    }
  }, [subscriptionQuery.data]);

  // Default to the first available team once teams load.
  useEffect(() => {
    if (teams.length > 0 && !selectedTeamId) {
      setSelectedTeamId(teams[0].id);
    }
  }, [teams, selectedTeamId, setSelectedTeamId]);

  // Loading / refresh flags derived from query activity.
  useEffect(() => {
    if (!teamsQuery.isLoading && !dashboardQuery.isLoading) {
      setLoading(false);
    }
  }, [teamsQuery.isLoading, dashboardQuery.isLoading]);

  useEffect(() => {
    if (!teamsQuery.isFetching && !shiftsQuery.isFetching) {
      setRefreshing(false);
    }
  }, [teamsQuery.isFetching, shiftsQuery.isFetching]);

  // Offline handling: fall back to cached read-only shifts.
  useEffect(() => {
    if (teamsQuery.isError || dashboardQuery.isError) {
      setIsOffline(true);
      StorageService.getCachedUpcomingShifts().then((cached) => {
        if (cached.length > 0) setShifts(cached);
      });
    } else if (teamsQuery.isSuccess) {
      setIsOffline(false);
    }
  }, [teamsQuery.isError, teamsQuery.isSuccess, dashboardQuery.isError]);

  // Refresh everything: invalidate the cache so active queries refetch.
  const loadData = useCallback(async () => {
    setErrorMsg(null);
    await queryClient.invalidateQueries();
  }, [queryClient]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleSelectTeam = (team: any) => {
    setSelectedTeamId(team.id);
  };

  const handleCreateTeam = async () => {
    setNewTeamName((v) => v.trimEnd());
    const name = newTeamName.trim();
    if (!name) return;
    setCreatingTeam(true);
    try {
      await ApiService.createTeam({ name });
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
    setInviteEmail((v) => v.trimEnd());
    const email = inviteEmail.trim();
    setInviting(true);
    try {
      const res = await ApiService.createInvitation(selectedTeam.id, {
        email: email || undefined,
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
    setJoinToken((v) => v.trimEnd());
    const rawToken = joinToken.trim();
    if (!rawToken) return;
    setJoining(true);
    try {
      const cleanToken = rawToken.includes('/')
        ? rawToken.split('/').pop()!.trim()
        : rawToken;

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

  const handleRemoveMember = (member: any) => {
    if (!selectedTeam) return;
    const name = `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'this member';
    Alert.alert(
      'Remove Member',
      `Remove ${name} from ${selectedTeam.name}? They will lose access to this team. Their account and scheduling history are preserved.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await ApiService.deactivateMember(selectedTeam.id, member.membershipId);
              await loadData();
              Alert.alert('Member Removed', `${name} has been removed from the team.`);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Could not remove member');
            }
          },
        },
      ]
    );
  };

  const handleCreateShift = async () => {
    if (!selectedTeam) return;
    setShiftConflictError(null);
    setCreatingShift(true);

    const cleanRoleName = shiftRoleName.trim();
    const cleanDate = shiftDate.trim();
    const cleanStartHour = shiftStartHour.trim();
    const cleanEndHour = shiftEndHour.trim();
    const cleanNotes = shiftNotes.trim();

    setShiftRoleName(cleanRoleName);
    setShiftDate(cleanDate);
    setShiftStartHour(cleanStartHour);
    setShiftEndHour(cleanEndHour);
    setShiftNotes(cleanNotes);

    const startTimeISO = `${cleanDate}T${cleanStartHour}:00.000Z`;
    const endTimeISO = `${cleanDate}T${cleanEndHour}:00.000Z`;

    try {
      await ApiService.createShift(selectedTeam.id, {
        assignedToId: shiftAssigneeId || undefined,
        roleName: cleanRoleName || 'Floor Staff',
        startTime: startTimeISO,
        endTime: endTimeISO,
        notes: cleanNotes || undefined,
      });

      setShowCreateShiftModal(false);
      setShiftNotes('');
      Alert.alert('Success', 'Shift created successfully!');
      const shiftsRes = await ApiService.getShifts(selectedTeam.id);
      setShifts(shiftsRes);
      queryClient.invalidateQueries({ queryKey: ['teamActivityInfinite'] });
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
            const shiftsRes = await ApiService.getShifts(selectedTeam.id);
            setShifts(shiftsRes);
            queryClient.invalidateQueries({ queryKey: ['teamActivityInfinite'] });
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to cancel shift');
          }
        },
      },
    ]);
  };

  const handleOpenRequestSwap = (shift: any) => {
    setSwapTargetShift(shift);
    setSwapType('DIRECT_SWAP');
    setSwapReason('');
    setSwapConflictError(null);
    const myId = dashboardData?.profile?.id || initialUser?.id;
    const eligibleColleagues = teamMembers.filter((m) => m.userId !== myId);
    if (eligibleColleagues.length > 0) {
      setSwapTargetUserId(eligibleColleagues[0].userId);
    } else {
      setSwapTargetUserId('');
    }
    setShowRequestSwapModal(true);
  };

  const handleSubmitSwapRequest = async () => {
    if (!selectedTeam || !swapTargetShift) return;
    setSwapConflictError(null);
    setSubmittingSwap(true);
    setSwapReason((v) => v.trimEnd());
    const cleanReason = swapReason.trim();
    try {
      await ApiService.requestSwap(selectedTeam.id, {
        shiftId: swapTargetShift.id,
        type: swapType,
        targetUserId: swapType === 'DIRECT_SWAP' ? swapTargetUserId : undefined,
        reason: cleanReason || undefined,
      });

      setShowRequestSwapModal(false);
      Alert.alert(
        'Swap Requested',
        swapType === 'DIRECT_SWAP'
          ? 'Direct swap proposal sent. It will take effect upon manager approval.'
          : 'Shift has been posted to your team as an Open Shift!'
      );

      const swapsRes = await ApiService.getTeamSwaps(selectedTeam.id);
      setTeamSwaps(swapsRes);
      queryClient.invalidateQueries({ queryKey: ['teamActivityInfinite'] });
    } catch (err: any) {
      setSwapConflictError(err.message || 'Failed to submit shift swap');
    } finally {
      setSubmittingSwap(false);
    }
  };

  const handleClaimOpenShift = async (swapId: string) => {
    if (!selectedTeam) return;
    setProcessingSwapId(swapId);
    try {
      await ApiService.claimOpenShift(selectedTeam.id, swapId);
      Alert.alert('Open Shift Claimed', 'Your claim has been submitted to your manager for approval.');
      const swapsRes = await ApiService.getTeamSwaps(selectedTeam.id);
      setTeamSwaps(swapsRes);
      queryClient.invalidateQueries({ queryKey: ['teamActivityInfinite'] });
    } catch (err: any) {
      Alert.alert('Claim Failed', err.message || 'Could not claim open shift');
    } finally {
      setProcessingSwapId(null);
    }
  };

  const handleApproveSwap = async (swapId: string) => {
    if (!selectedTeam) return;
    setProcessingSwapId(swapId);
    try {
      await ApiService.approveSwap(selectedTeam.id, swapId);
      Alert.alert('Swap Approved', 'The shift assignment has been updated atomically.');
      const [swapsRes, shiftsRes] = await Promise.all([
        ApiService.getTeamSwaps(selectedTeam.id),
        ApiService.getShifts(selectedTeam.id),
      ]);
      setTeamSwaps(swapsRes);
      setShifts(shiftsRes);
      queryClient.invalidateQueries({ queryKey: ['teamActivityInfinite'] });
    } catch (err: any) {
      Alert.alert('Approval Failed', err.message || 'Could not approve shift swap');
    } finally {
      setProcessingSwapId(null);
    }
  };

  const handleRejectSwap = async (swapId: string) => {
    if (!selectedTeam) return;
    Alert.alert('Reject Swap', 'Are you sure you want to decline this shift swap request?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          setProcessingSwapId(swapId);
          try {
            await ApiService.rejectSwap(selectedTeam.id, swapId, 'Manager declined');
            const swapsRes = await ApiService.getTeamSwaps(selectedTeam.id);
            setTeamSwaps(swapsRes);
            queryClient.invalidateQueries({ queryKey: ['teamActivityInfinite'] });
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to reject swap');
          } finally {
            setProcessingSwapId(null);
          }
        },
      },
    ]);
  };

  const handleSelectPlanTier = async (tier: string) => {
    setSelectedPlanTier(tier);
    if (!selectedTeam?.businessId) return;
    setCalculatingProration(true);
    try {
      const preview = await ApiService.previewProration(selectedTeam.businessId, {
        newPlanTier: tier,
        newSeatCount: targetSeatCount,
      });
      setProrationPreview(preview);
    } catch {
      setProrationPreview(null);
    } finally {
      setCalculatingProration(false);
    }
  };

  const handleChangeSeatCount = async (delta: number) => {
    if (!subscriptionData || !selectedTeam?.businessId) return;
    const currentMin = Math.max(subscriptionData.activeStaffCount || 1, 1);
    const newSeats = Math.max(currentMin, targetSeatCount + delta);
    if (newSeats === targetSeatCount) return;
    setTargetSeatCount(newSeats);
    setCalculatingProration(true);
    try {
      const preview = await ApiService.previewProration(selectedTeam.businessId, {
        newPlanTier: selectedPlanTier,
        newSeatCount: newSeats,
      });
      setProrationPreview(preview);
    } catch {
      setProrationPreview(null);
    } finally {
      setCalculatingProration(false);
    }
  };

  const handleApplySubscriptionUpdate = async () => {
    if (!selectedTeam?.businessId) return;
    setUpdatingSubscription(true);
    try {
      const res = await ApiService.updateSubscription(selectedTeam.businessId, {
        newPlanTier: selectedPlanTier,
        newSeatCount: targetSeatCount,
      });
      Alert.alert(
        'Subscription Updated',
        `Successfully updated to ${res.subscription.plan_tier} plan with ${res.subscription.seat_count} seats.\n\nProration adjustment: ${
          res.proration.proratedDeltaCents >= 0 ? '+' : ''
        }£${(res.proration.proratedDeltaCents / 100).toFixed(2)} ${res.proration.currency}`
      );
      const sub = await ApiService.getSubscription(selectedTeam.businessId);
      setSubscriptionData(sub);
      setProrationPreview(null);
      queryClient.invalidateQueries({ queryKey: ['teamActivityInfinite'] });
    } catch (err: any) {
      Alert.alert('Update Failed', err.message || 'Could not update subscription plan');
    } finally {
      setUpdatingSubscription(false);
    }
  };

  const handleMarkNotifRead = (id: string) => {
    // Optimistic update: the UI reflects "read" immediately and rolls back on failure.
    markNotificationRead.mutate(id);
  };

  const handleMarkAllNotifsRead = async () => {
    try {
      await ApiService.markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadNotifCount(0);
    } catch {
      // Ignored
    }
  };

  const handleToggleSetting = async (key: string, currentValue: any) => {
    if (!userSettings) return;
    const newVal = typeof currentValue === 'boolean' ? !currentValue : currentValue;
    const updated = { ...userSettings, [key]: newVal };
    setUserSettings(updated);
    await StorageService.cacheUserSettings(updated);
    try {
      await ApiService.updateUserSettings({ [key]: newVal });
    } catch {
      // Revert if network error
    }
  };

  const handleSetStartDayOfWeek = async (day: number) => {
    if (!userSettings) return;
    const updated = { ...userSettings, startDayOfWeek: day };
    setUserSettings(updated);
    await StorageService.cacheUserSettings(updated);
    try {
      await ApiService.updateUserSettings({ startDayOfWeek: day });
    } catch {
      // Revert if network error
    }
  };

  const handleLogout = async () => {
    await ApiService.logout();
    onLogout();
  };

  const profile = dashboardData?.profile || initialUser || {};
  const userRole = selectedTeam?.userRole || 'STAFF';
  const canManage = userRole === 'OWNER' || userRole === 'MANAGER';

  const renderActivityItem = useCallback(({ item }: { item: any }) => {
    const isCreated = item.action?.includes('CREATED') || item.action?.includes('PUBLISHED');
    const isCancelled = item.action?.includes('CANCELLED') || item.action?.includes('REJECTED');
    return (
      <View style={styles.activityRow}>
        <View style={styles.activityDot} />
        <View style={styles.activityBody}>
          <View style={styles.activityHeader}>
            <Text style={styles.activityActor}>{item.actorName}</Text>
            <View
              style={[
                styles.actionTag,
                isCreated
                  ? styles.actionTagCreated
                  : isCancelled
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
    );
  }, []);

  const renderFeedHeader = useCallback(() => (
    <View style={styles.feedHeaderContainer}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.brandBadge}>ROTA WORKFORCE</Text>
          <Text style={styles.greeting}>Hello, {profile.firstName || 'User'}</Text>
        </View>
        <View style={styles.topBarRight}>
          <TouchableOpacity
            style={styles.notifBellBtn}
            onPress={() => setShowNotificationsModal(true)}
          >
            <Ionicons
              name={
                unreadNotifCount > 0 || showNotificationsModal
                  ? 'notifications'
                  : 'notifications-outline'
              }
              size={22}
              color={colors.onSurface}
            />
            {unreadNotifCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{unreadNotifCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Active Team Header */}
      {selectedTeam && (
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.teamHeaderInfo}>
              <Text style={styles.cardTitle}>{selectedTeam.name}</Text>
              <Text style={styles.cardSubtitle}>
                {selectedTeam.businessName ? `${selectedTeam.businessName} • ` : ''}
                Active timezone: {selectedTeam.timezone || 'UTC'}
              </Text>
            </View>
            <View
              style={[
                styles.roleBadgeHeader,
                userRole === 'OWNER'
                  ? styles.roleOwner
                  : userRole === 'MANAGER'
                  ? styles.roleManager
                  : styles.roleStaff,
              ]}
            >
              <Ionicons
                name={
                  userRole === 'OWNER'
                    ? 'shield-checkmark'
                    : userRole === 'MANAGER'
                    ? 'shield'
                    : 'person'
                }
                size={13}
                color={
                  userRole === 'OWNER'
                    ? colors.onPrimaryContainer
                    : userRole === 'MANAGER'
                    ? colors.info
                    : colors.onSuccessContainer
                }
              />
              <Text
                style={[
                  styles.roleBadgeHeaderText,
                  {
                    color:
                      userRole === 'OWNER'
                        ? colors.onPrimaryContainer
                        : userRole === 'MANAGER'
                        ? colors.info
                        : colors.onSuccessContainer,
                  },
                ]}
              >
                {userRole}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Feed Card Title */}
      <View style={styles.card}>
        <View style={styles.feedTitleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Activity Feed</Text>
            <Text style={styles.cardSubtitle}>
              Real-time audit log of shifts, updates, and workforce events.
            </Text>
          </View>
          <View style={styles.cursorBadge}>
            <Ionicons name="infinite" size={13} color={colors.primary} />
            <Text style={styles.cursorBadgeText}>Cursor Feed</Text>
          </View>
        </View>
      </View>

      {/* Error state banner */}
      {activityInfiniteQuery.isError && (
        <View style={styles.activityErrorBox}>
          <Ionicons name="alert-circle-outline" size={24} color={colors.onErrorContainer} />
          <Text style={styles.activityErrorText}>
            {activityInfiniteQuery.error?.message || 'Failed to load activity feed'}
          </Text>
          <TouchableOpacity
            style={styles.activityRetryBtn}
            onPress={() => activityInfiniteQuery.refetch()}
          >
            <Text style={styles.activityRetryBtnText}>Retry Feed</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  ), [
    profile.firstName,
    unreadNotifCount,
    showNotificationsModal,
    selectedTeam,
    userRole,
    activityInfiniteQuery.isError,
    activityInfiniteQuery.error,
    activityInfiniteQuery.refetch,
  ]);

  const renderFeedFooter = useCallback(() => {
    if (activityInfiniteQuery.isFetchingNextPage) {
      return (
        <View style={styles.loadingMoreBox}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingMoreText}>Loading older activity records...</Text>
        </View>
      );
    }
    if (
      !activityInfiniteQuery.hasNextPage &&
      activityFeedItems.length > 0 &&
      !activityInfiniteQuery.isLoading
    ) {
      return (
        <View style={styles.endOfListBox}>
          <Ionicons name="checkmark-done-circle" size={18} color={colors.primary} />
          <Text style={styles.endOfListText}>
            You're all caught up • End of activity feed ({activityFeedItems.length} events)
          </Text>
        </View>
      );
    }
    return <View style={{ height: 40 }} />;
  }, [
    activityInfiniteQuery.isFetchingNextPage,
    activityInfiniteQuery.hasNextPage,
    activityFeedItems.length,
    activityInfiniteQuery.isLoading,
  ]);

  const renderFeedEmpty = useCallback(() => {
    if (activityInfiniteQuery.isLoading) {
      return (
        <View style={styles.activityCenterBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.activityStatusTitle}>Loading activity feed...</Text>
          <Text style={styles.activityStatusSubtitle}>
            Retrieving high-volume workforce logs via cursor pagination
          </Text>
        </View>
      );
    }
    if (activityInfiniteQuery.isError) {
      return null;
    }
    return (
      <View style={styles.activityCenterBox}>
        <Ionicons name="newspaper-outline" size={44} color={colors.onSurfaceVariant} />
        <Text style={styles.emptyText}>No activity recorded yet</Text>
        <Text style={styles.emptySubtext}>
          When team members schedule shifts or request swaps, events will appear here in real time.
        </Text>
      </View>
    );
  }, [activityInfiniteQuery.isLoading, activityInfiniteQuery.isError]);

  return (
    <View style={styles.screenWrapper}>
      {activeTab === 'feed' ? (
        <View style={styles.feedScreenContainer}>
          <FlashList
            data={activityFeedItems}
            renderItem={renderActivityItem}
            keyExtractor={(item) => item.id}
            onEndReached={handleLoadMoreActivity}
            onEndReachedThreshold={0.5}
            refreshControl={
              <RefreshControl
                refreshing={activityInfiniteQuery.isRefetching && !activityInfiniteQuery.isFetchingNextPage}
                onRefresh={() => activityInfiniteQuery.refetch()}
              />
            }
            ListHeaderComponent={renderFeedHeader}
            ListEmptyComponent={renderFeedEmpty}
            ListFooterComponent={renderFeedFooter}
            contentContainerStyle={styles.feedListContent}
          />
        </View>
      ) : (
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
        <View style={styles.topBarRight}>
          <TouchableOpacity
            style={styles.notifBellBtn}
            onPress={() => setShowNotificationsModal(true)}
          >
            <Ionicons
              name={
                unreadNotifCount > 0 || showNotificationsModal
                  ? 'notifications'
                  : 'notifications-outline'
              }
              size={22}
              color={colors.onSurface}
            />
            {unreadNotifCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{unreadNotifCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
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
          {/* Active Team & Role Header (Multi-team supported in backend, UI does not push create/join) */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.teamHeaderInfo}>
                <Text style={styles.cardTitle}>{selectedTeam?.name || 'Your Team'}</Text>
                <Text style={styles.cardSubtitle}>
                  {selectedTeam?.businessName ? `${selectedTeam.businessName} • ` : ''}
                  Active timezone: {selectedTeam?.timezone || 'UTC'}
                </Text>
              </View>
              {selectedTeam && (
                <View
                  style={[
                    styles.roleBadgeHeader,
                    userRole === 'OWNER'
                      ? styles.roleOwner
                      : userRole === 'MANAGER'
                      ? styles.roleManager
                      : styles.roleStaff,
                  ]}
                >
                  <Ionicons
                    name={
                      userRole === 'OWNER'
                        ? 'shield-checkmark'
                        : userRole === 'MANAGER'
                        ? 'shield'
                        : 'person'
                    }
                    size={13}
                    color={
                      userRole === 'OWNER'
                        ? colors.onPrimaryContainer
                        : userRole === 'MANAGER'
                        ? colors.info
                        : colors.onSuccessContainer
                    }
                  />
                  <Text
                    style={[
                      styles.roleBadgeHeaderText,
                      {
                        color:
                          userRole === 'OWNER'
                            ? colors.onPrimaryContainer
                            : userRole === 'MANAGER'
                            ? colors.info
                            : colors.onSuccessContainer,
                      },
                    ]}
                  >
                    {userRole}
                  </Text>
                </View>
              )}
            </View>

            {/* If user belongs to multiple teams (backend capability preserved), show subtle selector */}
            {teams.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.teamPillsContainer}
              >
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

            {teams.length === 0 && (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>You do not belong to any team yet.</Text>
                <Text style={styles.emptySubtext}>
                  Please create a team or join using an invite code.
                </Text>
              </View>
            )}
          </View>

          {/* TAB 1: SHIFTS / CALENDAR */}
          {selectedTeam && activeTab === 'shifts' && (
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
                    <View style={styles.actionPillContentRow}>
                      <Ionicons name="add" size={16} color={colors.onPrimary} />
                      <Text style={[styles.actionPillText, styles.actionPillPrimaryText]}>
                        Add Shift
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>

              {isOffline && (
                <View style={styles.offlineBanner}>
                  <Ionicons name="cloud-offline" size={20} color={colors.onWarningContainer} />
                  <View style={styles.offlineBannerContent}>
                    <Text style={styles.offlineBannerTitle}>Offline Mode Active</Text>
                    <Text style={styles.offlineBannerSubtitle}>
                      Viewing cached shifts from local encrypted device storage. Live changes will resume when reconnected.
                    </Text>
                  </View>
                </View>
              )}

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
                  const isMyShift = s.assignedToId === (dashboardData?.profile?.id || initialUser?.id);

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

                      <View style={styles.shiftActionFooter}>
                        {isMyShift && s.status !== 'CANCELLED' && (
                          <TouchableOpacity
                            style={styles.swapShiftBtn}
                            onPress={() => handleOpenRequestSwap(s)}
                          >
                            <View style={styles.btnRow}>
                              <Ionicons name="swap-horizontal-outline" size={14} color={colors.primary} />
                              <Text style={styles.swapShiftBtnText}>Request Swap</Text>
                            </View>
                          </TouchableOpacity>
                        )}
                        {canManage && (
                          <TouchableOpacity
                            style={styles.cancelShiftBtn}
                            onPress={() => handleCancelShift(s.id)}
                          >
                            <View style={styles.btnRow}>
                              <Ionicons name="trash-outline" size={14} color={colors.error} />
                              <Text style={styles.cancelShiftText}>Cancel Shift</Text>
                            </View>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}

          {/* TAB: SWAP REQUESTS & MANAGER APPROVAL */}
          {selectedTeam && activeTab === 'swaps' && (
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={styles.cardTitle}>Shift Swaps & Open Shifts</Text>
                  <Text style={styles.cardSubtitle}>
                    {canManage
                      ? 'Review and approve pending workforce shift swaps.'
                      : 'Claim open shifts or monitor your shift swap proposals.'}
                  </Text>
                </View>
              </View>

              {/* Section 1: Pending Approvals */}
              <View style={styles.sectionHeadingRow}>
                <Ionicons name="hourglass-outline" size={18} color={colors.primary} />
                <Text style={styles.sectionHeading}>
                  Pending Approvals ({teamSwaps.filter((sw) => sw.status === 'REQUESTED').length})
                </Text>
              </View>

              {teamSwaps.filter((sw) => sw.status === 'REQUESTED').length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>No pending swap requests.</Text>
                  <Text style={styles.emptySubtext}>
                    When staff propose swaps or claim open shifts, they appear here for manager review.
                  </Text>
                </View>
              ) : (
                teamSwaps
                  .filter((sw) => sw.status === 'REQUESTED')
                  .map((sw) => {
                    const shiftStart = new Date(sw.shift.startTime);
                    const shiftEnd = new Date(sw.shift.endTime);
                    const isClaimedOpenShift = sw.type === 'OPEN_SHIFT' && sw.targetUser;
                    const isUnclaimedOpenShift = sw.type === 'OPEN_SHIFT' && !sw.targetUser;

                    return (
                      <View key={sw.id} style={styles.swapCard}>
                        <View style={styles.swapHeaderRow}>
                          <View
                            style={[
                              styles.swapTypeBadge,
                              sw.type === 'DIRECT_SWAP'
                                ? styles.swapTypeDirect
                                : styles.swapTypeOpen,
                            ]}
                          >
                            <Text style={styles.swapTypeBadgeText}>
                              {sw.type === 'DIRECT_SWAP'
                                ? 'DIRECT SWAP'
                                : isClaimedOpenShift
                                ? 'OPEN SHIFT (CLAIMED)'
                                : 'OPEN SHIFT (OFFERED)'}
                            </Text>
                          </View>
                          <Text style={styles.swapTimestamp}>
                            {new Date(sw.requestedAt).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </Text>
                        </View>

                        <Text style={styles.swapShiftTitle}>
                          {sw.shift.roleName} Shift
                        </Text>
                        <Text style={styles.swapShiftTime}>
                          {shiftStart.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} •{' '}
                          {shiftStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                          {shiftEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>

                        <View style={styles.swapParticipantsBox}>
                          <Text style={styles.swapParticipantText}>
                            <Text style={{ fontWeight: '700' }}>Offered by: </Text>
                            {sw.requester.name}
                          </Text>
                          {sw.targetUser ? (
                            <Text style={styles.swapParticipantText}>
                              <Text style={{ fontWeight: '700' }}>
                                {sw.type === 'DIRECT_SWAP' ? 'Proposed Recipient: ' : 'Claimed by: '}
                              </Text>
                              {sw.targetUser.name}
                            </Text>
                          ) : (
                            <Text style={styles.swapParticipantText}>
                              <Text style={{ fontWeight: '700' }}>Recipient: </Text>
                              Anyone on team (Unclaimed)
                            </Text>
                          )}
                          {sw.reason ? (
                            <Text style={styles.swapReasonText}>Reason: "{sw.reason}"</Text>
                          ) : null}
                        </View>

                        {/* Actions */}
                        {canManage ? (
                          <View style={styles.swapActionRow}>
                            <TouchableOpacity
                              style={[
                                styles.approveSwapBtn,
                                processingSwapId === sw.id && { opacity: 0.6 },
                              ]}
                              onPress={() => handleApproveSwap(sw.id)}
                              disabled={processingSwapId === sw.id}
                            >
                              <View style={styles.btnRow}>
                                <Ionicons name="checkmark-circle-outline" size={16} color={colors.onPrimary} />
                                <Text style={styles.approveSwapBtnText}>
                                  {processingSwapId === sw.id ? 'Processing...' : 'Approve Swap'}
                                </Text>
                              </View>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[
                                styles.rejectSwapBtn,
                                processingSwapId === sw.id && { opacity: 0.6 },
                              ]}
                              onPress={() => handleRejectSwap(sw.id)}
                              disabled={processingSwapId === sw.id}
                            >
                              <View style={styles.btnRow}>
                                <Ionicons name="close-circle-outline" size={16} color={colors.onErrorContainer} />
                                <Text style={styles.rejectSwapBtnText}>Decline</Text>
                              </View>
                            </TouchableOpacity>
                          </View>
                        ) : isUnclaimedOpenShift &&
                          sw.requester.id !== (dashboardData?.profile?.id || initialUser?.id) ? (
                          <TouchableOpacity
                            style={[
                              styles.claimShiftBtn,
                              processingSwapId === sw.id && { opacity: 0.6 },
                            ]}
                            onPress={() => handleClaimOpenShift(sw.id)}
                            disabled={processingSwapId === sw.id}
                          >
                            <View style={styles.btnRow}>
                              <Ionicons name="hand-right-outline" size={16} color={colors.onPrimary} />
                              <Text style={styles.claimShiftBtnText}>
                                {processingSwapId === sw.id ? 'Claiming...' : 'Claim This Shift'}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        ) : (
                          <View style={styles.statusWaitBadge}>
                            <Text style={styles.statusWaitText}>
                              {isUnclaimedOpenShift
                                ? 'Available for eligible team members to claim'
                                : 'Awaiting Manager Review & Confirmation'}
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  })
              )}

              {/* Section 2: Recent Resolved Swaps */}
              <View style={[styles.sectionHeadingRow, { marginTop: spacing.xl }]}>
                <Ionicons name="time-outline" size={18} color={colors.primary} />
                <Text style={styles.sectionHeading}>
                  Swap History ({teamSwaps.filter((sw) => sw.status !== 'REQUESTED').length})
                </Text>
              </View>

              {teamSwaps.filter((sw) => sw.status !== 'REQUESTED').length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>No swap history yet.</Text>
                </View>
              ) : (
                teamSwaps
                  .filter((sw) => sw.status !== 'REQUESTED')
                  .slice(0, 10)
                  .map((sw) => (
                    <View key={sw.id} style={styles.historySwapRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.historySwapTitle}>
                          {sw.shift.roleName} ({sw.requester.name} to {sw.targetUser?.name || 'Open'})
                        </Text>
                        <Text style={styles.historySwapSub}>
                          {new Date(sw.shift.startTime).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                          })}{' '}
                          • {sw.type}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.roleBadge,
                          sw.status === 'EXECUTED'
                            ? styles.badgeSuccess
                            : styles.roleOwner,
                        ]}
                      >
                        <Text
                          style={[
                            styles.roleBadgeText,
                            sw.status === 'EXECUTED' && styles.badgeSuccessText,
                          ]}
                        >
                          {sw.status}
                        </Text>
                      </View>
                    </View>
                  ))
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
                    <View style={styles.actionPillContentRow}>
                      <Ionicons name="person-add-outline" size={14} color={colors.onPrimary} />
                      <Text style={[styles.actionPillText, styles.actionPillPrimaryText]}>
                        Invite
                      </Text>
                    </View>
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

                      {/* Remove control mirrors backend rules: OWNER protected, no self, managers cannot remove managers. */}
                      {canManage &&
                        member.role !== 'OWNER' &&
                        member.userId !== profile.id &&
                        !(userRole === 'MANAGER' && member.role === 'MANAGER') && (
                          <TouchableOpacity
                            style={styles.removePill}
                            onPress={() => handleRemoveMember(member)}
                            accessibilityRole="button"
                            accessibilityLabel={`Remove ${member.firstName} ${member.lastName || ''} from team`}
                          >
                            <Text style={styles.removePillText}>Remove</Text>
                          </TouchableOpacity>
                        )}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* TAB 5: PROFILE (Info, Settings, and Billing) */}
          {activeTab === 'profile' && (
            <View>
              {/* Profile Top Summary Card */}
              <View style={styles.card}>
                <View style={styles.profileHeaderRow}>
                  <View style={styles.profileAvatar}>
                    <Text style={styles.profileAvatarText}>
                      {(profile.firstName?.[0] || 'U').toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.profileHeaderInfo}>
                    <Text style={styles.profileName}>
                      {profile.firstName || 'User'} {profile.lastName || ''}
                    </Text>
                    <Text style={styles.profileEmail}>{profile.email || '—'}</Text>
                    <View style={styles.profileBadgeContainer}>
                      <View
                        style={[
                          styles.roleBadgeHeader,
                          userRole === 'OWNER'
                            ? styles.roleOwner
                            : userRole === 'MANAGER'
                            ? styles.roleManager
                            : styles.roleStaff,
                        ]}
                      >
                        <Ionicons
                          name={
                            userRole === 'OWNER'
                              ? 'shield-checkmark'
                              : userRole === 'MANAGER'
                              ? 'shield'
                              : 'person'
                          }
                          size={13}
                          color={
                            userRole === 'OWNER'
                              ? colors.onPrimaryContainer
                              : userRole === 'MANAGER'
                              ? colors.info
                              : colors.onSuccessContainer
                          }
                        />
                        <Text
                          style={[
                            styles.roleBadgeHeaderText,
                            {
                              color:
                                userRole === 'OWNER'
                                  ? colors.onPrimaryContainer
                                  : userRole === 'MANAGER'
                                  ? colors.info
                                  : colors.onSuccessContainer,
                            },
                          ]}
                        >
                          {userRole}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Sub-Tabs Switcher: Info, Settings, Billing */}
                <View style={styles.profileSubTabRow}>
                  <TouchableOpacity
                    style={[
                      styles.profileSubTab,
                      profileSubTab === 'info' && styles.profileSubTabActive,
                    ]}
                    onPress={() => setProfileSubTab('info')}
                  >
                    <Ionicons
                      name={profileSubTab === 'info' ? 'information-circle' : 'information-circle-outline'}
                      size={16}
                      color={profileSubTab === 'info' ? colors.primary : colors.onSurfaceVariant}
                    />
                    <Text
                      style={[
                        styles.profileSubTabText,
                        profileSubTab === 'info' && styles.profileSubTabTextActive,
                      ]}
                    >
                      Info
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.profileSubTab,
                      profileSubTab === 'settings' && styles.profileSubTabActive,
                    ]}
                    onPress={() => setProfileSubTab('settings')}
                  >
                    <Ionicons
                      name={profileSubTab === 'settings' ? 'settings' : 'settings-outline'}
                      size={16}
                      color={profileSubTab === 'settings' ? colors.primary : colors.onSurfaceVariant}
                    />
                    <Text
                      style={[
                        styles.profileSubTabText,
                        profileSubTab === 'settings' && styles.profileSubTabTextActive,
                      ]}
                    >
                      Settings
                    </Text>
                  </TouchableOpacity>

                  {userRole === 'OWNER' && (
                    <TouchableOpacity
                      style={[
                        styles.profileSubTab,
                        profileSubTab === 'billing' && styles.profileSubTabActive,
                      ]}
                      onPress={() => setProfileSubTab('billing')}
                    >
                      <Ionicons
                        name={profileSubTab === 'billing' ? 'card' : 'card-outline'}
                        size={16}
                        color={profileSubTab === 'billing' ? colors.primary : colors.onSurfaceVariant}
                      />
                      <Text
                        style={[
                          styles.profileSubTabText,
                          profileSubTab === 'billing' && styles.profileSubTabTextActive,
                        ]}
                      >
                        Billing
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* PROFILE SUB-SECTION: INFO */}
              {profileSubTab === 'info' && (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Account & Database Status</Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Account Email:</Text>
                    <Text style={styles.infoValue}>{profile.email || '—'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Account Status:</Text>
                    <View style={styles.badgeSuccess}>
                      <Text style={styles.badgeSuccessText}>{profile.status || 'ACTIVE'}</Text>
                    </View>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Current Team Role:</Text>
                    <Text style={styles.infoValue}>{userRole}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Active Team:</Text>
                    <Text style={styles.infoValue}>{selectedTeam?.name || '—'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Timezone:</Text>
                    <Text style={styles.infoValue}>{selectedTeam?.timezone || 'UTC'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Backend Database:</Text>
                    <Text style={styles.infoValue}>PostgreSQL (Live)</Text>
                  </View>

                  <TouchableOpacity style={styles.profileLogoutBtn} onPress={handleLogout}>
                    <Text style={styles.profileLogoutText}>Log Out</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* PROFILE SUB-SECTION: BILLING (OWNER ONLY) */}
              {profileSubTab === 'billing' && userRole === 'OWNER' && (
                <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={styles.cardTitle}>Subscription & Seat Billing</Text>
                  <Text style={styles.cardSubtitle}>
                    Seat-based pricing with automated midcycle proration.
                  </Text>
                </View>
              </View>

              {!subscriptionData ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.loadingText}>Loading subscription details...</Text>
                </View>
              ) : (
                <>
                  {/* Current Plan Overview Card */}
                  <View style={styles.billingPlanHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.billingPlanName}>
                        {subscriptionData.planDetails?.name || subscriptionData.planTier}
                      </Text>
                      <Text style={styles.billingPlanPrice}>
                        £{(subscriptionData.unitPriceCents / 100).toFixed(2)} / staff seat / month
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.roleBadge,
                        subscriptionData.status === 'TRIALING'
                          ? styles.badgeWarning
                          : styles.badgeSuccess,
                      ]}
                    >
                      <Text
                        style={[
                          styles.roleBadgeText,
                          subscriptionData.status === 'TRIALING'
                            ? styles.badgeWarningText
                            : styles.badgeSuccessText,
                        ]}
                      >
                        {subscriptionData.status === 'TRIALING'
                          ? `14-Day Free Trial (${subscriptionData.trialDaysRemaining}d left)`
                          : subscriptionData.status}
                      </Text>
                    </View>
                  </View>

                  {/* Seat Utilization Bar */}
                  <View style={styles.seatUtilizationCard}>
                    <View style={styles.seatUtilHeader}>
                      <Text style={styles.seatUtilTitle}>Active Staff Seat Utilization</Text>
                      <Text style={styles.seatUtilNumbers}>
                        {subscriptionData.activeStaffCount} / {subscriptionData.seatCount} seats used
                      </Text>
                    </View>
                    <View style={styles.progressBarTrack}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${Math.min(
                              100,
                              Math.round(
                                (subscriptionData.activeStaffCount /
                                  Math.max(1, subscriptionData.seatCount)) *
                                  100
                              )
                            )}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.seatUtilHint}>
                      Only active STAFF members require billable seats. Managers and Owners are free.
                    </Text>
                  </View>

                  {/* Plan Tier Selection */}
                  <Text style={[styles.sectionHeading, { marginTop: spacing.lg }]}>
                    Select Plan Tier
                  </Text>
                  <View style={styles.planTiersRow}>
                    {subscriptionData.availablePlans?.map((plan: any) => {
                      const isSelected = selectedPlanTier === plan.tier;
                      return (
                        <TouchableOpacity
                          key={plan.tier}
                          style={[
                            styles.planTierCard,
                            isSelected && styles.planTierCardActive,
                          ]}
                          onPress={() => handleSelectPlanTier(plan.tier)}
                        >
                          <Text
                            style={[
                              styles.planTierTitle,
                              isSelected && styles.planTierTitleActive,
                            ]}
                          >
                            {plan.name}
                          </Text>
                          <Text style={styles.planTierPrice}>
                            £{(plan.unitPriceCents / 100).toFixed(2)}/seat
                          </Text>
                          <Text style={styles.planTierDesc} numberOfLines={2}>
                            {plan.description}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Seat Stepper Midcycle */}
                  <Text style={[styles.sectionHeading, { marginTop: spacing.lg }]}>
                    Staff Seat Allocation
                  </Text>
                  <View style={styles.seatStepperCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.seatStepperLabel}>Total Allowed Staff Seats</Text>
                      <Text style={styles.seatStepperSub}>
                        Minimum {Math.max(subscriptionData.activeStaffCount, 1)} seats required for active staff
                      </Text>
                    </View>
                    <View style={styles.stepperControlsRow}>
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() => handleChangeSeatCount(-1)}
                        disabled={targetSeatCount <= Math.max(subscriptionData.activeStaffCount, 1)}
                      >
                        <Ionicons
                          name="remove"
                          size={18}
                          color={
                            targetSeatCount <= Math.max(subscriptionData.activeStaffCount, 1)
                              ? colors.onSurfaceVariant
                              : colors.primary
                          }
                        />
                      </TouchableOpacity>
                      <Text style={styles.stepperValue}>{targetSeatCount}</Text>
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() => handleChangeSeatCount(1)}
                      >
                        <Ionicons name="add" size={18} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Proration Preview Box */}
                  {prorationPreview && (
                    <View style={styles.prorationCard}>
                      <View style={styles.prorationHeaderRow}>
                        <Ionicons name="flash" size={16} color={colors.primary} />
                        <Text style={styles.prorationHeader}>Midcycle Proration Breakdown</Text>
                      </View>
                      <View style={styles.prorationRow}>
                        <Text style={styles.prorationLabel}>Current Monthly Rate:</Text>
                        <Text style={styles.prorationVal}>
                          £{(prorationPreview.currentMonthlyTotalCents / 100).toFixed(2)} / mo
                        </Text>
                      </View>
                      <View style={styles.prorationRow}>
                        <Text style={styles.prorationLabel}>New Monthly Rate:</Text>
                        <Text style={styles.prorationVal}>
                          £{(prorationPreview.newMonthlyTotalCents / 100).toFixed(2)} / mo
                        </Text>
                      </View>
                      <View style={styles.prorationRow}>
                        <Text style={styles.prorationLabel}>Cycle Days Remaining:</Text>
                        <Text style={styles.prorationVal}>
                          {prorationPreview.remainingDays} days
                        </Text>
                      </View>
                      <View style={[styles.prorationRow, styles.prorationDeltaHighlight]}>
                        <Text style={styles.prorationDeltaLabel}>
                          {prorationPreview.proratedDeltaCents >= 0
                            ? 'Prorated Adjustment Due Today:'
                            : 'Prorated Credit Applied to Next Cycle:'}
                        </Text>
                        <Text
                          style={[
                            styles.prorationDeltaVal,
                            prorationPreview.proratedDeltaCents < 0 && { color: colors.success },
                          ]}
                        >
                          {prorationPreview.proratedDeltaCents >= 0 ? '+' : '-'}£
                          {(Math.abs(prorationPreview.proratedDeltaCents) / 100).toFixed(2)}{' '}
                          {prorationPreview.currency}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Action Button */}
                  <TouchableOpacity
                    style={[
                      styles.confirmPlanBtn,
                      updatingSubscription && { opacity: 0.6 },
                    ]}
                    onPress={handleApplySubscriptionUpdate}
                    disabled={updatingSubscription}
                  >
                    <Text style={styles.confirmPlanBtnText}>
                      {updatingSubscription ? 'Processing...' : 'Apply Plan & Seat Changes'}
                    </Text>
                  </TouchableOpacity>

                  {/* Recent Billing Invoices */}
                  <View style={[styles.sectionHeadingRow, { marginTop: spacing.xl }]}>
                    <Ionicons name="receipt-outline" size={18} color={colors.primary} />
                    <Text style={styles.sectionHeading}>Invoices & Billing History</Text>
                  </View>
                  {subscriptionData.recentEvents?.length === 0 ? (
                    <View style={styles.emptyBox}>
                      <Text style={styles.emptyText}>No previous billing invoices.</Text>
                    </View>
                  ) : (
                    subscriptionData.recentEvents?.map((ev: any) => (
                      <View key={ev.id} style={styles.historySwapRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.historySwapTitle}>{ev.description}</Text>
                          <Text style={styles.historySwapSub}>
                            {new Date(ev.created_at).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}{' '}
                            • {ev.type}
                          </Text>
                        </View>
                        <Text style={styles.invoiceAmountText}>
                          {ev.prorated_amount_cents !== 0
                            ? `${ev.prorated_amount_cents > 0 ? '+' : ''}£${(
                                ev.prorated_amount_cents / 100
                              ).toFixed(2)}`
                            : `£${(ev.amount_cents / 100).toFixed(2)}`}
                        </Text>
                      </View>
                    ))
                  )}
                </>
              )}
            </View>
          )}

          {/* PROFILE SUB-SECTION: SETTINGS */}
          {profileSubTab === 'settings' && (
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={styles.cardTitle}>User Settings & Preferences</Text>
                  <Text style={styles.cardSubtitle}>
                    Settings are synced across all your devices and respected by the server.
                  </Text>
                </View>
              </View>

              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionTitle}>Notifications & Alerts</Text>

                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>Push Notifications</Text>
                    <Text style={styles.settingDesc}>
                      Receive push alerts on your mobile device for shift and swap updates.
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.toggleBtn,
                      (userSettings?.pushNotifications ?? true)
                        ? styles.toggleBtnActive
                        : styles.toggleBtnInactive,
                    ]}
                    onPress={() =>
                      handleToggleSetting(
                        'pushNotifications',
                        userSettings?.pushNotifications ?? true
                      )
                    }
                  >
                    <Text
                      style={[
                        styles.toggleBtnText,
                        (userSettings?.pushNotifications ?? true)
                          ? styles.toggleBtnTextActive
                          : styles.toggleBtnTextInactive,
                      ]}
                    >
                      {(userSettings?.pushNotifications ?? true) ? 'ON' : 'OFF'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>Email Notifications</Text>
                    <Text style={styles.settingDesc}>
                      Receive digest emails for weekly schedule publications.
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.toggleBtn,
                      (userSettings?.emailNotifications ?? true)
                        ? styles.toggleBtnActive
                        : styles.toggleBtnInactive,
                    ]}
                    onPress={() =>
                      handleToggleSetting(
                        'emailNotifications',
                        userSettings?.emailNotifications ?? true
                      )
                    }
                  >
                    <Text
                      style={[
                        styles.toggleBtnText,
                        (userSettings?.emailNotifications ?? true)
                          ? styles.toggleBtnTextActive
                          : styles.toggleBtnTextInactive,
                      ]}
                    >
                      {(userSettings?.emailNotifications ?? true) ? 'ON' : 'OFF'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>Shift Reminders</Text>
                    <Text style={styles.settingDesc}>
                      Get reminded 2 hours before your upcoming scheduled shifts.
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.toggleBtn,
                      (userSettings?.shiftReminders ?? true)
                        ? styles.toggleBtnActive
                        : styles.toggleBtnInactive,
                    ]}
                    onPress={() =>
                      handleToggleSetting(
                        'shiftReminders',
                        userSettings?.shiftReminders ?? true
                      )
                    }
                  >
                    <Text
                      style={[
                        styles.toggleBtnText,
                        (userSettings?.shiftReminders ?? true)
                          ? styles.toggleBtnTextActive
                          : styles.toggleBtnTextInactive,
                      ]}
                    >
                      {(userSettings?.shiftReminders ?? true) ? 'ON' : 'OFF'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>Swap & Open Shift Alerts</Text>
                    <Text style={styles.settingDesc}>
                      Instant notifications when a colleague offers or requests a shift swap.
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.toggleBtn,
                      (userSettings?.swapAlerts ?? true)
                        ? styles.toggleBtnActive
                        : styles.toggleBtnInactive,
                    ]}
                    onPress={() =>
                      handleToggleSetting(
                        'swapAlerts',
                        userSettings?.swapAlerts ?? true
                      )
                    }
                  >
                    <Text
                      style={[
                        styles.toggleBtnText,
                        (userSettings?.swapAlerts ?? true)
                          ? styles.toggleBtnTextActive
                          : styles.toggleBtnTextInactive,
                      ]}
                    >
                      {(userSettings?.swapAlerts ?? true) ? 'ON' : 'OFF'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionTitle}>Offline & Sync Preferences</Text>

                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>Offline Auto-Cache</Text>
                    <Text style={styles.settingDesc}>
                      Automatically cache upcoming shifts locally for offline view when network is unavailable.
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.toggleBtn,
                      (userSettings?.autoSyncOffline ?? true)
                        ? styles.toggleBtnActive
                        : styles.toggleBtnInactive,
                    ]}
                    onPress={() =>
                      handleToggleSetting(
                        'autoSyncOffline',
                        userSettings?.autoSyncOffline ?? true
                      )
                    }
                  >
                    <Text
                      style={[
                        styles.toggleBtnText,
                        (userSettings?.autoSyncOffline ?? true)
                          ? styles.toggleBtnTextActive
                          : styles.toggleBtnTextInactive,
                      ]}
                    >
                      {(userSettings?.autoSyncOffline ?? true) ? 'ON' : 'OFF'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionTitle}>Calendar Display</Text>
                <Text style={styles.settingDesc}>
                  Choose your preferred first day of the week on schedule calendars:
                </Text>
                <View style={styles.daySelectorRow}>
                  <TouchableOpacity
                    style={[
                      styles.daySelectorBtn,
                      userSettings?.startDayOfWeek === 1 && styles.daySelectorBtnActive,
                    ]}
                    onPress={() => handleSetStartDayOfWeek(1)}
                  >
                    <Text
                      style={[
                        styles.daySelectorBtnText,
                        userSettings?.startDayOfWeek === 1 && styles.daySelectorBtnTextActive,
                      ]}
                    >
                      Monday
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.daySelectorBtn,
                      userSettings?.startDayOfWeek === 0 && styles.daySelectorBtnActive,
                    ]}
                    onPress={() => handleSetStartDayOfWeek(0)}
                  >
                    <Text
                      style={[
                        styles.daySelectorBtnText,
                        userSettings?.startDayOfWeek === 0 && styles.daySelectorBtnTextActive,
                      ]}
                    >
                      Sunday
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionTitle}>Staff Availability & Shift Preferences</Text>
                <Text style={styles.settingDesc}>
                  Set your advisory working availability so managers can schedule you effectively:
                </Text>

                <View style={styles.prefSubgroup}>
                  <Text style={styles.prefSubgroupLabel}>Preferred Shift Window</Text>
                  <View style={styles.daySelectorRow}>
                    {['Any Time', 'Morning', 'Evening'].map((shiftType) => (
                      <TouchableOpacity
                        key={shiftType}
                        style={[
                          styles.daySelectorBtn,
                          (userSettings?.preferredShiftWindow || 'Any Time') === shiftType &&
                            styles.daySelectorBtnActive,
                        ]}
                        onPress={() => handleToggleSetting('preferredShiftWindow', shiftType)}
                      >
                        <Text
                          style={[
                            styles.daySelectorBtnText,
                            (userSettings?.preferredShiftWindow || 'Any Time') === shiftType &&
                              styles.daySelectorBtnTextActive,
                          ]}
                        >
                          {shiftType}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.prefSubgroup}>
                  <Text style={styles.prefSubgroupLabel}>Target Weekly Hours</Text>
                  <View style={styles.daySelectorRow}>
                    {['20 hrs', '30 hrs', '40 hrs'].map((hours) => (
                      <TouchableOpacity
                        key={hours}
                        style={[
                          styles.daySelectorBtn,
                          (userSettings?.targetHours || '40 hrs') === hours &&
                            styles.daySelectorBtnActive,
                        ]}
                        onPress={() => handleToggleSetting('targetHours', hours)}
                      >
                        <Text
                          style={[
                            styles.daySelectorBtnText,
                            (userSettings?.targetHours || '40 hrs') === hours &&
                              styles.daySelectorBtnTextActive,
                          ]}
                        >
                          {hours}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            </View>
          )}
        </View>
      )}
        </>
      )}
      </ScrollView>
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
              onBlur={() => setShiftRoleName((v) => v.trimEnd())}
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
                  onBlur={() => setShiftDate((v) => v.trimEnd())}
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
                  onBlur={() => setShiftStartHour((v) => v.trimEnd())}
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
                  onBlur={() => setShiftEndHour((v) => v.trimEnd())}
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
              onBlur={() => setShiftNotes((v) => v.trimEnd())}
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
              onBlur={() => setNewTeamName((v) => v.trimEnd())}
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
              onBlur={() => setInviteEmail((v) => v.trimEnd())}
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
              onBlur={() => setJoinToken((v) => v.trimEnd())}
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

      {/* REQUEST SHIFT SWAP MODAL */}
      <Modal visible={showRequestSwapModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Request Shift Swap</Text>
            <Text style={styles.modalSubtitle}>
              Propose a colleague to take over this shift, or offer it to the team as an open shift.
            </Text>

            {swapConflictError ? (
              <View style={styles.conflictBanner}>
                <Text style={styles.conflictText}>{swapConflictError}</Text>
              </View>
            ) : null}

            {swapTargetShift && (
              <View style={styles.selectedShiftSummary}>
                <Text style={styles.selectedShiftTitle}>
                  {swapTargetShift.roleName || 'Shift'}
                </Text>
                <Text style={styles.selectedShiftTime}>
                  {new Date(swapTargetShift.startTime).toLocaleDateString([], {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}{' '}
                  •{' '}
                  {new Date(swapTargetShift.startTime).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  –{' '}
                  {new Date(swapTargetShift.endTime).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            )}

            <Text style={styles.inputLabel}>Swap Type</Text>
            <View style={styles.swapTypeSelectorRow}>
              <TouchableOpacity
                style={[
                  styles.swapTypeBtn,
                  swapType === 'DIRECT_SWAP' && styles.swapTypeBtnActive,
                ]}
                onPress={() => setSwapType('DIRECT_SWAP')}
              >
                <Text
                  style={[
                    styles.swapTypeBtnText,
                    swapType === 'DIRECT_SWAP' && styles.swapTypeBtnTextActive,
                  ]}
                >
                  Direct Colleague Swap
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.swapTypeBtn,
                  swapType === 'OPEN_SHIFT' && styles.swapTypeBtnActive,
                ]}
                onPress={() => setSwapType('OPEN_SHIFT')}
              >
                <Text
                  style={[
                    styles.swapTypeBtnText,
                    swapType === 'OPEN_SHIFT' && styles.swapTypeBtnTextActive,
                  ]}
                >
                  Offer as Open Shift
                </Text>
              </TouchableOpacity>
            </View>

            {swapType === 'DIRECT_SWAP' && (
              <>
                <Text style={styles.inputLabel}>Select Colleague</Text>
                <ScrollView horizontal style={styles.assigneePicker}>
                  {teamMembers
                    .filter(
                      (m) =>
                        m.userId !== (dashboardData?.profile?.id || initialUser?.id)
                    )
                    .map((m) => (
                      <TouchableOpacity
                        key={m.userId}
                        style={[
                          styles.assigneeChoice,
                          swapTargetUserId === m.userId && styles.assigneeChoiceActive,
                        ]}
                        onPress={() => setSwapTargetUserId(m.userId)}
                      >
                        <Text
                          style={[
                            styles.assigneeChoiceText,
                            swapTargetUserId === m.userId &&
                              styles.assigneeChoiceTextActive,
                          ]}
                        >
                          {m.firstName} ({m.role})
                        </Text>
                      </TouchableOpacity>
                    ))}
                </ScrollView>
              </>
            )}

            <Text style={styles.inputLabel}>Reason (Optional)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Doctor appointment, Family emergency"
              placeholderTextColor={colors.onSurfaceVariant}
              value={swapReason}
              onChangeText={setSwapReason}
              onBlur={() => setSwapReason((v) => v.trimEnd())}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowRequestSwapModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmit, submittingSwap && { opacity: 0.6 }]}
                onPress={handleSubmitSwapRequest}
                disabled={submittingSwap}
              >
                <Text style={styles.modalSubmitText}>
                  {submittingSwap ? 'Submitting...' : 'Submit Request'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* NOTIFICATIONS MODAL */}
      <Modal visible={showNotificationsModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.notifModalCard}>
            <View style={styles.notifModalHeader}>
              <View style={styles.notifHeaderTitleRow}>
                <Text style={styles.modalTitle}>Notifications</Text>
                {unreadNotifCount > 0 && (
                  <View style={styles.notifBadgeHeader}>
                    <Text style={styles.notifBadgeText}>{unreadNotifCount} new</Text>
                  </View>
                )}
              </View>
              <View style={styles.notifHeaderActions}>
                {unreadNotifCount > 0 && (
                  <TouchableOpacity
                    style={styles.markAllReadBtn}
                    onPress={handleMarkAllNotifsRead}
                  >
                    <Text style={styles.markAllReadText}>Mark all read</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.closeNotifBtn}
                  onPress={() => setShowNotificationsModal(false)}
                >
                  <Ionicons name="close" size={20} color={colors.onSurfaceVariant} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView style={styles.notifScrollList}>
              {notifications.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Ionicons
                    name="notifications-outline"
                    size={40}
                    color={colors.onSurfaceVariant}
                    style={{ marginBottom: spacing.xs }}
                  />
                  <Text style={styles.emptyText}>No notifications</Text>
                  <Text style={styles.emptySubtext}>
                    You're completely caught up with all shift changes and swap updates!
                  </Text>
                </View>
              ) : (
                notifications.map((item) => {
                  const isUnread = !item.is_read;
                  const createdAtDate = item.created_at ? new Date(item.created_at) : null;
                  const timeFormatted = createdAtDate
                    ? createdAtDate.toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '';

                  let iconName: React.ComponentProps<typeof Ionicons>['name'] = isUnread
                    ? 'notifications'
                    : 'notifications-outline';
                  let iconColor = isUnread ? colors.primary : colors.onSurfaceVariant;
                  if (item.type?.includes('SHIFT_CREATED')) {
                    iconName = isUnread ? 'calendar' : 'calendar-outline';
                    iconColor = isUnread ? colors.primary : colors.onSurfaceVariant;
                  } else if (item.type?.includes('SHIFT_CANCELLED')) {
                    iconName = isUnread ? 'close-circle' : 'close-circle-outline';
                    iconColor = isUnread ? colors.error : colors.onSurfaceVariant;
                  } else if (item.type?.includes('SWAP_REQUESTED')) {
                    iconName = isUnread ? 'swap-horizontal' : 'swap-horizontal-outline';
                    iconColor = isUnread ? colors.warning : colors.onSurfaceVariant;
                  } else if (item.type?.includes('SWAP_APPROVED')) {
                    iconName = isUnread ? 'checkmark-circle' : 'checkmark-circle-outline';
                    iconColor = isUnread ? colors.success : colors.onSurfaceVariant;
                  } else if (item.type?.includes('SWAP_REJECTED')) {
                    iconName = isUnread ? 'close-circle' : 'close-circle-outline';
                    iconColor = isUnread ? colors.error : colors.onSurfaceVariant;
                  }

                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.notifItem, isUnread && styles.notifItemUnread]}
                      onPress={() => handleMarkNotifRead(item.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.notifItemIconContainer}>
                        <Ionicons name={iconName} size={20} color={iconColor} />
                      </View>
                      <View style={styles.notifItemBody}>
                        <View style={styles.notifItemTopRow}>
                          <Text
                            style={[
                              styles.notifItemTitle,
                              isUnread && styles.notifItemTitleUnread,
                            ]}
                          >
                            {item.title}
                          </Text>
                          {isUnread && <View style={styles.unreadDot} />}
                        </View>
                        <Text style={styles.notifItemDesc}>{item.body}</Text>
                        {timeFormatted ? (
                          <Text style={styles.notifItemTime}>{timeFormatted}</Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>


      {/* STICKY BOTTOM NAVIGATION BAR */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={[styles.bottomNavItem, activeTab === 'feed' && styles.bottomNavItemActive]}
          onPress={() => setActiveTab('feed')}
        >
          <Ionicons
            name={activeTab === 'feed' ? 'newspaper' : 'newspaper-outline'}
            size={22}
            color={activeTab === 'feed' ? colors.primary : colors.onSurfaceVariant}
            style={activeTab === 'feed' && styles.bottomNavIconActive}
          />
          <Text style={[styles.bottomNavLabel, activeTab === 'feed' && styles.bottomNavLabelActive]}>
            Feed
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.bottomNavItem, activeTab === 'swaps' && styles.bottomNavItemActive]}
          onPress={() => setActiveTab('swaps')}
        >
          <View style={styles.bottomNavIconWrapper}>
            <Ionicons
              name={activeTab === 'swaps' ? 'swap-horizontal' : 'swap-horizontal-outline'}
              size={22}
              color={activeTab === 'swaps' ? colors.primary : colors.onSurfaceVariant}
              style={activeTab === 'swaps' && styles.bottomNavIconActive}
            />
            {teamSwaps.filter((sw) => sw.status === 'REQUESTED').length > 0 && (
              <View style={styles.bottomNavBadge}>
                <Text style={styles.bottomNavBadgeText}>
                  {teamSwaps.filter((sw) => sw.status === 'REQUESTED').length}
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.bottomNavLabel, activeTab === 'swaps' && styles.bottomNavLabelActive]}>
            Swaps
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.bottomNavItem, activeTab === 'shifts' && styles.bottomNavItemActive]}
          onPress={() => setActiveTab('shifts')}
        >
          <Ionicons
            name={activeTab === 'shifts' ? 'calendar' : 'calendar-outline'}
            size={22}
            color={activeTab === 'shifts' ? colors.primary : colors.onSurfaceVariant}
            style={activeTab === 'shifts' && styles.bottomNavIconActive}
          />
          <Text style={[styles.bottomNavLabel, activeTab === 'shifts' && styles.bottomNavLabelActive]}>
            Shifts
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.bottomNavItem, activeTab === 'roster' && styles.bottomNavItemActive]}
          onPress={() => setActiveTab('roster')}
        >
          <Ionicons
            name={activeTab === 'roster' ? 'people' : 'people-outline'}
            size={22}
            color={activeTab === 'roster' ? colors.primary : colors.onSurfaceVariant}
            style={activeTab === 'roster' && styles.bottomNavIconActive}
          />
          <Text style={[styles.bottomNavLabel, activeTab === 'roster' && styles.bottomNavLabelActive]}>
            Roster
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.bottomNavItem, activeTab === 'profile' && styles.bottomNavItemActive]}
          onPress={() => setActiveTab('profile')}
        >
          <Ionicons
            name={activeTab === 'profile' ? 'person' : 'person-outline'}
            size={22}
            color={activeTab === 'profile' ? colors.primary : colors.onSurfaceVariant}
            style={activeTab === 'profile' && styles.bottomNavIconActive}
          />
          <Text style={[styles.bottomNavLabel, activeTab === 'profile' && styles.bottomNavLabelActive]}>
            Profile
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  contentContainer: {
    padding: spacing.md,
    paddingTop: spacing.xxl + spacing.sm,
    paddingBottom: 100,
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
  removePill: {
    backgroundColor: colors.errorContainer,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    marginLeft: spacing.sm,
  },
  removePillText: {
    ...typography.labelSmall,
    color: colors.onErrorContainer,
    fontWeight: '700',
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
  feedScreenContainer: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  feedListContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: 110,
  },
  feedHeaderContainer: {
    marginBottom: spacing.xs,
  },
  feedTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cursorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  cursorBadgeText: {
    ...typography.labelSmall,
    color: colors.primary,
    fontWeight: '700',
    fontSize: 11,
  },
  activityCenterBox: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: radius.md,
    marginVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activityStatusTitle: {
    ...typography.titleMedium,
    color: colors.onSurface,
    fontWeight: '700',
    marginTop: spacing.md,
    textAlign: 'center',
  },
  activityStatusSubtitle: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  activityErrorBox: {
    backgroundColor: colors.errorContainer,
    borderRadius: radius.md,
    padding: spacing.md,
    marginVertical: spacing.sm,
    alignItems: 'center',
  },
  activityErrorText: {
    ...typography.bodySmall,
    color: colors.onErrorContainer,
    fontWeight: '600',
    textAlign: 'center',
    marginVertical: spacing.xs,
  },
  activityRetryBtn: {
    backgroundColor: colors.error,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    marginTop: spacing.xs,
  },
  activityRetryBtnText: {
    ...typography.labelSmall,
    color: colors.onError,
    fontWeight: '700',
  },
  endOfListBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.xs,
  },
  endOfListText: {
    ...typography.labelSmall,
    color: colors.onSurfaceVariant,
    fontWeight: '600',
  },
  loadingMoreBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  loadingMoreText: {
    ...typography.labelSmall,
    color: colors.onSurfaceVariant,
  },
  activityFeedList: {
    marginTop: spacing.sm,
  },
  activityRow: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.sm,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.border,
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
  swapShiftBtn: {
    backgroundColor: colors.secondaryContainer,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  swapShiftBtnText: {
    ...typography.labelSmall,
    color: colors.onSecondaryContainer,
    fontWeight: '700',
  },
  sectionHeading: {
    ...typography.titleMedium,
    color: colors.onSurface,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  swapCard: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  swapHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  swapTypeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  swapTypeDirect: {
    backgroundColor: colors.primaryContainer,
  },
  swapTypeOpen: {
    backgroundColor: colors.infoContainer,
  },
  swapTypeBadgeText: {
    ...typography.labelSmall,
    color: colors.onSurface,
    fontWeight: '800',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  swapTimestamp: {
    ...typography.labelSmall,
    color: colors.onSurfaceVariant,
  },
  swapShiftTitle: {
    ...typography.titleMedium,
    color: colors.onSurface,
    fontWeight: '700',
  },
  swapShiftTime: {
    ...typography.bodyMedium,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.sm,
  },
  swapParticipantsBox: {
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
    gap: 4,
  },
  swapParticipantText: {
    ...typography.bodySmall,
    color: colors.onSurface,
  },
  swapReasonText: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    fontStyle: 'italic',
    marginTop: 2,
  },
  swapActionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  approveSwapBtn: {
    flex: 1,
    backgroundColor: colors.success,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  approveSwapBtnText: {
    ...typography.labelMedium,
    color: colors.onSuccess,
    fontWeight: '700',
  },
  rejectSwapBtn: {
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.errorContainer,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  rejectSwapBtnText: {
    ...typography.labelMedium,
    color: colors.onErrorContainer,
    fontWeight: '700',
  },
  claimShiftBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  claimShiftBtnText: {
    ...typography.labelMedium,
    color: colors.onPrimary,
    fontWeight: '700',
  },
  statusWaitBadge: {
    backgroundColor: colors.surfaceVariant,
    padding: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  statusWaitText: {
    ...typography.labelSmall,
    color: colors.onSurfaceVariant,
    fontWeight: '600',
  },
  historySwapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  historySwapTitle: {
    ...typography.bodyMedium,
    color: colors.onSurface,
    fontWeight: '600',
  },
  historySwapSub: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
  selectedShiftSummary: {
    backgroundColor: colors.surfaceContainer,
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
  },
  selectedShiftTitle: {
    ...typography.titleSmall,
    color: colors.primary,
    fontWeight: '700',
  },
  selectedShiftTime: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
  swapTypeSelectorRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  swapTypeBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  swapTypeBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  swapTypeBtnText: {
    ...typography.labelSmall,
    color: colors.onSurface,
    fontWeight: '600',
  },
  swapTypeBtnTextActive: {
    color: colors.onPrimary,
    fontWeight: '700',
  },
  badgeWarning: {
    backgroundColor: colors.warningContainer,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  badgeWarningText: {
    ...typography.labelSmall,
    color: colors.onWarningContainer,
    fontWeight: '700',
  },
  billingPlanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainer,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  billingPlanName: {
    ...typography.titleLarge,
    color: colors.primary,
    fontWeight: '800',
  },
  billingPlanPrice: {
    ...typography.bodyMedium,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  seatUtilizationCard: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  seatUtilHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  seatUtilTitle: {
    ...typography.titleSmall,
    color: colors.onSurface,
    fontWeight: '700',
  },
  seatUtilNumbers: {
    ...typography.labelMedium,
    color: colors.primary,
    fontWeight: '700',
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: colors.surfaceVariant,
    borderRadius: radius.full,
    overflow: 'hidden',
    marginVertical: spacing.xs,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: radius.full,
  },
  seatUtilHint: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    fontSize: 11,
    marginTop: 2,
  },
  planTiersRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  planTierCard: {
    flex: 1,
    backgroundColor: colors.surfaceContainer,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  planTierCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryContainer,
  },
  planTierTitle: {
    ...typography.titleSmall,
    color: colors.onSurface,
    fontWeight: '700',
    fontSize: 13,
  },
  planTierTitleActive: {
    color: colors.onPrimaryContainer,
  },
  planTierPrice: {
    ...typography.labelMedium,
    color: colors.primary,
    fontWeight: '800',
    marginTop: 2,
  },
  planTierDesc: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    fontSize: 10,
    marginTop: 4,
  },
  seatStepperCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainer,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  seatStepperLabel: {
    ...typography.titleSmall,
    color: colors.onSurface,
    fontWeight: '700',
  },
  seatStepperSub: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    fontSize: 11,
    marginTop: 2,
  },
  stepperControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: {
    color: colors.onPrimary,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 22,
  },
  stepperValue: {
    ...typography.titleMedium,
    color: colors.onSurface,
    fontWeight: '800',
    minWidth: 28,
    textAlign: 'center',
  },
  prorationCard: {
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  prorationHeader: {
    ...typography.titleSmall,
    color: colors.primary,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  prorationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  prorationLabel: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
  prorationVal: {
    ...typography.bodySmall,
    color: colors.onSurface,
    fontWeight: '600',
  },
  prorationDeltaHighlight: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  prorationDeltaLabel: {
    ...typography.bodyMedium,
    color: colors.onSurface,
    fontWeight: '700',
  },
  prorationDeltaVal: {
    ...typography.titleMedium,
    color: colors.primary,
    fontWeight: '800',
  },
  confirmPlanBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  confirmPlanBtnText: {
    ...typography.labelLarge,
    color: colors.onPrimary,
    fontWeight: '700',
  },
  invoiceAmountText: {
    ...typography.titleSmall,
    color: colors.primary,
    fontWeight: '700',
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  notifBellBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notifBellIcon: {
    fontSize: 18,
  },
  notifBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: colors.error,
    borderRadius: radius.full,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notifBadgeText: {
    color: colors.onError,
    fontSize: 10,
    fontWeight: '800',
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.infoContainer,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.info,
  },
  offlineBannerIcon: {
    fontSize: 22,
  },
  offlineBannerContent: {
    flex: 1,
  },
  offlineBannerTitle: {
    ...typography.titleSmall,
    color: colors.onInfoContainer,
    fontWeight: '700',
  },
  offlineBannerSubtitle: {
    ...typography.bodySmall,
    color: colors.onInfoContainer,
    marginTop: 2,
    lineHeight: 16,
  },
  settingsSection: {
    marginBottom: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingsSectionTitle: {
    ...typography.titleSmall,
    color: colors.primary,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  settingInfo: {
    flex: 1,
    paddingRight: spacing.md,
  },
  settingLabel: {
    ...typography.bodyMedium,
    color: colors.onSurface,
    fontWeight: '700',
  },
  settingDesc: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    marginTop: 2,
    lineHeight: 16,
  },
  toggleBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    minWidth: 54,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: colors.primary,
  },
  toggleBtnInactive: {
    backgroundColor: colors.surfaceContainerHighest,
  },
  toggleBtnText: {
    ...typography.labelSmall,
    fontWeight: '800',
  },
  toggleBtnTextActive: {
    color: colors.onPrimary,
  },
  toggleBtnTextInactive: {
    color: colors.onSurfaceVariant,
  },
  daySelectorRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  daySelectorBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceContainer,
    borderRadius: radius.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  daySelectorBtnActive: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primary,
  },
  daySelectorBtnText: {
    ...typography.labelMedium,
    color: colors.onSurface,
    fontWeight: '600',
  },
  daySelectorBtnTextActive: {
    color: colors.onPrimaryContainer,
    fontWeight: '700',
  },
  notifModalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    width: '100%',
    maxHeight: '85%',
  },
  notifModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  notifHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  notifBadgeHeader: {
    backgroundColor: colors.errorContainer,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  notifHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  markAllReadBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: radius.sm,
  },
  markAllReadText: {
    ...typography.labelSmall,
    color: colors.primary,
    fontWeight: '700',
  },
  closeNotifBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeNotifText: {
    color: colors.onSurfaceVariant,
    fontSize: 16,
    fontWeight: '700',
  },
  notifScrollList: {
    maxHeight: 460,
  },
  notifItem: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  notifItemUnread: {
    backgroundColor: colors.surfaceContainerHigh,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  notifItemIconContainer: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifItemIcon: {
    fontSize: 18,
  },
  notifItemBody: {
    flex: 1,
  },
  notifItemTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  notifItemTitle: {
    ...typography.titleSmall,
    color: colors.onSurface,
    fontWeight: '600',
  },
  notifItemTitleUnread: {
    fontWeight: '800',
    color: colors.primary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  notifItemDesc: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    lineHeight: 18,
  },
  notifItemTime: {
    ...typography.labelSmall,
    color: colors.onSurfaceVariant,
    fontSize: 11,
    marginTop: 4,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  teamHeaderInfo: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  roleBadgeHeader: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    alignSelf: 'center',
  },
  roleBadgeHeaderText: {
    ...typography.labelMedium,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  prefSubgroup: {
    marginTop: spacing.sm,
  },
  prefSubgroupLabel: {
    ...typography.labelMedium,
    color: colors.onSurface,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surfaceContainerLow,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
    paddingBottom: Platform.OS === 'ios' ? spacing.md : spacing.xs + 2,
    elevation: 8,
  },
  bottomNavItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    minWidth: 56,
  },
  bottomNavItemActive: {},
  bottomNavIconWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomNavIcon: {
    fontSize: 20,
    color: colors.onSurfaceVariant,
    marginBottom: 2,
  },
  bottomNavIconActive: {
    transform: [{ scale: 1.15 }],
  },
  bottomNavLabel: {
    ...typography.labelSmall,
    fontSize: 10,
    color: colors.onSurfaceVariant,
    fontWeight: '500',
  },
  bottomNavLabelActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  bottomNavBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: colors.error,
    borderRadius: radius.full,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bottomNavBadgeText: {
    color: colors.onError,
    fontSize: 9,
    fontWeight: '800',
  },
  profileAvatar: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: {
    ...typography.headlineMedium,
    color: colors.onPrimaryContainer,
    fontWeight: '800',
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  profileHeaderInfo: {
    flex: 1,
  },
  profileName: {
    ...typography.titleLarge,
    color: colors.onSurface,
    fontWeight: '700',
  },
  profileEmail: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  profileBadgeContainer: {
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
  },
  profileSubTabRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainer,
    borderRadius: radius.md,
    padding: 3,
    marginTop: spacing.sm,
    gap: 4,
  },
  profileSubTab: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  profileSubTabActive: {
    backgroundColor: colors.surface,
    elevation: 2,
  },
  profileSubTabText: {
    ...typography.labelMedium,
    color: colors.onSurfaceVariant,
    fontWeight: '600',
  },
  profileSubTabTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  profileLogoutBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.errorContainer,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  profileLogoutText: {
    ...typography.labelLarge,
    color: colors.onErrorContainer,
    fontWeight: '700',
  },
  actionPillContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.md,
  },
  prorationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
  },
});
