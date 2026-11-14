/**
 * Product artwork generator.
 * Every product gets a crisp, resolution-independent SVG illustration picked
 * from its name (laptop, chair, mug ...) and coloured by its category, so the
 * store looks rich without shipping image files.
 */

const PALETTES = {
  electronics: { bg1: '#e8edff', bg2: '#cfd8ff', main: '#3d4fd8', dark: '#1f2a8a', accent: '#8ea0ff' },
  furniture: { bg1: '#fbefe4', bg2: '#f3d9c2', main: '#c0703a', dark: '#7a3f1a', accent: '#f0b07d' },
  clothing: { bg1: '#fdeaf0', bg2: '#f8cfdc', main: '#d6456f', dark: '#8c1f43', accent: '#ff9fbb' },
  grocery: { bg1: '#e9f7e6', bg2: '#cdeec6', main: '#3c9a3a', dark: '#1e5c1d', accent: '#9bdc7c' },
  stationery: { bg1: '#fff6dc', bg2: '#ffe7a6', main: '#e0a106', dark: '#8a5d00', accent: '#ffd25e' },
  sports: { bg1: '#e1f6f6', bg2: '#bfeaea', main: '#13938f', dark: '#0a5755', accent: '#6fd8d2' },
  home: { bg1: '#f0eafd', bg2: '#ddd0fa', main: '#7c4fd6', dark: '#45228f', accent: '#b89cff' },
};

function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function paletteFor(typeName = '') {
  const t = typeName.toLowerCase();
  if (/electr|tech|gadget|computer/.test(t)) return PALETTES.electronics;
  if (/furn|decor/.test(t)) return PALETTES.furniture;
  if (/cloth|fashion|apparel|wear/.test(t)) return PALETTES.clothing;
  if (/grocer|food|pantry/.test(t)) return PALETTES.grocery;
  if (/station|office|book/.test(t)) return PALETTES.stationery;
  if (/sport|fitness|outdoor/.test(t)) return PALETTES.sports;
  if (/home|kitchen/.test(t)) return PALETTES.home;
  // unknown category: derive a stable colourway from the name
  const hue = hash(t) % 360;
  return {
    bg1: `hsl(${hue} 80% 95%)`,
    bg2: `hsl(${hue} 70% 86%)`,
    main: `hsl(${hue} 55% 46%)`,
    dark: `hsl(${hue} 60% 26%)`,
    accent: `hsl(${hue} 85% 72%)`,
  };
}

// --------------------------------------------------------------- icon drawings
// Each icon draws inside a 120x120 box. M = main fill, D = dark, A = accent, H = highlight.
const W = 'rgba(255,255,255,0.92)';
const H = 'rgba(255,255,255,0.35)';

