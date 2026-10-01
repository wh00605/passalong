// Generates tasteful "studio still-life" sample photos (SVG → JPEG) for seed listings:
// a soft backdrop, floor shadow and an item silhouette in the listing's colour.
// These are clearly illustrations for development/demo data, not real product photos.

type Kind = "dress" | "top" | "jacket" | "trousers" | "knit" | "trainer" | "boot" | "bag" | "scarf" | "ring" | "book" | "vinyl" | "console" | "mug" | "lamp" | "plant" | "pet" | "toy" | "box" | "sandal";

export function kindFor(categoryPath: string, title: string): Kind {
  const t = title.toLowerCase();
  if (/dress/.test(t)) return "dress";
  if (/boot/.test(t)) return "boot";
  if (/sandal|slider|birkenstock/.test(t)) return "sandal";
  if (/trainer|samba|air max|chuck|old skool|550|shoe/.test(t) || /shoes/.test(categoryPath)) return "trainer";
  if (/jean|trouser|legging|dungaree/.test(t)) return "trousers";
  if (/jumper|cardigan|cashmere|knit|fleece|hoodie/.test(t)) return "knit";
  if (/jacket|blazer|coat|puffer|barbour|nuptse/.test(t)) return "jacket";
  if (/scarf/.test(t)) return "scarf";
  if (/bag|wallet|purse|crossbody/.test(t)) return "bag";
  if (/ring|necklace|jewel/.test(t)) return "ring";
  if (/book|classics|harry potter/.test(t)) return "book";
  if (/vinyl|record/.test(t)) return "vinyl";
  if (/switch|console|zelda|game|catan/.test(t)) return "console";
  if (/mug|casserole|le creuset|kitchen/.test(t)) return "mug";
  if (/lamp|light/.test(t)) return "lamp";
  if (/plant|fejka/.test(t)) return "plant";
  if (/dog|cat|harness|scratching|pet/.test(t) || categoryPath.startsWith("pets")) return "pet";
  if (/lego|jellycat|toy|bunny/.test(t)) return "toy";
  if (/shirt|tee|t-shirt|polo|top|blouse/.test(t)) return "top";
  if (categoryPath.includes("clothing")) return "top";
  if (/duvet|bedding|linen/.test(t)) return "scarf";
  return "box";
}

