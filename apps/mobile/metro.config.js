// Metro config for Expo inside a Turborepo monorepo.
// Tells Metro to watch the whole workspace root so it can resolve
// packages/opencode-client and packages/github-client from source.

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo
config.watchFolders = [workspaceRoot];

// 2. Let Metro find both workspace-local and root-hoisted packages
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Explicit fallback map for packages Metro cannot find via hierarchical
//    lookup for modules outside projectRoot (known Metro monorepo limitation).
//    webidl-conversions is nested inside whatwg-url-without-unicode's own
//    node_modules and is not hoisted.
config.resolver.extraNodeModules = {
  'webidl-conversions': path.resolve(
    workspaceRoot,
    'node_modules/whatwg-url-without-unicode/node_modules/webidl-conversions'
  ),
};

// 4. Force React (and all its subpaths) to ALWAYS resolve from the single
//    local copy at apps/mobile/node_modules/react (19.1.0).
//
//    Why: extraNodeModules is a *fallback* — packages in workspaceRoot/
//    node_modules find react@19.2.0 there through normal Node resolution
//    before the fallback is consulted.  resolveRequest is an *override* that
//    intercepts every resolution call, so every react require in the bundle
//    (including those from expo, tanstack, etc.) lands on the same 19.1.0
//    instance that react-native-renderer@19.1.0 expects.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react' || moduleName.startsWith('react/')) {
    try {
      return {
        // require.resolve with paths:[projectRoot] always finds
        // apps/mobile/node_modules/react (19.1.0) first.
        filePath: require.resolve(moduleName, { paths: [projectRoot] }),
        type: 'sourceFile',
      };
    } catch {
      // subpath not resolvable locally — fall through to default
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
