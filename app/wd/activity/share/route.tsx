import { ImageResponse } from 'next/og';
export const dynamic = 'force-static';
export function GET() {
  return new ImageResponse(<div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: '#eff5f5', color: '#1c4559', padding: '52px 60px', fontFamily: 'sans-serif' }}>
    <div style={{ display: 'flex', fontSize: 25, letterSpacing: 4 }}>WASH & DRY / ACTIVITY</div>
    <div style={{ display: 'flex', marginTop: 36, gap: 32 }}>
      <div style={{ display: 'flex', flexDirection: 'column', width: 640 }}>
        <div style={{ display: 'flex', flexDirection: 'column', fontSize: 74, fontWeight: 700, lineHeight: 1.08 }}><span>Every rental,</span><span>in perspective.</span></div>
        <div style={{ display: 'flex', marginTop: 25, fontSize: 26, color: '#67828f' }}>Busy days. City connections. Care.</div>
        <div style={{ display: 'flex', gap: 12, marginTop: 35 }}>{['Calendar', 'City map', 'Repairs'].map(t => <div key={t} style={{ display: 'flex', padding: '12px 21px', border: '1px solid #b6ccd4', borderRadius: 25, fontSize: 20 }}>{t}</div>)}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', width: 354, height: 355, padding: 24, border: '2px solid #b6ccd4', background: '#fffefb', borderRadius: 25, transform: 'rotate(3deg)' }}>
        <div style={{ display: 'flex', gap: 10, height: 35, borderBottom: '2px solid #dfebee' }}><div style={{ width: 55, height: 12, background: '#c2d9e0', borderRadius: 4 }} /><div style={{ width: 12, height: 12, borderRadius: 12, background: '#719fb1', marginLeft: 'auto' }} /></div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 236, height: 236, borderRadius: 150, border: '16px solid #ccdee5', margin: '20px auto 0', background: '#548ba1' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, width: 133 }}>{Array.from({ length: 12 }, (_, i) => <div key={i} style={{ width: 27, height: 27, borderRadius: 7, background: ['#bce4cf', '#f1d790', '#e9a19a'][i % 3] }} />)}</div>
        </div>
      </div>
    </div>
    <div style={{ display: 'flex', marginTop: 'auto', fontSize: 20, color: '#67828f' }}>tolley.io/wd/activity</div>
  </div>, { width: 1200, height: 630 });
}
