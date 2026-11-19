import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT_PNG = join(ROOT_DIR, 'entry.png');
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

interface MapPin {
  id: number;
  lon: number;
  lat: number;
  beat: string;
  label: string;
}

const BEAT_COLORS: Record<string, string> = {
  geopolitics: '#1A4B84',
  markets: '#9E5A08',
  culture: '#75256A',
  conflict: '#A62328',
  climate: '#1B6B4F',
  science: '#463875',
};

const PINS: MapPin[] = [
  { id: 1, lon: 114.1, lat: 22.5, beat: 'geopolitics', label: 'Shenzhen' },
  { id: 2, lon: -74.0, lat: 40.7, beat: 'markets', label: 'New York' },
  { id: 3, lon: -81.5, lat: 24.5, beat: 'culture', label: 'Leonida/Global' },
  { id: 4, lon: 36.5, lat: 45.3, beat: 'conflict', label: 'Crimea' },
  { id: 5, lon: 56.3, lat: 26.6, beat: 'conflict', label: 'Hormuz' },
  { id: 6, lon: 86.5, lat: 14.5, beat: 'climate', label: 'Bay of Bengal' },
  { id: 7, lon: 39.2, lat: -3.5, beat: 'geopolitics', label: 'Kenya' },
  { id: 8, lon: -74.1, lat: 5.5, beat: 'conflict', label: 'Colombia' },
  { id: 9, lon: -46.6, lat: -22.5, beat: 'markets', label: 'Brazil' },
  { id: 10, lon: -102.0, lat: 26.0, beat: 'climate', label: 'Mexico' },
  { id: 11, lon: 2.3, lat: 48.9, beat: 'markets', label: 'Paris' },
  { id: 12, lon: 139.7, lat: 35.7, beat: 'geopolitics', label: 'Tokyo' },
  { id: 13, lon: 71.0, lat: 23.0, beat: 'science', label: 'India' },
  { id: 14, lon: 7.5, lat: 9.1, beat: 'geopolitics', label: 'Nigeria' },
  { id: 15, lon: -118.2, lat: 34.1, beat: 'science', label: 'Pasadena' },
  { id: 16, lon: 31.0, lat: -29.8, beat: 'markets', label: 'Durban' },
];

// Generalized continent polygons in [lon, lat] for clean equirectangular rendering.
const CONTINENTS: Array<Array<[number, number]>> = [
  // North & Central America
  [
    [-166, 66], [-156, 71], [-136, 70], [-115, 72], [-94, 70], [-80, 63],
    [-64, 59], [-55, 51], [-66, 44], [-75, 36], [-81, 25], [-83, 29],
    [-90, 29], [-97, 26], [-96, 19], [-88, 21], [-84, 11], [-78, 8],
    [-85, 9], [-93, 14], [-105, 20], [-112, 28], [-117, 32], [-124, 41],
    [-125, 49], [-136, 58], [-152, 60], [-162, 55],
  ],
  // Greenland
  [[-52, 60], [-42, 60], [-20, 71], [-22, 81], [-45, 82], [-66, 77], [-54, 68]],
  // South America
  [
    [-78, 9], [-72, 12], [-61, 10], [-50, 1], [-35, -6], [-38, -14],
    [-41, -22], [-48, -28], [-54, -34], [-62, -40], [-67, -50], [-69, -55],
    [-74, -52], [-73, -41], [-71, -30], [-70, -18], [-77, -12], [-81, -5], [-79, 2],
  ],
  // Europe (mainland + Iberia + Scandinavia + Italy + Balkans)
  [
    [-9, 37], [-9, 43], [-2, 43], [-5, 48], [2, 51], [8, 54], [6, 59],
    [5, 62], [14, 68], [26, 71], [40, 68], [58, 69], [58, 52], [44, 44],
    [38, 45], [30, 46], [28, 41], [23, 37], [19, 40], [16, 38], [12, 42],
    [8, 44], [3, 42], [-2, 37],
  ],
  // Great Britain & Ireland
  [[-6, 50], [2, 51], [0, 56], [-5, 58], [-7, 54]],
  // Africa
  [
    [-17, 15], [-16, 23], [-6, 36], [10, 37], [12, 33], [25, 32], [33, 31],
    [38, 22], [43, 12], [51, 12], [45, 2], [40, -10], [35, -24], [28, -33],
    [19, -35], [15, -26], [12, -14], [9, 4], [2, 6], [-8, 5], [-14, 9],
  ],
  // Madagascar
  [[44, -25], [47, -25], [50, -15], [49, -12], [44, -17]],
  // Asia + Middle East + India + SE Asia
  [
    [28, 41], [36, 37], [35, 30], [43, 13], [53, 16], [59, 22], [56, 26],
    [49, 29], [58, 25], [67, 25], [73, 19], [77, 8], [80, 13], [87, 22],
    [92, 21], [97, 16], [100, 7], [104, 2], [104, 10], [109, 13], [107, 21],
    [114, 22], [121, 25], [122, 32], [119, 39], [126, 38], [129, 35], [131, 42],
    [141, 52], [160, 60], [176, 66], [162, 70], [128, 72], [98, 76], [70, 72],
    [58, 69], [58, 52], [44, 44], [38, 45], [32, 41],
  ],
  // Japan
  [[130, 32], [136, 34], [141, 38], [145, 44], [141, 45], [139, 39], [132, 34]],
  // Indonesia / Sumatra / Java / Borneo
  [[96, 5], [104, 1], [106, -6], [114, -8], [116, -2], [106, -4], [98, 1]],
  [[109, 1], [117, 6], [118, 1], [114, -3], [110, -3]],
  // Australia & New Zealand
  [
    [114, -22], [122, -17], [131, -12], [137, -15], [142, -11], [146, -18],
    [153, -27], [150, -37], [141, -38], [135, -34], [125, -33], [115, -34],
  ],
  [[167, -46], [173, -41], [178, -37], [175, -35], [171, -42]],
];

