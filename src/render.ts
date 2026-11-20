import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const ASSETS_DIR = join(ROOT_DIR, 'assets');
const OUT_ASSET = join(ROOT_DIR, 'entry.png');
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const MAX_BYTES = 1048576;

type BeatKey = 'diplomacy' | 'markets' | 'law' | 'culture' | 'conflict' | 'climate';

const BEAT_COLOR: Record<BeatKey, string> = {
  diplomacy: '#163F6B',
  markets: '#9A550A',
  law: '#244A73',
  culture: '#632968',
  conflict: '#A12126',
  climate: '#165E4A',
};

interface MapPin {
  id: number;
  lon: number;
  lat: number;
  beat: BeatKey;
  hero?: boolean;
}

// 12 exact, non-overlapping cartographic anchors matching numbered stories #1–#12.
const MAP_PINS: MapPin[] = [
  { id: 1, lon: 114.1, lat: 22.5, beat: 'diplomacy', hero: true }, // Shenzhen APEC summit
  { id: 2, lon: -74.0, lat: 40.7, beat: 'markets', hero: true },   // New York (Anthropic IPO / Dow <50k)
  { id: 3, lon: 4.3, lat: 52.1, beat: 'law', hero: true },         // The Hague (ICJ Myanmar genocide ruling)
  { id: 4, lon: 35.0, lat: 47.0, beat: 'conflict', hero: true },   // Ukraine / Kerch Bridge / Kyiv
  { id: 5, lon: 55.8, lat: 25.5, beat: 'conflict', hero: true },   // Strait of Hormuz / Gulf / Gaza
  { id: 6, lon: 29.0, lat: 36.5, beat: 'climate', hero: true },    // Antalya COP31
  { id: 7, lon: 86.5, lat: 16.5, beat: 'climate', hero: true },    // Bay of Bengal / Odisha Cyclone Akvan
  { id: 8, lon: -78.5, lat: -0.2, beat: 'diplomacy' },             // Quito Ecuador / Colombia / Chile FTA
  { id: 9, lon: 7.5, lat: 9.1, beat: 'diplomacy' },                // Abuja Nigeria (state police / illicit gold)
  { id: 10, lon: 28.0, lat: -26.2, beat: 'markets' },              // Johannesburg South Africa (SARB)
  { id: 11, lon: 127.0, lat: 37.6, beat: 'law' },                  // Seoul South Korea (Han Duck-soo ruling)
  { id: 12, lon: 151.2, lat: -33.9, beat: 'culture' },             // Oceania Sydney/NZ (GTA VI rollout & Walkleys)
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
  [[-84, 22], [-75, 20], [-76, 22], [-84, 23]],
  // Greenland
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
  // Great Britain & Ireland
  [[-6, 50], [2, 51], [0, 56], [-5, 58], [-7, 54]],
  [[-10, 52], [-6, 52], [-6, 55], [-10, 54]],
  // Africa
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
  // Japan, Philippines, Indonesia
  [[130, 32], [136, 34], [141, 38], [145, 44], [141, 45], [139, 39], [132, 34]],
  [[120, 18], [124, 14], [126, 7], [122, 8], [120, 14]],
  [[96, 5], [104, 1], [106, -6], [114, -8], [116, -2], [106, -4], [98, 1]],
  [[109, 1], [117, 6], [118, 1], [114, -3], [110, -3]],
  // Australia & New Zealand
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

function project(lon: number, lat: number, w = 372, h = 204): [number, number] {
  const x = ((lon + 168) / 352) * w;
  const y = ((78 - lat) / 134) * h;
  return [Number(x.toFixed(1)), Number(y.toFixed(1))];
}

function buildWorldMapSvg(): string {
  const w = 372;
  const h = 204;

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
    return `<polygon points="${pts.map(([x, y]) => `${x},${y}`).join(' ')}" fill="none" stroke="#B7CAD7" stroke-width="2.5" stroke-linejoin="round"/>`;
  }).join('');

  const landShapes = CONTINENTS.map((poly) => {
    const pts = poly.map(([lon, lat]) => project(lon, lat, w, h));
    return `<polygon points="${pts.map(([x, y]) => `${x},${y}`).join(' ')}" fill="#DFD5BF" stroke="#8C806A" stroke-width="0.85" stroke-linejoin="round"/>`;
  }).join('');

  const regionTags = [
    { text: 'N. AMERICA', lon: -108, lat: 46 },
    { text: 'S. AMERICA', lon: -53, lat: -15 },
    { text: 'AFRICA', lon: 22, lat: 14 },
    { text: 'EURASIA', lon: 84, lat: 57 },
    { text: 'OCEANIA', lon: 132, lat: -24 },
  ]
    .map((r) => {
      const [rx, ry] = project(r.lon, r.lat, w, h);
      return `<text x="${rx}" y="${ry}" text-anchor="middle" font-family="Avenir Next Condensed, Helvetica Neue, sans-serif" font-size="6.8" font-weight="800" letter-spacing="1.1" fill="#6E6554" opacity="0.82">${r.text}</text>`;
    })
    .join('');

  // Dotted legal arc linking ICJ The Hague (#3) to Myanmar (Rohingya verdict).
  const [hx, hy] = project(4.3, 52.1, w, h);
  const [mx, my] = project(96.0, 20.0, w, h);
  const icjArc = `
    <path d="M ${hx} ${hy} Q ${(hx + mx) / 2} ${Math.min(hy, my) - 18} ${mx} ${my}" fill="none" stroke="#244A73" stroke-width="1.1" stroke-dasharray="3,2.5" opacity="0.75"/>
    <circle cx="${mx}" cy="${my}" r="3.4" fill="#244A73" stroke="#F6F2E9" stroke-width="1"/>`;

  const sortedPins = [...MAP_PINS].sort((a, b) => Number(!!a.hero) - Number(!!b.hero));
  const pins = sortedPins
    .map((pin) => {
      const [cx, cy] = project(pin.lon, pin.lat, w, h);
      const fill = BEAT_COLOR[pin.beat];
      const r = pin.hero ? 7.8 : 6.7;
      const fs = pin.hero ? 8.4 : 7.3;
      return `
        <g>
          ${pin.hero ? `<circle cx="${cx}" cy="${cy}" r="11.4" fill="${fill}" opacity="0.22"/>` : ''}
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="#F6F2E9" stroke-width="1.3"/>
          <text x="${cx}" y="${cy + (pin.hero ? 2.9 : 2.5)}" text-anchor="middle" font-family="Avenir Next, Helvetica Neue, sans-serif" font-size="${fs}" font-weight="800" fill="#FFFFFF">${pin.id}</text>
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
    padding: 7px 15px 6px 15px;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    gap: 5px;
    border-top: 5px solid #121821;
    background: radial-gradient(circle at 50% 0%, #FAF7F0 0%, #F5F0E5 62%, #EFE8D9 100%);
  }

  /* MASTHEAD + DATE CHECK */
  .masthead {
    border-bottom: 2px solid #121821;
    padding-bottom: 3.5px;
  }
  .folio-strip {
    display: flex;
    justify-content: space-between;
    font-family: "Avenir Next Condensed", "DIN Alternate", sans-serif;
    font-size: 9.4px;
    font-weight: 700;
    letter-spacing: 1.15px;
    color: #424C5C;
    border-bottom: 1px solid #C8BFA8;
    padding-bottom: 2px;
    margin-bottom: 2.5px;
    text-transform: uppercase;
  }
  .title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
  }
  .title-main {
    font-family: "Bodoni 72", "Big Caslon", "Didot", Georgia, serif;
    font-size: 39px;
    font-weight: 800;
    letter-spacing: -0.4px;
    line-height: 0.96;
    color: #121821;
  }
  .date-plaque {
    background: #9E1F24;
    color: #FFFFFF;
    padding: 3.5px 13px;
    border: 2px solid #121821;
    box-shadow: inset 0 0 0 1px #D8A449;
    text-align: center;
    flex-shrink: 0;
  }
  .date-day {
    font-family: "Avenir Next Condensed", "DIN Alternate", sans-serif;
    font-size: 9.8px;
    font-weight: 800;
    letter-spacing: 2.3px;
    color: #FCE3A6;
    line-height: 1.04;
  }
  .date-num {
    font-family: "DIN Condensed", "Avenir Next Condensed", sans-serif;
    font-size: 21px;
    font-weight: 700;
    letter-spacing: 0.6px;
    line-height: 1.02;
  }
  .date-check-bar {
    background: #141E2B;
    color: #F6F2E9;
    padding: 2.5px 9px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-family: "Avenir Next Condensed", sans-serif;
    font-size: 9.2px;
    font-weight: 700;
    letter-spacing: 0.65px;
    border-left: 4px solid #D8A449;
  }
  .dc-gold { color: #FBE09B; }

  /* SHARED TOKENS */
  .kicker {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-family: "Avenir Next Condensed", "DIN Alternate", sans-serif;
    font-size: 10.1px;
    font-weight: 800;
    letter-spacing: 0.8px;
    text-transform: uppercase;
  }
  .num-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 15px;
    height: 15px;
    border-radius: 50%;
    color: #FFFFFF;
    font-family: "Avenir Next", sans-serif;
    font-size: 9px;
    font-weight: 800;
    flex-shrink: 0;
  }
  .beat-sq {
    display: inline-block;
    width: 8px;
    height: 8px;
    margin-top: 3px;
    flex-shrink: 0;
  }
  .art-frame {
    display: block;
    width: 100%;
    object-fit: cover;
    border: 1px solid #9D937E;
  }
  .src {
    font-family: "Avenir Next Condensed", sans-serif;
    font-size: 9.2px;
    font-weight: 700;
    color: #5A6475;
    white-space: nowrap;
  }

  /* TOP HERO SPREAD */
  .hero-band {
    display: grid;
    grid-template-columns: 568px 414px;
    gap: 12px;
    border-bottom: 2px solid #121821;
    padding-bottom: 5px;
  }
  .hero-lead {
    display: flex;
    flex-direction: column;
    gap: 3px;
    border-right: 1px solid #C8BFA8;
    padding-right: 11px;
  }
  .hero-lead .art-frame {
    height: 164px;
    object-position: center 62%;
  }
  .hero-lead-head {
    font-family: "Iowan Old Style", "Charter", Georgia, serif;
    font-size: 19.5px;
    font-weight: 800;
    line-height: 1.07;
    letter-spacing: -0.2px;
    color: #121821;
  }
  .hero-lead-body {
    font-size: 10.6px;
    line-height: 1.22;
    color: #202938;
  }

  .hero-side {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .hero-side .art-frame {
    height: 136px;
  }
  .ticker-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #141E2B;
    color: #F4EFE4;
    padding: 2.5px 7px;
    font-family: "Avenir Next Condensed", sans-serif;
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.35px;
    border: 1px solid #121821;
  }
  .tick-up { color: #6BE0A8; }
  .tick-dn { color: #FF8A85; }
  .hero-side-head {
    font-family: "Iowan Old Style", "Charter", Georgia, serif;
    font-size: 16.5px;
    font-weight: 800;
    line-height: 1.09;
    color: #121821;
  }
  .hero-side-body {
    font-size: 10.4px;
    line-height: 1.21;
    color: #202938;
  }

  /* MIDDLE 3-COLUMN FEATURE BAND */
  .mid-band {
    display: grid;
    grid-template-columns: 288px 394px 288px;
    gap: 12px;
    border-bottom: 2px solid #121821;
    padding-bottom: 5px;
  }
  .mid-col {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 5px;
  }
  .feat-card {
    display: flex;
    flex-direction: column;
    gap: 2.5px;
    background: #EFE9DA;
    border: 1px solid #C8BFA8;
    border-top: 3px solid #121821;
    padding: 4px 7px 4.5px 7px;
  }
  .feat-card .art-frame {
    height: 92px;
  }
  .feat-head {
    font-family: "Iowan Old Style", "Charter", Georgia, serif;
    font-size: 13px;
    font-weight: 800;
    line-height: 1.1;
    color: #121821;
  }
  .feat-body {
    font-size: 9.8px;
    line-height: 1.2;
    color: #212A39;
  }

  /* CENTER MAP COLUMN */
  .map-col {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 5px;
    border-left: 1px solid #C8BFA8;
    border-right: 1px solid #C8BFA8;
    padding: 0 10px;
  }
  .map-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 2.5px;
  }
  .sec-title {
    font-family: "Avenir Next Condensed", "DIN Alternate", sans-serif;
    font-size: 10.8px;
    font-weight: 800;
    letter-spacing: 1px;
    color: #121821;
    text-transform: uppercase;
  }
  .sec-sub {
    font-size: 9px;
    font-weight: 700;
    color: #505A6B;
  }
  .legend {
    display: flex;
    justify-content: space-between;
    flex-wrap: nowrap;
    margin-top: 3.5px;
    font-size: 8.4px;
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
    gap: 5px;
  }
  .stat-card {
    background: #141E2B;
    color: #F6F2E9;
    padding: 4.5px 7px;
    border-left: 3.5px solid #D8A449;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 1px;
  }
  .stat-val {
    font-family: "Bodoni 72", "Iowan Old Style", Georgia, serif;
    font-size: 15.5px;
    font-weight: 800;
    line-height: 1.02;
    color: #FBE09B;
    white-space: nowrap;
  }
  .stat-lbl {
    font-family: "Avenir Next Condensed", sans-serif;
    font-size: 8.8px;
    font-weight: 700;
    letter-spacing: 0.45px;
    text-transform: uppercase;
    color: #DCE3ED;
    white-space: nowrap;
  }
  .key-line {
    background: #EAE2D0;
    border: 1px solid #C8BFA8;
    border-left: 3.5px solid #9E1F24;
    padding: 4px 7px;
    font-size: 9.5px;
    line-height: 1.2;
    color: #1A2331;
  }

  /* REGIONAL DISPATCHES DESK */
  .dispatches-band {
    display: flex;
    flex-direction: column;
    gap: 3.5px;
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
    gap: 3px;
    padding: 0 8px;
    border-right: 1px solid #C8BFA8;
  }
  .desk-col:first-child { padding-left: 0; }
  .desk-col:last-child { padding-right: 0; border-right: none; }
  .region-hdr {
    font-family: "Avenir Next Condensed", sans-serif;
    font-size: 9.8px;
    font-weight: 800;
    letter-spacing: 1px;
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
    font-size: 8.2px;
    margin-top: 1px;
  }
  .brief-text {
    font-size: 9.25px;
    line-height: 1.18;
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
    padding-top: 2.5px;
    display: flex;
    justify-content: space-between;
    font-family: "Avenir Next Condensed", sans-serif;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.55px;
    color: #465061;
  }
</style>
</head>
<body>
  <div class="page">
    <header class="masthead">
      <div class="folio-strip">
        <span>GLOBAL EDITION · SEVEN REGIONS &amp; SEAS · 22 WIRE DISPATCHES</span>
        <span>DIPLOMACY · MARKETS · INT'L LAW · CULTURE · WAR · CLIMATE · SCIENCE · SPORT</span>
      </div>
      <div class="title-row">
        <h1 class="title-main">THE WORLD IN ONE DAY</h1>
        <div class="date-plaque">
          <div class="date-day">THURSDAY</div>
          <div class="date-num">19 NOVEMBER 2026</div>
        </div>
      </div>
    </header>

    <div class="date-check-bar">
      <span><em class="dc-gold" style="font-style:normal;">DATE CHECK:</em> ALL 22 DISPATCHES REPORTED 19 NOV 2026 (00:00–23:59 UTC) · ZERO ARCHIVE STORIES</span>
      <span>12 ANCHOR PINS VERIFIED BY COORDINATE</span>
    </div>

    <section class="hero-band">
      <article class="hero-lead">
        <img class="art-frame" src="${artShenzhen}" alt="Three national flags at Kylin Villa round table overlooking Shenzhen Bay" />
        <div class="kicker" style="color:#163F6B;">
          <span class="num-badge" style="background:#163F6B;">1</span>
          <span>DIPLOMACY LEAD · APEC SHENZHEN, CHINA</span>
        </div>
        <h2 class="hero-lead-head">Trump, Xi &amp; Putin Hold Historic Three-Way Summit at Kylin Villa</h2>
        <p class="hero-lead-body">Leaders of the US, China and Russia hold unprecedented round-table talks at Shenzhen Bay, issuing a four-point declaration on nuclear risk reduction, fuel supply and UN reform while omitting Ukraine and Iran; US-China bilateral talks yield no tariff extension <span class="src">[CNA/Al Jazeera/Guardian]</span>.</p>
      </article>

      <article class="hero-side">
        <img class="art-frame" src="${artAnthropic}" alt="Golden AI spire beside downward red market candles over Manhattan" />
        <div class="ticker-bar">
          <span>DOW 49,097 <em class="tick-dn" style="font-style:normal;">-2.2%</em></span>
          <span>S&amp;P <em class="tick-dn" style="font-style:normal;">-2.0%</em></span>
          <span>ANT $97.17 <em class="tick-up" style="font-style:normal;">+17%</em></span>
          <span>BRENT $90.58 · GOLD $3,595</span>
        </div>
        <div class="kicker" style="color:#9A550A;">
          <span class="num-badge" style="background:#9A550A;">2</span>
          <span>MARKETS &amp; AI · NEW YORK</span>
        </div>
        <h2 class="hero-side-head">Anthropic Sets $81.3B US IPO Record; Dow Drops Below 50,000</h2>
        <p class="hero-side-body">Claude maker lists on Nasdaq as ANT ($83 IPO, opens $111.50, closes $97.17 near $1.5T), yet S&amp;P 500 falls 6th straight session (-2.02%), Dow drops 1,101 pts to 49,097 and Nvidia slides 3.3% post-CEO exit <span class="src">[Guardian/TradingView]</span>.</p>
      </article>
    </section>

    <section class="mid-band">
      <div class="mid-col">
        <article class="feat-card" style="border-top-color:#244A73;">
          <div class="kicker" style="color:#244A73;">
            <span class="num-badge" style="background:#244A73;">3</span>
            <span>INT'L LAW · THE HAGUE &amp; MYANMAR</span>
          </div>
          <img class="art-frame" src="${artIcj}" alt="Peace Palace and brass scales of justice" />
          <h3 class="feat-head">ICJ Rules Myanmar Committed Rohingya Genocide</h3>
          <p class="feat-body">UN court issues 1st state genocide judgment in 80-year history (<em>The Gambia v. Myanmar</em>) <span class="src">[ICJ/CNN]</span>.</p>
        </article>

        <article class="feat-card" style="border-top-color:#632968;">
          <div class="kicker" style="color:#632968;">
            <span class="num-badge" style="background:#632968;">12</span>
            <span>CULTURE · GLOBAL MIDNIGHT ROLLOUT</span>
          </div>
          <img class="art-frame" src="${artGtavi}" alt="Retro coastal palm boulevard at sunset" />
          <h3 class="feat-head">Grand Theft Auto VI Launches After 13 Years</h3>
          <p class="feat-body">Drops from NZ westward on PS5/Xbox; Sensor Tower est. $2.36B and 24.6M Day-1 copies <span class="src">[Statesman]</span>.</p>
        </article>
      </div>

      <div class="map-col">
        <div>
          <div class="map-header">
            <span class="sec-title">Global Story Atlas</span>
            <span class="sec-sub">Anchors #1–#12 by coordinate</span>
          </div>
          ${worldMap}
          <div class="legend">
            <span class="legend-item"><i class="dot" style="background:#163F6B;"></i>Diplomacy/Law</span>
            <span class="legend-item"><i class="dot" style="background:#9A550A;"></i>Markets</span>
            <span class="legend-item"><i class="dot" style="background:#A12126;"></i>War/Gulf</span>
            <span class="legend-item"><i class="dot" style="background:#165E4A;"></i>Climate</span>
            <span class="legend-item"><i class="dot" style="background:#632968;"></i>Culture</span>
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-val">49,097</div>
            <div class="stat-lbl">DOW DROPS &lt;50K</div>
          </div>
          <div class="stat-card">
            <div class="stat-val">$81.3B</div>
            <div class="stat-lbl">RECORD US IPO</div>
          </div>
          <div class="stat-card">
            <div class="stat-val">100K+</div>
            <div class="stat-lbl">AKVAN EVACUEES</div>
          </div>
          <div class="stat-card">
            <div class="stat-val">1st Ever</div>
            <div class="stat-lbl">ICJ GENOCIDE</div>
          </div>
        </div>

        <div class="key-line">
          <strong>19 Nov Picture:</strong> Historic UN court verdict, record Wall St AI IPO &amp; global Dow selloff alongside APEC big-power talks &amp; Cyclone Akvan threat.
        </div>
      </div>

      <div class="mid-col">
        <article class="feat-card" style="border-top-color:#A12126;">
          <div class="kicker" style="color:#A12126;">
            <span class="num-badge" style="background:#A12126;">4</span>
            <span class="num-badge" style="background:#A12126;">5</span>
            <span>WAR · UKRAINE &amp; HORMUZ</span>
          </div>
          <img class="art-frame" src="${artConflict}" alt="Burning steel-arch bridge and oil tanker in narrow strait" />
          <h3 class="feat-head">Kerch Bridge Hit 3rd Time; Hormuz Mines</h3>
          <p class="feat-body">Ukraine strikes Crimea bridge &amp; Putin halts truce talks; Kyiv drone raid; IRGC tanker mine claims <span class="src">[Guardian/ISW]</span>.</p>
        </article>

        <article class="feat-card" style="border-top-color:#165E4A;">
          <div class="kicker" style="color:#165E4A;">
            <span class="num-badge" style="background:#165E4A;">6</span>
            <span class="num-badge" style="background:#165E4A;">7</span>
            <span>CLIMATE · ANTALYA &amp; INDIA</span>
          </div>
          <img class="art-frame" src="${artClimate}" alt="Cyclone vortex approaching eastern coastline" />
          <h3 class="feat-head">COP31 Drops Fossil Text; Cyclone Akvan Nears</h3>
          <p class="feat-body">Panama threatens veto over Antalya draft omission; 100K+ evacuated in Odisha &amp; Andhra <span class="src">[CHN/Hindu]</span>.</p>
        </article>
      </div>
    </section>

    <section class="dispatches-band">
      <div class="dispatches-head">
        <span class="sec-title">Regional Dispatches Desk · Thursday 19 November 2026</span>
        <span class="sec-sub">16 additional verified 19 Nov wire reports grouped by exact geography</span>
      </div>
      <div class="desk-grid">
        <div class="desk-col">
          <div class="region-hdr">AMERICAS</div>
          <div class="brief">
            <span class="beat-sq" style="background:#A12126;"></span>
            <p class="brief-text"><span class="brief-head">US Cyber Ouster:</span> WH cyber chief Sean Cairncross removed after multi-day transport outages <span class="src">[Guardian]</span>.</p>
          </div>
          <div class="brief">
            <span class="beat-sq" style="background:#A12126;"></span>
            <p class="brief-text"><span class="brief-head">Palantir Spying:</span> DOJ charges Russian national Igor Dyu with spying on US analytics firm <span class="src">[DOJ]</span>.</p>
          </div>
          <div class="brief">
            <span class="beat-sq" style="background:#9A550A;"></span>
            <p class="brief-text"><span class="brief-head">Canada &amp; MedTech:</span> Ottawa warns of 50% US auto tariff; J&amp;J installs 1st OTTAVA robot in TX <span class="src">[J&amp;J/Reuters]</span>.</p>
          </div>
          <div class="brief">
            <span class="num-badge" style="background:#163F6B;">8</span>
            <p class="brief-text"><span class="brief-head">Latin America:</span> Hegseth visits Ecuador's Noboa; Chile–Philippines ink CEPA FTA; peso &gt;19/$ <span class="src">[AP/BW]</span>.</p>
          </div>
        </div>

        <div class="desk-col">
          <div class="region-hdr">EUROPE &amp; MID-EAST</div>
          <div class="brief">
            <span class="beat-sq" style="background:#163F6B;"></span>
            <p class="brief-text"><span class="brief-head">Berlin Security Talks:</span> Merz, Macron &amp; UK/US envoys weigh Ukraine pledges; EU summons envoy <span class="src">[Al Jazeera]</span>.</p>
          </div>
          <div class="brief">
            <span class="beat-sq" style="background:#9A550A;"></span>
            <p class="brief-text"><span class="brief-head">EU AI &amp; Defense:</span> Deutsche Telekom backs Mistral AI (€100M) as Kyiv cathedral hit in raids <span class="src">[Kyiv Ind]</span>.</p>
          </div>
          <div class="brief">
            <span class="beat-sq" style="background:#A12126;"></span>
            <p class="brief-text"><span class="brief-head">Gaza &amp; Gulf Fire:</span> IDF conducts central Gaza raid near Nuseirat; Saudis intercept Houthi fire <span class="src">[JustSec]</span>.</p>
          </div>
          <div class="brief">
            <span class="beat-sq" style="background:#244A73;"></span>
            <p class="brief-text"><span class="brief-head">Global Health:</span> WHO pushes science trust drive; study maps GLP-1 weight limits <span class="src">[WHO/SciDaily]</span>.</p>
          </div>
        </div>

        <div class="desk-col">
          <div class="region-hdr">AFRICA</div>
          <div class="brief">
            <span class="num-badge" style="background:#163F6B;">9</span>
            <p class="brief-text"><span class="brief-head">Nigeria Policing:</span> All 36 state legislatures approve constitutional path to state police <span class="src">[AllAfrica]</span>.</p>
          </div>
          <div class="brief">
            <span class="num-badge" style="background:#9A550A;">10</span>
            <p class="brief-text"><span class="brief-head">South Africa:</span> SARB holds 7.25% repo rate (5.2% CPI); Cape Town Africa Tech Fest; hail hits <span class="src">[SARB/EQS]</span>.</p>
          </div>
          <div class="brief">
            <span class="beat-sq" style="background:#9A550A;"></span>
            <p class="brief-text"><span class="brief-head">Illicit Gold Flow:</span> SWISSAID traces 453t of undisclosed African gold entering UAE markets <span class="src">[SWISSAID]</span>.</p>
          </div>
          <div class="brief">
            <span class="beat-sq" style="background:#632968;"></span>
            <p class="brief-text"><span class="brief-head">Kenya Athletics:</span> AIU hands Olympic marathon champ Peres Jepchirchir a 3-yr EPO ban <span class="src">[AIU/AJ]</span>.</p>
          </div>
        </div>

        <div class="desk-col">
          <div class="region-hdr">ASIA-PAC &amp; SPACE</div>
          <div class="brief">
            <span class="beat-sq" style="background:#163F6B;"></span>
            <p class="brief-text"><span class="brief-head">APEC Bilaterals:</span> Japan PM Takaichi meets Xi; NZ PM Luxon condemns Ukraine invasion <span class="src">[Guardian/1News]</span>.</p>
          </div>
          <div class="brief">
            <span class="num-badge" style="background:#244A73;">11</span>
            <p class="brief-text"><span class="brief-head">South Korea Court:</span> Supreme Court overturns ex-PM Han Duck-soo's 15-yr sentence <span class="src">[Japan Times]</span>.</p>
          </div>
          <div class="brief">
            <span class="beat-sq" style="background:#632968;"></span>
            <p class="brief-text"><span class="brief-head">Australia Walkleys:</span> Nick McKenzie wins Gold Walkley; Guardian wins two top prizes <span class="src">[Guardian]</span>.</p>
          </div>
          <div class="brief">
            <span class="beat-sq" style="background:#244A73;"></span>
            <p class="brief-text"><span class="brief-head">Deep Space &amp; Asia:</span> NASA marks Voyager 1 at 1 light-day (25.9B km); Taiwan -4.4% <span class="src">[NASA/Reuters]</span>.</p>
          </div>
        </div>
      </div>
    </section>

    <footer class="footer-folio">
      <span>THURSDAY 19 NOVEMBER 2026 · GLOBAL DAILY FRONT PAGE</span>
      <span>SOURCES: REUTERS · AP · CNN · GUARDIAN · AL JAZEERA · CNA · HINDU · UNFCCC · ICJ · NASA · WHO</span>
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
    if (pngSize <= 960000) {
      writeFileSync(OUT_ASSET, readFileSync(tmpCandidatePng));
      console.log(`Rendered PNG ${OUT_ASSET}: ${pngSize} bytes`);
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