const ICONS = {
  laptop: (M, D, A) => `
    <rect x="22" y="26" width="76" height="52" rx="6" fill="${D}"/>
    <rect x="27" y="31" width="66" height="42" rx="3" fill="${A}"/>
    <path d="M27 31h66v14c-20 8-44 8-66 2z" fill="${H}"/>
    <path d="M10 80h100l-6 10a6 6 0 0 1-5 3H21a6 6 0 0 1-5-3z" fill="${M}"/>
    <rect x="50" y="81" width="20" height="3" rx="1.5" fill="${D}" opacity=".5"/>`,
  mouse: (M, D, A) => `
    <rect x="38" y="20" width="44" height="78" rx="22" fill="${M}"/>
    <path d="M60 20v30M38 50h44" stroke="${D}" stroke-width="3" opacity=".5"/>
    <rect x="57" y="30" width="6" height="12" rx="3" fill="${A}"/>
    <path d="M44 34c3-8 8-11 12-12" stroke="${W}" stroke-width="4" stroke-linecap="round" fill="none" opacity=".6"/>`,
  keyboard: (M, D, A) => {
    let keys = '';
    for (let r = 0; r < 3; r += 1) for (let c = 0; c < 9; c += 1) keys += `<rect x="${17 + c * 9.6}" y="${44 + r * 10}" width="7.4" height="7" rx="1.6" fill="${r === 1 && c === 4 ? A : W}" opacity="${r === 1 && c === 4 ? 1 : 0.85}"/>`;
    return `<rect x="10" y="36" width="100" height="48" rx="8" fill="${M}"/>${keys}<rect x="34" y="74" width="52" height="6" rx="2" fill="${W}" opacity=".85"/>`;
  },
  monitor: (M, D, A) => `
    <rect x="12" y="18" width="96" height="62" rx="6" fill="${D}"/>
    <rect x="17" y="23" width="86" height="52" rx="3" fill="${A}"/>
    <path d="M17 23h86v20C75 54 45 52 17 40z" fill="${H}"/>
    <path d="M52 80h16l4 16H48z" fill="${M}"/>
    <rect x="36" y="94" width="48" height="6" rx="3" fill="${M}"/>`,
  headphones: (M, D, A) => `
    <path d="M24 70V58a36 36 0 0 1 72 0v12" stroke="${D}" stroke-width="8" fill="none" stroke-linecap="round"/>
    <rect x="16" y="62" width="24" height="38" rx="10" fill="${M}"/>
    <rect x="80" y="62" width="24" height="38" rx="10" fill="${M}"/>
    <rect x="22" y="70" width="8" height="22" rx="4" fill="${A}"/>
    <rect x="90" y="70" width="8" height="22" rx="4" fill="${A}"/>`,
  watch: (M, D, A) => `
    <rect x="44" y="8" width="32" height="30" rx="8" fill="${D}"/>
    <rect x="44" y="82" width="32" height="30" rx="8" fill="${D}"/>
    <rect x="32" y="30" width="56" height="60" rx="16" fill="${M}"/>
    <rect x="38" y="36" width="44" height="48" rx="11" fill="#151a3a"/>
    <path d="M60 60V48M60 60l8 6" stroke="${A}" stroke-width="4" stroke-linecap="round"/>
    <circle cx="60" cy="60" r="15" stroke="${A}" stroke-width="2" fill="none" opacity=".5"/>
    <rect x="88" y="52" width="5" height="14" rx="2" fill="${D}"/>`,
  speaker: (M, D, A) => `
    <rect x="30" y="14" width="60" height="92" rx="16" fill="${M}"/>
    <circle cx="60" cy="70" r="20" fill="${D}"/><circle cx="60" cy="70" r="10" fill="${A}"/>
    <circle cx="60" cy="34" r="8" fill="${D}"/><circle cx="60" cy="34" r="3.5" fill="${A}"/>
    <path d="M38 22c4-4 9-5 14-5" stroke="${W}" stroke-width="3" stroke-linecap="round" opacity=".55"/>`,
  phone: (M, D, A) => `
    <rect x="34" y="8" width="52" height="104" rx="12" fill="${D}"/>
    <rect x="38" y="12" width="44" height="96" rx="9" fill="${A}"/>
    <path d="M38 12h44v40C68 62 52 60 38 50z" fill="${H}"/>
    <rect x="52" y="16" width="16" height="4" rx="2" fill="${D}"/>
    <circle cx="50" cy="40" r="6" fill="${W}" opacity=".8"/><rect x="46" y="58" width="28" height="4" rx="2" fill="${W}" opacity=".8"/>
    <rect x="46" y="66" width="20" height="4" rx="2" fill="${W}" opacity=".6"/>`,
  charger: (M, D, A) => `
    <rect x="30" y="34" width="60" height="56" rx="12" fill="${M}"/>
    <rect x="44" y="18" width="7" height="18" rx="2" fill="${D}"/><rect x="69" y="18" width="7" height="18" rx="2" fill="${D}"/>
    <path d="M64 46l-12 16h10l-6 16 14-20H60z" fill="${W}"/>
    <path d="M60 90v14c0 6 6 8 12 8h16" stroke="${D}" stroke-width="5" fill="none" stroke-linecap="round"/>`,
  printer: (M, D, A) => `
    <rect x="34" y="14" width="52" height="30" rx="3" fill="${W}"/>
    <rect x="14" y="40" width="92" height="42" rx="10" fill="${M}"/>
    <rect x="30" y="70" width="60" height="36" rx="3" fill="${W}"/>
    <path d="M38 80h44M38 88h34M38 96h40" stroke="${A}" stroke-width="3" stroke-linecap="round"/>
    <circle cx="92" cy="54" r="4" fill="${A}"/>`,
  chair: (M, D, A) => `
    <rect x="34" y="10" width="52" height="54" rx="14" fill="${M}"/>
    <path d="M42 22h36M42 32h36M42 42h36M42 52h36" stroke="${D}" stroke-width="2" opacity=".35"/>
    <rect x="26" y="60" width="68" height="16" rx="8" fill="${D}"/>
    <rect x="57" y="76" width="6" height="18" fill="${D}"/>
    <path d="M60 94l-26 10M60 94l26 10M60 94v14" stroke="${D}" stroke-width="5" stroke-linecap="round"/>
    <circle cx="34" cy="106" r="5" fill="${A}"/><circle cx="86" cy="106" r="5" fill="${A}"/><circle cx="60" cy="110" r="5" fill="${A}"/>`,
  desk: (M, D, A) => `
    <rect x="8" y="40" width="104" height="12" rx="4" fill="${M}"/>
    <rect x="14" y="52" width="8" height="54" rx="3" fill="${D}"/>
    <rect x="98" y="52" width="8" height="54" rx="3" fill="${D}"/>
    <rect x="62" y="52" width="34" height="30" rx="4" fill="${D}" opacity=".85"/>
    <rect x="70" y="64" width="18" height="4" rx="2" fill="${A}"/>
    <rect x="22" y="22" width="30" height="18" rx="3" fill="${A}"/>
    <rect x="70" y="28" width="22" height="12" rx="6" fill="${W}" opacity=".8"/>`,
  lamp: (M, D, A) => `
    <path d="M58 26l26-12 10 22-30 6z" fill="${M}"/>
    <path d="M70 42l-28 40" stroke="${D}" stroke-width="7" stroke-linecap="round"/>
    <path d="M42 82l10-46" stroke="${D}" stroke-width="7" stroke-linecap="round"/>
    <rect x="22" y="94" width="48" height="12" rx="6" fill="${D}"/>
    <path d="M42 82v12" stroke="${D}" stroke-width="7"/>
    <path d="M78 42l14 32" stroke="${A}" stroke-width="16" opacity=".35" stroke-linecap="round"/>`,
  shelf: (M, D, A) => `
    <rect x="22" y="8" width="76" height="104" rx="4" fill="${D}"/>
    ${[12, 37, 62, 87].map((y) => `<rect x="27" y="${y}" width="66" height="20" fill="${A}" opacity=".35"/>`).join('')}
    <rect x="31" y="14" width="8" height="18" rx="1" fill="${W}"/><rect x="41" y="17" width="7" height="15" rx="1" fill="${M}"/><rect x="50" y="14" width="9" height="18" rx="1" fill="${W}" opacity=".7"/>
    <circle cx="80" cy="50" r="7" fill="${M}"/><rect x="33" y="66" width="22" height="16" rx="2" fill="${W}" opacity=".8"/>
    <rect x="70" y="90" width="9" height="17" rx="1" fill="${M}"/><rect x="81" y="93" width="7" height="14" rx="1" fill="${W}"/>`,
  tshirt: (M, D, A) => `
    <path d="M42 14l-30 16 10 22 12-6v58h52V46l12 6 10-22-30-16c-2 8-8 12-18 12s-16-4-18-12z" fill="${M}"/>
    <path d="M42 14c2 8 8 12 18 12s16-4 18-12" stroke="${D}" stroke-width="3" fill="none"/>
    <path d="M34 46v58h10V40z" fill="${H}"/>`,
  jacket: (M, D, A) => `
    <path d="M40 12l-26 18 4 76h28l14-70 14 70h28l4-76-26-18-20 18z" fill="${M}"/>
    <path d="M60 30v76" stroke="${D}" stroke-width="3"/>
    <path d="M40 12l20 18 20-18" stroke="${D}" stroke-width="4" fill="none"/>
    <rect x="30" y="52" width="18" height="12" rx="2" fill="${D}" opacity=".45"/><rect x="72" y="52" width="18" height="12" rx="2" fill="${D}" opacity=".45"/>
    ${[44, 60, 76, 92].map((y) => `<circle cx="64" cy="${y}" r="2.4" fill="${A}"/>`).join('')}`,
  hoodie: (M, D, A) => `
    <path d="M40 22c0-12 40-12 40 0l26 14-8 28-10-4v48H32V60l-10 4-8-28z" fill="${M}"/>
    <path d="M44 24c4 14 28 14 32 0" fill="${D}" opacity=".6"/>
    <path d="M54 34v16M66 34v16" stroke="${W}" stroke-width="3" stroke-linecap="round"/>
    <path d="M40 78h40l-6 18H46z" fill="${D}" opacity=".35"/>`,
  backpack: (M, D, A) => `
    <path d="M44 22c0-14 32-14 32 0" stroke="${D}" stroke-width="7" fill="none"/>
    <rect x="26" y="22" width="68" height="88" rx="22" fill="${M}"/>
    <rect x="36" y="64" width="48" height="34" rx="10" fill="${D}" opacity=".55"/>
    <path d="M36 74h48" stroke="${A}" stroke-width="3"/>
    <rect x="54" y="40" width="12" height="6" rx="3" fill="${A}"/>
    <path d="M34 36c4-6 10-9 16-9" stroke="${W}" stroke-width="3" stroke-linecap="round" opacity=".5"/>`,
  shoe: (M, D, A) => `
    <path d="M14 70c0-10 4-30 14-34l16 10c10 6 24 10 38 12 16 2 26 8 26 20v8H14z" fill="${M}"/>
    <path d="M12 86h98v8a6 6 0 0 1-6 6H18a6 6 0 0 1-6-6z" fill="${W}"/>
    <path d="M46 48l-6 10M56 52l-6 10M66 55l-5 10" stroke="${W}" stroke-width="4" stroke-linecap="round"/>
    <path d="M28 36c-4 12-6 24-4 34" stroke="${D}" stroke-width="4" opacity=".4" fill="none"/>
    <path d="M70 72c12 2 24 2 36 0" stroke="${A}" stroke-width="5" stroke-linecap="round"/>`,
  rice: (M, D, A) => `
    <path d="M32 26h56l8 76a8 8 0 0 1-8 8H32a8 8 0 0 1-8-8z" fill="${M}"/>
    <path d="M30 26c10-10 50-10 60 0l-4 8H34z" fill="${D}"/>
    <rect x="38" y="52" width="44" height="34" rx="6" fill="${W}"/>
    ${[[50, 64], [58, 70], [66, 63], [54, 76], [64, 78], [70, 72]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="2.4" ry="5" fill="${A}" transform="rotate(30 ${x} ${y})"/>`).join('')}`,
  coffee: (M, D, A) => `
    <path d="M30 24h60l6 80a8 8 0 0 1-8 8H32a8 8 0 0 1-8-8z" fill="${D}"/>
    <path d="M30 24l8-10h44l8 10" fill="${M}"/>
    <rect x="38" y="48" width="44" height="40" rx="6" fill="${A}" opacity=".9"/>
    <ellipse cx="60" cy="68" rx="9" ry="13" fill="${D}"/><path d="M60 56c-4 8-4 16 0 24" stroke="${A}" stroke-width="2.5" fill="none"/>`,
  tea: (M, D, A) => `
    <rect x="20" y="30" width="80" height="74" rx="8" fill="${M}"/>
    <path d="M20 46h80" stroke="${D}" stroke-width="3" opacity=".4"/>
    <path d="M52 56h22l-3 22a8 8 0 0 1-8 7h-0a8 8 0 0 1-8-7z" fill="${W}"/>
    <path d="M60 30V14M60 14l-6-4" stroke="${D}" stroke-width="2"/>
    <rect x="50" y="6" width="12" height="10" rx="2" fill="${A}"/>
    <path d="M66 50c10-8 18-4 20 4-8 2-14 0-20-4z" fill="${A}"/>`,
  notebook: (M, D, A) => `
    <rect x="28" y="12" width="66" height="96" rx="6" fill="${M}"/>
    <rect x="28" y="12" width="12" height="96" fill="${D}" opacity=".5"/>
    ${[22, 36, 50, 64, 78, 92].map((y) => `<rect x="24" y="${y}" width="10" height="5" rx="2.5" fill="${W}"/>`).join('')}
    <rect x="50" y="32" width="34" height="18" rx="3" fill="${W}"/>
    <path d="M55 38h24M55 44h16" stroke="${A}" stroke-width="2.5" stroke-linecap="round"/>`,
  pen: (M, D, A) => `
    <g transform="rotate(35 60 60)">
      <rect x="54" y="10" width="12" height="74" rx="5" fill="${M}"/>
      <rect x="54" y="10" width="12" height="18" rx="5" fill="${D}"/>
      <path d="M54 84h12l-6 22z" fill="${D}"/><rect x="66" y="16" width="3" height="30" rx="1.5" fill="${A}"/>
    </g>
    <g transform="rotate(-25 60 60)" opacity=".9">
      <rect x="54" y="18" width="10" height="66" rx="5" fill="${A}"/><path d="M54 84h10l-5 18z" fill="${D}"/>
    </g>`,
  sketchbook: (M, D, A) => `
    <rect x="18" y="20" width="84" height="80" rx="6" fill="${D}"/>
    <rect x="22" y="16" width="76" height="80" rx="4" fill="${W}"/>
    <path d="M34 78c10-26 22-36 30-20s16 6 22-10" stroke="${M}" stroke-width="4" fill="none" stroke-linecap="round"/>
    <circle cx="78" cy="34" r="8" fill="${A}"/>
    ${[26, 38, 50, 62, 74, 86].map((x) => `<circle cx="${x}" cy="16" r="2.5" fill="${D}"/>`).join('')}`,
  yoga: (M, D, A) => `
    <path d="M10 84h74v14H16a6 6 0 0 1-6-6z" fill="${M}"/>
    <path d="M14 88h66" stroke="${W}" stroke-width="2" opacity=".35"/>
    <circle cx="88" cy="76" r="22" fill="${D}"/>
    <circle cx="88" cy="76" r="16" fill="${M}"/>
    <circle cx="88" cy="76" r="10" fill="${D}"/>
    <circle cx="88" cy="76" r="5" fill="${A}"/>
    <path d="M66 56c10-10 30-10 40 0" stroke="${A}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  dumbbell: (M, D, A) => `
    <rect x="34" y="54" width="52" height="12" rx="6" fill="${A}"/>
    <rect x="16" y="34" width="16" height="52" rx="6" fill="${D}"/><rect x="88" y="34" width="16" height="52" rx="6" fill="${D}"/>
    <rect x="6" y="44" width="12" height="32" rx="5" fill="${M}"/><rect x="102" y="44" width="12" height="32" rx="5" fill="${M}"/>
    <path d="M20 40v10M92 40v10" stroke="${W}" stroke-width="3" stroke-linecap="round" opacity=".5"/>`,
  bottle: (M, D, A) => `
    <rect x="48" y="8" width="24" height="14" rx="4" fill="${D}"/>
    <path d="M44 22h32v10c10 4 12 10 12 18v54a8 8 0 0 1-8 8H40a8 8 0 0 1-8-8V50c0-8 2-14 12-18z" fill="${M}"/>
    <rect x="32" y="56" width="56" height="26" fill="${A}" opacity=".6"/>
    <path d="M40 46v58" stroke="${W}" stroke-width="5" stroke-linecap="round" opacity=".45"/>`,
  mug: (M, D, A) => `
    <path d="M84 46h8a14 14 0 0 1 0 28h-8" stroke="${D}" stroke-width="8" fill="none"/>
    <path d="M24 34h62v54a14 14 0 0 1-14 14H38a14 14 0 0 1-14-14z" fill="${M}"/>
    <ellipse cx="55" cy="34" rx="31" ry="7" fill="${D}"/>
    <path d="M34 46v42" stroke="${W}" stroke-width="5" stroke-linecap="round" opacity=".4"/>
    <path d="M46 20c-4-6 4-8 0-14M60 20c-4-6 4-8 0-14" stroke="${A}" stroke-width="3" stroke-linecap="round" fill="none"/>`,
  pan: (M, D, A) => `
    <ellipse cx="48" cy="64" rx="40" ry="30" fill="${D}"/>
    <ellipse cx="48" cy="60" rx="34" ry="24" fill="#2a2d3a"/>
    <path d="M84 56l28-10a5 5 0 0 1 4 9l-28 12z" fill="${M}"/>
    <path d="M28 52c6-8 16-12 26-12" stroke="${W}" stroke-width="3" stroke-linecap="round" opacity=".35"/>
    <ellipse cx="44" cy="62" rx="10" ry="7" fill="${A}" opacity=".85"/><circle cx="44" cy="62" r="4" fill="#ffd25e"/>`,
  box: (M, D, A) => `
    <path d="M60 14l42 20v52L60 106 18 86V34z" fill="${M}"/>
    <path d="M18 34l42 20 42-20M60 54v52" stroke="${D}" stroke-width="3" fill="none"/>
    <path d="M39 24l42 20v14" stroke="${A}" stroke-width="6" fill="none"/>`,
};

const KEYWORDS = [
  // most specific first ("LED Desk Lamp" is a lamp, "Green Tea 100 Bags" is tea)
  [/lamp|light/, 'lamp'],
  [/\btea\b/, 'tea'],
  [/coffee/, 'coffee'],
  [/bottle|flask/, 'bottle'],
  [/laptop|ultrabook|macbook/, 'laptop'],
  [/mouse/, 'mouse'],
  [/keyboard/, 'keyboard'],
  [/monitor|display|screen|\btv\b/, 'monitor'],
  [/headphone|headset|earphone|earbud/, 'headphones'],
  [/watch/, 'watch'],
  [/speaker/, 'speaker'],
  [/phone|mobile/, 'phone'],
  [/charger|adapter|usb|cable/, 'charger'],
  [/printer/, 'printer'],
  [/chair|stool|seat/, 'chair'],
  [/desk|table/, 'desk'],
  [/shelf|rack|cabinet/, 'shelf'],
  [/hoodie|sweat/, 'hoodie'],
  [/jacket|coat|blazer/, 'jacket'],
  [/t-?shirt|\btee\b|shirt|\btop\b/, 'tshirt'],
  [/backpack|\bbag\b/, 'backpack'],
  [/shoe|sneaker|boot/, 'shoe'],
  [/rice|flour|grain|atta|dal/, 'rice'],
  [/sketch|drawing|canvas/, 'sketchbook'],
  [/notebook|diary|journal|register/, 'notebook'],
  [/\bpens?\b|pencil|marker/, 'pen'],
  [/yoga|\bmat\b/, 'yoga'],
  [/dumbbell|weight|kettlebell/, 'dumbbell'],
  [/mug|cup/, 'mug'],
  [/\bpan\b|\bpot\b|wok|cook/, 'pan'],
];

const CATEGORY_FALLBACK = {
  electronics: 'laptop', furniture: 'chair', clothing: 'tshirt', grocery: 'rice',
  stationery: 'notebook', sports: 'dumbbell', home: 'mug',
};

export function iconKeyFor(name = '', typeName = '') {
  const n = name.toLowerCase();
  for (const [re, key] of KEYWORDS) if (re.test(n)) return key;
  const pal = Object.entries(PALETTES).find(([, p]) => p === paletteFor(typeName));
  return (pal && CATEGORY_FALLBACK[pal[0]]) || 'box';
}

let uid = 0;

/**
 * Full product tile artwork (square). Options: { soldOut, plain }
 */
export function productArt(product, opts = {}) {
  const name = product.name || product.item_name || '';
  const type = product.type_name || '';
  const p = paletteFor(type);
  const key = iconKeyFor(name, type);
  const draw = ICONS[key] || ICONS.box;
  const id = `a${(uid += 1)}`;
  const seed = hash(name);
  const bx = 30 + (seed % 120);
  const by = 20 + ((seed >> 8) % 50);
  const tilt = ((seed >> 4) % 13) - 6;
  return `
