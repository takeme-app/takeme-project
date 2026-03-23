/**
 * Metro config do admin — usado quando você roda "npm run start" a partir de apps/admin.
 * Assim o admin não depende do metro.config.js da raiz (que aponta para cliente/motorista).
 */
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.projectRoot = projectRoot;
config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Force all react/react-dom imports to resolve from admin's local node_modules
// to avoid duplicate React instances (root has React 18, admin has React 19)
const adminReact = path.resolve(projectRoot, 'node_modules/react');
const adminReactDom = path.resolve(projectRoot, 'node_modules/react-dom');

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Intercept react and react-dom to always use admin's version
  if (moduleName === 'react' || moduleName.startsWith('react/')) {
    const subpath = moduleName === 'react' ? '' : moduleName.slice('react'.length);
    return { type: 'sourceFile', filePath: require.resolve(adminReact + subpath) };
  }
  if (moduleName === 'react-dom' || moduleName.startsWith('react-dom/')) {
    const subpath = moduleName === 'react-dom' ? '' : moduleName.slice('react-dom'.length);
    return { type: 'sourceFile', filePath: require.resolve(adminReactDom + subpath) };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
