/** Regenerate the original vector-based social preview: npx tsx scripts/pc-share.tsx */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { PcBuildArt } from '../components/pc/build-art';

const art = renderToStaticMarkup(<PcBuildArt/>).replace('<svg ', '<svg x="680" y="45" width="490" height="540" ');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#121713"/><path d="M55 113H1145M55 560H1145" stroke="#384235"/>
<g font-family="DejaVu Sans,Arial,sans-serif"><text x="60" y="79" font-size="27" fill="#f2f3e9" font-weight="bold">TOLLEY <tspan fill="#c5ed8a">PC</tspan></text>
<text x="60" y="176" font-size="12" fill="#c5ed8a" letter-spacing="3">KANSAS CITY · CUSTOM PC BUILDING</text>
<text x="55" y="280" font-size="64" font-weight="bold" fill="#f2f3e9">Your next PC.</text>
<text x="55" y="361" font-size="64" font-weight="bold" fill="#c5ed8a">Built around you.</text>
<text x="60" y="420" font-size="19" fill="#b0b9ab">Parts sourcing or assembly with your parts.</text>
<rect x="60" y="458" width="248" height="51" rx="3" fill="#c5ed8a"/><text x="82" y="491" font-size="18" fill="#15200c">Build with Jared Tolley</text>
<text x="60" y="598" font-size="16" fill="#b0b9ab">tolley.io/pc</text></g>${art}</svg>`;
mkdirSync('public/pc', { recursive: true });
sharp(Buffer.from(svg)).png().toFile('public/pc/share.png')
  .then(() => console.log('Wrote public/pc/share.png'))
  .catch(error => { console.error(error); process.exitCode = 1; });
