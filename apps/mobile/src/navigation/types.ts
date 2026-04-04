import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

// ---------------------------------------------------------------------------
// Root stack — wraps onboarding + main tabs
// ---------------------------------------------------------------------------
export type RootStackParamList = {
  Onboarding: undefined;
  /** Connect screen — pass demo:true to pre-fill the demo server URL */
  Connect: { demo?: boolean } | undefined;
  Main: undefined;
};

// ---------------------------------------------------------------------------
// Bottom tab navigator
// ---------------------------------------------------------------------------
export type RootTabParamList = {
  /** Chat tab — can receive an optional sessionId and/or a pre-filled message */
  Chat: { sessionId?: string; initialMessage?: string } | undefined;
  Sessions: undefined;
  Projects: undefined;
  /** Files tab — can receive an optional filePath to open directly */
  Files: { filePath?: string } | undefined;
  Settings: undefined;
};

// ---------------------------------------------------------------------------
// Typed screen props
// ---------------------------------------------------------------------------
export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type ConnectScreenProps = RootStackScreenProps<'Connect'>;

export type ChatScreenProps = CompositeScreenProps<
  BottomTabScreenProps<RootTabParamList, 'Chat'>,
  NativeStackScreenProps<RootStackParamList>
>;

export type SessionsScreenProps = CompositeScreenProps<
  BottomTabScreenProps<RootTabParamList, 'Sessions'>,
  NativeStackScreenProps<RootStackParamList>
>;

export type ProjectsScreenProps = CompositeScreenProps<
  BottomTabScreenProps<RootTabParamList, 'Projects'>,
  NativeStackScreenProps<RootStackParamList>
>;

export type FilesScreenProps = CompositeScreenProps<
  BottomTabScreenProps<RootTabParamList, 'Files'>,
  NativeStackScreenProps<RootStackParamList>
>;

export type SettingsScreenProps = CompositeScreenProps<
  BottomTabScreenProps<RootTabParamList, 'Settings'>,
  NativeStackScreenProps<RootStackParamList>
>;

// Augment React Navigation's type system with our param lists
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
