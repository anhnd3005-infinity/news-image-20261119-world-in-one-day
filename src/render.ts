import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const ASSETS_DIR = join(ROOT_DIR, 'assets');
const OUT_ASSET = join(ROOT_DIR, 'entry.png');
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const MAX_BYTES = 1048576;

type BeatKey = 'diplomacy' | 'markets' | 'law' | 'culture' | 'conflict' | 'climate' | 'science';

const BEAT_COLOR: Record<BeatKey, string> = {
  diplomacy: '#163F6B',
  markets: '#9A550A',
  law: '#244A73',
  culture: '#632968',
  conflict: '#A12126',
  climate: '#165E4A',
  science: '#3D346E',
};

interface MapPin {
  id: number;
  lon: number;
  lat: number;
  beat: BeatKey;
  hero?: boolean;
}

// 20 spaced cartographic pins matching dispatches #1–#20.
const MAP_PINS: MapPin[] = [
  { id: 1, lon: 113.5, lat: 23.0, beat: 'diplomacy', hero: true },
  { id: 2, lon: -71.5, lat: 41.0, beat: 'markets', hero: true },
  { id: 3, lon: 4.5, lat: 54.0, beat: 'law', hero: true },
  { id: 4, lon: -80.2, lat: 24.5, beat: 'culture', hero: true },
  { id: 5, lon: 55.8, lat: 25.5, beat: 'conflict', hero: true },
  { id: 6, lon: 86.2, lat: 15.0, beat: 'climate', hero: true },
  { id: 7, lon: -86.0, lat: 42.5, beat: 'conflict' },
  { id: 8, lon: -121.5, lat: 37.5, beat: 'conflict' },
  { id: 9, lon: -77.0, lat: 55.5, beat: 'markets' },
  { id: 10, lon: -77.5, lat: -3.0, beat: 'diplomacy' },
  { id: 11, lon: 22.0, lat: 54.0, beat: 'diplomacy' },
  { id: 12, lon: -7.5, lat: 57.5, beat: 'law' },
  { id: 13, lon: -3.0, lat: 42.0, beat: 'markets' },
  { id: 14, lon: 27.5, lat: -27.5, beat: 'markets' },
  { id: 15, lon: 7.5, lat: 9.0, beat: 'diplomacy' },
  { id: 16, lon: 38.0, lat: -2.0, beat: 'culture' },
  { id: 17, lon: 128.0, lat: 38.0, beat: 'law' },
  { id: 18, lon: 149.0, lat: -32.0, beat: 'culture' },
  { id: 19, lon: -99.0, lat: 29.5, beat: 'science' },
  { id: 20, lon: 12.0, lat: 42.0, beat: 'science' },
];

// Secondary Crimea/Kerch & Antalya markers linked to Dispatches #5 and #6.
const SECONDARY_PULSES: Array<{ lon: number; lat: number; beat: BeatKey }> = [
  { lon: 36.5, lat: 45.3, beat: 'conflict' },
  { lon: 30.7, lat: 36.9, beat: 'climate' },
];

