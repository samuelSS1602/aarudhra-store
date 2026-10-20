/**
 * Flat product illustrations for DEMO products (SVG → WebP via the normal image
 * pipeline). Clearly illustrative — no brands, no text, no fake product photos.
 */

export type ArtKind =
  | "notebook"
  | "ream"
  | "pens"
  | "pencils"
  | "marker"
  | "geometry"
  | "eraser"
  | "sharpener"
  | "scale"
  | "crayons"
  | "watercolour"
  | "glue"
  | "paper"
  | "folder"
  | "stapler"
  | "containers"
  | "ladle"
  | "peeler"
  | "cloth"
  | "brush"
  | "scrub"
  | "storage"
  | "organiser"
  | "hooks"
  | "bottle"
  | "towel"
  | "soap"
  | "matchbox"
  | "kit";

function hex(c: string) {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** Lighten (amt > 0) or darken (amt < 0) a colour, amt in -1..1. */
export function shade(c: string, amt: number) {
  const [r, g, b] = hex(c);
  const f = (v: number) => Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt));
  return `#${[f(r), f(g), f(b)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

const shadow = (w = 230, cy = 655) => `<ellipse cx="400" cy="${cy}" rx="${w}" ry="26" fill="#0b1240" opacity="0.13"/>`;

function pen(x: number, color: string, angle: number) {
  return `<g transform="rotate(${angle} ${x} 400)">
    <rect x="${x - 17}" y="200" width="34" height="380" rx="17" fill="${shade(color, 0.82)}"/>
    <rect x="${x - 17}" y="200" width="12" height="380" rx="6" fill="#ffffff" opacity="0.6"/>
    <rect x="${x - 17}" y="200" width="34" height="120" rx="17" fill="${color}"/>
    <rect x="${x + 10}" y="215" width="7" height="140" rx="3.5" fill="${shade(color, -0.25)}"/>
    <rect x="${x - 6}" y="330" width="12" height="230" rx="6" fill="${color}" opacity="0.55"/>
    <path d="M${x - 17} 575 L${x + 17} 575 L${x} 630 Z" fill="#c9ced8"/>
    <circle cx="${x}" cy="628" r="4" fill="${shade(color, -0.3)}"/>
  </g>`;
}

function pencil(x: number, angle: number, body = "#f4c430") {
  return `<g transform="rotate(${angle} ${x} 400)">
    <rect x="${x - 20}" y="190" width="40" height="370" fill="${body}"/>
    <rect x="${x - 7}" y="190" width="14" height="370" fill="${shade(body, 0.3)}"/>
    <rect x="${x - 20}" y="175" width="40" height="22" fill="#b9bec9"/>
    <rect x="${x - 20}" y="150" width="40" height="28" rx="8" fill="#f28b9b"/>
    <path d="M${x - 20} 560 L${x + 20} 560 L${x} 640 Z" fill="#e8c39e"/>
    <path d="M${x - 7} 614 L${x + 7} 614 L${x} 640 Z" fill="#3a3a3a"/>
  </g>`;
}

function crayon(x: number, color: string, top: number) {
  return `<rect x="${x - 18}" y="${top}" width="36" height="300" rx="6" fill="${color}"/>
    <path d="M${x - 18} ${top + 4} L${x} ${top - 46} L${x + 18} ${top + 4} Z" fill="${color}"/>
    <rect x="${x - 18}" y="${top + 60}" width="36" height="70" fill="#ffffff" opacity="0.35"/>`;
}

function art(kind: ArtKind, c: string, alt: string[]): string {
  const d = shade(c, -0.25);
  switch (kind) {
    case "notebook":
      return `${shadow(210)}
        <rect x="262" y="168" width="330" height="470" rx="20" fill="${shade(c, -0.35)}"/>
        <rect x="240" y="150" width="330" height="470" rx="20" fill="${c}"/>
        <rect x="248" y="150" width="20" height="470" fill="${shade(c, 0.15)}" opacity="0.5"/>
        <rect x="312" y="250" width="200" height="96" rx="14" fill="#ffffff"/>
        <rect x="336" y="278" width="150" height="9" rx="4.5" fill="${shade(c, 0.55)}"/>
        <rect x="336" y="304" width="110" height="9" rx="4.5" fill="${shade(c, 0.7)}"/>
        <rect x="528" y="150" width="16" height="470" fill="${d}"/>
        ${Array.from({ length: 12 }, (_, i) => `<circle cx="240" cy="${180 + i * 37}" r="12" fill="none" stroke="#d3d8e2" stroke-width="7"/>`).join("")}`;
    case "ream":
      return `${shadow(250)}
        ${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${160 + i * 2}" y="${430 - i * 30}" width="480" height="${36}" rx="6" fill="${i % 2 ? "#ffffff" : "#f1f3f8"}" stroke="#dfe3ec" stroke-width="2"/>`).join("")}
        <rect x="160" y="300" width="480" height="300" rx="14" fill="#ffffff" stroke="#dfe3ec" stroke-width="3"/>
        <rect x="160" y="390" width="480" height="120" fill="${c}"/>
        <rect x="160" y="390" width="480" height="14" fill="${shade(c, 0.35)}"/>
        <rect x="350" y="425" width="100" height="50" rx="10" fill="#ffffff" opacity="0.92"/>`;
    case "pens":
      return `${shadow(220)}${pen(310, alt[0] ?? c, -14)}${pen(400, alt[1] ?? c, 0)}${pen(490, alt[2] ?? c, 14)}`;
    case "pencils":
      return `${shadow(220)}${pencil(320, -14)}${pencil(400, 0, "#f6a623")}${pencil(480, 14)}`;
    case "marker":
      return `${shadow(160)}<g transform="rotate(-20 400 400)">
        <rect x="350" y="180" width="100" height="430" rx="40" fill="#2b2f3a"/>
        <rect x="350" y="180" width="100" height="150" rx="40" fill="${c}"/>
        <rect x="362" y="350" width="22" height="240" rx="11" fill="#ffffff" opacity="0.18"/>
        <rect x="372" y="600" width="56" height="40" rx="12" fill="#1b1e26"/></g>`;
    case "geometry":
      return `${shadow(250)}
        <rect x="170" y="300" width="460" height="300" rx="22" fill="${shade(c, -0.3)}"/>
        <rect x="170" y="280" width="460" height="290" rx="22" fill="${c}"/>
        <rect x="190" y="300" width="420" height="250" rx="16" fill="${shade(c, 0.25)}"/>
        <path d="M250 520 A150 150 0 0 1 550 520 Z" fill="#ffffff" opacity="0.85"/>
        <path d="M290 520 A110 110 0 0 1 510 520" fill="none" stroke="${c}" stroke-width="4"/>
        <g transform="rotate(-8 400 360)"><rect x="380" y="250" width="40" height="40" rx="20" fill="#c9ced8"/>
        <path d="M392 285 L330 470 L345 474 L404 290 Z" fill="#9aa1b1"/><path d="M408 285 L470 470 L455 474 L396 290 Z" fill="#9aa1b1"/></g>`;
    case "eraser":
      return `${shadow(230)}
        ${[0, 1, 2].map((i) => `<g transform="translate(${-150 + i * 150} ${i === 1 ? -30 : 0})"><rect x="330" y="380" width="140" height="210" rx="18" fill="#ffffff" stroke="#e1e5ee" stroke-width="3"/><rect x="330" y="470" width="140" height="120" rx="18" fill="${alt[i] ?? c}"/><rect x="330" y="470" width="140" height="18" fill="${alt[i] ?? c}"/></g>`).join("")}`;
    case "sharpener":
      return `${shadow(230)}
        ${[0, 1, 2].map((i) => `<g transform="translate(${-150 + i * 150} 0)"><rect x="340" y="400" width="120" height="170" rx="12" fill="#b7bdc9"/><rect x="340" y="400" width="120" height="30" rx="10" fill="#d7dbe4"/><circle cx="400" cy="490" r="34" fill="#596172"/><circle cx="400" cy="490" r="16" fill="#2b2f3a"/><rect x="455" y="440" width="14" height="80" rx="4" fill="#8a92a3"/></g>`).join("")}`;
    case "scale":
      return `${shadow(270, 560)}<g transform="rotate(-12 400 450)">
        <rect x="110" y="400" width="580" height="110" rx="12" fill="${c}" opacity="0.85"/>
        ${Array.from({ length: 30 }, (_, i) => `<rect x="${130 + i * 18.6}" y="400" width="3" height="${i % 5 === 0 ? 40 : 22}" fill="${shade(c, -0.55)}"/>`).join("")}</g>`;
    case "crayons":
      return `${shadow(230)}
        ${alt.slice(0, 6).map((col, i) => crayon(250 + i * 60, col, 260 + (i % 2) * 40)).join("")}
        <rect x="200" y="420" width="400" height="220" rx="18" fill="${c}"/>
        <rect x="200" y="420" width="400" height="30" fill="${shade(c, 0.3)}"/>
        <rect x="320" y="500" width="160" height="70" rx="14" fill="#ffffff" opacity="0.9"/>`;
    case "watercolour":
      return `${shadow(260)}
        <rect x="150" y="290" width="500" height="320" rx="26" fill="#ffffff" stroke="#e1e5ee" stroke-width="3"/>
        ${alt.slice(0, 12).map((col, i) => `<ellipse cx="${215 + (i % 6) * 74}" cy="${375 + Math.floor(i / 6) * 120}" rx="30" ry="40" fill="${col}"/>`).join("")}
        <g transform="rotate(30 560 260)"><rect x="548" y="120" width="22" height="260" rx="11" fill="#8b5a2b"/><rect x="546" y="370" width="26" height="40" fill="#c9ced8"/><path d="M546 410 Q559 470 572 410 Z" fill="#2b2f3a"/></g>`;
    case "glue":
      return `${shadow(160)}
        <rect x="320" y="270" width="160" height="350" rx="30" fill="${c}"/>
        <rect x="335" y="285" width="34" height="320" rx="17" fill="#ffffff" opacity="0.3"/>
        <rect x="320" y="200" width="160" height="90" rx="28" fill="${shade(c, -0.35)}"/>
        <rect x="350" y="400" width="100" height="110" rx="12" fill="#ffffff"/>`;
    case "paper":
      return `${shadow(250)}
        ${alt.slice(0, 6).map((col, i) => `<rect x="${200 + i * 14}" y="${210 + i * 26}" width="380" height="300" rx="10" fill="${col}" transform="rotate(${-8 + i * 3} 400 400)"/>`).join("")}`;
    case "folder":
      return `${shadow(240)}
        <path d="M170 230 h170 l30 40 h260 a20 20 0 0 1 20 20 v330 a20 20 0 0 1 -20 20 h-460 a20 20 0 0 1 -20 -20 v-370 a20 20 0 0 1 20 -20 z" fill="${shade(c, -0.25)}"/>
        <rect x="200" y="250" width="380" height="300" rx="8" fill="#ffffff"/>
        ${[0, 1, 2, 3].map((i) => `<rect x="240" y="${290 + i * 34}" width="${280 - i * 30}" height="10" rx="5" fill="#d9dee8"/>`).join("")}
        <path d="M150 330 h500 a20 20 0 0 1 20 20 v260 a20 20 0 0 1 -20 20 h-460 a20 20 0 0 1 -20 -20 z" fill="${c}" opacity="0.92"/>`;
    case "stapler":
      return `${shadow(260)}
        <rect x="150" y="530" width="500" height="70" rx="30" fill="#2b2f3a"/>
        <path d="M170 520 Q190 400 330 390 L640 400 Q660 405 655 430 L640 520 Z" fill="${c}"/>
        <path d="M200 500 Q215 430 330 420 L610 428" fill="none" stroke="#ffffff" stroke-width="10" opacity="0.3" stroke-linecap="round"/>
        <circle cx="210" cy="520" r="26" fill="#9aa1b1"/>`;
    case "containers":
      return `${shadow(270)}
        ${[[240, 0.85, 0], [420, 1, 1], [575, 0.7, 2]].map(([x, s, i]) => `<g transform="translate(${x} 620) scale(${s})"><rect x="-90" y="-330" width="180" height="330" rx="26" fill="#e7f6fb" stroke="#bfe3ee" stroke-width="4" opacity="0.95"/><rect x="-80" y="-180" width="160" height="170" rx="18" fill="${alt[i as number] ?? c}" opacity="0.75"/><rect x="-98" y="-370" width="196" height="60" rx="18" fill="${c}"/><rect x="-70" y="-300" width="22" height="250" rx="11" fill="#ffffff" opacity="0.6"/></g>`).join("")}`;
    case "ladle":
      return `${shadow(180)}<g transform="rotate(-28 400 400)">
        <rect x="385" y="120" width="30" height="380" rx="15" fill="#c3c9d4"/>
        <rect x="390" y="130" width="10" height="360" rx="5" fill="#ffffff" opacity="0.6"/>
        <ellipse cx="400" cy="560" rx="120" ry="90" fill="#aeb5c2"/><ellipse cx="400" cy="548" rx="100" ry="66" fill="#d4d9e2"/>
        <circle cx="400" cy="140" r="16" fill="#8e96a6"/></g>`;
    case "peeler":
      return `${shadow(160)}<g transform="rotate(-25 400 400)">
        <rect x="360" y="330" width="80" height="300" rx="36" fill="${c}"/>
        <rect x="372" y="345" width="18" height="260" rx="9" fill="#ffffff" opacity="0.3"/>
        <path d="M370 330 L360 170 Q400 140 440 170 L430 330 Z" fill="#c3c9d4"/>
        <rect x="392" y="180" width="16" height="140" rx="6" fill="#7d8597"/></g>`;
    case "cloth":
      return `${shadow(250)}
        ${alt.slice(0, 3).map((col, i) => `<rect x="${190 + i * 20}" y="${470 - i * 90}" width="420" height="120" rx="22" fill="${col}"/><rect x="${190 + i * 20}" y="${470 - i * 90}" width="420" height="22" rx="11" fill="#ffffff" opacity="0.25"/>`).join("")}`;
    case "brush":
      return `${shadow(250)}
        <g transform="rotate(-35 400 300)"><rect x="385" y="40" width="30" height="420" rx="15" fill="#8b5a2b"/></g>
        <rect x="200" y="470" width="400" height="80" rx="20" fill="${c}"/>
        ${Array.from({ length: 24 }, (_, i) => `<rect x="${212 + i * 16}" y="545" width="8" height="70" rx="4" fill="${shade(c, -0.45)}"/>`).join("")}`;
    case "scrub":
      return `${shadow(250)}
        ${[0, 1, 2, 3].map((i) => `<g transform="translate(${(i % 2) * 200 - 100} ${Math.floor(i / 2) * -150})"><rect x="230" y="470" width="180" height="130" rx="20" fill="#f6d34a"/><rect x="230" y="470" width="180" height="40" rx="14" fill="${c}"/></g>`).join("")}`;
    case "storage":
      return `${shadow(260)}
        <path d="M180 330 h440 l-30 290 a20 20 0 0 1 -20 18 h-340 a20 20 0 0 1 -20 -18 z" fill="${c}" opacity="0.45"/>
        <path d="M180 330 h440 l-30 290 a20 20 0 0 1 -20 18 h-340 a20 20 0 0 1 -20 -18 z" fill="none" stroke="${shade(c, -0.2)}" stroke-width="6"/>
        <rect x="160" y="280" width="480" height="70" rx="18" fill="${c}"/>
        <rect x="340" y="296" width="120" height="16" rx="8" fill="#ffffff" opacity="0.6"/>`;
    case "organiser":
      return `${shadow(200)}
        ${pen(340, alt[0] ?? "#2b3590", -14)}${pencil(420, 6)}${pen(470, alt[1] ?? "#c0392b", 16)}
        <rect x="250" y="400" width="300" height="250" rx="28" fill="${c}"/>
        <rect x="250" y="400" width="300" height="40" rx="20" fill="${shade(c, 0.25)}"/>`;
    case "hooks":
      return `${shadow(250)}
        ${[0, 1, 2].map((i) => `<g transform="translate(${-180 + i * 180} 0)"><rect x="350" y="230" width="100" height="160" rx="20" fill="${c}"/><path d="M400 380 v120 a60 60 0 0 0 120 0 v-30" fill="none" stroke="#9aa1b1" stroke-width="22" stroke-linecap="round"/><circle cx="400" cy="270" r="9" fill="${shade(c, -0.4)}"/></g>`).join("")}`;
    case "bottle":
      return `${shadow(150)}
        <rect x="320" y="250" width="160" height="380" rx="56" fill="${c}"/>
        <rect x="338" y="275" width="30" height="330" rx="15" fill="#ffffff" opacity="0.35"/>
        <rect x="340" y="190" width="120" height="80" rx="20" fill="${shade(c, -0.35)}"/>
        <rect x="360" y="150" width="80" height="50" rx="16" fill="#2b2f3a"/>
        <rect x="320" y="420" width="160" height="36" fill="${shade(c, -0.15)}"/>`;
    case "towel":
      return `${shadow(240)}
        <rect x="190" y="300" width="420" height="300" rx="26" fill="${c}"/>
        <rect x="190" y="300" width="420" height="80" rx="26" fill="${shade(c, 0.25)}"/>
        ${[0, 1, 2].map((i) => `<rect x="190" y="${470 + i * 34}" width="420" height="14" fill="#ffffff" opacity="0.55"/>`).join("")}`;
    case "soap":
      return `${shadow(250)}
        ${[0, 1, 2].map((i) => `<g transform="translate(${-150 + i * 150} ${i === 1 ? -40 : 0})"><rect x="330" y="430" width="140" height="170" rx="40" fill="${c}"/><rect x="345" y="445" width="110" height="60" rx="30" fill="#ffffff" opacity="0.4"/></g>`).join("")}
        ${[0, 1, 2, 3, 4].map((i) => `<circle cx="${280 + i * 60}" cy="${330 - (i % 2) * 40}" r="${16 + (i % 3) * 6}" fill="#ffffff" stroke="${shade(c, 0.3)}" stroke-width="4"/>`).join("")}`;
    case "matchbox":
      return `${shadow(230)}
        <rect x="200" y="380" width="400" height="230" rx="16" fill="${c}"/>
        <rect x="200" y="380" width="400" height="34" fill="${shade(c, 0.3)}"/>
        <rect x="200" y="560" width="400" height="50" fill="#7a4a2a"/>
        ${Array.from({ length: 9 }, (_, i) => `<rect x="${232 + i * 38}" y="250" width="12" height="150" fill="#e8c39e"/><ellipse cx="${238 + i * 38}" cy="250" rx="12" ry="16" fill="#c0392b"/>`).join("")}`;
    case "kit":
      return `${shadow(270)}
        <g transform="translate(-130 30) scale(0.75) translate(130 100)">${art("notebook", c, alt)}</g>
        <g transform="translate(150 140) scale(0.6)">${pen(310, "#2b3590", -14)}${pen(400, "#c0392b", 0)}${pencil(490, 14)}</g>`;
  }
}

/** Full 800×800 SVG with a soft branded background. */
export function productSvg(kind: ArtKind, color: string, alt: string[] = []): string {
  const bg = shade(color, 0.86);
  const bg2 = shade(color, 0.72);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="${bg2}"/></linearGradient></defs>
  <rect width="800" height="800" fill="url(#g)"/>
  <circle cx="640" cy="150" r="190" fill="#ffffff" opacity="0.35"/>
  <circle cx="120" cy="720" r="150" fill="#ffffff" opacity="0.25"/>
  ${art(kind, color, alt)}
</svg>`;
}
