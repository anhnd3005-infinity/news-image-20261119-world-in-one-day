import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const ASSETS_DIR = join(ROOT_DIR, 'assets');
const OUT_ASSET = join(ROOT_DIR, 'entry.png');
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const MAX_BYTES = 1048576;

type RegionKey = 'americas' | 'europe' | 'mideast' | 'africa' | 'asia' | 'oceania';

const REGION_COLOR: Record<RegionKey, string> = {
  americas: '#B34717',
  europe: '#163F6B',
  mideast: '#A12126',
  africa: '#8A5A00',
  asia: '#165E4A',
  oceania: '#5E2B6B',
};

interface MapPin {
  id: number;
  lon: number;
  lat: number;
  region: RegionKey;
  lead?: boolean;
}

// 16 non-overlapping coordinate pins colored by continent/region matching numbered dispatches #1–#16.
const MAP_PINS: MapPin[] = [
  { id: 1, lon: 114.1, lat: 22.5, region: 'asia', lead: true },    // Shenzhen 3-way APEC declaration
  { id: 2, lon: 2.5, lat: 53.0, region: 'europe', lead: true },    // The Hague ICJ Myanmar verdict
  { id: 3, lon: -73.5, lat: 40.7, region: 'americas', lead: true },// New York Dow <50k & Anthropic IPO
  { id: 4, lon: 28.5, lat: 36.5, region: 'mideast', lead: true },  // Antalya COP31 draft
  { id: 5, lon: 86.5, lat: 16.5, region: 'asia', lead: true },     // Bay of Bengal / Odisha Cyclone Akvan
  { id: 6, lon: 36.5, lat: 48.0, region: 'europe' },               // Kerch Bridge & Kyiv raid
  { id: 7, lon: 56.5, lat: 25.0, region: 'mideast' },              // Strait of Hormuz tanker mines
  { id: 8, lon: 18.0, lat: 55.0, region: 'europe' },               // Berlin 30-nation Ukraine summit
  { id: 9, lon: -78.5, lat: -0.2, region: 'americas' },            // Quito Ecuador / Colombia / Chile FTA
  { id: 10, lon: 7.5, lat: 9.1, region: 'africa' },                // Abuja Nigeria state police
  { id: 11, lon: 28.0, lat: -26.2, region: 'africa' },             // Johannesburg South Africa SARB
  { id: 12, lon: 38.0, lat: -1.3, region: 'africa' },              // Kenya marathon EPO ban
  { id: 13, lon: 127.5, lat: 37.6, region: 'asia' },               // Seoul Han Duck-soo ruling
  { id: 14, lon: 121.0, lat: -8.5, region: 'asia' },               // Flores Indonesia M5.9 quake
  { id: 15, lon: 151.2, lat: -33.9, region: 'oceania' },           // Sydney/NZ GTA VI rollout & Walkleys
  { id: 16, lon: -99.0, lat: 30.0, region: 'americas' },           // Texas J&J OTTAVA robotic surgery
];

const CONTINENTS: Array<Array<[number, number]>> = [
  // North & Central America
  [
    [-166, 66], [-156, 71], [-134, 70], [-114, 73], [-95, 71], [-83, 66],
    [-81, 61], [-91, 56], [-80, 52], [-76, 61], [-65, 60], [-55, 51],
    [-64, 46], [-70, 42], [-76, 35], [-81, 25], [-83, 29], [-90, 29],
    [-97, 26], [-96, 19], [-90, 21], [-87, 21], [-83, 14], [-83, 9],
    [-78, 8], [-85, 10], [-93, 14], [-105, 20], [-110, 24], [-113, 29],
    [-117, 32], [-124, 41], [-125, 49], [-137, 58], [-152, 60], [-162, 55],
  ],
  [[-84, 22], [-75, 20], [-76, 22], [-84, 23]],
  [[-52, 60], [-42, 60], [-20, 71], [-22, 81], [-45, 82], [-66, 77], [-54, 68]],
  // South America
  [
    [-78, 9], [-72, 12], [-61, 10], [-50, 1], [-35, -6], [-38, -14],
    [-41, -22], [-48, -28], [-54, -34], [-62, -40], [-67, -50], [-69, -55],
    [-74, -52], [-73, -41], [-71, -30], [-70, -18], [-77, -12], [-81, -5], [-79, 2],
  ],
  // Europe
  [
    [-9, 37], [-9, 43], [-2, 43], [-5, 48], [2, 51], [8, 54], [10, 57],
    [12, 55], [6, 59], [5, 62], [14, 68], [26, 71], [40, 68], [58, 69],
    [58, 52], [44, 44], [38, 45], [30, 46], [28, 41], [23, 37], [19, 40],
    [16, 38], [18, 41], [14, 41], [12, 45], [8, 44], [3, 42], [-2, 37],
  ],
  [[-6, 50], [2, 51], [0, 56], [-5, 58], [-7, 54]],
  [[-10, 52], [-6, 52], [-6, 55], [-10, 54]],
  // Africa & Madagascar
  [
    [-17, 15], [-16, 23], [-6, 36], [10, 37], [12, 33], [25, 32], [33, 31],
    [38, 22], [43, 12], [51, 12], [45, 2], [40, -10], [35, -24], [28, -33],
    [19, -35], [15, -26], [12, -14], [9, 4], [2, 6], [-8, 5], [-14, 9],
  ],
  [[44, -25], [47, -25], [50, -15], [49, -12], [44, -17]],
  // Asia & Middle East
  [
    [27, 41], [36, 37], [35, 30], [43, 13], [53, 16], [59, 22], [56, 26],
    [49, 29], [58, 25], [67, 25], [73, 19], [77, 8], [80, 13], [87, 22],
    [92, 21], [97, 16], [100, 7], [104, 2], [104, 10], [109, 13], [107, 21],
    [114, 22], [121, 25], [122, 32], [119, 39], [126, 38], [129, 35], [131, 42],
    [141, 52], [160, 60], [176, 66], [162, 70], [128, 72], [98, 76], [70, 72],
    [58, 69], [58, 52], [44, 44], [38, 45], [32, 41],
  ],
  // Japan, Philippines, Indonesia, Australia, NZ
  [[130, 32], [136, 34], [141, 38], [145, 44], [141, 45], [139, 39], [132, 34]],
  [[120, 18], [124, 14], [126, 7], [122, 8], [120, 14]],
  [[96, 5], [104, 1], [106, -6], [114, -8], [116, -2], [106, -4], [98, 1]],
  [[109, 1], [117, 6], [118, 1], [114, -3], [110, -3]],
  [
    [114, -22], [122, -17], [131, -12], [137, -15], [142, -11], [146, -18],
    [153, -27], [150, -37], [141, -38], [135, -34], [125, -33], [115, -34],
  ],
  [[167, -46], [173, -41], [178, -37], [175, -35], [171, -42]],
];

