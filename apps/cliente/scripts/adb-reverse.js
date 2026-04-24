/**
 * Configura redirecionamento de porta no device Android conectado via USB.
 * No device físico, "localhost" é o próprio aparelho; com adb reverse,
 * localhost:PORT no device aponta para o Metro no PC e o app consegue conectar.
 * Rode com o celular conectado antes de abrir o app (ou use npm run android:run que chama isso).
 */
const path = require('path');
const os = require('os');
const fs = require('fs');
const { spawnSync } = require('child_process');

const isWindows = process.platform === 'win32';
const ADB_BIN = isWindows ? 'adb.exe' : 'adb';

function findAdb() {
  const candidates = [];

  if (isWindows && process.env.LOCALAPPDATA) {
    candidates.push(path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk', 'platform-tools', ADB_BIN));
  }
  if (process.env.ANDROID_HOME) {
    candidates.push(path.join(process.env.ANDROID_HOME, 'platform-tools', ADB_BIN));
  }
  if (process.env.ANDROID_SDK_ROOT) {
    candidates.push(path.join(process.env.ANDROID_SDK_ROOT, 'platform-tools', ADB_BIN));
  }

  // Caminhos padrão por plataforma
  const home = os.homedir();
  if (!isWindows && home) {
    if (process.platform === 'darwin') {
      candidates.push(path.join(home, 'Library', 'Android', 'sdk', 'platform-tools', ADB_BIN));
    }
    candidates.push(path.join(home, 'Android', 'Sdk', 'platform-tools', ADB_BIN));
  }

  for (const p of candidates) {
    try {
      if (p && fs.existsSync(p)) return p;
    } catch (_) {}
  }

  // Fallback: confia no PATH.
  const probe = spawnSync(ADB_BIN, ['version'], { encoding: 'utf8', shell: false });
  if (probe.status === 0) return ADB_BIN;

  return null;
}

/**
 * Com vários devices, comandos adb exigem `-s SERIAL`. Prioriza USB (não emulador).
 * Respeita ANDROID_SERIAL já definido no ambiente.
 */
function resolveAdbSerial(adbPath) {
  if (process.env.ANDROID_SERIAL) return process.env.ANDROID_SERIAL;
  const r = spawnSync(adbPath, ['devices'], { encoding: 'utf8', shell: false });
  const lines = (r.stdout || '').split(/\n/).filter((l) => /\tdevice\s*$/.test(l));
  const ids = lines.map((l) => l.split('\t')[0].trim()).filter(Boolean);
  if (ids.length <= 1) return null;
  const physical = ids.filter((id) => !id.startsWith('emulator-'));
  if (physical.length === 1) return physical[0];
  if (physical.length > 1) {
    console.warn(
      '[adb-reverse] Vários aparelhos USB; usando o primeiro:',
      physical[0],
      '(defina ANDROID_SERIAL no ambiente para escolher outro)'
    );
    return physical[0];
  }
  console.warn('[adb-reverse] Vários emuladores; usando o primeiro:', ids[0]);
  return ids[0];
}

function main() {
  const adb = findAdb();
  if (!adb) {
    const hint = isWindows
      ? '%LOCALAPPDATA%\\Android\\Sdk'
      : process.platform === 'darwin'
        ? '~/Library/Android/sdk'
        : '~/Android/Sdk';
    console.error(
      `adb não encontrado. Defina ANDROID_HOME/ANDROID_SDK_ROOT, adicione platform-tools ao PATH, ou instale o SDK em ${hint}.`
    );
    process.exit(1);
  }

  const serial = resolveAdbSerial(adb);
  const adbPrefix = serial ? ['-s', serial] : [];

  const ports = process.env.REACT_NATIVE_PACKAGER_PORT
    ? [process.env.REACT_NATIVE_PACKAGER_PORT]
    : ['8081'];

  let ok = true;
  for (const port of ports) {
    const r = spawnSync(adb, [...adbPrefix, 'reverse', `tcp:${port}`, `tcp:${port}`], {
      stdio: 'inherit',
      shell: false,
    });
    if (r.status !== 0) ok = false;
  }

  if (ok) {
    console.log('Portas no device redirecionadas para o PC:', ports.join(', '));
    console.log('Inicie o Metro (npm start) e abra o app no celular.');
  }
  process.exit(ok ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = { findAdb, resolveAdbSerial };
