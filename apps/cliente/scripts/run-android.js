const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const appDir = path.resolve(__dirname, '..');
const rootDir = path.resolve(appDir, '../..');

process.env.JAVA_HOME = process.env.JAVA_HOME || 'C:\\Program Files\\Android\\Android Studio\\jbr';

// Parar daemons do Gradle (evita arquivo travado)
const gradlew = path.join(appDir, 'android', 'gradlew.bat');
if (fs.existsSync(gradlew)) {
  spawnSync(gradlew, ['--stop'], {
    cwd: path.join(appDir, 'android'),
    env: { ...process.env, JAVA_HOME: process.env.JAVA_HOME },
    stdio: 'ignore',
    shell: true,
  });
}

// Remover pasta de build que costuma travar (expo-modules-core)
const lockPath = path.join(rootDir, 'node_modules', 'expo-modules-core', 'android', 'build');
if (fs.existsSync(lockPath)) {
  try {
    fs.rmSync(lockPath, { recursive: true, force: true });
  } catch (_) {
    // Se falhar (arquivo em uso), continua mesmo assim
  }
}

// Só gera o APK (sem iniciar Metro nem instalar no device)
const androidDir = path.join(appDir, 'android');
const result = spawnSync(
  path.join(androidDir, 'gradlew.bat'),
  ['app:assembleDebug', '-x', 'lint', '-x', 'test'],
  {
    stdio: 'inherit',
    shell: true,
    cwd: androidDir,
    env: process.env,
  }
);

if (result.status === 0) {
  console.log('\nAPK gerado: android\\app\\build\\outputs\\apk\\debug\\app-debug.apk');
  console.log('Instale manualmente no celular (copie o arquivo ou use adb install).');
}
process.exit(result.status ?? 1);