// Detailed generalized landmass polygons in [lon, lat].
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
  // Baffin & Cuba/Hispaniola accents
  [[-84, 22], [-75, 20], [-76, 22], [-84, 23]],
  // Greenland
  [[-52, 60], [-42, 60], [-20, 71], [-22, 81], [-45, 82], [-66, 77], [-54, 68]],
  // South America
  [
    [-78, 9], [-72, 12], [-61, 10], [-50, 1], [-35, -6], [-38, -14],
    [-41, -22], [-48, -28], [-54, -34], [-62, -40], [-67, -50], [-69, -55],
    [-74, -52], [-73, -41], [-71, -30], [-70, -18], [-77, -12], [-81, -5], [-79, 2],
  ],
  // Mainland Europe (Scandinavia, Iberia, Italy, Balkans, East Europe)
  [
    [-9, 37], [-9, 43], [-2, 43], [-5, 48], [2, 51], [8, 54], [10, 57],
    [12, 55], [6, 59], [5, 62], [14, 68], [26, 71], [40, 68], [58, 69],
    [58, 52], [44, 44], [38, 45], [30, 46], [28, 41], [23, 37], [19, 40],
    [16, 38], [18, 41], [14, 41], [12, 45], [8, 44], [3, 42], [-2, 37],
  ],
  // Great Britain & Ireland
  [[-6, 50], [2, 51], [0, 56], [-5, 58], [-7, 54]],
  [[-10, 52], [-6, 52], [-6, 55], [-10, 54]],
  // Africa
  [
    [-17, 15], [-16, 23], [-6, 36], [10, 37], [12, 33], [25, 32], [33, 31],
    [38, 22], [43, 12], [51, 12], [45, 2], [40, -10], [35, -24], [28, -33],
    [19, -35], [15, -26], [12, -14], [9, 4], [2, 6], [-8, 5], [-14, 9],
  ],
  // Madagascar
  [[44, -25], [47, -25], [50, -15], [49, -12], [44, -17]],
  // Asia + Arabian Peninsula + India + SE Asia
  [
    [27, 41], [36, 37], [35, 30], [43, 13], [53, 16], [59, 22], [56, 26],
    [49, 29], [58, 25], [67, 25], [73, 19], [77, 8], [80, 13], [87, 22],
    [92, 21], [97, 16], [100, 7], [104, 2], [104, 10], [109, 13], [107, 21],
    [114, 22], [121, 25], [122, 32], [119, 39], [126, 38], [129, 35], [131, 42],
    [141, 52], [160, 60], [176, 66], [162, 70], [128, 72], [98, 76], [70, 72],
    [58, 69], [58, 52], [44, 44], [38, 45], [32, 41],
  ],
  // Japan, Philippines, Indonesia, Taiwan
  [[130, 32], [136, 34], [141, 38], [145, 44], [141, 45], [139, 39], [132, 34]],
  [[120, 18], [124, 14], [126, 7], [122, 8], [120, 14]],
  [[96, 5], [104, 1], [106, -6], [114, -8], [116, -2], [106, -4], [98, 1]],
  [[109, 1], [117, 6], [118, 1], [114, -3], [110, -3]],
  // Australia, Tasmania & New Zealand
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

function project(lon: number, lat: number, w = 388, h = 196): [number, number] {
  const x = ((lon + 168) / 352) * w;
  const y = ((78 - lat) / 134) * h;
  return [Number(x.toFixed(1)), Number(y.toFixed(1))];
}

