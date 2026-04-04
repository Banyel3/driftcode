/**
 * Module augmentation to restore ViewProps (including `style`, `onLayout`, etc.)
 * on NativeSafeAreaViewProps.
 *
 * Why: In this npm workspaces monorepo, `react-native-safe-area-context` is hoisted
 * to the root `node_modules`, but `react-native` lives only in
 * `apps/mobile/node_modules`. TypeScript resolves RNSC's d.ts files from the root
 * node_modules context, where `react-native` is not present. This causes ViewProps
 * (which provides `style`, `onLayout`, etc.) to be unresolvable, so the excess-
 * property check rejects those props on <SafeAreaView>.
 *
 * This augmentation re-declares the interface in the compilation context where
 * `react-native` IS resolvable, merging the missing props back in.
 */
import type { ViewProps } from 'react-native';

declare module 'react-native-safe-area-context' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface NativeSafeAreaViewProps extends ViewProps {}
}
