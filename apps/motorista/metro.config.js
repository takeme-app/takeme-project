/**
 * Monorepo: delega ao metro.config.js da raiz (watchFolders, blockList, uma única cópia de React).
 * Sem este arquivo o Metro usa só o default do Expo e ignora a config compartilhada.
 */
const path = require('path');

if (!process.env.EXPO_APP_SUBPATH) {
  process.env.EXPO_APP_SUBPATH = 'apps/motorista';
}

module.exports = require(path.resolve(__dirname, '../../metro.config.js'));