function project(lon: number, lat: number): [number, number] {
  const width = 472;
  const height = 242;
  const x = ((lon + 172) / 352) * width;
  const y = ((82 - lat) / 140) * height;
  return [Number(x.toFixed(1)), Number(y.toFixed(1))];
}

function buildWorldMapSvg(): string {
  const landPaths = CONTINENTS.map((poly) => {
    const pts = poly.map(([lon, lat]) => project(lon, lat));
    return `<polygon points="${pts.map(([x, y]) => `${x},${y}`).join(' ')}" fill="#DDD3BD" stroke="#A69C86" stroke-width="0.95" stroke-linejoin="round"/>`;
  }).join('');

  const gridLines: string[] = [];
  for (const lat of [-30, 0, 30, 60]) {
    const [, y] = project(0, lat);
    gridLines.push(
      `<line x1="0" y1="${y}" x2="472" y2="${y}" stroke="${lat === 0 ? '#AEC1CE' : '#CFDCE4'}" stroke-width="${lat === 0 ? '1.1' : '0.7'}" stroke-dasharray="${lat === 0 ? '4,3' : '2,3'}"/>`
    );
  }
  for (const lon of [-120, -60, 0, 60, 120]) {
    const [x] = project(lon, 0);
    gridLines.push(
      `<line x1="${x}" y1="0" x2="${x}" y2="242" stroke="#CFDCE4" stroke-width="0.7" stroke-dasharray="2,3"/>`
    );
  }

  const regionTags = [
    { text: 'AMERICAS', lon: -102, lat: 48 },
    { text: 'EUROPE', lon: 14, lat: 57 },
    { text: 'AFRICA', lon: 19, lat: 19 },
    { text: 'ASIA', lon: 92, lat: 52 },
    { text: 'OCEANIA', lon: 134, lat: -25 },
  ]
    .map((r) => {
      const [rx, ry] = project(r.lon, r.lat);
      return `<text x="${rx}" y="${ry}" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="7.5" font-weight="800" letter-spacing="1.2" fill="#7D7563" opacity="0.75">${r.text}</text>`;
    })
    .join('');

  const pinNodes = PINS.map((pin) => {
    const [cx, cy] = project(pin.lon, pin.lat);
    const fill = BEAT_COLORS[pin.beat] ?? '#A62328';
    const isHero = pin.id <= 3;
    const r = isHero ? 9.0 : 7.4;
    return `
      <g>
        ${isHero ? `<circle cx="${cx}" cy="${cy}" r="13" fill="${fill}" opacity="0.22"/>` : ''}
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="#F7F3E9" stroke-width="1.5"/>
        <text x="${cx}" y="${cy + 3.1}" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="${isHero ? '9.8' : '8.4'}" font-weight="800" fill="#FFFFFF">${pin.id}</text>
      </g>`;
  }).join('');

  return `
    <svg viewBox="0 0 472 242" width="472" height="242" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:auto;background:#E3EDF3;border:1px solid #C5BFB0;">
      ${gridLines.join('')}
      ${landPaths}
      ${regionTags}
      ${pinNodes}
    </svg>`;
}

