import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { ChatScreen } from '../screens/chat/ChatScreen';
import { SessionsScreen } from '../screens/sessions/SessionsScreen';
import { ProjectsScreen } from '../screens/projects/ProjectsScreen';
import { ProjectDetailScreen } from '../screens/projects/ProjectDetailScreen';
import { FilesScreen } from '../screens/files/FilesScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { OnboardingScreen } from '../screens/onboarding/OnboardingScreen';
import { ConnectScreen } from '../screens/onboarding/ConnectScreen';
import { useConnectionStore } from '../store';
import { COLORS } from '../constants/colors';
import type {
  RootStackParamList,
  RootTabParamList,
  ChatStackParamList,
  ProjectsStackParamList,
} from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<RootTabParamList>();
const ChatStack = createNativeStackNavigator<ChatStackParamList>();
const ProjectsStack = createNativeStackNavigator<ProjectsStackParamList>();

// ─── Tab icon map ─────────────────────────────────────────────────────────────
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<
  keyof RootTabParamList,
  { focused: IoniconName; unfocused: IoniconName }
> = {
  Chat: { focused: 'chatbubble', unfocused: 'chatbubble-outline' },
  Projects: { focused: 'git-branch', unfocused: 'git-branch-outline' },
  Files: { focused: 'folder', unfocused: 'folder-outline' },
  Settings: { focused: 'settings', unfocused: 'settings-outline' },
};

function ChatTabStack() {
  return (
    <ChatStack.Navigator screenOptions={{ headerShown: false }}>
      <ChatStack.Screen name="SessionList" component={SessionsScreen} />
      <ChatStack.Screen name="Conversation" component={ChatScreen} />
    </ChatStack.Navigator>
  );
}

function ProjectsTabStack() {
  return (
    <ProjectsStack.Navigator screenOptions={{ headerShown: false }}>
      <ProjectsStack.Screen name="ProjectList" component={ProjectsScreen} />
      <ProjectsStack.Screen name="ProjectDetail" component={ProjectDetailScreen} />
    </ProjectsStack.Navigator>
  );
}

// ─── Bottom tab navigator ─────────────────────────────────────────────────────
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICONS[route.name as keyof RootTabParamList];
          const iconName = focused ? icons.focused : icons.unfocused;
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Chat"
        component={ChatTabStack}
        listeners={({ navigation, route }) => ({
          tabPress: () => {
            const nestedState = (route as { state?: { index?: number } }).state;
            if (nestedState?.index && nestedState.index > 0) {
              navigation.navigate('Chat', { screen: 'SessionList' });
            }
          },
        })}
      />
      <Tab.Screen name="Projects" component={ProjectsTabStack} />
      <Tab.Screen name="Files" component={FilesScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

// ─── Root navigator ───────────────────────────────────────────────────────────
// Reads isConnected from the store to decide whether to show onboarding.
// After hydrate() runs in App.tsx the store updates and React Navigation
// renders the correct initial screen automatically.
export function RootNavigator() {
  const isConnected = useConnectionStore((s) => s.isConnected);

  return (
    <NavigationContainer
      theme={{
        dark: true,
        colors: {
          primary: COLORS.primary,
          background: COLORS.background,
          card: COLORS.surface,
          text: COLORS.text,
          border: COLORS.border,
          notification: COLORS.primary,
        },
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isConnected ? (
          // ── Authenticated stack ──────────────────────────────────────────
          <Stack.Screen name="Main" component={MainTabs} />
        ) : (
          // ── Onboarding stack ─────────────────────────────────────────────
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        )}
        {/* Connect is always registered so Settings can navigate to it
            regardless of whether the user is currently connected. */}
        <Stack.Screen
          name="Connect"
          component={ConnectScreen}
          options={{ animation: 'slide_from_right' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
