import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NavigatorScreenParams } from '@react-navigation/native';
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
  Chat: NavigatorScreenParams<ChatStackParamList> | undefined;
  Projects: NavigatorScreenParams<ProjectsStackParamList> | undefined;
  /** Files tab — can receive an optional filePath to open directly */
  Files: { filePath?: string } | undefined;
  Settings: undefined;
};

export type ChatStackParamList = {
  SessionList: undefined;
  Conversation: { sessionId: string; initialMessage?: string };
};

export type ProjectsStackParamList = {
  ProjectList: undefined;
  ProjectDetail: undefined;
};

// ---------------------------------------------------------------------------
// Typed screen props
// ---------------------------------------------------------------------------
export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type ConnectScreenProps = RootStackScreenProps<'Connect'>;

export type ChatStackScreenProps<T extends keyof ChatStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<ChatStackParamList, T>,
    CompositeScreenProps<
      BottomTabScreenProps<RootTabParamList, 'Chat'>,
      NativeStackScreenProps<RootStackParamList>
    >
  >;

export type SessionListScreenProps = ChatStackScreenProps<'SessionList'>;
export type ConversationScreenProps = ChatStackScreenProps<'Conversation'>;

export type ProjectsStackScreenProps<T extends keyof ProjectsStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<ProjectsStackParamList, T>,
    CompositeScreenProps<
      BottomTabScreenProps<RootTabParamList, 'Projects'>,
      NativeStackScreenProps<RootStackParamList>
    >
  >;

export type ProjectListScreenProps = ProjectsStackScreenProps<'ProjectList'>;
export type ProjectDetailScreenProps = ProjectsStackScreenProps<'ProjectDetail'>;

export type ChatTabScreenProps = CompositeScreenProps<
  BottomTabScreenProps<RootTabParamList, 'Chat'>,
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