function buildHeroSvg(kind: 'shenzhen' | 'anthropic' | 'gtavi'): string {
  if (kind === 'shenzhen') {
    return `
      <svg viewBox="0 0 310 122" width="310" height="122" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:122px;border:1px solid #CFC6B2;background:#EDE7D8;">
        <defs>
          <linearGradient id="skySz" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#143252"/>
            <stop offset="100%" stop-color="#2B5984"/>
          </linearGradient>
        </defs>
        <rect width="310" height="90" fill="url(#skySz)"/>
        <!-- Stylized Shenzhen skyline kept cleanly below summit banner -->
        <polygon points="0,90 0,68 18,68 18,54 34,54 34,72 52,72 52,46 68,46 68,62 88,62 88,74 112,74 112,56 126,56 126,42 140,34 154,42 154,68 176,68 176,48 198,48 198,66 220,66 220,42 238,42 238,60 262,60 262,50 286,50 286,66 310,66 310,90" fill="#0E2036"/>
        <path d="M 68 78 A 88 46 0 0 1 242 78" fill="none" stroke="#E8BD5E" stroke-width="2" stroke-dasharray="4,3"/>
        <rect x="44" y="6" width="222" height="17" rx="2" fill="#0B1B2E" opacity="0.72"/>
        <text x="155" y="18" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="9.8" font-weight="800" letter-spacing="1.4" fill="#F8DD92">APEC SHENZHEN · 3-WAY SUMMIT</text>
        <rect y="90" width="310" height="32" fill="#1C2B3B"/>
        <rect x="42" y="62" width="54" height="36" rx="3" fill="#F7F3E9" stroke="#10253D" stroke-width="1.5"/>
        <rect x="42" y="62" width="54" height="9" fill="#214B8C"/>
        <text x="69" y="86" text-anchor="middle" font-family="Georgia, serif" font-size="12" font-weight="800" fill="#111C2D">USA</text>
        <rect x="128" y="58" width="54" height="40" rx="3" fill="#F7F3E9" stroke="#10253D" stroke-width="1.5"/>
        <rect x="128" y="58" width="54" height="9" fill="#B8282E"/>
        <text x="155" y="84" text-anchor="middle" font-family="Georgia, serif" font-size="12" font-weight="800" fill="#111C2D">CHINA</text>
        <rect x="214" y="62" width="54" height="36" rx="3" fill="#F7F3E9" stroke="#10253D" stroke-width="1.5"/>
        <rect x="214" y="62" width="54" height="9" fill="#3B6DA8"/>
        <text x="241" y="86" text-anchor="middle" font-family="Georgia, serif" font-size="12" font-weight="800" fill="#111C2D">RUSSIA</text>
        <text x="155" y="114" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="9.5" font-weight="800" fill="#E2E9F0">TRUMP · XI · PUTIN MEET ON ARMS &amp; TRADE</text>
      </svg>`;
  }
  if (kind === 'anthropic') {
    return `
      <svg viewBox="0 0 310 122" width="310" height="122" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:122px;border:1px solid #CFC6B2;background:#101A28;">
        <rect width="310" height="122" fill="#111B29"/>
        <line x1="14" y1="30" x2="296" y2="30" stroke="#223247" stroke-width="1"/>
        <line x1="14" y1="60" x2="296" y2="60" stroke="#223247" stroke-width="1"/>
        <line x1="14" y1="90" x2="296" y2="90" stroke="#223247" stroke-width="1"/>
        <rect x="14" y="10" width="128" height="23" rx="3" fill="#1F6E54"/>
        <text x="78" y="25.5" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="11.2" font-weight="800" fill="#FFFFFF">NASDAQ: ANT $83</text>
        <rect x="212" y="10" width="84" height="23" rx="3" fill="#9E2A2B"/>
        <text x="254" y="25.5" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="11" font-weight="800" fill="#FFFFFF">TW -4.4% ▼</text>
        <rect x="20" y="76" width="22" height="24" fill="#2E8B6A"/>
        <rect x="50" y="62" width="22" height="38" fill="#36A17C"/>
        <rect x="80" y="45" width="22" height="55" fill="#41B88E"/>
        <polyline points="18,86 58,64 96,44 146,32" fill="none" stroke="#F4C95D" stroke-width="2.6"/>
        <circle cx="146" cy="32" r="4.2" fill="#F4C95D"/>
        <polyline points="222,42 246,46 268,62 292,72" fill="none" stroke="#E06C75" stroke-width="2"/>
        <text x="204" y="71" text-anchor="middle" font-family="Georgia, serif" font-size="27" font-weight="800" fill="#F7F3E9">$1.5T</text>
        <text x="204" y="90" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="10.2" font-weight="800" fill="#7CE0B9">VALUATION · $81.3B IPO</text>
        <rect y="101" width="310" height="21" fill="#0B131E"/>
        <text x="155" y="115" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="9.2" font-weight="700" fill="#C2D0E0">&gt;$100B TOTAL HAUL · NVIDIA TURMOIL HITS ASIA CHIPS</text>
      </svg>`;
  }
  return `
    <svg viewBox="0 0 310 122" width="310" height="122" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:122px;border:1px solid #CFC6B2;background:#2C163B;">
      <defs>
        <linearGradient id="viceSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#351654"/>
          <stop offset="56%" stop-color="#C84B78"/>
          <stop offset="100%" stop-color="#F2A359"/>
        </linearGradient>
      </defs>
      <rect width="310" height="122" fill="url(#viceSky)"/>
      <circle cx="155" cy="68" r="38" fill="#FFD166" opacity="0.92"/>
      <rect x="112" y="58" width="86" height="3.2" fill="#C84B78"/>
      <rect x="112" y="67" width="86" height="3.8" fill="#C84B78"/>
      <polygon points="0,101 0,80 22,80 22,66 40,66 40,84 66,84 66,60 84,60 84,86 225,86 225,64 245,64 245,80 276,80 276,68 310,68 310,101" fill="#1A0F28"/>
      <path d="M 35 98 Q 42 68 48 48" stroke="#12091E" stroke-width="3.8" fill="none"/>
      <path d="M 48 48 Q 30 42 22 52 M 48 48 Q 40 32 54 30 M 48 48 Q 65 40 70 52 M 48 48 Q 62 52 64 62" stroke="#12091E" stroke-width="2.6" fill="none"/>
      <path d="M 272 98 Q 266 70 260 50" stroke="#12091E" stroke-width="3.8" fill="none"/>
      <path d="M 260 50 Q 244 42 236 52 M 260 50 Q 254 34 268 32 M 260 50 Q 276 42 282 52" stroke="#12091E" stroke-width="2.6" fill="none"/>
      <text x="155" y="61" text-anchor="middle" font-family="Georgia, serif" font-size="38" font-weight="900" fill="#FFFFFF" stroke="#240D38" stroke-width="1.6">GTA VI</text>
      <rect y="100" width="310" height="22" fill="#150B22"/>
      <text x="155" y="114.5" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="9.6" font-weight="800" letter-spacing="0.6" fill="#FFA8DC">$1.6B PRE-ORDERS · GLOBAL LAUNCH TODAY</text>
    </svg>`;
}

