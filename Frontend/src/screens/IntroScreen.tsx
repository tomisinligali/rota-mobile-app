import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { colors, typography, spacing, radius } from '../theme/tokens';
import { BrandLogo } from '../components/BrandLogo';

interface IntroScreenProps {
  onDone: () => void;
}

interface Slide {
  key: string;
  // Flat-vector onboarding illustrations. Source SVGs live beside the PNGs in
  // assets/illustrations/svg and are rasterized to PNG via `qlmanage`.
  illustration: number;
  title: string;
  description: string;
}

const SLIDES: Slide[] = [
  {
    key: 'schedule',
    illustration: require('../../assets/illustrations/onboarding-1-schedule.png'),
    title: 'Plan shifts faster\npublish in seconds',
    description:
      'Build schedules with ease and keep your whole team aligned without the back-and-forth.',
  },
  {
    key: 'swap',
    illustration: require('../../assets/illustrations/onboarding-2-swap.png'),
    title: 'Swap shifts easily\nwith team approval',
    description:
      'Request trades on the go, set your availability, and get manager approvals instantly.',
  },
  {
    key: 'notify',
    illustration: require('../../assets/illustrations/onboarding-3-notifications.png'),
    title: 'Stay notified when\nschedules change',
    description:
      'Receive live shift updates, direct alerts, and never miss a roster adjustment.',
  },
];

export const IntroScreen: React.FC<IntroScreenProps> = ({ onDone }) => {
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  const isLast = index === SLIDES.length - 1;

  const handleNext = () => {
    if (isLast) {
      onDone();
      return;
    }
    scrollRef.current?.scrollTo({ x: width * (index + 1), animated: true });
  };

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== index) setIndex(next);
  };

  return (
    <View style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <BrandLogo iconSize={30} />
      </View>

      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        style={styles.slidesScroll}
      >
        {SLIDES.map((slide, slideIdx) => (
          <View key={slide.key} style={[styles.slide, { width }]}>
            <Image
              source={slide.illustration}
              style={styles.illustrationImage}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />

            {/* Pagination indicator between illustration base and headline */}
            <View
              style={styles.paginationDots}
              accessibilityRole="tablist"
              accessibilityLabel={`Slide ${slideIdx + 1} of ${SLIDES.length}`}
            >
              {SLIDES.map((_, dotIdx) => (
                <View
                  key={dotIdx}
                  style={[
                    styles.dot,
                    dotIdx === slideIdx ? styles.dotActive : styles.dotInactive,
                  ]}
                />
              ))}
            </View>

            <Text style={styles.slideTitle}>{slide.title}</Text>
            <Text style={styles.slideDescription}>{slide.description}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Bottom Navigation & Action Bar */}
      <View style={styles.footer}>
        {!isLast ? (
          <View style={styles.dualActionRow}>
            <TouchableOpacity
              onPress={onDone}
              accessibilityRole="button"
              accessibilityLabel="Skip onboarding"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.skipButtonText}>Skip</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.nextButton}
              onPress={handleNext}
              accessibilityRole="button"
              accessibilityLabel="Next slide"
            >
              <Text style={styles.nextButtonText}>Next</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.singleActionRow}>
            <TouchableOpacity
              style={styles.getStartedButton}
              onPress={onDone}
              accessibilityRole="button"
              accessibilityLabel="Get started"
            >
              <Text style={styles.getStartedButtonText}>Get started</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  topBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    alignItems: 'flex-start',
  },
  slidesScroll: {
    flex: 1,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  illustrationImage: {
    // The PNG carries its own warm circular backdrop; borderRadius clips the
    // square canvas corners so only the circle shows on the light screen.
    width: 260,
    height: 260,
    borderRadius: 130,
    marginBottom: spacing.xxl,
  },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 7,
    marginBottom: spacing.md,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  dotActive: {
    backgroundColor: colors.primary,
    borderWidth: 0,
  },
  dotInactive: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  slideTitle: {
    ...typography.headlineSmall,
    color: colors.onSurface,
    textAlign: 'center',
    fontWeight: '700',
    lineHeight: 30,
    marginBottom: spacing.md,
  },
  slideDescription: {
    ...typography.bodyMedium,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    fontWeight: '400',
    lineHeight: 22,
    maxWidth: 320,
    alignSelf: 'center',
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.md,
  },
  dualActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  singleActionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  skipButtonText: {
    ...typography.labelMedium,
    fontSize: 14,
    fontWeight: '700',
    color: colors.onSurface,
  },
  nextButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: 12,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onPrimary,
    textAlign: 'center',
  },
  getStartedButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: 15,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  getStartedButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.onPrimary,
    textAlign: 'center',
  },
});
