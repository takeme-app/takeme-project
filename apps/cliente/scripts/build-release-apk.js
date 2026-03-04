/**
 * Gera APK release do app Cliente no PC (para enviar ao cliente).
 * Faz bump da versão (patch) no package.json, passa versão ao Gradle e gera
 * android/app/build/outputs/apk/release/take-me-cliente-{versão}.apk
 */
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const appDir = path.resolve(__dirname, '..');
const androidDir = path.join(appDir, 'android');
const gradlew = path.join(androidDir, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
const packagePath = path.join(appDir, 'package.json');

// JAVA_HOME (mesma lógica do run-android-dev.js)
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
    console.error('JAVA_HOME não definido. Defina ou instale o JDK (ex.: Android Studio).');
    process.exit(1);
  }
}

if (!fs.existsSync(gradlew)) {
  console.error('Gradle wrapper não encontrado em', androidDir);
  process.exit(1);
}

// Versão: bump por padrão; use SKIP_VERSION_BUMP=1 para manter a versão atual (ex.: só testers)
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const match = (pkg.version || '1.0.0').match(/^(\d+)\.(\d+)\.(\d+)$/);
if (!match) {
  console.error('package.json "version" deve ser semver (ex: 1.0.0). Atual:', pkg.version);
  process.exit(1);
}
const major = parseInt(match[1], 10);
const minor = parseInt(match[2], 10);
const patch = parseInt(match[3], 10);
const skipBump = process.env.SKIP_VERSION_BUMP === '1' || process.env.SKIP_VERSION_BUMP === 'true';
const newVersion = skipBump ? `${major}.${minor}.${patch}` : `${major}.${minor}.${patch + 1}`;
const versionCode = major * 10000 + minor * 100 + (skipBump ? patch : patch + 1);
if (!skipBump) {
  pkg.version = newVersion;
  fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
}
console.log(`Versão: ${newVersion} (versionCode ${versionCode})${skipBump ? ' (sem bump)' : ''}\n`);

console.log('Building release APK...\n');
const result = spawnSync(
  gradlew,
  ['app:assembleRelease', '-x', 'lint', '-x', 'test', `-PversionName=${newVersion}`, `-PversionCode=${versionCode}`],
  {
    cwd: androidDir,
    env: process.env,
    stdio: 'inherit',
    shell: true,
  }
);

if (result.status === 0) {
  const apkName = `take-me-cliente-${newVersion}.apk`;
  const apkPath = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', apkName);
  console.log('\nAPK gerado:', apkPath);
  console.log('Envie esse arquivo ao cliente.');
}
process.exit(result.status ?? 1);
