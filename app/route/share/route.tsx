import { ImageResponse } from 'next/og';

const size = { width: 1200, height: 630 };
export const dynamic = 'force-static';

export function GET() {
  const colors = ['#e8ebe3', '#8ec6a2', '#e6cd70', '#cd7057'];
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#f4f3eb', color: '#203e32', padding: '52px 60px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', fontSize: 24, letterSpacing: 5, fontWeight: 700 }}>TOLLEY / ROUTE</div>
      <div style={{ display: 'flex', marginTop: 30, gap: 46 }}>
        <div style={{ display: 'flex', flexDirection: 'column', width: 610 }}>
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 76, lineHeight: 1.05, fontWeight: 700 }}><span>Every day.</span><span>Every delivery.</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 28, lineHeight: 1.4, marginTop: 28, color: '#5b6c60' }}><span>See when the work arrives —</span><span>and where you go most.</span></div>
          <div style={{ display: 'flex', fontSize: 20, marginTop: 38, gap: 12 }}>
            {['Calendar', 'Map', 'Pounds'].map(label => <div key={label} style={{ display: 'flex', padding: '12px 22px', border: '1px solid #bdc9ba', borderRadius: 25 }}>{label}</div>)}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', width: 390, background: '#fffef9', border: '1px solid #d6dccf', padding: 28, borderRadius: 20, transform: 'rotate(3deg)' }}>
          <div style={{ display: 'flex', fontSize: 23, fontWeight: 700, marginBottom: 22 }}>DELIVERY ACTIVITY</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {Array.from({ length: 35 }, (_, i) => <div key={i} style={{ display: 'flex', width: 40, height: 40, borderRadius: 7, background: colors[(i * 7 + Math.floor(i / 7)) % 4] }} />)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', fontSize: 16, marginTop: 24, gap: 10 }}>
            <span>Less</span>{colors.slice(1).map(color => <div key={color} style={{ width: 26, height: 13, background: color, borderRadius: 4 }} />)}<span>More</span>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', marginTop: 'auto', fontSize: 20, color: '#5b6c60' }}>tolley.io/route</div>
    </div>, size,
  );
}