function buildMiniIcon(kind: 'ukraine' | 'hormuz' | 'climate' | 'africa'): string {
  if (kind === 'ukraine') {
    return `
      <svg viewBox="0 0 70 52" width="70" height="52" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;border:1px solid #C8C0AE;background:#EBF1F6;">
        <rect width="70" height="35" fill="#DCE6EE"/>
        <rect y="35" width="70" height="17" fill="#2B5B84"/>
        <path d="M 4 35 L 17 19 L 30 35" fill="none" stroke="#1E2C3A" stroke-width="2.4"/>
        <path d="M 41 35 L 54 19 L 66 35" fill="none" stroke="#1E2C3A" stroke-width="2.4"/>
        <line x1="2" y1="29" x2="28" y2="29" stroke="#1E2C3A" stroke-width="3.2"/>
        <line x1="42" y1="29" x2="68" y2="29" stroke="#1E2C3A" stroke-width="3.2"/>
        <polygon points="35,12 39,23 45,21 40,29 33,27 29,21" fill="#C9332B"/>
      </svg>`;
  }
  if (kind === 'hormuz') {
    return `
      <svg viewBox="0 0 70 52" width="70" height="52" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;border:1px solid #C8C0AE;background:#F3E9DC;">
        <rect width="70" height="52" fill="#F4E7D3"/>
        <path d="M 0 0 L 24 0 L 31 20 L 15 29 L 0 25 Z" fill="#C9B799"/>
        <path d="M 70 18 L 44 25 L 37 42 L 70 52 Z" fill="#C9B799"/>
        <path d="M 0 32 L 70 32 L 70 52 L 0 52 Z" fill="#34699A" opacity="0.38"/>
        <polygon points="22,32 46,32 50,26 19,26" fill="#1E2D3D"/>
        <rect x="26" y="19" width="9" height="7" fill="#A62328"/>
        <circle cx="53" cy="13" r="6.5" fill="#D95D24"/>
      </svg>`;
  }
  if (kind === 'climate') {
    return `
      <svg viewBox="0 0 70 52" width="70" height="52" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;border:1px solid #C8C0AE;background:#E2F0EB;">
        <rect width="70" height="52" fill="#E1F0EA"/>
        <circle cx="26" cy="26" r="15.5" fill="none" stroke="#1B6B4F" stroke-width="2.6"/>
        <path d="M 26 10 C 37 14 40 25 26 26 C 15 27 15 38 26 42" fill="none" stroke="#1B6B4F" stroke-width="2.6"/>
        <circle cx="26" cy="26" r="4" fill="#B8282E"/>
        <polygon points="52,9 46,26 53,26 49,43 62,23 54,23" fill="#D48806"/>
      </svg>`;
  }
  return `
    <svg viewBox="0 0 70 52" width="70" height="52" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;border:1px solid #C8C0AE;background:#EEE7DB;">
      <rect width="70" height="52" fill="#EFE8DA"/>
      <polygon points="24,6 40,6 49,18 43,32 35,46 28,46 25,31 17,22" fill="#1A4B84"/>
      <circle cx="38" cy="26" r="8.5" fill="#E8B84B" stroke="#F7F3E9" stroke-width="1.6"/>
      <text x="38" y="29" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="8.6" font-weight="800" fill="#111C2D">44%</text>
    </svg>`;
}

