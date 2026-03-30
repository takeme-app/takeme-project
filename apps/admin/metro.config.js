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

function firstExistingDir(...candidates) {
  const fsSync = require('fs');
  for (const c of candidates) {
    try {
      if (fsSync.statSync(c).isDirectory()) return c;
    } catch {
      /* next */
    }
  }
  return candidates[candidates.length - 1];
}

// Prefer react/react-dom no pacote admin; com hoisting do npm, cair para a raiz do monorepo.
const reactRoot = firstExistingDir(
  path.resolve(projectRoot, 'node_modules/react'),
  path.resolve(monorepoRoot, 'node_modules/react'),
);
const reactDomRoot = firstExistingDir(
  path.resolve(projectRoot, 'node_modules/react-dom'),
  path.resolve(monorepoRoot, 'node_modules/react-dom'),
);

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react' || moduleName.startsWith('react/')) {
    const subpath = moduleName === 'react' ? '' : moduleName.slice('react'.length);
    return { type: 'sourceFile', filePath: require.resolve(reactRoot + subpath) };
  }
  if (moduleName === 'react-dom' || moduleName.startsWith('react-dom/')) {
    const subpath = moduleName === 'react-dom' ? '' : moduleName.slice('react-dom'.length);
    return { type: 'sourceFile', filePath: require.resolve(reactDomRoot + subpath) };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
