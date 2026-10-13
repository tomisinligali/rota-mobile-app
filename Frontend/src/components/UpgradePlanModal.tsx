import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radius } from '../theme/tokens';
import { ApiService } from '../services/api';

interface UpgradePlanModalProps {
  visible: boolean;
  onClose: () => void;
  businessId?: string;
  currentPlanTier?: string;
  onSuccess?: () => void;
}

export const UpgradePlanModal: React.FC<UpgradePlanModalProps> = ({
  visible,
  onClose,
  businessId,
  currentPlanTier = 'STARTER',
  onSuccess,
}) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedTier, setSelectedTier] = useState<'TEAM' | 'BUSINESS'>('TEAM');
  const [loading, setLoading] = useState(false);

  const plans = {
    TEAM: {
      name: 'Team Plan',
      tagline: 'Ideal for growing cafés, shops & restaurants',
      monthlyPrice: '$50',
      monthlySub: 'per month',
      yearlyPrice: '$500',
      yearlySub: 'per year ($41.67/mo)',
      savings: 'Save $100/yr (2 months free)',
      seatsIncluded: 15,
      extraSeatPrice: '$3/mo per extra seat',
      features: [
        'Up to 15 staff members included',
        'Extra staff seats available at $3/month',
        'Unlimited shifts & real-time publication',
        'Automated shift overlap & conflict protection',
        'Direct swaps & open shift claims with manager approval',
        'Role-based permissions (Managers & Owners are free)',
        'Push notifications & email delivery via BullMQ queue',
        '7-day grace period on renewals (never lose schedules)',
      ],
    },
    BUSINESS: {
      name: 'Business Plan',
      tagline: 'Best for multi-location teams & busy venues',
      monthlyPrice: '$120',
      monthlySub: 'per month',
      yearlyPrice: '$1,200',
      yearlySub: 'per year ($100.00/mo)',
      savings: 'Save $240/yr (2 months free)',
      seatsIncluded: 40,
      extraSeatPrice: '$2/mo per extra seat',
      features: [
        'Up to 40 staff members included',
        'Extra staff seats available at $2/month',
        'All Team Plan features included',
        'Multi-team & multi-location shift scheduling',
        'Priority schedule generation & conflict diagnostics',
        'Permanent immutable audit ledger & exportable history',
        'Priority customer support response',
      ],
    },
  };

  const activePlan = plans[selectedTier];
  const isCurrentPlan = currentPlanTier?.toUpperCase() === selectedTier.toUpperCase();

  const handleProceedToCheckout = async () => {
    if (!businessId) {
      Alert.alert('Notice', 'Business ID is missing. Please select an active team first.');
      return;
    }

    setLoading(true);
    try {
      const response = await ApiService.initializeCheckout(businessId, {
        planTier: selectedTier,
        billingCycle,
      });

      if (response?.checkoutUrl) {
        Alert.alert(
          'Flutterwave Checkout',
          `You are being redirected to Flutterwave secure checkout to complete your ${activePlan.name} (${billingCycle}) upgrade.`,
          [
            {
              text: 'Open Checkout',
              onPress: async () => {
                const canOpen = await Linking.canOpenURL(response.checkoutUrl);
                if (canOpen) {
                  await Linking.openURL(response.checkoutUrl);
                } else {
                  Alert.alert('Checkout Link', `Please open: ${response.checkoutUrl}`);
                }
                onClose();
                if (onSuccess) onSuccess();
              },
            },
            {
              text: 'Cancel',
              style: 'cancel',
            },
          ]
        );
      } else {
        Alert.alert('Error', 'Unable to generate checkout URL. Please try again.');
      }
    } catch (err: any) {
      Alert.alert('Checkout Error', err.message || 'Failed to initialize payment checkout.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableWithoutFeedback
          onPress={() => {
            Keyboard.dismiss();
            onClose();
          }}
          accessibilityRole="button"
          accessibilityLabel="Dismiss modal"
        >
          <View style={styles.modalBackdrop} />
        </TouchableWithoutFeedback>
        <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.titleTagRow}>
                <Text style={styles.modalTitle}>Upgrade Plan</Text>
                <View style={styles.currentBadge}>
                  <Text style={styles.currentBadgeText}>Current: {currentPlanTier}</Text>
                </View>
              </View>
              <Text style={styles.modalSubtitle}>
                Unlock larger team capacity, conflict prevention & instant swaps.
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
            {/* Billing Cycle Switcher: Monthly vs Yearly */}
            <View style={styles.cycleToggleContainer}>
              <TouchableOpacity
                style={[
                  styles.cycleToggleBtn,
                  billingCycle === 'monthly' && styles.cycleToggleBtnActive,
                ]}
                onPress={() => setBillingCycle('monthly')}
              >
                <Text
                  style={[
                    styles.cycleToggleText,
                    billingCycle === 'monthly' && styles.cycleToggleTextActive,
                  ]}
                >
                  Monthly
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.cycleToggleBtn,
                  billingCycle === 'yearly' && styles.cycleToggleBtnActive,
                ]}
                onPress={() => setBillingCycle('yearly')}
              >
                <View style={styles.yearlyLabelRow}>
                  <Text
                    style={[
                      styles.cycleToggleText,
                      billingCycle === 'yearly' && styles.cycleToggleTextActive,
                    ]}
                  >
                    Yearly
                  </Text>
                  <View style={styles.saveBadge}>
                    <Text style={styles.saveBadgeText}>SAVE 20%</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>

            {/* Plan Selector Cards */}
            <View style={styles.planCardsRow}>
              {/* Team Plan */}
              <TouchableOpacity
                style={[
                  styles.planOptionCard,
                  selectedTier === 'TEAM' && styles.planOptionCardActive,
                ]}
                onPress={() => setSelectedTier('TEAM')}
              >
                <View style={styles.planCardTop}>
                  <View style={styles.popularBadge}>
                    <Ionicons name="star" size={12} color="#FFFFFF" />
                    <Text style={styles.popularBadgeText}>POPULAR</Text>
                  </View>
                  <Text style={styles.planCardName}>Team</Text>
                  <Text style={styles.planCardPrice}>
                    {billingCycle === 'yearly' ? plans.TEAM.yearlyPrice : plans.TEAM.monthlyPrice}
                  </Text>
                  <Text style={styles.planCardSub}>
                    {billingCycle === 'yearly' ? plans.TEAM.yearlySub : plans.TEAM.monthlySub}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Business Plan */}
              <TouchableOpacity
                style={[
                  styles.planOptionCard,
                  selectedTier === 'BUSINESS' && styles.planOptionCardActive,
                ]}
                onPress={() => setSelectedTier('BUSINESS')}
              >
                <View style={styles.planCardTop}>
                  <View style={[styles.popularBadge, { backgroundColor: colors.secondary }]}>
                    <Ionicons name="flash" size={12} color="#FFFFFF" />
                    <Text style={styles.popularBadgeText}>ENTERPRISE</Text>
                  </View>
                  <Text style={styles.planCardName}>Business</Text>
                  <Text style={styles.planCardPrice}>
                    {billingCycle === 'yearly'
                      ? plans.BUSINESS.yearlyPrice
                      : plans.BUSINESS.monthlyPrice}
                  </Text>
                  <Text style={styles.planCardSub}>
                    {billingCycle === 'yearly'
                      ? plans.BUSINESS.yearlySub
                      : plans.BUSINESS.monthlySub}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Annual Savings Alert */}
            {billingCycle === 'yearly' && (
              <View style={styles.savingsBanner}>
                <Ionicons name="gift-outline" size={18} color={colors.primary} />
                <Text style={styles.savingsBannerText}>{activePlan.savings}</Text>
              </View>
            )}

            {/* Features Breakdown */}
            <View style={styles.featuresCard}>
              <View style={styles.featuresHeaderRow}>
                <Ionicons name="sparkles" size={18} color={colors.primary} />
                <Text style={styles.featuresHeading}>
                  What's included in {activePlan.name}:
                </Text>
              </View>

              <View style={styles.seatPillRow}>
                <View style={styles.seatPill}>
                  <Ionicons name="people" size={14} color={colors.primary} />
                  <Text style={styles.seatPillText}>
                    {activePlan.seatsIncluded} staff seats included
                  </Text>
                </View>
                <View style={styles.seatPill}>
                  <Ionicons name="add-circle-outline" size={14} color={colors.onSurfaceVariant} />
                  <Text style={styles.seatPillText}>{activePlan.extraSeatPrice}</Text>
                </View>
              </View>

              <View style={styles.featureList}>
                {activePlan.features.map((feature, idx) => (
                  <View key={idx} style={styles.featureItemRow}>
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color={colors.success}
                      style={{ marginTop: 2 }}
                    />
                    <Text style={styles.featureItemText}>{feature}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Security Guarantee */}
            <View style={styles.securityRow}>
              <Ionicons name="shield-checkmark-outline" size={16} color={colors.onSurfaceVariant} />
              <Text style={styles.securityText}>
                Secure payments powered by Flutterwave • Cancel or change anytime
              </Text>
            </View>
          </ScrollView>

          {/* Action CTA */}
          <View style={styles.footerContainer}>
            <TouchableOpacity
              style={[
                styles.checkoutBtn,
                (loading || isCurrentPlan) && styles.checkoutBtnDisabled,
              ]}
              onPress={handleProceedToCheckout}
              disabled={loading || isCurrentPlan}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : isCurrentPlan ? (
                <View style={styles.btnContentRow}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.onPrimary} />
                  <Text style={styles.checkoutBtnText}>
                    Active Plan: {activePlan.name}
                  </Text>
                </View>
              ) : (
                <View style={styles.btnContentRow}>
                  <Text style={styles.checkoutBtnText}>
                    Continue to Flutterwave Checkout ({billingCycle === 'yearly' ? activePlan.yearlyPrice : activePlan.monthlyPrice})
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color={colors.onPrimary} />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
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
    maxHeight: '90%',
    paddingTop: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceVariant,
  },
  titleTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  modalTitle: {
    ...typography.titleLarge,
    color: colors.onSurface,
    fontWeight: '700',
  },
  currentBadge: {
    backgroundColor: colors.surfaceContainerHighest,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  currentBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    marginTop: 4,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  scrollBody: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  cycleToggleContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: radius.md,
    padding: 3,
    marginBottom: spacing.md,
  },
  cycleToggleBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  cycleToggleBtnActive: {
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cycleToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
  },
  cycleToggleTextActive: {
    color: colors.primary,
  },
  yearlyLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  saveBadge: {
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.full,
  },
  saveBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.onPrimaryContainer,
  },
  planCardsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  planOptionCard: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  planOptionCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  planCardTop: {
    alignItems: 'flex-start',
  },
  popularBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
    marginBottom: spacing.xs,
  },
  popularBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  planCardName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.onSurface,
  },
  planCardPrice: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.primary,
    marginTop: 4,
  },
  planCardSub: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  savingsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primaryContainer,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  savingsBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.onPrimaryContainer,
  },
  featuresCard: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  featuresHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  featuresHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.onSurface,
  },
  seatPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  seatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  seatPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.onSurface,
  },
  featureList: {
    gap: spacing.sm,
  },
  featureItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  featureItemText: {
    flex: 1,
    fontSize: 13,
    color: colors.onSurface,
    lineHeight: 18,
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
  },
  securityText: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
  footerContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceVariant,
    backgroundColor: colors.surface,
  },
  checkoutBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkoutBtnDisabled: {
    opacity: 0.6,
  },
  btnContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  checkoutBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.onPrimary,
  },
});