function loadArtDataUri(filename: string): string {
  const bytes = readFileSync(join(ASSETS_DIR, filename));
  return `data:image/jpeg;base64,${bytes.toString('base64')}`;
}

function project(lon: number, lat: number, w = 376, h = 196): [number, number] {
  const x = ((lon + 168) / 352) * w;
  const y = ((78 - lat) / 134) * h;
  return [Number(x.toFixed(1)), Number(y.toFixed(1))];
}

function buildWorldMapSvg(): string {
  const w = 376;
  const h = 196;

  const gridLines: string[] = [];
  for (const lat of [-30, 0, 30, 60]) {
    const [, y] = project(0, lat, w, h);
    gridLines.push(
      `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="${lat === 0 ? '#A3BAC9' : '#C5D5E0'}" stroke-width="${lat === 0 ? '0.9' : '0.6'}" stroke-dasharray="${lat === 0 ? '4,3' : '2,3'}"/>`
    );
  }
  for (const lon of [-120, -60, 0, 60, 120]) {
    const [x] = project(lon, 0, w, h);
    gridLines.push(
      `<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="#C5D5E0" stroke-width="0.6" stroke-dasharray="2,3"/>`
    );
  }

  const landHalos = CONTINENTS.map((poly) => {
    const pts = poly.map(([lon, lat]) => project(lon, lat, w, h));
    return `<polygon points="${pts.map(([x, y]) => `${x},${y}`).join(' ')}" fill="none" stroke="#B7CAD7" stroke-width="2.4" stroke-linejoin="round"/>`;
  }).join('');

  const landShapes = CONTINENTS.map((poly) => {
    const pts = poly.map(([lon, lat]) => project(lon, lat, w, h));
    return `<polygon points="${pts.map(([x, y]) => `${x},${y}`).join(' ')}" fill="#DFD5BF" stroke="#8C806A" stroke-width="0.85" stroke-linejoin="round"/>`;
  }).join('');

  const regionTags = [
    { text: 'N. AMERICA', lon: -108, lat: 49 },
    { text: 'S. AMERICA', lon: -53, lat: -15 },
    { text: 'AFRICA', lon: 22, lat: 14 },
    { text: 'EURASIA', lon: 84, lat: 57 },
    { text: 'OCEANIA', lon: 132, lat: -24 },
  ]
    .map((r) => {
      const [rx, ry] = project(r.lon, r.lat, w, h);
      return `<text x="${rx}" y="${ry}" text-anchor="middle" font-family="Avenir Next Condensed, Helvetica Neue, sans-serif" font-size="6.8" font-weight="800" letter-spacing="1.05" fill="#6E6554" opacity="0.82">${r.text}</text>`;
    })
    .join('');

  // Dotted arc connecting ICJ verdict in The Hague (#2) to Myanmar.
  const [hx, hy] = project(2.5, 53.0, w, h);
  const [mx, my] = project(96.0, 20.0, w, h);
  const icjArc = `
    <path d="M ${hx} ${hy} Q ${(hx + mx) / 2} ${Math.min(hy, my) - 16} ${mx} ${my}" fill="none" stroke="#163F6B" stroke-width="1.05" stroke-dasharray="3,2.5" opacity="0.72"/>
    <circle cx="${mx}" cy="${my}" r="3.2" fill="#163F6B" stroke="#F6F2E9" stroke-width="1"/>`;

  const sortedPins = [...MAP_PINS].sort((a, b) => Number(!!a.lead) - Number(!!b.lead));
  const pins = sortedPins
    .map((pin) => {
      const [cx, cy] = project(pin.lon, pin.lat, w, h);
      const fill = REGION_COLOR[pin.region];
      const r = pin.lead ? 7.6 : 6.4;
      const fs = pin.lead ? 8.1 : 6.9;
      return `
        <g>
          ${pin.lead ? `<circle cx="${cx}" cy="${cy}" r="10.8" fill="${fill}" opacity="0.20"/>` : ''}
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="#F6F2E9" stroke-width="1.2"/>
          <text x="${cx}" y="${cy + (pin.lead ? 2.8 : 2.4)}" text-anchor="middle" font-family="Avenir Next, Helvetica Neue, sans-serif" font-size="${fs}" font-weight="800" fill="#FFFFFF">${pin.id}</text>
        </g>`;
    })
    .join('');

  return `
    <svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:auto;background:#DCE7EE;border:1px solid #B7AE99;">
      ${gridLines.join('')}
      ${landHalos}
      ${landShapes}
      ${regionTags}
      ${icjArc}
      ${pins}
    </svg>`;
}

