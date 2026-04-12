/**
 * expo run:android com adb reverse na porta do Metro (8082 no app motorista; cliente usa 8081).
 * Device físico via USB: sem reverse, "Unable to load script".
 *
 * Uso:
 *   npm run android              → Expo pode subir o Metro
 *   npm run android:run          → Metro já deve estar rodando (npm start) em outro terminal
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { findAdb, resolveAdbSerial } = require('./adb-reverse');

const appDir = path.resolve(__dirname, '..');
const noBundler = process.argv.includes('--no-bundler');

process.env.REACT_NATIVE_PACKAGER_PORT = process.env.REACT_NATIVE_PACKAGER_PORT || '8082';

console.log(
  '\n[Android] O JavaScript só carrega com o Metro rodando (na raiz: npm run motorista, porta ' +
    process.env.REACT_NATIVE_PACKAGER_PORT +
    '). Sem isso o app pode ficar em tela preta. Executando adb reverse nas portas do bundler…\n',
);

const adbEarly = findAdb();
if (adbEarly && !process.env.ANDROID_SERIAL) {
  const serial = resolveAdbSerial(adbEarly);
  if (serial) process.env.ANDROID_SERIAL = serial;
}

spawnSync(process.execPath, [path.join(__dirname, 'adb-reverse.js')], {
  cwd: appDir,
  env: process.env,
  stdio: 'inherit',
  shell: false,
});

if (!process.env.JAVA_HOME) {
  const candidates = [
    'C:\\Program Files\\Android\\Android Studio\\jbr',
    'C:\\Program Files\\Android\\Android Studio\\jre',
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'Android Studio', 'jbr'),
  ].filter(Boolean);
  for (const p of candidates) {
    try {
      if (p && fs.existsSync(path.join(p, 'bin', 'java.exe'))) {
        process.env.JAVA_HOME = p;
        break;
      }
    } catch (_) {}
  }
}

/**
 * Após `expo prebuild --clean`, `android/local.properties` some (é gitignored).
 * Sem sdk.dir o Gradle falha: "SDK location not found".
 */
function ensureAndroidLocalProperties() {
  const androidDir = path.join(appDir, 'android');
  const localProps = path.join(androidDir, 'local.properties');
  if (!fs.existsSync(androidDir)) return;

  let sdkDir = (process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || '').trim();
  if (!sdkDir && process.platform === 'win32' && process.env.LOCALAPPDATA) {
    const guess = path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk');
    if (fs.existsSync(guess)) sdkDir = guess;
  }
  if (!sdkDir && process.env.HOME) {
    const guess = path.join(process.env.HOME, 'Library', 'Android', 'sdk');
    if (fs.existsSync(guess)) sdkDir = guess;
  }
  if (!sdkDir) {
    console.warn(
      '\n[android] ANDROID_HOME não definido e SDK padrão não encontrado.\n' +
        '  Instale o Android SDK (Android Studio) e defina ANDROID_HOME, ou crie:\n' +
        '  apps/motorista/android/local.properties\n' +
        '  com uma linha: sdk.dir=C:\\\\Users\\\\SEU_USUARIO\\\\AppData\\\\Local\\\\Android\\\\Sdk\n',
    );
    return;
  }

  const normalized = path.normalize(sdkDir).replace(/\\/g, '/');
  let needWrite = true;
  if (fs.existsSync(localProps)) {
    const cur = fs.readFileSync(localProps, 'utf8');
    if (/^\s*sdk\.dir\s*=/m.test(cur)) needWrite = false;
  }
  if (needWrite) {
    fs.writeFileSync(localProps, `sdk.dir=${normalized}\n`, 'utf8');
    console.log('[android] Criado android/local.properties → sdk.dir=' + normalized + '\n');
  }
  if (!process.env.ANDROID_HOME && !process.env.ANDROID_SDK_ROOT) {
    process.env.ANDROID_HOME = sdkDir;
  }
}

ensureAndroidLocalProperties();

if (noBundler) {
  console.log('\n[android:run] Metro deve estar em outro terminal: npm start (porta ' + process.env.REACT_NATIVE_PACKAGER_PORT + ')\n');
}

const args = ['expo', 'run:android'];
if (noBundler) args.push('--no-bundler');
// Windows: sem isso o Expo envia -PreactNativeArchitectures com 2 ABIs (ex.: x86_64,arm64-v8a) e o
// build nativo falha com caminhos >260 chars (OneDrive). --all-arch evita esse -P; o Gradle usa então
// reactNativeArchitectures do gradle.properties (x86_64 para emulador).
if (process.platform === 'win32') {
  args.push('--all-arch');
}

const result = spawnSync('npx', args, {
  cwd: appDir,
  env: process.env,
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 1);
