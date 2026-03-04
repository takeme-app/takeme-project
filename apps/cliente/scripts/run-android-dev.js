/**
 * Sobe Metro, compila o app e abre no device/emulador Android.
 * Define JAVA_HOME para o Gradle quando não estiver setado (ex.: Android Studio JBR).
 */
const path = require('path');
const { spawnSync } = require('child_process');

const appDir = path.resolve(__dirname, '..');

// Fixar porta do Metro para não travar em prompt "Use port 8082?" em terminal não interativo
process.env.REACT_NATIVE_PACKAGER_PORT = process.env.REACT_NATIVE_PACKAGER_PORT || '8081';

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

const result = spawnSync('npx', ['expo', 'run:android'], {
  cwd: appDir,
  env: process.env,
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 1);
