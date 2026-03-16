/**
 * Gera APK debug do app Motorista (para testar em dispositivo sem cabo).
 * Saída: android/app/build/outputs/apk/debug/app-debug.apk
 */
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const appDir = path.resolve(__dirname, '..');
const androidDir = path.join(appDir, 'android');
const gradlew = path.join(androidDir, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');

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
  if (!process.env.JAVA_HOME) {
    console.error('JAVA_HOME não definido. Instale o JDK (ex.: Android Studio) ou defina JAVA_HOME.');
    process.exit(1);
  }
}

if (!fs.existsSync(androidDir)) {
  console.error('Pasta android não encontrada. Rode antes: npm run motorista:android (até o prebuild) ou npm run motorista:prebuild');
  process.exit(1);
}

if (!fs.existsSync(gradlew)) {
  console.error('Gradle wrapper não encontrado em', androidDir);
  process.exit(1);
}

// Android SDK: ANDROID_HOME / ANDROID_SDK_ROOT ou local.properties
let sdkDir = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
if (!sdkDir) {
  const candidates = [
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk'),
    path.join(process.env.USERPROFILE || '', 'AppData', 'Local', 'Android', 'Sdk'),
  ].filter(Boolean);
  for (const p of candidates) {
    if (p && fs.existsSync(path.join(p, 'platform-tools'))) {
      sdkDir = p;
      break;
    }
  }
}
if (!sdkDir || !fs.existsSync(path.join(sdkDir, 'platform-tools'))) {
  console.error('Android SDK não encontrado. Defina ANDROID_HOME ou instale o Android Studio (SDK em %LOCALAPPDATA%\\Android\\Sdk).');
  process.exit(1);
}
const localPropsPath = path.join(androidDir, 'local.properties');
const sdkDirForProps = sdkDir.replace(/\\/g, '/');
fs.writeFileSync(localPropsPath, 'sdk.dir=' + sdkDirForProps + '\n', 'utf8');

console.log('Gerando APK debug do Motorista...\n');
const result = spawnSync(
  process.platform === 'win32' ? 'gradlew.bat' : './gradlew',
  ['app:assembleDebug', '-x', 'lint', '-x', 'test'],
  {
    cwd: androidDir,
    stdio: 'inherit',
    shell: true,
  }
);

if (result.status === 0) {
  const apkPath = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
  console.log('\nAPK gerado:', apkPath);
  console.log('Instale no celular (envie o arquivo ou use ADB: adb install -r "' + apkPath + '")');
}
process.exit(result.status ?? 1);
