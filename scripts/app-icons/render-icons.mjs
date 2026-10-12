/**
 * Re-render the app icons with the logo inset, from the original artwork.
 *
 *   node scripts/app-icons/render-icons.mjs
 *
 * The original (scripts/app-icons/icon-source-512.png) runs the wordmark and
 * its light trails edge to edge, and the same file was also declared
 * `maskable`. Launchers crop a maskable icon to its inner 80% circle, so the
 * "P" and the "t" ran past the icon shape on Android home screens.
 *
 * The artwork is only scaled, never redrawn: it is shrunk, its outer band
 * feathered into the source's own corner colour, and centred on that colour.
 *   - `icon-<n>.png`          purpose "any": logo at 84%, ~8% clear on each side.
 *   - `icon-maskable-<n>.png` purpose "maskable": logo at 75%, so every lit
 *     pixel (radius 260px at full size) sits inside the 205px safe circle.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const SOURCE = path.join(__dirname, 'icon-source-512.png');
const OUT = path.join(ROOT, 'public', 'icons');
const MASTER = 1024;

const ANY_SCALE = 0.84;
const MASKABLE_SCALE = 0.75;
const ANY_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const MASKABLE_SIZES = [192, 512];

/** Fraction of the scaled artwork's edge that fades into the background. */
const FEATHER = 0.1;

async function cornerColour() {
  const { data } = await sharp(SOURCE).removeAlpha().extract({ left: 0, top: 0, width: 8, height: 8 })
    .raw().toBuffer({ resolveWithObject: true });
  const sum = [0, 0, 0];
  for (let i = 0; i < data.length; i += 3) for (let c = 0; c < 3; c++) sum[c] += data[i + c];
  const n = data.length / 3;
  return { r: Math.round(sum[0] / n), g: Math.round(sum[1] / n), b: Math.round(sum[2] / n) };
}

/** The artwork at `scale` of MASTER, with a feathered alpha edge. */
async function insetArtwork(scale) {
  const side = Math.round(MASTER * scale);
  const { data, info } = await sharp(SOURCE)
    .removeAlpha()
    .resize(side, side, { kernel: 'lanczos3' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const band = side * FEATHER;
  const ramp = (d) => Math.min(1, d / band);
  for (let y = 0; y < info.height; y++) {
    const fy = ramp(Math.min(y + 0.5, info.height - y - 0.5));
    for (let x = 0; x < info.width; x++) {
      const fx = ramp(Math.min(x + 0.5, info.width - x - 0.5));
      // Smoothstep so the fade has no visible edge of its own.
      const t = fx * fy;
      data[(y * info.width + x) * 4 + 3] = Math.round(255 * t * t * (3 - 2 * t));
    }
  }
  return { buffer: await sharp(data, { raw: info }).png().toBuffer(), side };
}

async function master(scale, background) {
  const { buffer, side } = await insetArtwork(scale);
  const offset = Math.round((MASTER - side) / 2);
  return sharp({ create: { width: MASTER, height: MASTER, channels: 3, background } })
    .composite([{ input: buffer, left: offset, top: offset }])
    .png()
    .toBuffer();
}

async function writeSizes(masterPng, sizes, name) {
  for (const n of sizes) {
    const file = path.join(OUT, name(n));
    await sharp(masterPng).resize(n, n, { kernel: 'lanczos3' }).removeAlpha()
      .png({ compressionLevel: 9 }).toFile(file);
    console.log('wrote', path.relative(ROOT, file));
  }
}

await (async () => {
  const background = await cornerColour();
  const any = await master(ANY_SCALE, background);
  const maskable = await master(MASKABLE_SCALE, background);
  await writeSizes(any, ANY_SIZES, (n) => `icon-${n}x${n}.png`);
  await writeSizes(maskable, MASKABLE_SIZES, (n) => `icon-maskable-${n}x${n}.png`);
  await sharp(any).resize(512, 512, { kernel: 'lanczos3' }).removeAlpha()
    .png({ compressionLevel: 9 }).toFile(path.join(ROOT, 'app-icon.png'));
  console.log('wrote app-icon.png');
})();
