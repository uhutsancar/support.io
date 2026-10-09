// The social preview image (plan v10 MKT-03): Facebook, LinkedIn, X and
// WhatsApp do not show SVG, so public/og-image.png (1200×630) is rendered
// from public/og-image.svg. Run after changing the SVG:
//   npx tsx scripts/og-image.ts
// sharp comes from the backend's dependencies (it already re-encodes
// uploaded images); the panel does not carry it.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '../../backend/package.json'));
const sharp = require('sharp');

await sharp(path.join(here, '../public/og-image.svg'), { density: 144 })
  .resize(1200, 630, { fit: 'cover' })
  .png({ compressionLevel: 9 })
  .toFile(path.join(here, '../public/og-image.png'));
console.warn('public/og-image.png written');
