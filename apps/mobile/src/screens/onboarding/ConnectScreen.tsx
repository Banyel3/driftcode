import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Switch,
  type TextInput as TextInputType,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { RootStackScreenProps } from '../../navigation/types';
import { useConnectionStore } from '../../store';
import { useTestConnection } from '../../hooks/useTestConnection';
import {
  COLORS,
  SPACING,
  FONT_SIZE,
  FONT_WEIGHT,
  BORDER_RADIUS,
  DEMO_SERVER_URL,
  DEFAULT_SERVER_USERNAME,
} from '../../constants';

type Props = RootStackScreenProps<'Connect'>;

export function ConnectScreen({ navigation, route }: Props) {
  const isDemo = route.params?.demo === true;

  // ── Store ──────────────────────────────────────────────────────────────────
  const storedUrl = useConnectionStore((s) => s.serverUrl);
  const storedUsername = useConnectionStore((s) => s.serverUsername);
  const storedPassword = useConnectionStore((s) => s.serverPassword);
  const rememberCredentials = useConnectionStore((s) => s.rememberCredentials);
  const setRememberCredentials = useConnectionStore((s) => s.setRememberCredentials);
  const setServerUrl = useConnectionStore((s) => s.setServerUrl);
  const setServerUsername = useConnectionStore((s) => s.setServerUsername);
  const setServerPassword = useConnectionStore((s) => s.setServerPassword);
  const setIsConnected = useConnectionStore((s) => s.setIsConnected);
  const setOnboardingComplete = useConnectionStore((s) => s.setOnboardingComplete);

  // ── Local form state — pre-fill from store when remember is on ─────────────
  const [url, setUrl] = useState(
    isDemo
      ? DEMO_SERVER_URL
      : (rememberCredentials && storedUrl) ? storedUrl : '',
  );
  const [username, setUsername] = useState(storedUsername || DEFAULT_SERVER_USERNAME);
  const [password, setPassword] = useState(
    (rememberCredentials && storedPassword) ? storedPassword : '',
  );
  const [showPassword, setShowPassword] = useState(false);

  // ── Refs for keyboard navigation ───────────────────────────────────────────
  const usernameRef = useRef<TextInputType>(null);
  const passwordRef = useRef<TextInputType>(null);

  // ── Connection test ────────────────────────────────────────────────────────
  const { test, isLoading } = useTestConnection();
  const [testPassed, setTestPassed] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleTest = async () => {
    if (!url.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter a server URL.' });
      return;
    }
    setTestPassed(false);
    setStatusMessage(null);

    const result = await test(url, username, password);
    if (result.ok) {
      setTestPassed(true);
      setStatusMessage({
        type: 'success',
        text: `Connected! opencode ${result.version ?? ''}`.trim(),
      });
    } else {
      setStatusMessage({ type: 'error', text: result.error ?? 'Connection failed.' });
    }
  };

  const handleConnect = async () => {
    if (!url.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter a server URL.' });
      return;
    }

    // If not yet tested (or previous test failed), run one now
    if (!testPassed) {
      const result = await test(url, username, password);
      if (!result.ok) {
        setStatusMessage({ type: 'error', text: result.error ?? 'Connection failed.' });
        return;
      }
    }

    // Normalise URL before persisting
    let normalised = url.trim().replace(/\/$/, '');
    if (!normalised.startsWith('http://') && !normalised.startsWith('https://')) {
      normalised = `https://${normalised}`;
    }

    // Persist to store / SecureStore (setServerUrl/Password respect rememberCredentials)
    setServerUrl(normalised);
    setServerUsername(username);
    setServerPassword(password);
    setOnboardingComplete();
    setIsConnected(true);

    // When navigating here from Settings → "Change Server", go back to Settings.
    // During initial onboarding the stack hasn't been pushed so canGoBack() is false
    // and the navigator switches stacks naturally via the isConnected conditional.
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  // ── Remember-me toggle ─────────────────────────────────────────────────────
  const handleToggleRemember = (value: boolean) => {
    setRememberCredentials(value);
    if (!value) {
      // Clear form fields so the user sees the effect immediately
      setUrl(isDemo ? DEMO_SERVER_URL : '');
      setPassword('');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="arrow-back" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <View style={styles.headerTitles}>
              <Text style={styles.title}>
                {isDemo ? 'Try Demo Server' : 'Connect to Server'}
              </Text>
              <Text style={styles.subtitle}>
                {isDemo
                  ? 'The demo server is rate-limited and has no persistent storage.'
                  : 'Enter your self-hosted opencode server details.'}
              </Text>
            </View>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Server URL */}
            <View style={styles.field}>
              <Text style={styles.label}>Server URL</Text>
              <TextInput
                style={styles.input}
                value={url}
                onChangeText={(v) => {
                  setUrl(v);
                  setTestPassed(false);
                  setStatusMessage(null);
                }}
                placeholder="https://your-server.example.com"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="next"
                onSubmitEditing={() => usernameRef.current?.focus()}
                editable={!isDemo}
                selectTextOnFocus
              />
            </View>

            {/* Username */}
            <View style={styles.field}>
              <Text style={styles.label}>Username</Text>
              <TextInput
                ref={usernameRef}
                style={styles.input}
                value={username}
                onChangeText={(v) => {
                  setUsername(v);
                  setTestPassed(false);
                  setStatusMessage(null);
                }}
                placeholder="opencode"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
            </View>

            {/* Password */}
            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  ref={passwordRef}
                  style={[styles.input, styles.passwordInput]}
                  value={password}
                  onChangeText={(v) => {
                    setPassword(v);
                    setTestPassed(false);
                    setStatusMessage(null);
                  }}
                  placeholder="Your server password"
                  placeholderTextColor={COLORS.textMuted}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleTest}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color={COLORS.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Remember me toggle */}
            {!isDemo && (
              <View style={styles.rememberRow}>
                <View style={styles.rememberLeft}>
                  <Ionicons
                    name={rememberCredentials ? 'bookmark' : 'bookmark-outline'}
                    size={18}
                    color={rememberCredentials ? COLORS.primary : COLORS.textSecondary}
                  />
                  <View style={styles.rememberText}>
                    <Text style={styles.rememberLabel}>Remember credentials</Text>
                    <Text style={styles.rememberHint}>
                      {rememberCredentials
                        ? 'URL and password are saved to this device.'
                        : 'Credentials will not be saved to disk.'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={rememberCredentials}
                  onValueChange={handleToggleRemember}
                  trackColor={{
                    false: COLORS.border,
                    true: COLORS.primary + '80',
                  }}
                  thumbColor={rememberCredentials ? COLORS.primary : COLORS.textMuted}
                  ios_backgroundColor={COLORS.border}
                />
              </View>
            )}

            {/* Status message */}
            {statusMessage && (
              <View
                style={[
                  styles.statusBanner,
                  statusMessage.type === 'success'
                    ? styles.statusBannerSuccess
                    : styles.statusBannerError,
                ]}
              >
                <Ionicons
                  name={statusMessage.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
                  size={16}
                  color={
                    statusMessage.type === 'success' ? COLORS.success : COLORS.error
                  }
                />
                <Text
                  style={[
                    styles.statusText,
                    statusMessage.type === 'success'
                      ? styles.statusTextSuccess
                      : styles.statusTextError,
                  ]}
                >
                  {statusMessage.text}
                </Text>
              </View>
            )}

            {/* Test connection button */}
            <TouchableOpacity
              style={[styles.testButton, isLoading && styles.buttonDisabled]}
              onPress={handleTest}
              activeOpacity={0.7}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={COLORS.textSecondary} />
              ) : (
                <Text style={styles.testButtonText}>Test Connection</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Connect / Save button */}
          <TouchableOpacity
            style={[
              styles.connectButton,
              (!url.trim() || isLoading) && styles.buttonDisabled,
            ]}
            onPress={handleConnect}
            activeOpacity={0.8}
            disabled={!url.trim() || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.connectButtonText}>
                {testPassed ? 'Connect' : 'Test & Connect'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Security note */}
          <View style={styles.securityNote}>
            <Ionicons name="lock-closed" size={14} color={COLORS.textMuted} />
            <Text style={styles.securityText}>
              {rememberCredentials
                ? 'Credentials are stored encrypted on-device using Expo SecureStore. They are never sent anywhere except your own server.'
                : 'Credentials are held in memory only and will be cleared when the app closes.'}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    gap: SPACING.lg,
    flexGrow: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
  },
  backButton: {
    marginTop: 2,
    padding: SPACING.xs,
  },
  headerTitles: {
    flex: 1,
    gap: SPACING.xs,
  },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.text,
  },
  subtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },

  // Form
  form: {
    gap: SPACING.md,
  },
  field: {
    gap: SPACING.xs,
  },
  label: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.textSecondary,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    paddingRight: 44,
  },
  eyeButton: {
    position: 'absolute',
    right: SPACING.md,
    padding: SPACING.xs,
  },

  // Remember me
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    gap: SPACING.md,
  },
  rememberLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  rememberText: {
    flex: 1,
    gap: 2,
  },
  rememberLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.text,
  },
  rememberHint: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    lineHeight: 16,
  },

  // Status banner
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.sm + 2,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
  },
  statusBannerSuccess: {
    backgroundColor: `${COLORS.success}18`,
    borderColor: `${COLORS.success}40`,
  },
  statusBannerError: {
    backgroundColor: `${COLORS.error}18`,
    borderColor: `${COLORS.error}40`,
  },
  statusText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    lineHeight: 18,
  },
  statusTextSuccess: {
    color: COLORS.success,
  },
  statusTextError: {
    color: COLORS.error,
  },

  // Buttons
  testButton: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm + 2,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 44,
    justifyContent: 'center',
  },
  testButtonText: {
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
  },
  connectButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  connectButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
  },
  buttonDisabled: {
    opacity: 0.5,
  },

  // Security note
  securityNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  securityText: {
    flex: 1,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    lineHeight: 18,
  },
});
