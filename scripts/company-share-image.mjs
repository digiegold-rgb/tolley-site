/** Build the company's static sharing card using bundled, outlined typography. */
import { readFile, writeFile } from 'node:fs/promises';
import opentype from 'opentype.js';
import sharp from 'sharp';
const bytes = await readFile('assets/content-income/DejaVuSans.ttf');
const font = opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
const text=(value,x,y,size,color)=>{
  let cursor=x;
  return Array.from(value,c=>font.charToGlyph(c)).map(g=>{
    const path=`<path fill="${color}" d="${g.getPath(cursor,y,size).toPathData(2)}"/>`;
    cursor+=(g.advanceWidth ?? font.unitsPerEm)*size/font.unitsPerEm;
    return path;
  }).join('');
};
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#f7f6f2"/><rect x="840" width="360" height="630" fill="#132438"/><circle cx="1030" cy="310" r="180" fill="none" stroke="#547196"/><ellipse cx="1030" cy="310" rx="125" ry="235" transform="rotate(35 1030 310)" fill="none" stroke="#547196"/><circle cx="1040" cy="310" r="103" fill="#213953"/>${text('T.',975,350,115,'#e3eaf5')}<circle cx="1145" cy="177" r="8" fill="#9cb4ee"/>${text('TOLLEY.IO',62,86,23,'#294fd3')}${text('AI software &',60,222,65,'#17232b')}${text('consumer',60,305,65,'#17232b')}${text('technology.',60,388,65,'#17232b')}<line x1="62" x2="760" y1="452" y2="452" stroke="#17232b" opacity=".2"/>${text('T-Agent / Jelly Studio / Electronics / Custom PCs',62,506,22,'#54616a')}${text('Jared Tolley, Founder · Independence, MO',62,558,20,'#54616a')}</svg>`;
await writeFile('public/company-share.png',await sharp(Buffer.from(svg)).png().toBuffer());
