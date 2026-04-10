/**
 * Copia o worker CSP do mapbox-gl para apps/admin/public/ — servido na raiz do web (ex.: /mapbox-gl-csp-worker.js).
 * CDNs como unpkg costumam ser bloqueadas (CSP/rede); sem worker o GL falha e o MapView cai no mapa estático (<img>).
 */
const fs = require('fs');
const path = require('path');

const adminRoot = path.resolve(__dirname, '..');
const candidates = [
  path.join(adminRoot, 'node_modules', 'mapbox-gl', 'dist', 'mapbox-gl-csp-worker.js'),
  path.join(adminRoot, '..', '..', 'node_modules', 'mapbox-gl', 'dist', 'mapbox-gl-csp-worker.js'),
];
const src = candidates.find((p) => fs.existsSync(p));
if (!src) {
  console.warn('[copy-mapbox-worker] mapbox-gl dist não encontrado; mapa GL pode falhar no web.');
  process.exit(0);
}
const destDir = path.join(adminRoot, 'public');
const dest = path.join(destDir, 'mapbox-gl-csp-worker.js');
fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log('[copy-mapbox-worker] →', path.relative(adminRoot, dest));
