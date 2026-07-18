import sharp from "sharp";
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const sourceLogo = resolve(root, "public/image_ux_ux/MAIN_LOGO.jpg");
const mainAppLogo = resolve(root, "public/main_app_logo.png");
const brandDir = resolve(root, "public/brand");
const sourceDir = resolve(brandDir, "source");
const iconsDir = resolve(root, "public/icons");

const sourceReference = resolve(sourceDir, "perx-original-reference.jpg");

function rgbaSvgText({
  color = "#0b1020",
  gold = "#f59e0b",
  height = 96,
  width = 166,
}) {
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <text x="0" y="63" font-family="Inter, Arial, Helvetica, sans-serif" font-size="54" font-weight="900" letter-spacing="-1" fill="${color}">per</text>
      <text x="96" y="63" font-family="Inter, Arial, Helvetica, sans-serif" font-size="54" font-weight="900" letter-spacing="-1" fill="${gold}">X</text>
    </svg>
  `);
}

function makeIco(entries) {
  const headerSize = 6;
  const dirSize = 16 * entries.length;
  let offset = headerSize + dirSize;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);

  const dirs = entries.map(({ size, buffer }) => {
    const dir = Buffer.alloc(16);
    dir.writeUInt8(size >= 256 ? 0 : size, 0);
    dir.writeUInt8(size >= 256 ? 0 : size, 1);
    dir.writeUInt8(0, 2);
    dir.writeUInt8(0, 3);
    dir.writeUInt16LE(1, 4);
    dir.writeUInt16LE(32, 6);
    dir.writeUInt32LE(buffer.length, 8);
    dir.writeUInt32LE(offset, 12);
    offset += buffer.length;
    return dir;
  });

  return Buffer.concat([
    header,
    ...dirs,
    ...entries.map((entry) => entry.buffer),
  ]);
}

async function cleanedSymbolBuffer() {
  const trimmed = sharp(sourceLogo)
    .rotate()
    .trim({ background: "#ffffff", threshold: 20 });
  const { data, info } = await trimmed
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const out = Buffer.from(data);

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const i = (y * info.width + x) * 4;
      const r = out[i];
      const g = out[i + 1];
      const b = out[i + 2];
      const max = Math.max(r, g, b);

      if (r > 248 && g > 248 && b > 248) {
        out[i + 3] = 0;
      }

      // MAIN_LOGO.jpg includes legacy center lettering. Visible UI
      // branding must use perX, so this masks that lettering while
      // preserving the source loops and proportions.
      if (x >= 335 && x <= 602 && y >= 62 && y <= 190 && max < 248) {
        out[i + 3] = 0;
      }
    }
  }

  return sharp(out, {
    raw: {
      channels: info.channels,
      height: info.height,
      width: info.width,
    },
  })
    .png()
    .toBuffer();
}

async function makeLogo({ file, textColor, symbol }) {
  const canvasWidth = 420;
  const canvasHeight = 116;
  const symbolWidth = 230;
  const symbolHeight = 70;
  const symbolBuffer = await sharp(symbol)
    .resize(symbolWidth, symbolHeight, {
      background: { alpha: 0, b: 0, g: 0, r: 0 },
      fit: "contain",
    })
    .png()
    .toBuffer();

  await sharp({
    create: {
      background: { alpha: 0, b: 0, g: 0, r: 0 },
      channels: 4,
      height: canvasHeight,
      width: canvasWidth,
    },
  })
    .composite([
      { input: symbolBuffer, left: 0, top: 22 },
      { input: rgbaSvgText({ color: textColor }), left: 238, top: 10 },
    ])
    .png()
    .toFile(resolve(brandDir, file));
}

async function makeWordmark({ file, textColor }) {
  await sharp({
    create: {
      background: { alpha: 0, b: 0, g: 0, r: 0 },
      channels: 4,
      height: 96,
      width: 176,
    },
  })
    .composite([{ input: rgbaSvgText({ color: textColor }), left: 0, top: 0 }])
    .png()
    .toFile(resolve(brandDir, file));
}

async function makeIcon({ file, maskable, size, sourceImagePath }) {
  const artwork = await cropVisibleArtwork(sourceImagePath);
  const targetSize = Math.round(
    size * (maskable ? 0.74 : size <= 32 ? 0.92 : 0.9),
  );

  const canvas = sharp({
    create: {
      background: { alpha: 1, b: 255, g: 255, r: 255 },
      channels: 4,
      height: size,
      width: size,
    },
  });

  const iconBuffer = await sharp(artwork)
    .resize(targetSize, targetSize, {
      background: { alpha: 0, b: 0, g: 0, r: 0 },
      fit: "contain",
    })
    .sharpen({ sigma: size <= 32 ? 0.55 : 0.32 })
    .png()
    .toBuffer();

  await canvas
    .composite([{ input: iconBuffer, gravity: "center" }])
    .png()
    .toFile(resolve(iconsDir, file));
}

async function cropVisibleArtwork(sourceImagePath) {
  const image = sharp(sourceImagePath).rotate().ensureAlpha();
  const { data, info } = await image
    .raw()
    .toBuffer({ resolveWithObject: true });
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const i = (y * info.width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const alpha = data[i + 3];
      const isWhitePadding = r >= 246 && g >= 246 && b >= 246;

      if (alpha > 16 && !isWhitePadding) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    throw new Error(`Could not find visible artwork in ${sourceImagePath}`);
  }

  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const margin = Math.ceil(Math.max(width, height) * 0.015);
  const left = Math.max(0, minX - margin);
  const top = Math.max(0, minY - margin);
  const right = Math.min(info.width, maxX + margin + 1);
  const bottom = Math.min(info.height, maxY + margin + 1);

  return sharp(sourceImagePath)
    .rotate()
    .extract({
      height: bottom - top,
      left,
      top,
      width: right - left,
    })
    .png()
    .toBuffer();
}

await mkdir(brandDir, { recursive: true });
await mkdir(sourceDir, { recursive: true });
await mkdir(iconsDir, { recursive: true });
await copyFile(sourceLogo, sourceReference);

const symbol = await cleanedSymbolBuffer();

const symbolFiles = [
  "perx-symbol.png",
  "perx-symbol-light.png",
  "perx-symbol-dark.png",
  "perx-symbol-monochrome.png",
];

for (const file of symbolFiles) {
  await sharp(symbol).toFile(resolve(brandDir, file));
}

await makeLogo({ file: "perx-logo.png", symbol, textColor: "#0b1020" });
await makeLogo({ file: "perx-logo-light.png", symbol, textColor: "#0b1020" });
await makeLogo({
  file: "perx-logo-horizontal.png",
  symbol,
  textColor: "#0b1020",
});
await makeLogo({
  file: "perx-logo-horizontal-light.png",
  symbol,
  textColor: "#0b1020",
});
await makeLogo({ file: "perx-logo-dark.png", symbol, textColor: "#f8fafc" });
await makeLogo({
  file: "perx-logo-horizontal-dark.png",
  symbol,
  textColor: "#f8fafc",
});
await makeWordmark({ file: "perx-wordmark.png", textColor: "#0b1020" });
await makeWordmark({ file: "perx-wordmark-light.png", textColor: "#0b1020" });
await makeWordmark({ file: "perx-wordmark-dark.png", textColor: "#f8fafc" });

const iconSpecs = [
  ["favicon-16x16.png", 16, false],
  ["favicon-32x32.png", 32, false],
  ["favicon-48x48.png", 48, false],
  ["apple-touch-icon.png", 180, false],
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  ["maskable-icon-192.png", 192, true],
  ["maskable-icon-512.png", 512, true],
];

for (const [file, size, maskable] of iconSpecs) {
  await makeIcon({ file, maskable, size, sourceImagePath: mainAppLogo });
}

const ico16 = await readFile(resolve(iconsDir, "favicon-16x16.png"));
const ico32 = await readFile(resolve(iconsDir, "favicon-32x32.png"));
const ico48 = await readFile(resolve(iconsDir, "favicon-48x48.png"));
await writeFile(
  resolve(root, "public/favicon.ico"),
  makeIco([
    { size: 16, buffer: ico16 },
    { size: 32, buffer: ico32 },
    { size: 48, buffer: ico48 },
  ]),
);

console.log(
  "Generated perX brand derivatives from public/image_ux_ux/MAIN_LOGO.jpg",
);
console.log("Generated app icons and favicon from public/main_app_logo.png");
