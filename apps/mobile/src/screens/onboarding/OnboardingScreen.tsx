import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Image,
} from 'react-native';
import type { RootStackScreenProps } from '../../navigation/types';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS } from '../../constants';

type Props = RootStackScreenProps<'Onboarding'>;

export function OnboardingScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Logo / hero */}
        <View style={styles.heroSection}>
          <View style={styles.logoContainer}>
            <Image
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              source={require('../../../assets/icon.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.appName}>DriftCode</Text>
          <Text style={styles.tagline}>AI Coding, Anywhere</Text>
        </View>

        {/* Feature list */}
        <View style={styles.featuresSection}>
          <FeatureRow icon="⚡" text="Full agentic coding sessions from your phone" />
          <FeatureRow icon="🔒" text="Self-hosted — your code never leaves your server" />
          <FeatureRow icon="🌿" text="GitHub integration for branches & pull requests" />
          <FeatureRow icon="📁" text="Browse & edit project files on the go" />
        </View>

        {/* CTA buttons */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Connect')}
          >
            <Text style={styles.primaryButtonText}>Connect to My Server</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Connect', { demo: true })}
          >
            <Text style={styles.secondaryButtonText}>Try Demo Server</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footnote}>
          Requires a self-hosted opencode server.{'\n'}
          See docs at opencode.ai for setup instructions.
        </Text>
      </View>
    </SafeAreaView>
  );
}

// ─── Feature row helper ───────────────────────────────────────────────────────
function FeatureRow({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.featureRow}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    justifyContent: 'space-between',
    paddingTop: SPACING.xxl,
    paddingBottom: SPACING.xl,
  },

  // Hero
  heroSection: {
    alignItems: 'center',
    gap: SPACING.sm,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
    marginBottom: SPACING.sm,
  },
  logo: {
    width: 80,
    height: 80,
  },
  appName: {
    fontSize: FONT_SIZE.xxxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHT.medium,
  },

  // Features
  featuresSection: {
    gap: SPACING.md,
    paddingVertical: SPACING.lg,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  featureIcon: {
    fontSize: FONT_SIZE.xl,
    width: 32,
    textAlign: 'center',
  },
  featureText: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    lineHeight: 22,
  },

  // Actions
  actionsSection: {
    gap: SPACING.md,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
  },
  secondaryButton: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryButtonText: {
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
  },

  // Footnote
  footnote: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
