/**
 * Configura redirecionamento de porta no device Android conectado via USB.
 * No device físico, "localhost" é o próprio aparelho; com adb reverse,
 * localhost:PORT no device aponta para o Metro no PC e o app consegue conectar.
 * Rode com o celular conectado antes de abrir o app (ou use npm run android:run que chama isso).
 */
const path = require('path');
const { spawnSync } = require('child_process');

function findAdb() {
  const candidates = [
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk', 'platform-tools', 'adb.exe'),
    process.env.ANDROID_HOME && path.join(process.env.ANDROID_HOME, 'platform-tools', 'adb.exe'),
  ].filter(Boolean);
  for (const p of candidates) {
    try {
      const fs = require('fs');
      if (p && fs.existsSync(p)) return p;
    } catch (_) {}
  }
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
    console.error('adb não encontrado. Defina ANDROID_HOME ou use Android Studio (Sdk em %LOCALAPPDATA%\\Android\\Sdk).');
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
