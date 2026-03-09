/**
 * Compila, instala e abre o app no device/emulador Android (conecta ao Metro).
 * Em device físico via USB, roda adb reverse para o app conseguir conectar ao Metro no PC.
 *
 * IMPORTANTE: rode o Metro antes, em outro terminal:
 *   cd apps/cliente && npm run start:8081
 */
const path = require('path');
const { spawnSync } = require('child_process');

const appDir = path.resolve(__dirname, '..');

// Porta 8081: expo run:android --no-bundler não aceita --port; o app usa o padrão 8081.
process.env.REACT_NATIVE_PACKAGER_PORT = process.env.REACT_NATIVE_PACKAGER_PORT || '8081';

console.log('\n[android:run] Porta do Metro: 8081');
console.log('[android:run] Em outro terminal rode: npm run start:8081\n');

// Device físico: redireciona localhost:PORT no celular para o Metro no PC
spawnSync(process.execPath, [path.join(__dirname, 'adb-reverse.js')], {
  cwd: appDir,
  env: process.env,
  stdio: 'inherit',
  shell: true,
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

// --no-bundler: Metro já está rodando (npm run start:8081)
const result = spawnSync('npx', ['expo', 'run:android', '--no-bundler'], {
  cwd: appDir,
  env: process.env,
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 1);
