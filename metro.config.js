/**
 * Metro config na raiz do monorepo.
 * Quando o build Android (Gradle) inicia o Metro a partir da raiz, o Metro usa
 * este arquivo. Definimos projectRoot como apps/cliente para o app Cliente.
 * Para buildar outro app (motorista, etc.), altere EXPO_APP_SUBPATH ou este path.
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