function buildHtml(): string {
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
    background: #F7F3E9;
    color: #111C2D;
    font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .page {
    width: 1024px;
    height: 1024px;
    padding: 13px 18px 11px 18px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    border-top: 7px solid #111C2D;
    background: #F7F3E9;
  }
  .masthead {
    border-bottom: 2.5px solid #111C2D;
    padding-bottom: 7px;
  }
  .meta-strip {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 1.3px;
    color: #4A5568;
    border-bottom: 1px solid #C9C0AE;
    padding-bottom: 4px;
    margin-bottom: 5px;
    text-transform: uppercase;
  }
  .title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .title-main {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 40px;
    font-weight: 900;
    letter-spacing: -0.7px;
    line-height: 1;
    color: #111C2D;
  }
  .date-pill {
    background: #B8282E;
    color: #FFFFFF;
    padding: 8px 15px;
    border: 2px solid #111C2D;
    text-align: center;
    flex-shrink: 0;
  }
  .date-day {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 1.8px;
    line-height: 1.1;
    opacity: 0.94;
  }
  .date-num {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 22px;
    font-weight: 900;
    letter-spacing: 0.4px;
    line-height: 1.05;
  }

  .hero-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    border-bottom: 2px solid #111C2D;
    padding: 2px 0 10px 0;
  }
  .hero-card {
    display: flex;
    flex-direction: column;
    gap: 5px;
    border-right: 1px solid #CFC7B6;
    padding-right: 12px;
  }
  .hero-card:last-child {
    border-right: none;
    padding-right: 0;
  }
  .kicker {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 10.2px;
    font-weight: 800;
    letter-spacing: 0.9px;
    text-transform: uppercase;
  }
  .num-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 17px;
    height: 17px;
    border-radius: 50%;
    color: #FFFFFF;
    font-size: 10px;
    font-weight: 800;
    flex-shrink: 0;
  }
  .hero-headline {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 19px;
    font-weight: 800;
    line-height: 1.14;
    color: #111C2D;
  }
  .hero-body {
    font-size: 11.8px;
    line-height: 1.32;
    color: #243042;
  }

  .mid-row {
    display: grid;
    grid-template-columns: 472px 1fr;
    gap: 14px;
    border-bottom: 2px solid #111C2D;
    padding: 2px 0 10px 0;
    align-items: stretch;
    flex: 1;
  }
  .map-panel {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    border-right: 1px solid #CFC7B6;
    padding-right: 12px;
  }
  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 4px;
  }
  .panel-title {
    font-size: 10.8px;
    font-weight: 900;
    letter-spacing: 1.2px;
    color: #111C2D;
    text-transform: uppercase;
  }
  .panel-sub {
    font-size: 9.8px;
    font-weight: 700;
    color: #556072;
  }
  .legend {
    display: flex;
    justify-content: space-between;
    margin-top: 5px;
    font-size: 9.8px;
    font-weight: 700;
    color: #2F3A4B;
  }
  .kpi-strip {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px solid #C9C0AE;
  }
  .kpi-box {
    background: #EFE9DB;
    border: 1px solid #CFC7B6;
    border-left: 3px solid #111C2D;
    padding: 4px 6px;
  }
  .kpi-val {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 13.5px;
    font-weight: 900;
    color: #111C2D;
    line-height: 1.1;
  }
  .kpi-lbl {
    font-size: 8.6px;
    font-weight: 700;
    color: #4A5568;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    margin-top: 1px;
  }
  .legend-item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
  }

  .mid-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
    gap: 9px 11px;
  }
  .mid-card {
    background: #EFE9DB;
    border: 1px solid #CCC3AF;
    border-top: 3.5px solid #111C2D;
    padding: 8px 9px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 5px;
  }
  .mid-top {
    display: flex;
    gap: 8px;
    align-items: flex-start;
  }
  .mid-headline {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 14.8px;
    font-weight: 800;
    line-height: 1.16;
    color: #111C2D;
  }
  .mid-body {
    font-size: 11.2px;
    line-height: 1.3;
    color: #243042;
  }

  .bottom-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .bottom-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .bottom-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 7px 11px;
  }
  .brief {
    display: flex;
    gap: 7px;
    align-items: flex-start;
    background: #F1ECE0;
    border: 1px solid #D6CEBE;
    border-left: 3px solid #111C2D;
    padding: 6px 8px;
  }
  .brief-text {
    font-size: 11.1px;
    line-height: 1.26;
    color: #1F2B3D;
  }
  .brief-head {
    font-weight: 800;
    color: #111C2D;
  }
  .footer-note {
    border-top: 1px solid #C8C0AE;
    padding-top: 5px;
    display: flex;
    justify-content: space-between;
    font-size: 9.5px;
    font-weight: 700;
    color: #556072;
    letter-spacing: 0.4px;
  }
