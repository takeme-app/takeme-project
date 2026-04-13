/**
 * Redireciona localhost:PORT no device Android (USB) para o Metro no PC.
 * Sem isso, o app tenta carregar o bundle em localhost:8081 no próprio celular → "Unable to load script".
 */
const path = require('path');
const { spawnSync } = require('child_process');

function findAdb() {
  const adbName = process.platform === 'win32' ? 'adb.exe' : 'adb';
  const candidates = [
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk', 'platform-tools', adbName),
    process.env.ANDROID_HOME && path.join(process.env.ANDROID_HOME, 'platform-tools', adbName),
    process.env.ANDROID_SDK_ROOT && path.join(process.env.ANDROID_SDK_ROOT, 'platform-tools', adbName),
    process.env.HOME && path.join(process.env.HOME, 'Library', 'Android', 'sdk', 'platform-tools', adbName),
  ].filter(Boolean);
  for (const p of candidates) {
    try {
      const fs = require('fs');
      if (p && fs.existsSync(p)) return p;
    } catch (_) {}
  }
  return null;
}

/** Com vários devices, `adb reverse` exige `-s SERIAL`. Prioriza USB (não emulador). */
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
      '(defina ANDROID_SERIAL para escolher outro)',
    );
    return physical[0];
  }
  console.warn('[adb-reverse] Vários emuladores; usando o primeiro:', ids[0]);
  return ids[0];
}

function main() {
  const adb = findAdb();
  if (!adb) {
    console.warn(
      '[adb-reverse] adb não encontrado (ANDROID_HOME ou Sdk em %LOCALAPPDATA%\\Android\\Sdk). Pulando reverse.',
    );
    process.exit(0);
  }

  const serial = resolveAdbSerial(adb);
  const adbPrefix = serial ? ['-s', serial] : [];

  const fromEnv = process.env.REACT_NATIVE_PACKAGER_PORT ? [String(process.env.REACT_NATIVE_PACKAGER_PORT)] : [];
  const ports = [...new Set([...fromEnv, '8081', '8082', '8083', '8084'])];

  let okCount = 0;
  for (const port of ports) {
    const r = spawnSync(adb, [...adbPrefix, 'reverse', `tcp:${port}`, `tcp:${port}`], {
      stdio: 'pipe',
      shell: false,
    });
    if (r.status === 0) okCount += 1;
  }

  if (okCount === ports.length) {
    console.log('[adb-reverse] OK — device USB → PC:', ports.join(', '));
  } else if (okCount > 0) {
    console.warn('[adb-reverse] Parcial:', okCount, 'de', ports.length, 'portas. Verifique `adb devices`.');
  } else {
    console.warn(
      '[adb-reverse] Nenhuma porta redirecionada. USB desconectado ou `adb devices` vazio? Emulador costuma usar 10.0.2.2 no host.',
    );
    console.warn('  Com aparelho físico: conecte o USB, ative Depuração USB e rode de novo: npm run android:reverse');
  }

  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { findAdb, resolveAdbSerial };
