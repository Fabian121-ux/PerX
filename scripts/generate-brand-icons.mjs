import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const outDir = resolve(root, "public/icons");

function appIconSvg(size, maskable = false) {
  const radius = maskable ? Math.round(size * 0.18) : Math.round(size * 0.22);
  const pad = maskable ? size * 0.22 : size * 0.16;
  const width = size - pad * 2;
  const height = width * 0.62;
  const x = pad;
  const y = (size - height) / 2;
  const stroke = Math.max(9, width * 0.12);
  const highlight = Math.max(2, width * 0.028);
  const sx = width / 128;
  const sy = height / 80;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="${size}" y2="${size}" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#070707"/>
          <stop offset=".58" stop-color="#151518"/>
          <stop offset="1" stop-color="#2a210c"/>
        </linearGradient>
        <linearGradient id="symbol" x1="${x}" y1="${y}" x2="${x + width}" y2="${y + height}" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#9f7410"/>
          <stop offset=".46" stop-color="#f5b942"/>
          <stop offset="1" stop-color="#f7d77b"/>
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" rx="${radius}" fill="url(#bg)"/>
      <g transform="translate(${x} ${y}) scale(${sx} ${sy})">
        <path d="M18 40c0-13 9.5-23 21.5-23 10 0 17 6.7 24.5 18l6 9c7.5 11.3 14.5 19 27 19 12 0 22-10 22-23s-10-23-22-23c-12.5 0-19.5 7.7-27 19l-6 9C56.5 56.3 49.5 63 39.5 63 27.5 63 18 53 18 40Z" fill="none" stroke="url(#symbol)" stroke-width="${stroke / sx}" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M29.5 40c0-6.3 4.3-11.2 10-11.2 5.9 0 10.5 5.2 16.1 13.5l3.8 5.6" fill="none" stroke="#FFF7D6" stroke-width="${highlight / sx}" stroke-linecap="round" opacity=".55"/>
      </g>
    </svg>
  `;
}

async function renderSvgToPng(browser, svg, path, size) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(`
    <!doctype html>
    <html>
      <body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;background:transparent">
        ${svg}
      </body>
    </html>
  `);
  await page.screenshot({ path, omitBackground: true });
  await page.close();
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

  return Buffer.concat([header, ...dirs, ...entries.map((entry) => entry.buffer)]);
}

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();

const iconSizes = [
  ["favicon-16x16.png", 16, false],
  ["favicon-32x32.png", 32, false],
  ["apple-touch-icon.png", 180, false],
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  ["maskable-icon-192.png", 192, true],
  ["maskable-icon-512.png", 512, true],
];

for (const [file, size, maskable] of iconSizes) {
  await renderSvgToPng(browser, appIconSvg(size, maskable), resolve(outDir, file), size);
}

await browser.close();

const ico16 = await readFile(resolve(outDir, "favicon-16x16.png"));
const ico32 = await readFile(resolve(outDir, "favicon-32x32.png"));
await writeFile(resolve(root, "public/favicon.ico"), makeIco([{ size: 16, buffer: ico16 }, { size: 32, buffer: ico32 }]));
