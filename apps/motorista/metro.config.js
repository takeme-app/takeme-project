/**
 * Monorepo: delega ao metro.config.js da raiz (watchFolders, blockList, uma única cópia de React).
 * Fixa o subpath do app no monorepo quando o Metro sobe sem EXPO_APP_SUBPATH.
 */
const path = require('path');

if (!process.env.EXPO_APP_SUBPATH) {
  process.env.EXPO_APP_SUBPATH = 'apps/motorista';
}

module.exports = require(path.resolve(__dirname, '../../metro.config.js'));