function buildWorldMapSvg(): string {
  const w = 388;
  const h = 208;

  const gridLines: string[] = [];
  for (const lat of [-30, 0, 30, 60]) {
    const [, y] = project(0, lat, w, h);
    gridLines.push(
      `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="${lat === 0 ? '#A5BBC9' : '#C5D5E0'}" stroke-width="${lat === 0 ? '0.95' : '0.6'}" stroke-dasharray="${lat === 0 ? '4,3' : '2,3'}"/>`
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
    return `<polygon points="${pts.map(([x, y]) => `${x},${y}`).join(' ')}" fill="none" stroke="#B7CAD7" stroke-width="2.6" stroke-linejoin="round"/>`;
  }).join('');

  const landShapes = CONTINENTS.map((poly) => {
    const pts = poly.map(([lon, lat]) => project(lon, lat, w, h));
    return `<polygon points="${pts.map(([x, y]) => `${x},${y}`).join(' ')}" fill="#DFD5BF" stroke="#8C806A" stroke-width="0.85" stroke-linejoin="round"/>`;
  }).join('');

  const regionTags = [
    { text: 'N. AMERICA', lon: -108, lat: 55 },
    { text: 'S. AMERICA', lon: -56, lat: -13 },
    { text: 'AFRICA', lon: 22, lat: 17 },
    { text: 'EURASIA', lon: 84, lat: 58 },
    { text: 'OCEANIA', lon: 132, lat: -24 },
  ]
    .map((r) => {
      const [rx, ry] = project(r.lon, r.lat, w, h);
      return `<text x="${rx}" y="${ry}" text-anchor="middle" font-family="Avenir Next Condensed, Helvetica Neue, sans-serif" font-size="6.8" font-weight="800" letter-spacing="1.1" fill="#6E6554" opacity="0.8">${r.text}</text>`;
    })
    .join('');

  const pulses = SECONDARY_PULSES.map((p) => {
    const [cx, cy] = project(p.lon, p.lat, w, h);
    const fill = BEAT_COLOR[p.beat];
    return `<circle cx="${cx}" cy="${cy}" r="6.5" fill="${fill}" opacity="0.24"/><circle cx="${cx}" cy="${cy}" r="3.1" fill="${fill}" stroke="#F6F2E9" stroke-width="1"/>`;
  }).join('');

  const sortedPins = [...MAP_PINS].sort((a, b) => Number(!!a.hero) - Number(!!b.hero));
  const pins = sortedPins
    .map((pin) => {
      const [cx, cy] = project(pin.lon, pin.lat, w, h);
      const fill = BEAT_COLOR[pin.beat];
      const r = pin.hero ? 7.6 : 6.4;
      const fs = pin.hero ? 8.3 : 7.0;
      return `
        <g>
          ${pin.hero ? `<circle cx="${cx}" cy="${cy}" r="11.2" fill="${fill}" opacity="0.20"/>` : ''}
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="#F6F2E9" stroke-width="1.25"/>
          <text x="${cx}" y="${cy + (pin.hero ? 2.8 : 2.4)}" text-anchor="middle" font-family="Avenir Next, Helvetica Neue, sans-serif" font-size="${fs}" font-weight="800" fill="#FFFFFF">${pin.id}</text>
        </g>`;
    })
    .join('');

  return `
    <svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:auto;background:#DCE7EE;border:1px solid #B7AE99;">
      ${gridLines.join('')}
      ${landHalos}
      ${landShapes}
      ${regionTags}
      ${pulses}
      ${pins}
    </svg>`;
}

