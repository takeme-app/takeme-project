/**
 * Wrapper para o bundle Android em monorepo.
 * Garante que o Metro rode com cwd = apps/cliente (projectRoot correto),
 * evitando "Unable to resolve module ./index.ts from <raiz-monorepo>".
 * Usado pelo Gradle via cliFile no android/app/build.gradle.
 */
const path = require('path');
const { spawnSync } = require('child_process');

const appRoot = path.resolve(__dirname, '..');
process.chdir(appRoot);

const expoPackagePath = require.resolve('expo/package.json', { paths: [appRoot] });
const expoCliPath = require.resolve('@expo/cli', { paths: [path.dirname(expoPackagePath)] });

// Força --entry-file como caminho absoluto em apps/cliente para Metro resolver no app (monorepo).
let args = process.argv.slice(2);
const entryIdx = args.indexOf('--entry-file');
if (entryIdx !== -1 && args[entryIdx + 1]) {
  const entry = args[entryIdx + 1];
  if (!path.isAbsolute(entry)) {
    args = [...args];
    args[entryIdx + 1] = path.resolve(appRoot, entry);
  }
}
const result = spawnSync(process.execPath, [expoCliPath, ...args], {
  stdio: 'inherit',
  cwd: appRoot,
  env: { ...process.env, EXPO_APP_SUBPATH: 'apps/cliente' },
  windowsHide: true,
});

process.exit(result.status ?? 1);
