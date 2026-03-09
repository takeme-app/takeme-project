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

const adb = findAdb();
if (!adb) {
  console.error('adb não encontrado. Defina ANDROID_HOME ou use Android Studio (Sdk em %LOCALAPPDATA%\\Android\\Sdk).');
  process.exit(1);
}

const ports = process.env.REACT_NATIVE_PACKAGER_PORT
  ? [process.env.REACT_NATIVE_PACKAGER_PORT]
  : ['8085', '8081'];

let ok = true;
for (const port of ports) {
  const r = spawnSync(adb, ['reverse', `tcp:${port}`, `tcp:${port}`], {
    stdio: 'inherit',
    shell: true,
  });
  if (r.status !== 0) ok = false;
}

if (ok) {
  console.log('Portas no device redirecionadas para o PC:', ports.join(', '));
  console.log('Inicie o Metro (npm start ou npm run start:8081) e abra o app no celular.');
}
process.exit(ok ? 0 : 1);