function buildHtml(): string {
  const artShenzhen = loadArtDataUri('art-shenzhen.jpg');
  const artAnthropic = loadArtDataUri('art-anthropic.jpg');
  const artIcj = loadArtDataUri('art-icj.jpg');
  const artGtavi = loadArtDataUri('art-gtavi.jpg');
  const artConflict = loadArtDataUri('art-conflict.jpg');
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
    position: relative;
    width: 1024px;
    height: 1024px;
    padding: 8px 15px 7px 15px;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    gap: 6px;
    border-top: 5px solid #121821;
    background: radial-gradient(circle at 50% 0%, #FAF7F0 0%, #F5F0E5 62%, #EFE8D9 100%);
  }

  /* MASTHEAD */
  .masthead {
    border-bottom: 2.5px solid #121821;
    padding-bottom: 4px;
  }
  .folio-strip {
    display: flex;
    justify-content: space-between;
    font-family: "Avenir Next Condensed", "DIN Alternate", sans-serif;
    font-size: 9.6px;
    font-weight: 700;
    letter-spacing: 1.2px;
    color: #424C5C;
    border-bottom: 1px solid #C8BFA8;
    padding-bottom: 2.5px;
    margin-bottom: 3px;
    text-transform: uppercase;
  }
  .title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
  }
  .title-wrap {
    display: flex;
    flex-direction: column;
  }
  .title-main {
    font-family: "Bodoni 72", "Big Caslon", "Didot", Georgia, serif;
    font-size: 42px;
    font-weight: 800;
    letter-spacing: -0.4px;
    line-height: 0.96;
    color: #121821;
  }
  .date-plaque {
    background: #9E1F24;
    color: #FFFFFF;
    padding: 4px 13px 4px 13px;
    border: 2px solid #121821;
    box-shadow: inset 0 0 0 1px #D8A449;
    text-align: center;
    flex-shrink: 0;
  }
  .date-day {
    font-family: "Avenir Next Condensed", "DIN Alternate", sans-serif;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 2.4px;
    color: #FCE3A6;
    line-height: 1.05;
  }
  .date-num {
    font-family: "DIN Condensed", "Avenir Next Condensed", sans-serif;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: 0.6px;
    line-height: 1.02;
  }

  /* SHARED TOKENS */
  .kicker {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-family: "Avenir Next Condensed", "DIN Alternate", sans-serif;
    font-size: 10.3px;
    font-weight: 800;
    letter-spacing: 0.85px;
    text-transform: uppercase;
  }
  .num-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 15.5px;
    height: 15.5px;
    border-radius: 50%;
    color: #FFFFFF;
    font-family: "Avenir Next", sans-serif;
    font-size: 9.2px;
    font-weight: 800;
    flex-shrink: 0;
  }
  .art-frame {
    display: block;
    width: 100%;
    object-fit: cover;
    border: 1px solid #9D937E;
  }

  /* TOP HERO SPREAD */
  .hero-band {
    display: grid;
    grid-template-columns: 584px 396px;
    gap: 14px;
    border-bottom: 2px solid #121821;
    padding-bottom: 6px;
  }
  .hero-lead {
    display: flex;
    flex-direction: column;
    gap: 3.5px;
    border-right: 1px solid #C8BFA8;
    padding-right: 13px;
  }
  .hero-lead .art-frame {
    height: 176px;
  }
  .hero-lead-head {
    font-family: "Iowan Old Style", "Charter", Georgia, serif;
    font-size: 21px;
    font-weight: 800;
    line-height: 1.08;
    letter-spacing: -0.2px;
    color: #121821;
  }
  .hero-lead-body {
    font-size: 11.1px;
    line-height: 1.25;
    color: #202938;
  }

  .hero-side {
    display: flex;
    flex-direction: column;
    gap: 3.5px;
  }
  .hero-side .art-frame {
    height: 145px;
  }
  .ticker-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #141E2B;
    color: #F4EFE4;
    padding: 3px 8px;
    font-family: "Avenir Next Condensed", sans-serif;
    font-size: 10.1px;
    font-weight: 700;
    letter-spacing: 0.4px;
    border: 1px solid #121821;
  }
  .tick-up { color: #6BE0A8; }
  .tick-dn { color: #FF8A85; }
  .hero-side-head {
    font-family: "Iowan Old Style", "Charter", Georgia, serif;
    font-size: 17px;
    font-weight: 800;
    line-height: 1.1;
    color: #121821;
  }
  .hero-side-body {
    font-size: 10.9px;
    line-height: 1.24;
    color: #202938;
  }

  /* MIDDLE 3-COLUMN FEATURE BAND */
  .mid-band {
    display: grid;
    grid-template-columns: 288px 390px 288px;
    gap: 14px;
    border-bottom: 2px solid #121821;
    padding-bottom: 6px;
  }
  .mid-col {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 6px;
  }
  .feat-card {
    display: flex;
    flex-direction: column;
    gap: 2.5px;
    background: #EFE9DA;
    border: 1px solid #C8BFA8;
    border-top: 3px solid #121821;
    padding: 4.5px 7px 5px 7px;
  }
  .feat-card .art-frame {
    height: 102px;
  }
  .feat-head {
    font-family: "Iowan Old Style", "Charter", Georgia, serif;
    font-size: 13.4px;
    font-weight: 800;
    line-height: 1.12;
    color: #121821;
  }
  .feat-body {
    font-size: 10.2px;
    line-height: 1.22;
    color: #212A39;
  }

  /* CENTER MAP COLUMN */
  .map-col {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    gap: 8px;
    border-left: 1px solid #C8BFA8;
    border-right: 1px solid #C8BFA8;
    padding: 0 11px;
  }
  .map-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 3px;
  }
  .sec-title {
    font-family: "Avenir Next Condensed", "DIN Alternate", sans-serif;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 1.05px;
    color: #121821;
    text-transform: uppercase;
  }
  .sec-sub {
    font-size: 9.2px;
    font-weight: 700;
    color: #505A6B;
  }
  .legend {
    display: flex;
    justify-content: space-between;
    flex-wrap: nowrap;
    margin-top: 4px;
    font-size: 8.5px;
    font-weight: 700;
    color: #2A3444;
  }
  .legend-item {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    white-space: nowrap;
  }
  .dot {
    width: 6.5px;
    height: 6.5px;
    border-radius: 50%;
    display: inline-block;
  }
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
  }
  .stat-card {
    background: #141E2B;
    color: #F6F2E9;
    padding: 5.5px 8px;
    border-left: 3.5px solid #D8A449;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 1px;
  }
  .stat-val {
    font-family: "Bodoni 72", "Iowan Old Style", Georgia, serif;
    font-size: 16.5px;
    font-weight: 800;
    line-height: 1.02;
    color: #FBE09B;
    white-space: nowrap;
  }
  .stat-lbl {
    font-family: "Avenir Next Condensed", sans-serif;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: #DCE3ED;
    white-space: nowrap;
  }
  .key-line {
    margin-top: auto;
    background: #EAE2D0;
    border: 1px solid #C8BFA8;
    border-left: 3.5px solid #9E1F24;
    padding: 5px 8px;
    font-size: 9.9px;
    line-height: 1.24;
    color: #1A2331;
  }

  /* REGIONAL DISPATCHES DESK */
  .dispatches-band {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
  }
  .dispatches-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    border-bottom: 1px solid #C8BFA8;
    padding-bottom: 2px;
  }
  .desk-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0;
  }
  .desk-col {
    display: flex;
    flex-direction: column;
    gap: 3.5px;
    padding: 0 8px;
    border-right: 1px solid #C8BFA8;
  }
  .desk-col:first-child { padding-left: 0; }
  .desk-col:last-child { padding-right: 0; border-right: none; }
  .region-hdr {
    font-family: "Avenir Next Condensed", sans-serif;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 1.1px;
    color: #163F6B;
    border-bottom: 1.5px solid #121821;
    padding-bottom: 1.5px;
    text-transform: uppercase;
  }
  .brief {
    display: flex;
    gap: 5px;
    align-items: flex-start;
  }
  .brief .num-badge {
    width: 14px;
    height: 14px;
    font-size: 8.3px;
    margin-top: 1px;
  }
  .brief-text {
    font-size: 9.7px;
    line-height: 1.2;
    color: #1E2837;
  }
  .brief-head {
    font-weight: 800;
    color: #121821;
  }

  /* FOOTER FOLIO */
  .footer-folio {
    margin-top: auto;
    border-top: 1.5px solid #121821;
    padding-top: 3px;
    display: flex;
    justify-content: space-between;
    font-family: "Avenir Next Condensed", sans-serif;
    font-size: 9.2px;
    font-weight: 700;
    letter-spacing: 0.6px;
    color: #465061;
  }
