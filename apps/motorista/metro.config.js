/**
 * Fixa o subpath do app no monorepo quando o Metro sobe sem EXPO_APP_SUBPATH
 * (evita resolver o projeto errado e ajuda o binário iOS a achar o packager).
 */
const path = require('path');

if (!process.env.EXPO_APP_SUBPATH) {
  process.env.EXPO_APP_SUBPATH = 'apps/motorista';
}

module.exports = require(path.resolve(__dirname, '../../metro.config.js'));
