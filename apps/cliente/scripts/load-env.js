/**
 * Carrega ficheiros `.env` a partir de `startDir` e subindo diretórios até à raiz.
 * Ordem: raiz do disco → pasta do app (ficheiros mais profundos aplicados por último e sobrescrevem).
 * Usado por `app.config.js` e `metro.config.js` para `EXPO_PUBLIC_*` e `extra`.
 */
const fs = require('fs');
const path = require('path');

function applyEnvFile(filePath, override) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, 'utf8');
  for (let line of raw.split(/\n/)) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const eq = s.indexOf('=');
    if (eq <= 0) continue;
    const key = s.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let val = s.slice(eq + 1).trim();
    const hash = val.indexOf(' #');
    if (hash !== -1 && !(val.startsWith('"') || val.startsWith("'"))) val = val.slice(0, hash).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (override || process.env[key] === undefined) process.env[key] = val;
  }
}

function loadEnv(startDir) {
  const found = [];
  let d = path.resolve(startDir);
  for (let i = 0; i < 14; i++) {
    const p = path.join(d, '.env');
    if (fs.existsSync(p)) found.push(p);
    const parent = path.dirname(d);
    if (parent === d) break;
    d = parent;
  }
  found.reverse();
  for (const p of found) applyEnvFile(p, true);
}

module.exports = { loadEnv };