</style>
</head>
<body>
  <div class="page">
    <header class="masthead">
      <div class="folio-strip">
        <span>GLOBAL EDITION · SEVEN CONTINENTS &amp; SEAS · 20 VERIFIED DISPATCHES</span>
        <span>DIPLOMACY · MARKETS · INT'L LAW · CULTURE · WAR · CLIMATE · SCIENCE · SPORT</span>
      </div>
      <div class="title-row">
        <div class="title-wrap">
          <h1 class="title-main">THE WORLD IN ONE DAY</h1>
        </div>
        <div class="date-plaque">
          <div class="date-day">THURSDAY</div>
          <div class="date-num">19 NOVEMBER 2026</div>
        </div>
      </div>
    </header>

    <section class="hero-band">
      <article class="hero-lead">
        <img class="art-frame" src="${artShenzhen}" alt="Three leaders at circular Shenzhen summit table" />
        <div class="kicker" style="color:#163F6B;">
          <span class="num-badge" style="background:#163F6B;">1</span>
          <span>DIPLOMACY LEAD · APEC SHENZHEN, CHINA</span>
        </div>
        <h2 class="hero-lead-head">Trump, Xi &amp; Putin Hold Historic Three-Way Summit</h2>
        <p class="hero-lead-body">Meeting around a circular table at Kylin Villa, the US, Chinese and Russian leaders issue a 4-point declaration on nuclear risk reduction, energy supply and UN reform while omitting Ukraine and Iran; bilateral trade truce talks yield no tariff extension.</p>
      </article>

      <article class="hero-side">
        <img class="art-frame" src="${artAnthropic}" alt="Golden AI tower beside falling market candles" />
        <div class="ticker-bar">
          <span>ANT IPO $83 → CLOSE $97.17 <em class="tick-up" style="font-style:normal;">+17%</em></span>
          <span>S&amp;P <em class="tick-dn" style="font-style:normal;">-2.0%</em></span>
          <span>NVDA $145.98 <em class="tick-dn" style="font-style:normal;">-3.3%</em></span>
        </div>
        <div class="kicker" style="color:#9A550A;">
          <span class="num-badge" style="background:#9A550A;">2</span>
          <span>MARKETS &amp; AI · NEW YORK</span>
        </div>
        <h2 class="hero-side-head">Anthropic Sets US Record With $81.3B IPO as Equities Slide</h2>
        <p class="hero-side-body">Claude maker lists on Nasdaq near $1.5T valuation (opening $111.50), yet S&amp;P 500 drops for a 6th straight session (-2.0%), Nasdaq falls 2.3% and Nvidia slides post-Jensen Huang resignation.</p>
      </article>
    </section>

    <section class="mid-band">
      <div class="mid-col">
        <article class="feat-card" style="border-top-color:#244A73;">
          <div class="kicker" style="color:#244A73;">
            <span class="num-badge" style="background:#244A73;">3</span>
            <span>INT'L LAW · THE HAGUE</span>
          </div>
          <img class="art-frame" src="${artIcj}" alt="Peace Palace and brass scales" />
          <h3 class="feat-head">ICJ Rules Myanmar Committed Rohingya Genocide</h3>
          <p class="feat-body">UN's top court delivers landmark 80-year first verdict against a state in <em>The Gambia v. Myanmar</em>.</p>
        </article>

        <article class="feat-card" style="border-top-color:#632968;">
          <div class="kicker" style="color:#632968;">
            <span class="num-badge" style="background:#632968;">4</span>
            <span>CULTURE · WORLDWIDE LAUNCH</span>
          </div>
          <img class="art-frame" src="${artGtavi}" alt="Sunset ocean boulevard and convertible" />
          <h3 class="feat-head">Grand Theft Auto VI Launches After 13-Year Wait</h3>
          <p class="feat-body">Rolls out west from NZ on PS5 &amp; Xbox; Sensor Tower estimates $2.36B and 24.6M Day-1 copies.</p>
        </article>
      </div>

      <div class="map-col">
        <div>
          <div class="map-header">
            <span class="sec-title">Global Story Atlas</span>
            <span class="sec-sub">Markers match #1–#20</span>
          </div>
          ${worldMap}
          <div class="legend">
            <span class="legend-item"><i class="dot" style="background:#163F6B;"></i>Diplomacy/Law</span>
            <span class="legend-item"><i class="dot" style="background:#9A550A;"></i>Markets</span>
            <span class="legend-item"><i class="dot" style="background:#A12126;"></i>War/Cyber</span>
            <span class="legend-item"><i class="dot" style="background:#165E4A;"></i>Climate</span>
            <span class="legend-item"><i class="dot" style="background:#632968;"></i>Culture/Sci</span>
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-val">$81.3B</div>
            <div class="stat-lbl">Record US IPO</div>
          </div>
          <div class="stat-card">
            <div class="stat-val">24.6M</div>
            <div class="stat-lbl">GTA VI Day 1</div>
          </div>
          <div class="stat-card">
            <div class="stat-val">100K+</div>
            <div class="stat-lbl">Akvan Evacuees</div>
          </div>
          <div class="stat-card">
            <div class="stat-val">1st Ever</div>
            <div class="stat-lbl">ICJ Genocide</div>
          </div>
        </div>

        <div class="key-line">
          <strong>Day Highlight:</strong> UN court's 1st state genocide ruling &amp; record Wall St AI IPO unfold beside three-power APEC diplomacy in Shenzhen.
        </div>
      </div>

      <div class="mid-col">
        <article class="feat-card" style="border-top-color:#A12126;">
          <div class="kicker" style="color:#A12126;">
            <span class="num-badge" style="background:#A12126;">5</span>
            <span>WAR · UKRAINE &amp; HORMUZ</span>
          </div>
          <img class="art-frame" src="${artConflict}" alt="Burning arch bridge and tanker in narrow strait" />
          <h3 class="feat-head">Kerch Bridge Struck; Tankers Hit Hormuz Mines</h3>
          <p class="feat-body">Ukraine hits Crimea bridge 3rd time; Kyiv drone raid hits cathedral; IRGC claims tanker mines, IDF enters Gaza.</p>
        </article>

        <article class="feat-card" style="border-top-color:#165E4A;">
          <div class="kicker" style="color:#165E4A;">
            <span class="num-badge" style="background:#165E4A;">6</span>
            <span>CLIMATE · ANTALYA &amp; INDIA</span>
          </div>
          <img class="art-frame" src="${artClimate}" alt="Cyclone vortex approaching palm coast" />
          <h3 class="feat-head">COP31 Drops Fossil Text; Cyclone Akvan Nears</h3>
          <p class="feat-body">Panama threatens veto over draft omission; 100,000+ evacuated across Odisha &amp; Andhra coasts.</p>
        </article>
      </div>
    </section>

    <section class="dispatches-band">
      <div class="dispatches-head">
        <span class="sec-title">Regional Dispatches Desk · Thursday 19 November 2026</span>
        <span class="sec-sub">Verified global events across Americas, Europe, Africa &amp; Asia-Pacific</span>
      </div>
      <div class="desk-grid">
        <div class="desk-col">
          <div class="region-hdr">AMERICAS</div>
          <div class="brief">
            <span class="num-badge" style="background:#A12126;">7</span>
            <p class="brief-text"><span class="brief-head">US Cyber Chief:</span> WH Director Sean Cairncross ousted after multi-day transport &amp; bank outages.</p>
          </div>
          <div class="brief">
            <span class="num-badge" style="background:#A12126;">8</span>
            <p class="brief-text"><span class="brief-head">Palantir Spy Case:</span> DOJ charges Russian national Igor Dyu with tracking Silicon Valley staff.</p>
          </div>
          <div class="brief">
            <span class="num-badge" style="background:#9A550A;">9</span>
            <p class="brief-text"><span class="brief-head">Canada Trade:</span> Ottawa warns no interim deal ahead of Jan 50% US auto tariff hike.</p>
          </div>
          <div class="brief">
            <span class="num-badge" style="background:#163F6B;">10</span>
            <p class="brief-text"><span class="brief-head">LatAm &amp; APEC:</span> Hegseth visits Ecuador's Noboa; Chile–Philippines ink FTA.</p>
          </div>
        </div>

        <div class="desk-col">
          <div class="region-hdr">EUROPE</div>
          <div class="brief">
            <span class="num-badge" style="background:#163F6B;">11</span>
            <p class="brief-text"><span class="brief-head">Berlin Quartet:</span> Merz, Burnham &amp; Macron weigh Ukraine security pact; EU summons Russia.</p>
          </div>
          <div class="brief">
            <span class="num-badge" style="background:#244A73;">12</span>
            <p class="brief-text"><span class="brief-head">UK Law &amp; Online:</span> YouTube defies UK on Russell Brand clip; four convicted in abuse trial.</p>
          </div>
          <div class="brief">
            <span class="num-badge" style="background:#9A550A;">13</span>
            <p class="brief-text"><span class="brief-head">Sovereign AI:</span> Deutsche Telekom invests €100M in Mistral AI Series D for EU cloud.</p>
          </div>
        </div>

        <div class="desk-col">
          <div class="region-hdr">AFRICA</div>
          <div class="brief">
            <span class="num-badge" style="background:#9A550A;">14</span>
            <p class="brief-text"><span class="brief-head">South Africa:</span> SARB holds rate at 7.25% (5.2% CPI); Africa Tech Fest &amp; hailstorm.</p>
          </div>
          <div class="brief">
            <span class="num-badge" style="background:#163F6B;">15</span>
            <p class="brief-text"><span class="brief-head">Nigeria &amp; Gold:</span> 36 states back state police; SWISSAID traces 453t Africa gold to UAE.</p>
          </div>
          <div class="brief">
            <span class="num-badge" style="background:#632968;">16</span>
            <p class="brief-text"><span class="brief-head">Kenya Sport:</span> AIU gives Olympic marathon champ Peres Jepchirchir 3-yr EPO ban.</p>
          </div>
        </div>

        <div class="desk-col">
          <div class="region-hdr">ASIA-PAC &amp; SCIENCE</div>
          <div class="brief">
            <span class="num-badge" style="background:#244A73;">17</span>
            <p class="brief-text"><span class="brief-head">South Korea:</span> Supreme Court overturns ex-PM Han's martial law conviction.</p>
          </div>
          <div class="brief">
            <span class="num-badge" style="background:#632968;">18</span>
            <p class="brief-text"><span class="brief-head">Walkley Awards:</span> Nick McKenzie wins Gold Walkley; Guardian takes two honors.</p>
          </div>
          <div class="brief">
            <span class="num-badge" style="background:#3D346E;">19</span>
            <p class="brief-text"><span class="brief-head">MedTech:</span> J&amp;J installs first FDA-cleared OTTAVA surgical robot in Texas.</p>
          </div>
          <div class="brief">
            <span class="num-badge" style="background:#3D346E;">20</span>
            <p class="brief-text"><span class="brief-head">Health &amp; WHO:</span> WHO backs science trust push; study maps GLP-1 weight limits.</p>
          </div>
        </div>
      </div>
    </section>

    <footer class="footer-folio">
      <span>THURSDAY 19 NOVEMBER 2026 · GLOBAL DAILY FRONT PAGE</span>
      <span>SOURCES: REUTERS · AP · BBC · GUARDIAN · AL JAZEERA · CNA · HINDU · UNFCCC · ICJ</span>
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

    // Downsample 2048x2048 HiDPI render -> 1024x1024 with Lanczos for crisp print type.
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
    if (pngSize <= 960000) {
      writeFileSync(OUT_ASSET, readFileSync(tmpCandidatePng));
      console.log(`Rendered PNG ${OUT_ASSET}: ${pngSize} bytes`);
    } else {
      // Lossless PNG exceeds comfortable margin; emit high-precision 4:4:4 JPEG (rules allow JPEG named entry.png).
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
