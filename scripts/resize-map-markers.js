/**
 * Redimensiona os PNGs dos marcadores do mapa para 48x48 (e @2x 96x96)
 * para que no Android não apareçam gigantes. Rode: node scripts/resize-map-markers.js
 *
 * Para personalizar: substitua os PNGs em apps/cliente/assets/ (originais)
 * e rode o script de novo, ou edite diretamente os arquivos em
 * apps/cliente/assets/map-markers/ (48x48 e 96x96).
 */

const path = require('path');
const fs = require('fs');

const SHARP_NOT_FOUND = `
  Dependência opcional não encontrada. Instale com:
  npm install --save-dev sharp
  e rode de novo: node scripts/resize-map-markers.js
`;

async function main() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    console.warn(SHARP_NOT_FOUND);
    process.exit(1);
  }

  const assetsDir = path.join(__dirname, '..', 'apps', 'cliente', 'assets');
  const outDir = path.join(assetsDir, 'map-markers');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const sizes = [
    [48, ''],
    [96, '@2x'],
  ];

  for (const name of ['marker-my-location', 'marker-driver']) {
    const src = path.join(assetsDir, `${name}.png`);
    if (!fs.existsSync(src)) {
      console.warn(`Pulando ${name}: ${src} não encontrado`);
      continue;
    }
    for (const [size, suffix] of sizes) {
      const dest = path.join(outDir, `${name}${suffix}.png`);
      await sharp(src)
        .resize(size, size)
        .png()
        .toFile(dest);
      console.log(`Gerado ${path.basename(dest)} (${size}x${size})`);
    }
  }
  console.log('Pronto. Marcadores em apps/cliente/assets/map-markers/');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
