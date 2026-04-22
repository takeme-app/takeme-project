/**
 * Metro config na raiz do monorepo.
 * EXPO_APP_SUBPATH define qual app buildar (apps/cliente, apps/motorista, etc.).
 * Polyfill FormData fica só no entry (index.js) para não rodar antes do runtime no Expo Go.
 */
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const monorepoRoot = __dirname;

// Detecta qual app buildar:
// 1. EXPO_APP_SUBPATH (setado pelos scripts da raiz, ex: npm run motorista)
// 2. process.cwd() se estiver dentro de apps/* (ex: npx expo start dentro de apps/motorista)
// 3. Fallback: apps/cliente
const cwd = process.cwd();
const cwdRelative = path.relative(monorepoRoot, cwd);
const isInsideApp = /^apps[/\\]/.test(cwdRelative) && !cwdRelative.startsWith('..');
const appSubpath = process.env.EXPO_APP_SUBPATH || (isInsideApp ? cwdRelative : 'apps/cliente');
const projectRoot = path.resolve(monorepoRoot, appSubpath);

const config = getDefaultConfig(projectRoot);

// Gradle apaga/recria pastas em node_modules/.../android/build durante o native build;
// o watcher do Metro quebra com ENOENT se incluir esses caminhos.
const extraBlock = [/[/\\]android[/\\]build[/\\].*/, /[/\\]\.cxx[/\\].*/];
config.resolver.blockList = Array.isArray(config.resolver.blockList)
  ? [...config.resolver.blockList, ...extraBlock]
  : config.resolver.blockList
    ? [config.resolver.blockList, ...extraBlock]
    : extraBlock;

config.projectRoot = projectRoot;
config.server = { ...(config.server ?? {}), unstable_serverRoot: monorepoRoot };
config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

/**
 * React 19 expõe "exports" no package.json. Com `unstable_enablePackageExports` ativo, o Metro
 * pode resolver `react` e `react/jsx-dev-runtime` de formas inconsistentes no monorepo + Hermes,
 * e o runtime JSX lê `React.__CLIENT_INTERNALS_*` em um módulo `react` ainda incompleto →
 * ReferenceError: Property 'React' doesn't exist no dispositivo.
 */
config.resolver.unstable_enablePackageExports = false;

const reactRoot = path.join(monorepoRoot, 'node_modules', 'react');
const reactShimFiles = {
  react: path.join(reactRoot, 'index.js'),
  'react/jsx-runtime': path.join(reactRoot, 'jsx-runtime.js'),
  'react/jsx-dev-runtime': path.join(reactRoot, 'jsx-dev-runtime.js'),
};

const upstreamResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform, ...rest) => {
  const filePath = reactShimFiles[moduleName];
  if (filePath) {
    return { type: 'sourceFile', filePath };
  }
  if (typeof upstreamResolveRequest === 'function') {
    return upstreamResolveRequest(context, moduleName, platform, ...rest);
  }
  return context.resolveRequest(context, moduleName, platform, ...rest);
};

module.exports = config;