<svg class="art ${opts.soldOut ? 'sold-out' : ''}" viewBox="0 0 200 200" role="img" aria-label="${name.replace(/"/g, '&quot;')}" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.bg1}"/><stop offset="1" stop-color="${p.bg2}"/></linearGradient>
    <radialGradient id="${id}g" cx="0.5" cy="0.45" r="0.55"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="200" height="200" fill="url(#${id}b)"/>
  <circle cx="${bx}" cy="${by}" r="58" fill="${p.accent}" opacity=".18"/>
  <circle cx="${200 - bx / 2}" cy="${160 + (seed % 30)}" r="44" fill="${p.main}" opacity=".08"/>
  <circle cx="100" cy="96" r="70" fill="url(#${id}g)"/>
  <ellipse class="art-shadow" cx="100" cy="164" rx="52" ry="8" fill="${p.dark}" opacity=".14"/>
  <g class="art-obj" transform="translate(40 36) rotate(${tilt} 60 60)">${draw(p.main, p.dark, p.accent)}</g>
</svg>`;
}

/** Tiny round thumbnail (cart lines, order cards, search results) */
export function productThumb(product, size = 48) {
  return `<span class="thumb" style="width:${size}px;height:${size}px">${productArt(product)}</span>`;
}

/** Category tile artwork - shows the category's signature icon */
export function categoryArt(typeName) {
  return productArt({ name: '', type_name: typeName });
}
