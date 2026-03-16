/**
 * Metro config na raiz do monorepo.
 * EXPO_APP_SUBPATH define qual app buildar (apps/cliente, apps/motorista, etc.).
 * Polyfill FormData fica só no entry (index.js) para não rodar antes do runtime no Expo Go.
 */
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const monorepoRoot = __dirname;
const appSubpath = process.env.EXPO_APP_SUBPATH || 'apps/cliente';
const projectRoot = path.resolve(monorepoRoot, appSubpath);

const config = getDefaultConfig(projectRoot);

config.projectRoot = projectRoot;
config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

module.exports = config;
