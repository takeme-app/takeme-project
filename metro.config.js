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
config.server = { ...(config.server ?? {}), unstable_serverRoot: projectRoot };
config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Força react (e subpaths) a resolver SEMPRE da cópia do app sendo buildado.
// Sem isso, arquivos em node_modules raiz resolvem de um app vizinho → dois
// instances de React → "Invalid hook call" / useState of null.
const reactRoot = path.resolve(projectRoot, 'node_modules', 'react');
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react' || moduleName.startsWith('react/')) {
    const filePath = require.resolve(moduleName, { paths: [path.resolve(projectRoot, 'node_modules')] });
    return { filePath, type: 'sourceFile' };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
