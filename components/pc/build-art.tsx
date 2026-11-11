import React from 'react';
/** Original schematic illustration, deliberately not presented as a completed client build. */
export function PcBuildArt() {
  return <svg className="pc-build-art" viewBox="0 0 620 640" role="img" aria-labelledby="pc-art-title">
    <title id="pc-art-title">Illustration of a custom desktop PC with carefully arranged components</title>
    <defs>
      <linearGradient id="pc-case" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#343a36"/><stop offset="1" stopColor="#131714"/></linearGradient>
      <linearGradient id="pc-glass" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#667a62" stopOpacity=".18"/><stop offset="1" stopColor="#171d18" stopOpacity=".5"/></linearGradient>
      <radialGradient id="pc-glow"><stop stopColor="#b6e66f" stopOpacity=".24"/><stop offset="1" stopColor="#b6e66f" stopOpacity="0"/></radialGradient>
      <pattern id="pc-grid" width="34" height="34" patternUnits="userSpaceOnUse"><path d="M34 0H0V34" fill="none" stroke="#8a9b80" strokeOpacity=".1"/></pattern>
      <pattern id="pc-mesh" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".8" fill="#7d8b75"/></pattern>
      <g id="pc-fan"><circle r="45" fill="#161b17" stroke="#849c70" strokeWidth="1.5"/><circle r="38" fill="none" stroke="#bce37d" strokeOpacity=".6" strokeWidth="2"/>{Array.from({ length: 7 }, (_, i) => <path key={i} d="M0 -10C-18 -10 -30 -24 -19 -32C-8 -36 3 -26 0 -10" fill="#66755b" transform={`rotate(${i * 360 / 7})`}/>)}<circle r="10" fill="#2e382c" stroke="#a6bd91"/></g>
    </defs>
    <rect width="620" height="640" fill="url(#pc-grid)"/>
    <circle cx="320" cy="320" r="285" fill="url(#pc-glow)"/>
    <ellipse cx="319" cy="540" rx="217" ry="30" fill="#000" opacity=".4"/>
    <path d="M147 163 399 110 503 155 249 214Z" fill="#353d34" stroke="#6c7a64"/>
    <path d="M147 163 399 110V455L147 514Z" fill="url(#pc-case)" stroke="#65775a"/>
    <path d="M399 110 503 155V505L399 455Z" fill="#242b23" stroke="#65775a"/>
    <path d="M415 135 487 166V476L415 444Z" fill="url(#pc-mesh)" opacity=".5"/>
    <path d="M147 514 399 455 503 505 249 563Z" fill="#111510" stroke="#495441"/>
    <g transform="matrix(.90,-.20,0,1,165,183)">
      <rect x="0" y="0" width="241" height="285" rx="3" fill="#19231a" stroke="#3f5140"/>
      <g stroke="#6b8660" strokeWidth="1" opacity=".35" fill="none"><path d="M15 24H70V89H117V144H219M20 48H48V115H15M20 170H75V230H209M105 15V55H153V125H227M140 245V185H220"/><path d="M70 285V250H12M120 285V267H202V218M233 30H179V11"/></g>
      <rect x="73" y="54" width="86" height="86" rx="9" fill="#111810" stroke="#8ca176"/>
      <rect x="82" y="63" width="68" height="68" rx="6" fill="#2b3527" stroke="#586b4d"/>
      <path d="M98 89H136M117 89V114" stroke="#c3ee88" strokeWidth="4" fill="none"/>
      {[175, 192].map(x => <g key={x}><rect x={x} y="48" width="10" height="109" rx="2" fill="#171c15" stroke="#56634d"/><path d={`M${x + 3} 53V149`} stroke="#b7df7f" strokeWidth="2"/></g>)}
      <path d="M105 56C76 10 163 0 193 20M132 55C114 14 187 10 211 30" fill="none" stroke="#080e09" strokeWidth="10"/>
      <rect x="15" y="175" width="208" height="49" rx="5" fill="#30382d" stroke="#889776"/>
      <path d="M20 184H218M20 216H218" stroke="#bce284" strokeWidth="2"/>
      <text x="42" y="205" fill="#b7c4aa" fontSize="9" letterSpacing="3" fontFamily="monospace">GRAPHICS / COMPUTE</text>
      <path d="M198 227V251Q198 260 213 261H233M190 227V257Q190 271 211 272H233" fill="none" stroke="#8b9d74" strokeWidth="3"/>
      <use href="#pc-fan" transform="translate(31 91) scale(.47)"/>
      <path d="M8 271H235" stroke="#4d5a43" strokeWidth="2"/>
    </g>
    <g transform="matrix(.72,.31,0,1,451,212)"><use href="#pc-fan"/><use href="#pc-fan" y="109"/><use href="#pc-fan" y="218"/></g>
    <path d="M152 169 394 118V448L152 506Z" fill="url(#pc-glass)" stroke="#a0ae90" strokeOpacity=".35"/>
    <path d="M164 181 382 133" stroke="#d6e9c1" strokeOpacity=".32"/>
    <path d="M173 519V535L194 544V529M465 517V533L484 529V510" fill="#3b4534"/>
    <circle cx="463" cy="152" r="3" fill="#cbf291"/>
    <g fill="none" stroke="#a7c77f" strokeOpacity=".6"><path d="M213 94V61H111"/><circle cx="213" cy="94" r="3"/><path d="M508 354H554V309"/><circle cx="508" cy="354" r="3"/><path d="M183 461H80V425"/><circle cx="183" cy="461" r="3"/></g>
    <g fill="#a7b59a" fontSize="10" letterSpacing="2" fontFamily="monospace"><text x="64" y="47">PURPOSEFUL PARTS</text><text x="468" y="296">ROOM TO BREATHE</text><text x="33" y="412">CLEAN ASSEMBLY</text></g>
    <text x="310" y="611" textAnchor="middle" fill="#86917d" fontSize="9" letterSpacing="3" fontFamily="monospace">BUILD ILLUSTRATION · EVERY CONFIGURATION IS CUSTOM</text>
  </svg>;
}
