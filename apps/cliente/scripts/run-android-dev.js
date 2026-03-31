/**
 * Compila, instala e abre o app no device/emulador Android (conecta ao Metro).
 * Em device físico via USB, roda adb reverse para o app conseguir conectar ao Metro no PC.
 *
 * IMPORTANTE: rode o Metro antes, em outro terminal:
 *   cd apps/cliente && npm start
 */
const path = require('path');
const { spawnSync } = require('child_process');
const { findAdb, resolveAdbSerial } = require('./adb-reverse');

const appDir = path.resolve(__dirname, '..');

// Porta 8081 = padrão do Expo/React Native; o app nativo conecta nessa porta.
process.env.REACT_NATIVE_PACKAGER_PORT = process.env.REACT_NATIVE_PACKAGER_PORT || '8081';

console.log('\n[android:run] Porta do Metro: 8081');
console.log('[android:run] Em outro terminal rode: npm start\n');

// Vários devices: Gradle/adb precisam de ANDROID_SERIAL (reverse também).
const adbEarly = findAdb();
if (adbEarly && !process.env.ANDROID_SERIAL) {
  const serial = resolveAdbSerial(adbEarly);
  if (serial) process.env.ANDROID_SERIAL = serial;
}

// Device físico: redireciona localhost:PORT no celular para o Metro no PC
// shell:false — evita quebrar quando node.exe está em "C:\Program Files\..."
spawnSync(process.execPath, [path.join(__dirname, 'adb-reverse.js')], {
  cwd: appDir,
  env: process.env,
  stdio: 'inherit',
  shell: false,
});

// Gradle precisa do JAVA_HOME; uso o JBR do Android Studio se não estiver definido
if (!process.env.JAVA_HOME) {
  const candidates = [
    'C:\\Program Files\\Android\\Android Studio\\jbr',
    'C:\\Program Files\\Android\\Android Studio\\jre',
    process.env.LOCALAPPDATA + '\\Programs\\Android Studio\\jbr',
  ].filter(Boolean);
  for (const p of candidates) {
    try {
      const fs = require('fs');
      if (p && fs.existsSync(path.join(p, 'bin', 'java.exe'))) {
        process.env.JAVA_HOME = p;
        break;
      }
    } catch (_) {}
  }
  if (!process.env.JAVA_HOME) {
    console.error('JAVA_HOME não definido e nenhum JDK encontrado em:');
    candidates.forEach((c) => console.error('  -', c));
    console.error('\nDefina JAVA_HOME (ex.: Android Studio → File → Settings → Build → JDK) ou instale o JDK.');
    process.exit(1);
  }
}

// --no-bundler: Metro já está rodando (npm start)
const result = spawnSync('npx', ['expo', 'run:android', '--no-bundler'], {
  cwd: appDir,
  env: process.env,
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 1);