const SHAPES: Record<Kind, string> = {
  dress: `<path d="M340 250 L370 230 Q400 260 430 230 L460 250 L445 330 L520 700 Q400 730 280 700 L355 330 Z"/>`,
  top: `<path d="M300 300 L360 260 Q400 290 440 260 L500 300 L560 380 L515 410 L490 380 L490 620 L310 620 L310 380 L285 410 L240 380 Z"/>`,
  jacket: `<path d="M300 270 L365 240 L400 300 L435 240 L500 270 L560 420 L545 640 L505 640 L500 450 L495 660 L305 660 L300 450 L295 640 L255 640 L240 420 Z"/><path d="M400 300 L400 660" stroke="rgba(0,0,0,.18)" stroke-width="5" fill="none"/>`,
  trousers: `<path d="M315 240 L485 240 L505 690 L425 690 L400 380 L375 690 L295 690 Z"/>`,
  knit: `<path d="M290 300 Q400 250 510 300 L580 470 L535 490 L495 400 L495 640 L305 640 L305 400 L265 490 L220 470 Z"/><path d="M305 600 L495 600 M305 615 L495 615" stroke="rgba(0,0,0,.15)" stroke-width="5"/>`,
  trainer: `<path d="M220 560 Q230 470 300 450 L420 430 Q470 460 520 470 Q590 485 595 540 L600 590 Q400 610 220 600 Z"/><path d="M215 590 L605 590 L605 615 Q400 635 215 620 Z" fill="#f4f1ea"/>`,
  boot: `<path d="M330 300 L450 300 L455 520 Q560 540 580 600 L585 640 L320 640 Z"/><path d="M315 630 L590 630 L590 655 L315 655 Z" fill="rgba(0,0,0,.35)"/>`,
  sandal: `<path d="M230 590 Q400 540 590 580 L590 610 Q400 630 230 615 Z"/><path d="M300 585 Q330 500 380 520 M420 575 Q470 490 510 560" stroke="currentColor" stroke-width="22" fill="none" stroke-linecap="round"/>`,
  bag: `<path d="M290 400 L510 400 L540 650 L260 650 Z"/><path d="M340 400 Q340 290 400 290 Q460 290 460 400" stroke="currentColor" stroke-width="16" fill="none"/>`,
  scarf: `<path d="M260 330 Q400 280 540 330 L560 380 Q400 330 240 380 Z"/><path d="M330 370 L300 660 L370 660 L390 380 Z M430 370 L450 650 L515 640 L475 365 Z"/>`,
  ring: `<circle cx="400" cy="470" r="110" fill="none" stroke="currentColor" stroke-width="26"/><path d="M370 345 L400 300 L430 345 Z" fill="#e6f0ff" stroke="rgba(0,0,0,.2)"/>`,
  book: `<path d="M260 330 L540 330 L540 640 L260 640 Z"/><path d="M285 330 L285 640" stroke="rgba(0,0,0,.2)" stroke-width="8"/><path d="M320 400 L500 400 M320 430 L460 430" stroke="rgba(255,255,255,.6)" stroke-width="8"/>`,
  vinyl: `<circle cx="400" cy="480" r="190"/><circle cx="400" cy="480" r="60" fill="#e9dcc3"/><circle cx="400" cy="480" r="10" fill="#222"/>`,
  console: `<path d="M250 420 L550 420 Q590 420 590 460 L590 560 Q590 600 550 600 L250 600 Q210 600 210 560 L210 460 Q210 420 250 420 Z"/><rect x="300" y="450" width="200" height="120" rx="10" fill="rgba(0,0,0,.55)"/>`,
  mug: `<path d="M300 380 L480 380 L470 630 Q390 660 310 630 Z"/><path d="M480 430 Q560 430 555 500 Q550 570 470 570" stroke="currentColor" stroke-width="24" fill="none"/>`,
  lamp: `<path d="M300 280 L500 280 L560 440 L240 440 Z"/><path d="M400 440 L400 620" stroke="#3a332c" stroke-width="14"/><ellipse cx="400" cy="630" rx="110" ry="24" fill="#3a332c"/>`,
  plant: `<path d="M330 520 L470 520 L450 660 L350 660 Z" fill="#c4a27a"/><path d="M400 520 Q330 380 260 360 Q330 330 400 470 Q420 330 470 270 Q480 380 405 500 Q470 400 560 400 Q480 470 410 520 Z"/>`,
  pet: `<ellipse cx="400" cy="560" rx="210" ry="90"/><ellipse cx="400" cy="540" rx="150" ry="55" fill="rgba(255,255,255,.35)"/>`,
  toy: `<circle cx="400" cy="460" r="110"/><circle cx="330" cy="330" r="45"/><circle cx="470" cy="330" r="45"/><ellipse cx="400" cy="630" rx="120" ry="55"/>`,
  box: `<path d="M270 360 L530 360 L530 640 L270 640 Z"/><path d="M270 360 L400 300 L530 360" fill="rgba(255,255,255,.25)"/>`,
};

const BACKDROPS = ["#efe9df", "#e9e6ef", "#ece5e1", "#e5eae4", "#f1ebe2", "#e7e4dd"];

/** Returns an SVG Buffer. `angle` varies the composition slightly between photos of the same item. */
export function stillLifeSvg(opts: { kind: Kind; hex: string; seed: number; angle: number }) {
  const bg = BACKDROPS[opts.seed % BACKDROPS.length];
  const rotate = [0, -6, 5, -3][opts.angle % 4];
  const scale = [1, 1.12, 0.9, 1.05][opts.angle % 4];
  const fill = opts.hex.toLowerCase() === "#ffffff" ? "#f7f5f0" : opts.hex;
  const outline = opts.hex.toLowerCase() === "#ffffff" ? `stroke="#d9d3c8" stroke-width="3"` : "";
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">
  <defs>
    <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="#ffffff" stop-opacity="0.6"/></linearGradient>
    <radialGradient id="shadow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#000" stop-opacity="0.18"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.22"/><stop offset="0.6" stop-color="#fff" stop-opacity="0"/></linearGradient>
  </defs>
  <rect width="800" height="1000" fill="url(#wall)"/>
  <rect y="760" width="800" height="240" fill="${bg}" opacity="0.85"/>
  <ellipse cx="400" cy="745" rx="270" ry="38" fill="url(#shadow)"/>
  <g transform="translate(400 470) rotate(${rotate}) scale(${scale}) translate(-400 -470)" fill="${fill}" color="${fill}" ${outline}>
    ${SHAPES[opts.kind]}
  </g>
  <g transform="translate(400 470) rotate(${rotate}) scale(${scale}) translate(-400 -470)" fill="url(#sheen)" color="transparent">
    ${SHAPES[opts.kind]}
  </g>
</svg>`);
}
