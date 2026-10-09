import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { colors, typography, spacing, radius } from '../theme/tokens';

interface BrandLogoProps {
  /** Width/height of the square app-icon mark. */
  iconSize?: number;
  /** Font size of the "Rota" wordmark. */
  textSize?: number;
  /** Whether to show the "Rota" wordmark text. Defaults to true. */
  showText?: boolean;
  /** Render the wordmark light for use on dark/primary backgrounds. */
  onDark?: boolean;
  /**
   * Place the icon mark on a white tile. Needed on colored backgrounds where
   * the icon's own primary-colored square would otherwise blend in.
   */
  plate?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * The Rota brand lockup: the app icon with the "Rota" wordmark beside it.
 * Use this anywhere a logo badge would otherwise appear.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  iconSize = 30,
  textSize = 20,
  showText = true,
  onDark = false,
  plate = false,
  style,
}) => {
  const mark = (
    <Image
      source={require('../../assets/icon.png')}
      style={{
        width: iconSize,
        height: iconSize,
        borderRadius: iconSize >= 40 ? radius.md : radius.sm,
      }}
      resizeMode="contain"
      accessibilityLabel="Rota logo"
    />
  );

  return (
    <View style={[styles.lockup, style]}>
      {plate ? (
        <View style={[styles.plate, { padding: Math.round(iconSize * 0.25) }]}>
          {mark}
        </View>
      ) : (
        mark
      )}
      {showText ? (
        <Text
          style={[
            styles.wordmark,
            { fontSize: textSize, color: onDark ? colors.onPrimary : colors.primary },
          ]}
        >
          Rota
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  lockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  plate: {
    backgroundColor: colors.onPrimary,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  wordmark: {
    ...typography.titleLarge,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