</style>
</head>
<body>
  <div class="page">
    <header class="masthead">
      <div class="meta-strip">
        <span>GLOBAL EDITION · SIX CONTINENTS · 16 VERIFIED DISPATCHES</span>
        <span>GEOPOLITICS · MARKETS · TECH · CLIMATE · CULTURE · SCIENCE</span>
      </div>
      <div class="title-row">
        <h1 class="title-main">THE WORLD IN ONE DAY</h1>
        <div class="date-pill">
          <div class="date-day">THURSDAY</div>
          <div class="date-num">19 NOVEMBER 2026</div>
        </div>
      </div>
    </header>

    <section class="hero-row">
      <article class="hero-card">
        <div class="kicker" style="color:#1A4B84;">
          <span class="num-badge" style="background:#1A4B84;">1</span>
          <span>GEOPOLITICS · SHENZHEN</span>
        </div>
        ${buildHeroSvg('shenzhen')}
        <h2 class="hero-headline">Trump, Xi &amp; Putin Hold Historic Three-Way Talks</h2>
        <p class="hero-body">Leaders of the three nuclear powers meet at APEC in Shenzhen on security, arms control &amp; Hormuz shipping as Xi backs open trade.</p>
      </article>

      <article class="hero-card">
        <div class="kicker" style="color:#9E5A08;">
          <span class="num-badge" style="background:#9E5A08;">2</span>
          <span>MARKETS &amp; AI · NEW YORK</span>
        </div>
        ${buildHeroSvg('anthropic')}
        <h2 class="hero-headline">Anthropic Floats in Record $1.5T Nasdaq IPO</h2>
        <p class="hero-body">AI lab lists as <strong>ANT</strong> at $83/sh ($81.3B IPO, &gt;$100B total), while Nvidia turmoil pulls Taiwan stocks down 4.4% across Asia.</p>
      </article>

      <article class="hero-card">
        <div class="kicker" style="color:#75256A;">
          <span class="num-badge" style="background:#75256A;">3</span>
          <span>CULTURE · WORLDWIDE</span>
        </div>
        ${buildHeroSvg('gtavi')}
        <h2 class="hero-headline">Grand Theft Auto VI Launches Across the Globe</h2>
        <p class="hero-body">After a 13-year wait and $1.6B in digital pre-orders, Rockstar's Leonida epic releases today, sparking global &ldquo;GTA Flu&rdquo; work absences.</p>
      </article>
    </section>

    <section class="mid-row">
      <div class="map-panel">
        <div class="panel-header">
          <span class="panel-title">Global Story Map · 19 Nov 2026</span>
          <span class="panel-sub">Pins match dispatches #1–#16</span>
        </div>
        ${worldMap}
        <div class="legend">
          <span class="legend-item"><i class="dot" style="background:#1A4B84;"></i>Geopolitics</span>
          <span class="legend-item"><i class="dot" style="background:#A62328;"></i>Conflict</span>
          <span class="legend-item"><i class="dot" style="background:#9E5A08;"></i>Markets</span>
          <span class="legend-item"><i class="dot" style="background:#1B6B4F;"></i>Climate</span>
          <span class="legend-item"><i class="dot" style="background:#463875;"></i>Tech/Space</span>
          <span class="legend-item"><i class="dot" style="background:#75256A;"></i>Culture</span>
        </div>
        <div class="kpi-strip">
          <div class="kpi-box" style="border-left-color:#1A4B84;">
            <div class="kpi-val">3 Powers</div>
            <div class="kpi-lbl">APEC Shenzhen</div>
          </div>
          <div class="kpi-box" style="border-left-color:#9E5A08;">
            <div class="kpi-val">$1.5T</div>
            <div class="kpi-lbl">Anthropic IPO</div>
          </div>
          <div class="kpi-box" style="border-left-color:#75256A;">
            <div class="kpi-val">$1.6B</div>
            <div class="kpi-lbl">GTA VI Pre-orders</div>
          </div>
          <div class="kpi-box" style="border-left-color:#1B6B4F;">
            <div class="kpi-val">3.1%</div>
            <div class="kpi-lbl">IMF 2026 Growth</div>
          </div>
        </div>
      </div>

      <div class="mid-grid">
        <article class="mid-card" style="border-top-color:#A62328;">
          <div class="kicker" style="color:#A62328;">
            <span class="num-badge" style="background:#A62328;">4</span>
            <span>CONFLICT · EUROPE</span>
          </div>
          <div class="mid-top">
            ${buildMiniIcon('ukraine')}
            <h3 class="mid-headline">Crimea Bridge Hit; EU Weighs €45B Loan</h3>
          </div>
          <p class="mid-body">3rd strike in a week halts Crimea rail traffic; Poland's Tusk rebukes Trump's Putin remark as allies meet in Berlin.</p>
        </article>

        <article class="mid-card" style="border-top-color:#A62328;">
          <div class="kicker" style="color:#A62328;">
            <span class="num-badge" style="background:#A62328;">5</span>
            <span>MIDDLE EAST · ENERGY</span>
          </div>
          <div class="mid-top">
            ${buildMiniIcon('hormuz')}
            <h3 class="mid-headline">Hormuz Crossfire; IEA Signals Oil Shift</h3>
          </div>
          <p class="mid-body">US-Iran clashes trigger Gulf missile alerts in Kuwait &amp; Bahrain; IEA 2026 Outlook says crisis speeds fossil-fuel decline.</p>
        </article>

        <article class="mid-card" style="border-top-color:#1B6B4F;">
          <div class="kicker" style="color:#1B6B4F;">
            <span class="num-badge" style="background:#1B6B4F;">6</span>
            <span>CLIMATE &amp; WEATHER</span>
          </div>
          <div class="mid-top">
            ${buildMiniIcon('climate')}
            <h3 class="mid-headline">COP31 Grid Pact; Cyclone Akvan Nears</h3>
          </div>
          <p class="mid-body">UN unveils COP31 Electrification Package in Antalya; IMD warns severe Cyclone Akvan threatens India's east coast.</p>
        </article>

        <article class="mid-card" style="border-top-color:#1A4B84;">
          <div class="kicker" style="color:#1A4B84;">
            <span class="num-badge" style="background:#1A4B84;">7</span>
            <span>AFRICA · RESOURCES</span>
          </div>
          <div class="mid-top">
            ${buildMiniIcon('africa')}
            <h3 class="mid-headline">44% Conflict-Zone Kids in Africa; Kenya Deal</h3>
          </div>
          <p class="mid-body">Save the Children warns 2 in 5 African kids live near conflict; Kenya picks US consortium for Mrima Hill rare earths.</p>
        </article>
      </div>
    </section>

    <section class="bottom-section">
      <div class="bottom-header">
        <span class="panel-title">Regional Dispatches · Americas, Europe, Asia-Pacific &amp; Africa</span>
        <span class="panel-sub">Events reported Thursday 19 November 2026</span>
      </div>
      <div class="bottom-grid">
        <div class="brief">
          <span class="num-badge" style="background:#A62328;">8</span>
          <p class="brief-text"><span class="brief-head">Colombia Strike:</span> National union walkout &amp; rallies disrupt transit across Bogotá, Medellín &amp; Cali.</p>
        </div>
        <div class="brief">
          <span class="num-badge" style="background:#9E5A08;">9</span>
          <p class="brief-text"><span class="brief-head">Brazil Crops:</span> Weak real delays 30–40% of 2027 <em>safrinha</em> corn nitrogen fertilizer buys.</p>
        </div>
        <div class="brief">
          <span class="num-badge" style="background:#1B6B4F;">10</span>
          <p class="brief-text"><span class="brief-head">Mexico Solar:</span> Peñoles signs 20-yr deal for a 269 MWp Coahuila solar-battery plant (550 GWh/yr).</p>
        </div>
        <div class="brief">
          <span class="num-badge" style="background:#9E5A08;">11</span>
          <p class="brief-text"><span class="brief-head">Europe AI:</span> Deutsche Telekom invests €100M in Mistral AI Series D for sovereign EU cloud AI.</p>
        </div>
        <div class="brief">
          <span class="num-badge" style="background:#1A4B84;">12</span>
          <p class="brief-text"><span class="brief-head">Japan-Russia:</span> PM Sanae Takaichi presses Putin in face-to-face talks to free detained Japanese journalist.</p>
        </div>
        <div class="brief">
          <span class="num-badge" style="background:#463875;">13</span>
          <p class="brief-text"><span class="brief-head">India Broadband:</span> Reliance seeks tech partners for a 1,600-satellite domestic internet network.</p>
        </div>
        <div class="brief">
          <span class="num-badge" style="background:#1A4B84;">14</span>
          <p class="brief-text"><span class="brief-head">Nigeria &amp; Abuja:</span> All 36 states back state police; Kenya pitches African anti-deepfake network.</p>
        </div>
        <div class="brief">
          <span class="num-badge" style="background:#463875;">15</span>
          <p class="brief-text"><span class="brief-head">Space &amp; Mars:</span> NASA JPL tests supersonic Mars rotor (+30% lift); ECOWAS shows ECOSAT-1.</p>
        </div>
        <div class="brief">
          <span class="num-badge" style="background:#9E5A08;">16</span>
          <p class="brief-text"><span class="brief-head">Economy &amp; Ports:</span> IMF's Georgieva cites AI lifting 2026 growth to 3.1%; Durban port tackles backlog.</p>
        </div>
      </div>
      <div class="footer-note">
        <span>THURSDAY 19 NOVEMBER 2026 · GLOBAL DAILY NEWS SYNTHESIS</span>
        <span>SOURCES: REUTERS · AP · CNN · THE GUARDIAN · THE HINDU · UNFCCC · IMF · NASA JPL</span>
      </div>
    </section>
  </div>
</body>
</html>`;
}

function render(): void {
  if (!existsSync(CHROME_PATH)) {
    throw new Error(`Google Chrome binary not found at ${CHROME_PATH}`);
  }
  const tmpHtml = join(ROOT_DIR, '.tmp-broadsheet.html');
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
        '--force-device-scale-factor=1',
        `--screenshot=${OUT_PNG}`,
        `file://${tmpHtml}`,
      ],
      { stdio: 'pipe' }
    );
  } finally {
    if (existsSync(tmpHtml)) unlinkSync(tmpHtml);
  }
  const bytes = readFileSync(OUT_PNG);
  if (bytes.length > 1048576) {
    throw new Error(`Rendered PNG exceeds 1 MiB (${bytes.length} bytes)`);
  }
  console.log(`Rendered ${OUT_PNG}: ${bytes.length} bytes`);
}

render();