function pinBadge(id: number, region: RegionKey): string {
  return `<span class="pin-badge" style="background:${REGION_COLOR[region]};">${id}</span>`;
}

function statusTag(kind: 'C' | '?'): string {
  return kind === 'C'
    ? `<span class="tag-c" title="Confirmed">C</span>`
    : `<span class="tag-q" title="Claimed / Disputed">?</span>`;
}

function buildHtml(): string {
  const artShenzhen = loadArtDataUri('art-shenzhen.jpg');
  const artIcj = loadArtDataUri('art-icj.jpg');
  const artAnthropic = loadArtDataUri('art-anthropic.jpg');
  const artClimate = loadArtDataUri('art-climate.jpg');
  const worldMap = buildWorldMapSvg();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: 1024px;
    height: 1024px;
    overflow: hidden;
    background: #F6F2E9;
    color: #121821;
    font-family: "Avenir Next", -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
    font-variant-numeric: tabular-nums;
    -webkit-font-smoothing: antialiased;
  }
  .page {
    width: 1024px;
    height: 1024px;
    padding: 6px 14px 5px 14px;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    gap: 5px;
    border-top: 5px solid #121821;
    background: radial-gradient(circle at 50% 0%, #FAF7F0 0%, #F5F0E5 62%, #EFE8D9 100%);
  }

  /* BAND 1: MASTHEAD */
  .masthead {
    border-bottom: 2px solid #121821;
    padding-bottom: 3px;
  }
  .folio-strip {
    display: flex;
    justify-content: space-between;
    font-family: "Avenir Next Condensed", "DIN Alternate", sans-serif;
    font-size: 9.2px;
    font-weight: 700;
    letter-spacing: 1px;
    color: #3E4858;
    border-bottom: 1px solid #C8BFA8;
    padding-bottom: 2px;
    margin-bottom: 2px;
    text-transform: uppercase;
  }
  .title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .title-main {
    font-family: "Bodoni 72", "Big Caslon", "Didot", Georgia, serif;
    font-size: 38px;
    font-weight: 800;
    letter-spacing: -0.4px;
    line-height: 0.95;
    color: #121821;
  }
  .date-plaque {
    background: #9E1F24;
    color: #FFFFFF;
    padding: 3px 13px;
    border: 2px solid #121821;
    box-shadow: inset 0 0 0 1px #D8A449;
    text-align: center;
    flex-shrink: 0;
  }
  .date-day {
    font-family: "Avenir Next Condensed", sans-serif;
    font-size: 9.5px;
    font-weight: 800;
    letter-spacing: 2.3px;
    color: #FCE3A6;
    line-height: 1.04;
  }
  .date-num {
    font-family: "DIN Condensed", "Avenir Next Condensed", sans-serif;
    font-size: 20.5px;
    font-weight: 700;
    letter-spacing: 0.55px;
    line-height: 1.02;
  }

  /* BAND 2: UTC TIMELINE */
  .utc-strip {
    background: #141E2B;
    color: #F6F2E9;
    padding: 3px 8px;
    border-left: 4px solid #D8A449;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-family: "Avenir Next Condensed", sans-serif;
    font-size: 9.2px;
    font-weight: 600;
    letter-spacing: 0.25px;
    white-space: nowrap;
  }
  .utc-lbl { color: #FBE09B; font-weight: 800; letter-spacing: 0.7px; }
  .utc-t { color: #7EE0B5; font-weight: 800; }

  /* SHARED TOKENS */
  .pin-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    color: #FFFFFF;
    font-family: "Avenir Next", sans-serif;
    font-size: 8.4px;
    font-weight: 800;
    flex-shrink: 0;
  }
  .tag-c {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 12.5px;
    height: 12.5px;
    border-radius: 2px;
    background: #163F6B;
    color: #FFFFFF;
    font-family: "Avenir Next Condensed", sans-serif;
    font-size: 8.2px;
    font-weight: 800;
    flex-shrink: 0;
    margin-top: 1px;
  }
  .tag-q {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 12.5px;
    height: 12.5px;
    border-radius: 2px;
    background: #9E1F24;
    color: #FFFFFF;
    font-family: "Avenir Next Condensed", sans-serif;
    font-size: 8.4px;
    font-weight: 800;
    flex-shrink: 0;
    margin-top: 1px;
  }
  .src {
    font-family: "Avenir Next Condensed", sans-serif;
    font-size: 8.7px;
    font-weight: 700;
    color: #556072;
    white-space: nowrap;
  }
  .kicker {
    display: flex;
    align-items: center;
    gap: 4px;
    font-family: "Avenir Next Condensed", sans-serif;
    font-size: 9.6px;
    font-weight: 800;
    letter-spacing: 0.6px;
    text-transform: uppercase;
  }

  /* BAND 3: TOP 4 ILLUSTRATED LEADS */
  .leads-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 9px;
    border-bottom: 2px solid #121821;
    padding-bottom: 5px;
  }
  .lead-card {
    display: flex;
    flex-direction: column;
    gap: 2.5px;
    border-right: 1px solid #C8BFA8;
    padding-right: 9px;
  }
  .lead-card:last-child { border-right: none; padding-right: 0; }
  .art-wrap {
    position: relative;
    width: 100%;
    height: 82px;
    border: 1px solid #8E846E;
    overflow: hidden;
  }
  .art-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .art-note {
    position: absolute;
    right: 0;
    bottom: 0;
    background: rgba(18, 24, 33, 0.78);
    color: #F6F2E9;
    font-family: "Avenir Next Condensed", sans-serif;
    font-size: 7.4px;
    font-weight: 700;
    letter-spacing: 0.35px;
    padding: 1px 4px;
  }
  .lead-head {
    font-family: "Iowan Old Style", "Charter", Georgia, serif;
    font-size: 13px;
    font-weight: 800;
    line-height: 1.1;
    color: #121821;
  }
  .lead-body {
    font-size: 9.35px;
    line-height: 1.19;
    color: #1E2837;
  }

  /* BAND 4: MIDDLE ATLAS + SPOTLIGHTS + AUDIT */
  .mid-band {
    display: grid;
    grid-template-columns: 294px 396px 286px;
    gap: 10px;
    border-bottom: 2px solid #121821;
    padding-bottom: 5px;
    align-items: stretch;
  }
  .spot-col {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 4px;
  }
  .spot-card {
    background: #EFE9DA;
    border: 1px solid #C8BFA8;
    border-left: 3px solid #121821;
    padding: 4px 6px;
    display: flex;
    flex-direction: column;
    gap: 1.5px;
  }
  .spot-top {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .spot-title {
    font-family: "Iowan Old Style", Georgia, serif;
    font-size: 11.5px;
    font-weight: 800;
    line-height: 1.1;
    color: #121821;
  }
  .spot-body {
    font-size: 9.25px;
    line-height: 1.18;
    color: #202938;
  }

  .map-col {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    border-left: 1px solid #C8BFA8;
    border-right: 1px solid #C8BFA8;
    padding: 0 9px;
    gap: 3.5px;
  }
  .sec-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .sec-title {
    font-family: "Avenir Next Condensed", sans-serif;
    font-size: 10.6px;
    font-weight: 800;
    letter-spacing: 0.9px;
    color: #121821;
    text-transform: uppercase;
  }
  .sec-sub {
    font-size: 8.8px;
    font-weight: 700;
    color: #505A6B;
  }
  .legend {
    display: flex;
    justify-content: space-between;
    font-size: 8.3px;
    font-weight: 700;
    color: #263142;
  }
  .leg-item { display: inline-flex; align-items: center; gap: 3px; white-space: nowrap; }
  .dot { width: 6.5px; height: 6.5px; border-radius: 50%; display: inline-block; }
  .atlas-note {
    background: #EAE2D0;
    border: 1px solid #C8BFA8;
    padding: 4px 7px;
    font-size: 8.9px;
    line-height: 1.18;
    color: #1E2837;
  }

  .audit-col {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 5px;
  }
  .mkt-box {
    background: #141E2B;
    color: #F6F2E9;
    padding: 5px 7px;
    border-top: 3px solid #D8A449;
  }
  .mkt-hdr {
    font-family: "Avenir Next Condensed", sans-serif;
    font-size: 9.6px;
    font-weight: 800;
    letter-spacing: 0.9px;
    color: #FBE09B;
    border-bottom: 1px solid #2D3D52;
    padding-bottom: 2px;
    margin-bottom: 4px;
    display: flex;
    justify-content: space-between;
  }
  .mkt-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 3px 8px;
    font-family: "Avenir Next Condensed", sans-serif;
    font-size: 9.8px;
    font-weight: 700;
  }
  .mkt-row { display: flex; justify-content: space-between; }
  .up { color: #6BE0A8; }
  .dn { color: #FF8A85; }
  .audit-box {
    background: #EAE2D0;
    border: 1px solid #B8AD94;
    border-left: 3.5px solid #9E1F24;
    padding: 5px 7px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1;
    justify-content: center;
  }
  .audit-hdr {
    font-family: "Avenir Next Condensed", sans-serif;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.75px;
    color: #9E1F24;
    text-transform: uppercase;
  }
  .audit-txt {
    font-size: 8.95px;
    line-height: 1.18;
    color: #1A2331;
  }
  .key-strip {
    background: #EFE9DA;
    border: 1px solid #C8BFA8;
    padding: 3.5px 6px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 8.6px;
    font-weight: 700;
    color: #202938;
  }
  .key-group { display: inline-flex; align-items: center; gap: 4px; }

  /* BAND 5: GLOBAL WIRE DESK (3x2 REGIONAL GRID) */
  .desk-band {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
  }
  .desk-rows {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .desk-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }
  .reg-block {
    display: flex;
    flex-direction: column;
    gap: 3px;
    border-right: 1px solid #C8BFA8;
    padding-right: 11px;
  }
  .reg-block:last-child { border-right: none; padding-right: 0; }
  .reg-hdr {
    font-family: "Avenir Next Condensed", sans-serif;
    font-size: 9.8px;
    font-weight: 800;
    letter-spacing: 0.9px;
    color: #FFFFFF;
    padding: 1.5px 6px;
    display: flex;
    justify-content: space-between;
    text-transform: uppercase;
  }
  .brief {
    display: flex;
    align-items: flex-start;
    gap: 4px;
  }
  .brief-txt {
    font-size: 8.95px;
    line-height: 1.17;
    color: #1C2534;
  }
  .brief-hl { font-weight: 800; color: #121821; }

  /* FOOTER */
  .footer-folio {
    margin-top: auto;
    border-top: 1.5px solid #121821;
    padding-top: 2px;
    display: flex;
    justify-content: space-between;
    font-family: "Avenir Next Condensed", sans-serif;
    font-size: 8.8px;
    font-weight: 700;
    letter-spacing: 0.5px;
    color: #424C5C;
  }
</style>
</head>
<body>
  <div class="page">
    <header class="masthead">
      <div class="folio-strip">
        <span>GLOBAL FRONT PAGE · 7 REGIONS · 36 WIRE-SOURCED DISPATCHES</span>
        <span>CONFIRMED (C) vs CLAIMED (?) TAGGED · EDITORIAL ILLUSTRATIONS (NOT NEWS PHOTOS)</span>
      </div>
      <div class="title-row">
        <h1 class="title-main">THE WORLD IN ONE DAY</h1>
        <div class="date-plaque">
          <div class="date-day">THURSDAY</div>
          <div class="date-num">19 NOVEMBER 2026</div>
        </div>
      </div>
    </header>

    <div class="utc-strip">
      <span class="utc-lbl">UTC TIMELINE (19 NOV):</span>
      <span><b class="utc-t">00:00</b> NZ/AU GTA VI Rollout</span>
      <span><b class="utc-t">04:00</b> Odisha Evacuations</span>
      <span><b class="utc-t">07:00</b> Shenzhen 3-Way Statement</span>
      <span><b class="utc-t">10:00</b> ICJ Genocide Verdict</span>
      <span><b class="utc-t">13:00</b> COP31 Draft Outcry</span>
      <span><b class="utc-t">14:30</b> Anthropic IPO ($83)</span>
      <span><b class="utc-t">21:00</b> Dow 49,097 (-2.2%)</span>
    </div>

    <section class="leads-grid">
      <article class="lead-card">
        <div class="kicker" style="color:#165E4A;">
          ${pinBadge(1, 'asia')} ${statusTag('C')} <span>SHENZHEN · DIPLOMACY</span>
        </div>
        <div class="art-wrap">
          <img class="art-img" style="object-position:center 60%;" src="${artShenzhen}" alt="Summit table with US, China, Russia flags overlooking Shenzhen Bay" />
          <span class="art-note">Editorial illustration</span>
        </div>
        <h2 class="lead-head">Trump, Xi &amp; Putin Issue Shenzhen Summit Statement</h2>
        <p class="lead-body">APEC Kylin Villa talks yield 4-point pledge on nuclear risk, fuel supply &amp; UN reform while omitting Ukraine &amp; Iran; US-China tariff truce unchanged <span class="src">[CNA/Al Jazeera]</span>.</p>
      </article>

      <article class="lead-card">
        <div class="kicker" style="color:#163F6B;">
          ${pinBadge(2, 'europe')} ${statusTag('C')} <span>THE HAGUE · INT'L LAW</span>
        </div>
        <div class="art-wrap">
          <img class="art-img" src="${artIcj}" alt="Peace Palace and scales of justice" />
          <span class="art-note">Editorial illustration</span>
        </div>
        <h2 class="lead-head">ICJ Rules Myanmar Guilty of Rohingya Genocide</h2>
        <p class="lead-body">UN's top court holds a sovereign state accountable for genocide for the 1st time in its 80-year history (<em>The Gambia v. Myanmar</em>) <span class="src">[ICJ/CNN]</span>.</p>
      </article>

      <article class="lead-card">
        <div class="kicker" style="color:#B34717;">
          ${pinBadge(3, 'americas')} ${statusTag('C')} <span>NEW YORK · MARKETS &amp; AI</span>
        </div>
        <div class="art-wrap">
          <img class="art-img" src="${artAnthropic}" alt="Golden AI spire beside downward market candles" />
          <span class="art-note">Editorial illustration</span>
        </div>
        <h2 class="lead-head">Dow Drops Under 50,000; Record $81.3B AI IPO</h2>
        <p class="lead-body">Dow falls 1,101 pts (-2.19%) to 49,097 &amp; S&amp;P logs 6th straight loss (-2.02%) as Anthropic (ANT) lists at $83 and closes $97.17 (+17%) <span class="src">[Guardian/PBS]</span>.</p>
      </article>

      <article class="lead-card">
        <div class="kicker" style="color:#A12126;">
          ${pinBadge(4, 'mideast')} ${pinBadge(5, 'asia')} ${statusTag('C')} <span>CLIMATE &amp; STORM</span>
        </div>
        <div class="art-wrap">
          <img class="art-img" src="${artClimate}" alt="Cyclone vortex off eastern coastline" />
          <span class="art-note">Editorial illustration</span>
        </div>
        <h2 class="lead-head">COP31 Drops Fossil Text; Cyclone Akvan Nears</h2>
        <p class="lead-body">Antalya 2nd draft omits fossil-fuel phaseout as Panama warns of veto; India evacuates 100,000+ in Odisha &amp; Andhra ahead of 110 km/h gusts <span class="src">[CHN/Hindu]</span>.</p>
      </article>
    </section>

    <section class="mid-band">
      <div class="spot-col">
        <div class="spot-card" style="border-left-color:#163F6B;">
          <div class="spot-top">
            ${pinBadge(6, 'europe')} ${statusTag('?')}
            <span class="spot-title">Kerch Bridge Hit 3rd Time; Kyiv Drones</span>
          </div>
          <p class="spot-body">Ukraine says strikes hit Crimean Bridge again; Moscow halts truce talks; Russian drones damage Kyiv cathedral <span class="src">[ISW/Guardian]</span>.</p>
        </div>

        <div class="spot-card" style="border-left-color:#A12126;">
          <div class="spot-top">
            ${pinBadge(7, 'mideast')} ${statusTag('?')}
            <span class="spot-title">Hormuz Tanker Mines &amp; Gaza Raid</span>
          </div>
          <p class="spot-body">IRGC claims supertankers struck mines in Strait; IDF says troops conducted a ground raid near central Gaza's Nuseirat <span class="src">[Al-Monitor/FDD]</span>.</p>
        </div>

        <div class="spot-card" style="border-left-color:#163F6B;">
          <div class="spot-top">
            ${pinBadge(8, 'europe')} ${statusTag('C')}
            <span class="spot-title">Berlin Hosts 30+ European Leaders</span>
          </div>
          <p class="spot-body">Merz, Rutte &amp; Zelenskyy back EU + E5 (FR, DE, IT, PL, UK) talks seat; EU's Kallas summons Russian envoy <span class="src">[NATO/U24]</span>.</p>
        </div>

        <div class="spot-card" style="border-left-color:#5E2B6B;">
          <div class="spot-top">
            ${pinBadge(15, 'oceania')} ${statusTag('C')}
            <span class="spot-title">Grand Theft Auto VI Launches Globally</span>
          </div>
          <p class="spot-body">Drops from NZ westward on PS5/Xbox after 13-yr wait; Sensor Tower est. $2.36B &amp; 24.6M Day-1 copies <span class="src">[Statesman]</span>.</p>
        </div>
      </div>

      <div class="map-col">
        <div>
          <div class="sec-row" style="margin-bottom:2px;">
            <span class="sec-title">Global Story Atlas</span>
            <span class="sec-sub">#1–#16 by continent · #2 → Myanmar</span>
          </div>
          ${worldMap}
          <div class="legend" style="margin-top:3px;">
            <span class="leg-item"><i class="dot" style="background:#B34717;"></i>Americas</span>
            <span class="leg-item"><i class="dot" style="background:#163F6B;"></i>Europe</span>
            <span class="leg-item"><i class="dot" style="background:#A12126;"></i>Mid-East</span>
            <span class="leg-item"><i class="dot" style="background:#8A5A00;"></i>Africa</span>
            <span class="leg-item"><i class="dot" style="background:#165E4A;"></i>Asia</span>
            <span class="leg-item"><i class="dot" style="background:#5E2B6B;"></i>Oceania</span>
          </div>
        </div>

        <div class="atlas-note">
          <strong>Map Coverage:</strong> Markers #1–#16 map each continent's headline stories (including Americas, Europe, Middle East, Africa, Asia &amp; Oceania) with zero unpinned regions.
        </div>
      </div>

      <div class="audit-col">
        <div class="mkt-box">
          <div class="mkt-hdr"><span>19 NOV GLOBAL CLOSE</span><span>WIRE DATA</span></div>
          <div class="mkt-grid">
            <div class="mkt-row"><span>DOW</span><span class="dn">49,097 (-2.2%)</span></div>
            <div class="mkt-row"><span>S&amp;P 500</span><span class="dn">7,176 (-2.0%)</span></div>
            <div class="mkt-row"><span>NASDAQ</span><span class="dn">23,879 (-2.3%)</span></div>
            <div class="mkt-row"><span>ANT IPO</span><span class="up">$97.17 (+17%)</span></div>
            <div class="mkt-row"><span>BRENT</span><span class="up">$90.58 (+1.0%)</span></div>
            <div class="mkt-row"><span>GOLD</span><span class="dn">$3,595 (-1.8%)</span></div>
          </div>
        </div>

        <div class="audit-box">
          <div class="audit-hdr">DATE-CHECK AUDIT · THU 19 NOV 2026</div>
          <p class="audit-txt"><strong>Window Verified:</strong> All 36 reports occurred or closed on 19 Nov 2026 UTC across multi-wire sources.</p>
          <p class="audit-txt"><strong>Excluded Pre-19 Nov:</strong> Voyager 1 light-day (17–18 Nov), Manila Quad summit (17 Nov) &amp; Qeshm strikes (17 Nov).</p>
          <p class="audit-txt"><strong>Attribution Rule:</strong> Disputed strikes (#6 Kerch, #7 Hormuz/Gaza, Saudi intercepts) carry <span class="src">[Claimant]</span> &amp; <strong>?</strong> tag.</p>
        </div>

        <div class="key-strip">
          <span class="key-group">${statusTag('C')} Confirmed (Court/Close/Off.)</span>
          <span class="key-group">${statusTag('?')} Claimed / Attributed</span>
        </div>
      </div>
    </section>

    <section class="desk-band">
      <div class="sec-row">
        <span class="sec-title">Global Regional Desk · 28 Additional Wire-Sourced Reports (19 Nov 2026)</span>
        <span class="sec-sub">North America · Latin America · Europe · Middle East · Africa · Asia-Pacific &amp; Health</span>
      </div>
      <div class="desk-rows">
        <div class="desk-row">
          <div class="reg-block">
            <div class="reg-hdr" style="background:#B34717;"><span>NORTH AMERICA</span><span>5 ITEMS</span></div>
            <div class="brief">${statusTag('C')}<p class="brief-txt"><span class="brief-hl">US Cyber Ouster:</span> WH cyber chief Sean Cairncross removed after transport &amp; bank outages <span class="src">[Guardian]</span>.</p></div>
            <div class="brief">${statusTag('C')}<p class="brief-txt"><span class="brief-hl">Palantir Spy Case:</span> DOJ charges Russian national Igor Dyu with tracking defense-tech staff <span class="src">[DOJ]</span>.</p></div>
            <div class="brief">${statusTag('C')}<p class="brief-txt"><span class="brief-hl">Canada Auto Tariffs:</span> Min. LeBlanc warns no US deal ahead of Jan 50% auto tariff <span class="src">[Reuters]</span>.</p></div>
            <div class="brief">${pinBadge(16, 'americas')}${statusTag('C')}<p class="brief-txt"><span class="brief-hl">Surgical Robotics:</span> J&amp;J installs 1st commercial FDA-cleared OTTAVA system in Texas <span class="src">[J&amp;J]</span>.</p></div>
            <div class="brief">${statusTag('C')}<p class="brief-txt"><span class="brief-hl">Crypto &amp; Tech Selloff:</span> Bitcoin slides 1.8% to $61,953 as megacaps AMZN, GOOG &amp; META drop 3%+ <span class="src">[TradingKey]</span>.</p></div>
          </div>

          <div class="reg-block">
            <div class="reg-hdr" style="background:#B34717;"><span>LATIN AMERICA</span><span>4 ITEMS</span></div>
            <div class="brief">${pinBadge(9, 'americas')}${statusTag('C')}<p class="brief-txt"><span class="brief-hl">US–Ecuador Security:</span> Sec. Hegseth meets Pres. Noboa in Quito on joint maritime interdictions <span class="src">[War.gov]</span>.</p></div>
            <div class="brief">${statusTag('C')}<p class="brief-txt"><span class="brief-hl">Colombia Walkout:</span> National union strike disrupts transit across Bogotá, Medellín &amp; Cali <span class="src">[AP]</span>.</p></div>
            <div class="brief">${statusTag('C')}<p class="brief-txt"><span class="brief-hl">Chile–Philippines FTA:</span> Manila inks CEPA deal with Santiago at APEC — its 1st LatAm trade pact <span class="src">[BWorld]</span>.</p></div>
            <div class="brief">${statusTag('C')}<p class="brief-txt"><span class="brief-hl">Mexico Peso &amp; Brazil:</span> Peso slips past 19/USD; German FM visits VW São Paulo plants <span class="src">[Briefs/Time]</span>.</p></div>
          </div>

          <div class="reg-block">
            <div class="reg-hdr" style="background:#163F6B;"><span>EUROPE</span><span>5 ITEMS</span></div>
            <div class="brief">${statusTag('C')}<p class="brief-txt"><span class="brief-hl">IAEA Safeguards:</span> US, UK, France &amp; Germany rebuke Iran NPT compliance at Vienna Board <span class="src">[US Mission]</span>.</p></div>
            <div class="brief">${statusTag('C')}<p class="brief-txt"><span class="brief-hl">EU Sovereign AI:</span> Deutsche Telekom invests €100M in Mistral AI Series D for EU cloud <span class="src">[Reuters]</span>.</p></div>
            <div class="brief">${statusTag('C')}<p class="brief-txt"><span class="brief-hl">Bomb-Threat Probe:</span> Police across FR, IT, ES, PL &amp; DE coordinate on school &amp; flight alerts <span class="src">[AP]</span>.</p></div>
            <div class="brief">${statusTag('C')}<p class="brief-txt"><span class="brief-hl">EU Ukraine Aid:</span> Leaders weigh €45B Ukraine loan framework amid Winter grid pressure <span class="src">[Reuters]</span>.</p></div>
            <div class="brief">${statusTag('C')}<p class="brief-txt"><span class="brief-hl">Women's Cycling:</span> TotalEnergies exits men's WorldTour for 5-yr FDJ United-Suez women's deal <span class="src">[Sportcal]</span>.</p></div>
          </div>
        </div>

        <div class="desk-row">
          <div class="reg-block">
            <div class="reg-hdr" style="background:#A12126;"><span>MIDDLE EAST</span><span>4 ITEMS</span></div>
            <div class="brief">${statusTag('?')}<p class="brief-txt"><span class="brief-hl">Saudi Intercepts:</span> Coalition says air defenses downed Houthi drones &amp; missiles near border <span class="src">[CBS]</span>.</p></div>
            <div class="brief">${statusTag('C')}<p class="brief-txt"><span class="brief-hl">OIC Gaza Call:</span> Iran FM Araghchi seeks emergency OIC ministerial session over Gaza crisis <span class="src">[PChron]</span>.</p></div>
            <div class="brief">${statusTag('C')}<p class="brief-txt"><span class="brief-hl">UAE Storm &amp; Quake:</span> Heavy rains bring Fujairah &amp; RAK flood alerts alongside offshore tremor <span class="src">[National]</span>.</p></div>
            <div class="brief">${statusTag('C')}<p class="brief-txt"><span class="brief-hl">Illicit Gold Trade:</span> SWISSAID report traces 453t of undisclosed African gold into UAE hubs <span class="src">[SWISSAID]</span>.</p></div>
          </div>

          <div class="reg-block">
            <div class="reg-hdr" style="background:#8A5A00;"><span>AFRICA</span><span>5 ITEMS</span></div>
            <div class="brief">${pinBadge(10, 'africa')}${statusTag('C')}<p class="brief-txt"><span class="brief-hl">Nigeria Policing:</span> All 36 state assemblies ratify constitutional amendment for state police <span class="src">[AllAfrica]</span>.</p></div>
            <div class="brief">${pinBadge(11, 'africa')}${statusTag('C')}<p class="brief-txt"><span class="brief-hl">South Africa Rates:</span> SARB holds 7.25% repo rate (5.2% CPI); hail hits Potchefstroom <span class="src">[SARB]</span>.</p></div>
            <div class="brief">${pinBadge(12, 'africa')}${statusTag('C')}<p class="brief-txt"><span class="brief-hl">Kenya Athletics:</span> AIU gives Olympic marathon winner Peres Jepchirchir 3-yr EPO ban <span class="src">[AIU/AJ]</span>.</p></div>
            <div class="brief">${statusTag('C')}<p class="brief-txt"><span class="brief-hl">Tech &amp; Trade Expos:</span> Cape Town Africa Tech Fest backs AI sovereignty; China-Africa Expo opens <span class="src">[EQS]</span>.</p></div>
            <div class="brief">${statusTag('C')}<p class="brief-txt"><span class="brief-hl">ECOWAS Force:</span> Inspection team concludes readiness check of Nigerian units in Ondo &amp; Lagos <span class="src">[ECOWAS]</span>.</p></div>
          </div>

          <div class="reg-block">
            <div class="reg-hdr" style="background:#165E4A;"><span>ASIA-PACIFIC, OCEANIA &amp; HEALTH</span><span>5 ITEMS</span></div>
            <div class="brief">${pinBadge(13, 'asia')}${statusTag('C')}<p class="brief-txt"><span class="brief-hl">South Korea Court:</span> Supreme Court overturns ex-PM Han Duck-soo's 15-yr sentence, orders retrial <span class="src">[JT]</span>.</p></div>
            <div class="brief">${statusTag('C')}<p class="brief-txt"><span class="brief-hl">APEC Bilaterals:</span> Japan PM Takaichi meets Xi; NZ PM Luxon condemns Ukraine invasion <span class="src">[Guardian]</span>.</p></div>
            <div class="brief">${pinBadge(14, 'asia')}${statusTag('C')}<p class="brief-txt"><span class="brief-hl">Quake &amp; Chips:</span> M5.9 quake hits Indonesia's Flores region; Taiwan shares drop 4.4% <span class="src">[Ammon/Reuters]</span>.</p></div>
            <div class="brief">${statusTag('C')}<p class="brief-txt"><span class="brief-hl">Walkleys &amp; Cricket:</span> Nick McKenzie wins Gold Walkley; BCCI gives HK Sixes fees to para cricket <span class="src">[BNN]</span>.</p></div>
            <div class="brief">${statusTag('C')}<p class="brief-txt"><span class="brief-hl">WHO &amp; Obesity Science:</span> WHO backs science trust push; Alberta GLP-1 study flags metabolic shift <span class="src">[WHO]</span>.</p></div>
          </div>
        </div>
      </div>
    </section>

    <footer class="footer-folio">
      <span>THURSDAY 19 NOVEMBER 2026 · 36 WIRE-SOURCED STORIES · 7 REGIONS · EDITORIAL ILLUSTRATIONS (NOT NEWS PHOTOS)</span>
      <span>REUTERS · AP · CNN · GUARDIAN · AL JAZEERA · CNA · HINDU · ICJ · NATO · WHO</span>
    </footer>
  </div>
</body>
</html>`;
}

function render(): void {
  if (!existsSync(CHROME_PATH)) {
    throw new Error(`Google Chrome binary not found at ${CHROME_PATH}`);
  }
  const tmpHtml = join(ROOT_DIR, '.tmp-broadsheet.html');
  const tmpRaw2x = join(ROOT_DIR, '.tmp-broadsheet-2x.png');
  const tmpCandidatePng = join(ROOT_DIR, '.tmp-entry-1x.png');
  mkdirSync(ROOT_DIR, { recursive: true });
  writeFileSync(tmpHtml, buildHtml(), 'utf8');

  try {
    execFileSync(
      CHROME_PATH,
      [
        '--headless=new',
        '--disable-gpu',
        '--hide-scrollbars',
        '--no-sandbox',
        '--window-size=1024,1024',
        '--force-device-scale-factor=2',
        `--screenshot=${tmpRaw2x}`,
        `file://${tmpHtml}`,
      ],
      { stdio: 'pipe' }
    );

    execFileSync(
      'ffmpeg',
      [
        '-y',
        '-v',
        'error',
        '-i',
        tmpRaw2x,
        '-vf',
        'scale=1024:1024:flags=lanczos',
        '-compression_level',
        '9',
        tmpCandidatePng,
      ],
      { stdio: 'pipe' }
    );

    const pngSize = statSync(tmpCandidatePng).size;
    if (pngSize <= 1035000) {
      writeFileSync(OUT_ASSET, readFileSync(tmpCandidatePng));
      console.log(`Rendered lossless PNG ${OUT_ASSET}: ${pngSize} bytes`);
    } else {
      let encoded = false;
      for (const q of ['2', '3', '4', '5']) {
        execFileSync(
          'ffmpeg',
          [
            '-y',
            '-v',
            'error',
            '-i',
            tmpRaw2x,
            '-vf',
            'scale=1024:1024:flags=lanczos',
            '-f',
            'mjpeg',
            '-pix_fmt',
            'yuvj444p',
            '-q:v',
            q,
            OUT_ASSET,
          ],
          { stdio: 'pipe' }
        );
        const sz = statSync(OUT_ASSET).size;
        if (sz <= MAX_BYTES) {
          console.log(`Rendered JPEG(4:4:4, q=${q}) ${OUT_ASSET}: ${sz} bytes (raw PNG was ${pngSize})`);
          encoded = true;
          break;
        }
      }
      if (!encoded) {
        throw new Error('Could not fit rendered image within 1 MiB limit');
      }
    }
  } finally {
    for (const tmp of [tmpHtml, tmpRaw2x, tmpCandidatePng]) {
      if (existsSync(tmp)) unlinkSync(tmp);
    }
  }
}

render();
