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

// Só gera o APK debug (sem iniciar Metro nem instalar no device). Porta 8085 = mesma do npm start.
const androidDir = path.join(appDir, 'android');
const buildEnv = { ...process.env, REACT_NATIVE_PACKAGER_PORT: process.env.REACT_NATIVE_PACKAGER_PORT || '8085' };
const result = spawnSync(
  path.join(androidDir, 'gradlew.bat'),
  ['app:assembleDebug', '-x', 'lint', '-x', 'test'],
  {
    stdio: 'inherit',
    shell: true,
    cwd: androidDir,
    env: buildEnv,
  }
);

if (result.status === 0) {
  const apkPath = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
  console.log('\nAPK gerado:', apkPath);
  console.log('Instalar no device USB: adb install -r "' + apkPath + '"');
}
process.exit(result.status ?? 1);
