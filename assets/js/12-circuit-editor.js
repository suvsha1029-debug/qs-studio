// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  CIRCUIT EDITOR  â€”  12-circuit-editor.js
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const CIRC_GRID_SMALL = 4;
const CIRC_GRID_DEFAULT = 6;
const CIRC_GRID_2X = 8;
const CIRC_GRID_3X = 12;
let _cGridStep = CIRC_GRID_SMALL;
let _cViewZoom = 1;
let _cExpanded = false;

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  SYMBOL LIBRARY
//  All coords relative to symbol centre (0,0).
//  w/h = bounding box used for palette preview viewBox.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const CIRC_SYMBOLS = [
  {
    id:'battery', label:'Battery', group:'Sources', w:86, h:96,
    ports:[{"id": "P1", "x": 0.0, "y": -27.0}, {"id": "P2", "x": 0.0, "y": 28.8}],
    svgFn:(sel)=>{
      const c=sel?'#1f57a4':'#111';
      return `<g color="${c}" transform="scale(0.45) translate(-128,-128)"><style>.line{stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;fill:none}.term{stroke:currentColor;stroke-width:3;fill:#fff}.txt{font-family:Arial,Helvetica,sans-serif;fill:currentColor;font-size:18px;text-anchor:middle;dominant-baseline:middle}.lab{font-family:Arial,Helvetica,sans-serif;fill:currentColor;font-size:18px;text-anchor:middle;dominant-baseline:middle}.file{font-family:Arial,Helvetica,sans-serif;fill:currentColor;font-size:13px;text-anchor:middle;dominant-baseline:middle}</style><text class="lab" x="84" y="98">+</text><text class="lab" x="84" y="169">âˆ’</text><path class="line" d="M128 74 V96 M98 96 H158 M108 112 H148 M98 128 H158 M108 144 H148 M128 144 V186"/><circle class="term" cx="128" cy="68" r="6"/><circle class="term" cx="128" cy="192" r="6"/></g>`;
    }
  },
  {
    id:'cap', label:'Capacitor', group:'Passive', w:104, h:72,
    ports:[{"id": "P1", "x": -36.0, "y": 0.0}, {"id": "P2", "x": 36.0, "y": 0.0}],
    svgFn:(sel)=>{
      const c=sel?'#1f57a4':'#111';
      return `<g color="${c}" transform="scale(0.45) translate(-128,-128)"><style>.line{stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;fill:none}.term{stroke:currentColor;stroke-width:3;fill:#fff}.txt{font-family:Arial,Helvetica,sans-serif;fill:currentColor;font-size:18px;text-anchor:middle;dominant-baseline:middle}.file{font-family:Arial,Helvetica,sans-serif;fill:currentColor;font-size:13px;text-anchor:middle;dominant-baseline:middle}</style><circle class="term" cx="48" cy="128" r="6"/><circle class="term" cx="208" cy="128" r="6"/><path class="line" d="M54 128 H112 M144 128 H202 M112 98 V158 M144 98 V158"/></g>`;
    }
  },
  {
    id:'diode', label:'Diode A->K', group:'Diodes', w:104, h:72,
    ports:[{"id": "P1", "x": -36.0, "y": 0.0}, {"id": "P2", "x": 36.0, "y": 0.0}],
    svgFn:(sel)=>{
      const c=sel?'#1f57a4':'#111';
      return `<g color="${c}" transform="scale(0.45) translate(-128,-128)"><style>.line{stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;fill:none}.term{stroke:currentColor;stroke-width:3;fill:#fff}.txt{font-family:Arial,Helvetica,sans-serif;fill:currentColor;font-size:18px;text-anchor:middle;dominant-baseline:middle}.lab{font-family:Arial,Helvetica,sans-serif;fill:currentColor;font-size:18px;text-anchor:middle;dominant-baseline:middle}.file{font-family:Arial,Helvetica,sans-serif;fill:currentColor;font-size:13px;text-anchor:middle;dominant-baseline:middle}</style><circle class="term" cx="48" cy="128" r="6"/><circle class="term" cx="208" cy="128" r="6"/><path class="line" d="M54 128 H110 M162 128 H202"/><path class="line" d="M110,102 L110,154 L158,128 Z"/><path class="line" d="M162 102 V154"/><text class="lab" x="36" y="110">A</text><text class="lab" x="220" y="110">K</text></g>`;
    }
  },
  {
    id:'diode_rev', label:'Diode K->A', group:'Diodes', w:104, h:72,
    ports:[{"id": "P1", "x": -36.0, "y": 0.0}, {"id": "P2", "x": 36.0, "y": 0.0}],
    svgFn:(sel)=>{
      const c=sel?'#1f57a4':'#111';
      return `<g color="${c}" transform="scale(0.45) translate(-128,-128)"><style>.line{stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;fill:none}.term{stroke:currentColor;stroke-width:3;fill:#fff}.txt{font-family:Arial,Helvetica,sans-serif;fill:currentColor;font-size:18px;text-anchor:middle;dominant-baseline:middle}.lab{font-family:Arial,Helvetica,sans-serif;fill:currentColor;font-size:18px;text-anchor:middle;dominant-baseline:middle}.file{font-family:Arial,Helvetica,sans-serif;fill:currentColor;font-size:13px;text-anchor:middle;dominant-baseline:middle}</style><circle class="term" cx="48" cy="128" r="6"/><circle class="term" cx="208" cy="128" r="6"/><path class="line" d="M54 128 H94 M146 128 H202"/><path class="line" d="M146,102 L146,154 L98,128 Z"/><path class="line" d="M94 102 V154"/><text class="lab" x="36" y="110">K</text><text class="lab" x="220" y="110">A</text></g>`;
    }
  },
  {
    id:'ind', label:'Inductor', group:'Passive', w:104, h:72,
    ports:[{"id": "P1", "x": -36.0, "y": 0.0}, {"id": "P2", "x": 36.0, "y": 0.0}],
    svgFn:(sel)=>{
      const c=sel?'#1f57a4':'#111';
      return `<g color="${c}" transform="scale(0.45) translate(-128,-128)"><style>.line{stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;fill:none}.term{stroke:currentColor;stroke-width:3;fill:#fff}.txt{font-family:Arial,Helvetica,sans-serif;fill:currentColor;font-size:18px;text-anchor:middle;dominant-baseline:middle}.file{font-family:Arial,Helvetica,sans-serif;fill:currentColor;font-size:13px;text-anchor:middle;dominant-baseline:middle}</style><circle class="term" cx="48" cy="128" r="6"/><circle class="term" cx="208" cy="128" r="6"/><path class="line" d="M54 128 H82 C82 106,110 106,110 128 C110 106,138 106,138 128 C138 106,166 106,166 128 C166 106,194 106,194 128 H202"/></g>`;
    }
  },
  {
    id:'jfet_n_1', label:'JFET N 1', group:'JFET', w:116, h:116,
    ports:[{"id": "G", "x": -42.3, "y": 5.4}, {"id": "D", "x": 3.6, "y": -26.1}, {"id": "S", "x": 3.6, "y": 36.9}],
    svgFn:(sel)=>{
      const c=sel?'#1f57a4':'#111';
      return `<g color="${c}" transform="scale(0.45) translate(-128,-128)"><defs>
  <marker id="jfet_n_1_arr" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto">
    <path d="M0,0 L10,5 L0,10 Z" fill="currentColor"/>
  </marker>
</defs>
<style>
.L{stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;fill:none}
.T{stroke:currentColor;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;fill:none}
.C{stroke:currentColor;stroke-width:3;fill:#fff}
.t{font-family:Arial,Helvetica,sans-serif;fill:currentColor;font-size:18px;text-anchor:middle;dominant-baseline:middle}
.l{font-family:Arial,Helvetica,sans-serif;fill:currentColor;font-size:18px;text-anchor:middle;dominant-baseline:middle}
.f{font-family:Arial,Helvetica,sans-serif;fill:currentColor;font-size:13px;text-anchor:middle;dominant-baseline:middle}
</style>
<circle class="T" cx="118" cy="140" r="64"/>
<path class="L" d="M112 100 V180"/>
<path class="L" d="M112 112 H132 V76"/>
<circle class="C" cx="132" cy="70" r="6"/>
<text class="l" x="154" y="70">D</text>
<path class="L" d="M112 168 H132 V204"/>
<circle class="C" cx="132" cy="210" r="6"/>
<text class="l" x="154" y="210">S</text>
<circle class="C" cx="36" cy="140" r="6"/>
<text class="l" x="18" y="140">G</text>
<path class="L" d="M42 140 H112" marker-end="url(#jfet_n_1_arr)"/></g>`;
    }
  },
  {
    id:'jfet_n_2', label:'JFET N 2', group:'JFET', w:116, h:116,
    ports:[{"id": "G", "x": -42.3, "y": 5.4}, {"id": "D", "x": 3.6, "y": -26.1}, {"id": "S", "x": 3.6, "y": 36.9}],
    svgFn:(sel)=>{
      const c=sel?'#1f57a4':'#111';
      return `<g color="${c}" transform="scale(0.45) translate(-128,-128)"><defs>
  <marker id="jfet_n_2_arr" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto">
    <path d="M0,0 L10,5 L0,10 Z" fill="currentColor"/>
  </marker>
</defs>
<style>
.L{stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;fill:none}
.T{stroke:currentColor;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;fill:none}
.C{stroke:currentColor;stroke-width:3;fill:#fff}
.t{font-family:Arial,Helvetica,sans-serif;fill:currentColor;font-size:18px;text-anchor:middle;dominant-baseline:middle}
.l{font-family:Arial,Helvetica,sans-serif;fill:currentColor;font-size:18px;text-anchor:middle;dominant-baseline:middle}
.f{font-family:Arial,Helvetica,sans-serif;fill:currentColor;font-size:13px;text-anchor:middle;dominant-baseline:middle}
</style>
<circle class="T" cx="118" cy="140" r="50"/>
<path class="L" d="M112 100 V180"/>
<path class="L" d="M112 112 H132 V76"/>
<circle class="C" cx="132" cy="70" r="6"/>
<text class="l" x="154" y="70">D</text>
<path class="L" d="M112 168 H132 V204"/>
<circle class="C" cx="132" cy="210" r="6"/>
<text class="l" x="154" y="210">S</text>
<circle class="C" cx="44" cy="140" r="6"/>
<text class="l" x="22" y="140">G</text>
<path class="L" d="M50 140 H112" marker-end="url(#jfet_n_2_arr)"/></g>`;
    }
  },
  {
    id:'jfet_p', label:'JFET P', group:'JFET', w:116, h:116,
    ports:[{"id": "G", "x": -42.3, "y": 5.4}, {"id": "D", "x": 3.6, "y": -26.1}, {"id": "S", "x": 3.6, "y": 36.9}],
    svgFn:(sel)=>{
      const c=sel?'#1f57a4':'#111';
      return `<g color="${c}" transform="scale(0.45) translate(-128,-128)"><defs>
  <marker id="jfet_p_arr" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto">
    <path d="M0,0 L10,5 L0,10 Z" fill="currentColor"/>
  </marker>
</defs>
<style>
.L{stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;fill:none}
.T{stroke:currentColor;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;fill:none}
.C{stroke:currentColor;stroke-width:3;fill:#fff}
.t{font-family:Arial,Helvetica,sans-serif;fill:currentColor;font-size:18px;text-anchor:middle;dominant-baseline:middle}
.l{font-family:Arial,Helvetica,sans-serif;fill:currentColor;font-size:18px;text-anchor:middle;dominant-baseline:middle}
.f{font-family:Arial,Helvetica,sans-serif;fill:currentColor;font-size:13px;text-anchor:middle;dominant-baseline:middle}
</style>
<circle class="T" cx="118" cy="140" r="50"/>
<path class="L" d="M112 100 V180"/>
<path class="L" d="M112 112 H132 V76"/>
<circle class="C" cx="132" cy="70" r="6"/>
<text class="l" x="154" y="70">D</text>
<path class="L" d="M112 168 H132 V204"/>
<circle class="C" cx="132" cy="210" r="6"/>
<text class="l" x="154" y="210">S</text>
<circle class="C" cx="44" cy="140" r="6"/>
<text class="l" x="22" y="140">G</text>
<path class="L" d="M112 140 H50" marker-end="url(#jfet_p_arr)"/></g>`;
    }
  },
  {
    id:'led', label:'LED', group:'Diodes', w:104, h:72,
    ports:[{"id": "P1", "x": -36.0, "y": 0.0}, {"id": "P2", "x": 36.0, "y": 0.0}],
    svgFn:(sel)=>{
      const c=sel?'#1f57a4':'#111';
      return `<g color="${c}" transform="scale(0.45) translate(-128,-128)"><defs><marker id="led_smallArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto"><path d="M0,0 L10,5 L0,10 Z" fill="currentColor"/></marker></defs><style>.line{stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;fill:none}.term{stroke:currentColor;stroke-width:3;fill:#fff}.txt{font-family:Arial,Helvetica,sans-serif;fill:currentColor;font-size:18px;text-anchor:middle;dominant-baseline:middle}.lab{font-family:Arial,Helvetica,sans-serif;fill:currentColor;font-size:18px;text-anchor:middle;dominant-baseline:middle}.file{font-family:Arial,Helvetica,sans-serif;fill:currentColor;font-size:13px;text-anchor:middle;dominant-baseline:middle}</style><circle class="term" cx="48" cy="128" r="6"/><circle class="term" cx="208" cy="128" r="6"/><path class="line" d="M54 128 H110 M162 128 H202"/><path class="line" d="M110,102 L110,154 L158,128 Z"/><path class="line" d="M162 102 V154"/><text class="lab" x="36" y="110">A</text><text class="lab" x="220" y="110">K</text><path class="line" d="M146 84 L160 60" marker-end="url(#led_smallArrow)"/><path class="line" d="M164 92 L178 68" marker-end="url(#led_smallArrow)"/></g>`;
    }
  },
  {
    id:'nmos', label:'NMOS 1', group:'MOSFET', w:116, h:116,
    ports:[{"id": "G", "x": -32.0, "y": 0.0}, {"id": "D", "x": 24.0, "y": -44.0}, {"id": "S", "x": 24.0, "y": 44.0}],
    svgFn:(sel)=>{
      const c=sel?'#1f57a4':'#111';
      return `<g color="${c}" transform="scale(0.45) translate(-128,-128)"><defs>
  <marker id="nmos_arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
    <path d="M1 1L9 5L1 9" fill="currentColor" stroke="none"/>
  </marker>
</defs>
<style>
.L{stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;fill:none}
.l{font-family:Arial,Helvetica,sans-serif;fill:currentColor;font-size:18px;text-anchor:middle;dominant-baseline:middle}
</style>
<path class="L" d="M56 128 H112"/>
<path class="L" d="M112 78 V178"/>
<path class="L" d="M128 72 V184"/>
<path class="L" d="M128 84 H180"/>
<path class="L" d="M180 84 V28"/>
<path class="L" d="M128 172 H150"/>
<path class="L" d="M150 172 H168" marker-end="url(#nmos_arr)"/>
<path class="L" d="M169 172 H180"/>
<path class="L" d="M180 172 V228"/>
<text class="l" x="194" y="28">D</text>
<text class="l" x="194" y="234">S</text>
<text class="l" x="38" y="134">G</text></g>`;
    }
  },
  {
    id:'nmos_2', label:'NMOS 2', group:'MOSFET', w:116, h:116,
    ports:[{"id": "G", "x": -44.0, "y": 4.0}, {"id": "D", "x": 4.0, "y": -24.0}, {"id": "S", "x": 4.0, "y": 36.0}],
    svgFn:(sel)=>{
      const c=sel?'#1f57a4':'#111';
      return `<g color="${c}" transform="scale(0.45) translate(-128,-128)"><defs>
  <marker id="nmos_2_arr" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto">
    <path d="M0,0 L10,5 L0,10 Z" fill="currentColor"/>
  </marker>
</defs>
<style>
.L{stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;fill:none}
.t{font-family:Arial,Helvetica,sans-serif;fill:currentColor;font-size:18px;text-anchor:middle;dominant-baseline:middle}
.l{font-family:Arial,Helvetica,sans-serif;fill:currentColor;font-size:18px;text-anchor:middle;dominant-baseline:middle}
.f{font-family:Arial,Helvetica,sans-serif;fill:currentColor;font-size:13px;text-anchor:middle;dominant-baseline:middle}
</style>
<path class="L" d="M100 114 V166"/>
<path class="L" d="M118 104 V176"/>
<path class="L" d="M118 122 H136 V78"/>
<text class="l" x="150" y="72">D</text>
<path class="L" d="M136 210 V158"/>
<path class="L" d="M118 158 H136" marker-end="url(#nmos_2_arr)"/>
<text class="l" x="150" y="216">S</text>
<text class="l" x="20" y="140">G</text>
<path class="L" d="M34 140 H100"/></g>`;
    }
  },
  {
    id:'pmos', label:'PMOS', group:'MOSFET', w:116, h:116,
    ports:[{"id": "G", "x": -32.0, "y": 0.0}, {"id": "S", "x": 24.0, "y": -44.0}, {"id": "D", "x": 24.0, "y": 44.0}],
    svgFn:(sel)=>{
      const c=sel?'#1f57a4':'#111';
      return `<g color="${c}" transform="scale(0.45) translate(-128,-128)"><defs>
  <marker id="pmos_arr" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="8" markerHeight="8" orient="auto">
    <path d="M9 1L1 5L9 9" fill="currentColor" stroke="none"/>
  </marker>
</defs>
<style>
.L{stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;fill:none}
.l{font-family:Arial,Helvetica,sans-serif;fill:currentColor;font-size:18px;text-anchor:middle;dominant-baseline:middle}
</style>
<path class="L" d="M56 128 H112"/>
<path class="L" d="M112 78 V178"/>
<path class="L" d="M128 72 V184"/>
<path class="L" d="M128 84 H150"/>
<path class="L" d="M151 84 H168" marker-start="url(#pmos_arr)"/>
<path class="L" d="M169 84 H180"/>
<path class="L" d="M180 84 V28"/>
<path class="L" d="M128 172 H180"/>
<path class="L" d="M180 172 V228"/>
<text class="l" x="194" y="28">S</text>
<text class="l" x="194" y="234">D</text>
<text class="l" x="38" y="134">G</text></g>`;
    }
  },
  {
    id:'photodiode', label:'Photodiode', group:'Diodes', w:104, h:72,
    ports:[{"id": "P1", "x": -36.0, "y": 0.0}, {"id": "P2", "x": 36.0, "y": 0.0}],
    svgFn:(sel)=>{
      const c=sel?'#1f57a4':'#111';
      return `<g color="${c}" transform="scale(0.45) translate(-128,-128)"><defs><marker id="photodiode_smallArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto"><path d="M0,0 L10,5 L0,10 Z" fill="currentColor"/></marker></defs><style>.line{stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;fill:none}.term{stroke:currentColor;stroke-width:3;fill:#fff}.txt{font-family:Arial,Helvetica,sans-serif;fill:currentColor;font-size:18px;text-anchor:middle;dominant-baseline:middle}.lab{font-family:Arial,Helvetica,sans-serif;fill:currentColor;font-size:18px;text-anchor:middle;dominant-baseline:middle}.file{font-family:Arial,Helvetica,sans-serif;fill:currentColor;font-size:13px;text-anchor:middle;dominant-baseline:middle}</style><circle class="term" cx="48" cy="128" r="6"/><circle class="term" cx="208" cy="128" r="6"/><path class="line" d="M54 128 H110 M162 128 H202"/><path class="line" d="M110,102 L110,154 L158,128 Z"/><path class="line" d="M162 102 V154"/><text class="lab" x="36" y="110">A</text><text class="lab" x="220" y="110">K</text><path class="line" d="M136 62 L120 87" marker-end="url(#photodiode_smallArrow)"/><path class="line" d="M160 60 L144 85" marker-end="url(#photodiode_smallArrow)"/></g>`;
    }
  },
  {
    id:'npn', label:'NPN BJT', group:'BJT', w:116, h:116,
    ports:[{"id": "B", "x": -36.0, "y": 0.0}, {"id": "C", "x": 0.0, "y": -28.8}, {"id": "E", "x": 0.0, "y": 28.8}],
    svgFn:(sel)=>{
      const c=sel?'#1f57a4':'#111';
      return `<g color="${c}" transform="scale(0.45) translate(-128,-128)"><defs><marker id="npn_arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="currentColor"/></marker></defs><style>.line{stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;fill:none}.thin{stroke:currentColor;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;fill:none}.term{stroke:currentColor;stroke-width:3;fill:#fff}.txt{font-family:Arial,Helvetica,sans-serif;fill:currentColor;font-size:18px;text-anchor:middle;dominant-baseline:middle}.lab{font-family:Arial,Helvetica,sans-serif;fill:currentColor;font-size:18px;text-anchor:middle;dominant-baseline:middle}.file{font-family:Arial,Helvetica,sans-serif;fill:currentColor;font-size:13px;text-anchor:middle;dominant-baseline:middle}</style><circle class="thin" cx="128" cy="128" r="54"/><circle class="term" cx="48" cy="128" r="6"/><text class="lab" x="24" y="128">B</text><circle class="term" cx="128" cy="64" r="6"/><text class="lab" x="148" y="64">C</text><circle class="term" cx="128" cy="192" r="6"/><text class="lab" x="148" y="192">E</text><path class="line" d="M54 128 H100"/><path class="line" d="M100 94 V162"/><path class="line" d="M100 108 L128 90 V70"/><path class="line" d="M100 148 L128 166 V186"/><path class="line" d="M108 153 L126 165" marker-end="url(#npn_arrow)"/></g>`;
    }
  },
  {
    id:'pnp', label:'PNP BJT', group:'BJT', w:116, h:116,
    ports:[{"id": "B", "x": -36.0, "y": 0.0}, {"id": "C", "x": 0.0, "y": -28.8}, {"id": "E", "x": 0.0, "y": 28.8}],
    svgFn:(sel)=>{
      const c=sel?'#1f57a4':'#111';
      return `<g color="${c}" transform="scale(0.45) translate(-128,-128)"><defs><marker id="pnp_arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="currentColor"/></marker></defs><style>.line{stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;fill:none}.thin{stroke:currentColor;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;fill:none}.term{stroke:currentColor;stroke-width:3;fill:#fff}.txt{font-family:Arial,Helvetica,sans-serif;fill:currentColor;font-size:18px;text-anchor:middle;dominant-baseline:middle}.lab{font-family:Arial,Helvetica,sans-serif;fill:currentColor;font-size:18px;text-anchor:middle;dominant-baseline:middle}.file{font-family:Arial,Helvetica,sans-serif;fill:currentColor;font-size:13px;text-anchor:middle;dominant-baseline:middle}</style><circle class="thin" cx="128" cy="128" r="54"/><circle class="term" cx="48" cy="128" r="6"/><text class="lab" x="24" y="128">B</text><circle class="term" cx="128" cy="64" r="6"/><text class="lab" x="148" y="64">C</text><circle class="term" cx="128" cy="192" r="6"/><text class="lab" x="148" y="192">E</text><path class="line" d="M54 128 H100"/><path class="line" d="M100 94 V162"/><path class="line" d="M100 108 L128 90 V70"/><path class="line" d="M100 148 L128 166 V186"/><path class="line" d="M126 165 L108 153" marker-end="url(#pnp_arrow)"/></g>`;
    }
  },
  {
    id:'pnp_2', label:'PNP BJT 2', group:'BJT', w:116, h:116,
    ports:[{"id": "B", "x": -36.0, "y": 0.0}, {"id": "C", "x": 0.0, "y": -28.8}, {"id": "E", "x": 0.0, "y": 28.8}],
    svgFn:(sel)=>{
      const c=sel?'#1f57a4':'#111';
      return `<g color="${c}" transform="scale(0.45) translate(-128,-128)"><defs><marker id="pnp_2_arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="currentColor"/></marker></defs><style>.line{stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;fill:none}.thin{stroke:currentColor;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;fill:none}.term{stroke:currentColor;stroke-width:3;fill:#fff}.txt{font-family:Arial,Helvetica,sans-serif;fill:currentColor;font-size:18px;text-anchor:middle;dominant-baseline:middle}.lab{font-family:Arial,Helvetica,sans-serif;fill:currentColor;font-size:18px;text-anchor:middle;dominant-baseline:middle}.file{font-family:Arial,Helvetica,sans-serif;fill:currentColor;font-size:13px;text-anchor:middle;dominant-baseline:middle}</style><circle class="thin" cx="128" cy="128" r="54"/><circle class="term" cx="48" cy="128" r="6"/><text class="lab" x="24" y="128">B</text><circle class="term" cx="128" cy="64" r="6"/><text class="lab" x="148" y="64">C</text><circle class="term" cx="128" cy="192" r="6"/><text class="lab" x="148" y="192">E</text><path class="line" d="M54 128 H100"/><path class="line" d="M100 94 V162"/><path class="line" d="M100 108 L128 90 V70"/><path class="line" d="M100 148 L128 166 V186"/><path class="line" d="M126 165 L108 153" marker-end="url(#pnp_2_arrow)"/></g>`;
    }
  },
  {
    id:'pnp_3', label:'PNP BJT 3', group:'BJT', w:116, h:116,
    ports:[{"id": "B", "x": -36.0, "y": 0.0}, {"id": "C", "x": 0.0, "y": -28.8}, {"id": "E", "x": 0.0, "y": 28.8}],
    svgFn:(sel)=>{
      const c=sel?'#1f57a4':'#111';
      return `<g color="${c}" transform="scale(0.45) translate(-128,-128)"><defs><marker id="pnp_3_arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="currentColor"/></marker></defs><style>.line{stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;fill:none}.thin{stroke:currentColor;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;fill:none}.term{stroke:currentColor;stroke-width:3;fill:#fff}.txt{font-family:Arial,Helvetica,sans-serif;fill:currentColor;font-size:18px;text-anchor:middle;dominant-baseline:middle}.lab{font-family:Arial,Helvetica,sans-serif;fill:currentColor;font-size:18px;text-anchor:middle;dominant-baseline:middle}.file{font-family:Arial,Helvetica,sans-serif;fill:currentColor;font-size:13px;text-anchor:middle;dominant-baseline:middle}</style><circle class="thin" cx="128" cy="128" r="54"/><circle class="term" cx="48" cy="128" r="6"/><text class="lab" x="24" y="128">B</text><circle class="term" cx="128" cy="64" r="6"/><text class="lab" x="148" y="64">C</text><circle class="term" cx="128" cy="192" r="6"/><text class="lab" x="148" y="192">E</text><path class="line" d="M54 128 H100"/><path class="line" d="M100 94 V162"/><path class="line" d="M100 108 L128 90 V70"/><path class="line" d="M100 148 L128 166 V186"/><path class="line" d="M126 165 L108 153" marker-end="url(#pnp_3_arrow)"/></g>`;
    }
  },
  {
    id:'zener', label:'Zener Diode', group:'Diodes', w:104, h:72,
    ports:[{"id": "P1", "x": -36.0, "y": 0.0}, {"id": "P2", "x": 36.0, "y": 0.0}],
    svgFn:(sel)=>{
      const c=sel?'#1f57a4':'#111';
      return `<g color="${c}" transform="scale(0.45) translate(-128,-128)"><style>.line{stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;fill:none}.term{stroke:currentColor;stroke-width:3;fill:#fff}.txt{font-family:Arial,Helvetica,sans-serif;fill:currentColor;font-size:18px;text-anchor:middle;dominant-baseline:middle}.lab{font-family:Arial,Helvetica,sans-serif;fill:currentColor;font-size:18px;text-anchor:middle;dominant-baseline:middle}.file{font-family:Arial,Helvetica,sans-serif;fill:currentColor;font-size:13px;text-anchor:middle;dominant-baseline:middle}</style><circle class="term" cx="48" cy="128" r="6"/><circle class="term" cx="208" cy="128" r="6"/><path class="line" d="M54 128 H110 M162 128 H202"/><path class="line" d="M110,102 L110,154 L158,128 Z"/><path class="line" d="M162 102 v52 m0 -52 l10 6 m-10 46 l-10 -6"/><text class="lab" x="36" y="110">A</text><text class="lab" x="220" y="110">K</text></g>`;
    }
  },


  {
    id:'res', label:'Resistor', group:'Passive', w:140, h:60,
    ports:[{"id":"P1","x":-58.0,"y":0.0},{"id":"P2","x":58.0,"y":0.0}],
    svgFn:(sel)=>{
      const c=sel?'#1f57a4':'#111';
      return `<g color="${c}" transform="scale(0.45) translate(-128,-128)"><style>.L{stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;fill:none}</style><path class="L" d="M24 128 H52 L74 94 L96 162 L118 94 L140 162 L162 94 L184 162 L206 94 L228 128 H256"/></g>`;
    }
  },
  {
    id:'res_zigzag', label:'Zig-Zag Resistor', group:'Passive', w:140, h:60,
    ports:[{"id":"P1","x":-58.0,"y":0.0},{"id":"P2","x":58.0,"y":0.0}],
    svgFn:(sel)=>{
      const c=sel?'#1f57a4':'#111';
      return `<g color="${c}" transform="scale(0.45) translate(-128,-128)"><style>.L{stroke:currentColor;stroke-width:3;stroke-linecap:square;stroke-linejoin:miter;fill:none}</style><path class="L" d="M24 128 H62 L82 82 L106 174 L130 82 L154 174 L178 82 L198 128 H256"/></g>`;
    }
  },
  {
    id:'ground', label:'Ground', group:'Nodes', w:80, h:80,
    ports:[{"id":"GND","x":0.0,"y":-25.0}],
    svgFn:(sel)=>{
      const c=sel?'#1f57a4':'#111';
      return `<g color="${c}" transform="scale(0.45) translate(-128,-128)"><style>.L{stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;fill:none}</style><path class="L" d="M128 56 V112 M84 112 H172 M98 132 H158 M112 152 H144"/></g>`;
    }
  },
  {
    id:'supply_vdd', label:'Supply Terminal', group:'Nodes', w:80, h:80,
    ports:[{"id":"PWR","x":0.0,"y":25.0}],
    svgFn:(sel)=>{
      const c=sel?'#1f57a4':'#111';
      return `<g color="${c}" transform="scale(0.45) translate(-128,-128)"><style>.L{stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;fill:none}</style><path class="L" d="M128 60 V128 M88 60 H168"/></g>`;
    }
  },
  {
    id:'current_source', label:'Current Source', group:'Sources', w:90, h:120,
    ports:[{"id":"P1","x":0.0,"y":-42.0},{"id":"P2","x":0.0,"y":42.0}],
    svgFn:(sel)=>{
      const c=sel?'#1f57a4':'#111';
      return `<g color="${c}" transform="scale(0.45) translate(-128,-128)"><style>.L{stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;fill:none}.C{stroke:currentColor;stroke-width:3;fill:#fff}</style><path class="L" d="M128 34 V78 M128 178 V222 M128 96 V158"/><circle class="C" cx="128" cy="128" r="42"/><path class="L" d="M112 124 L128 142 L144 124"/></g>`;
    }
  },
  {
    id:'ac_voltage_source', label:'AC Voltage Source', group:'Sources', w:100, h:140,
    ports:[{"id":"P1","x":0.0,"y":-50.0},{"id":"P2","x":0.0,"y":50.0}],
    svgFn:(sel)=>{
      const c=sel?'#1f57a4':'#111';
      return `<g color="${c}" transform="scale(0.45) translate(-128,-128)"><style>.L{stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;fill:none}.C{stroke:currentColor;stroke-width:3;fill:#fff}</style><path class="L" d="M128 26 V72 M128 184 V230"/><circle class="C" cx="128" cy="128" r="42"/><path class="L" d="M96 128 C106 108 118 108 128 128 C138 148 150 148 160 128"/></g>`;
    }
  },
  {
    id:'ac_current_source', label:'AC Current Source', group:'Sources', w:100, h:140,
    ports:[{"id":"P1","x":0.0,"y":-50.0},{"id":"P2","x":0.0,"y":50.0}],
    svgFn:(sel)=>{
      const c=sel?'#1f57a4':'#111';
      return `<g color="${c}" transform="scale(0.45) translate(-128,-128)"><style>.L{stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;fill:none}.C{stroke:currentColor;stroke-width:3;fill:#fff}</style><path class="L" d="M128 26 V72 M128 184 V230"/><circle class="C" cx="128" cy="128" r="42"/><path class="L" d="M128 96 V150"/><path class="L" d="M112 132 L128 150 L144 132"/><path class="L" d="M96 104 C106 94 118 94 128 104 C138 114 150 114 160 104"/></g>`;
    }
  },
  {
    id:'switch_spst_open', label:'Switch SPST Open', group:'Switches', w:180, h:110,
    ports:[{"id":"P1","x":-60.0,"y":20.0},{"id":"P2","x":60.0,"y":20.0}],
    svgFn:(sel)=>{
      const c=sel?'#1f57a4':'#111';
      return `<g color="${c}" transform="scale(0.45) translate(-128,-128)"><style>.L{stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;fill:none}.T{fill:currentColor;stroke:none}</style><path class="L" d="M28 172 H64 M192 172 H228 M64 172 L148 118"/><circle cx="64" cy="172" r="5" fill="currentColor"/><circle cx="192" cy="172" r="5" fill="currentColor"/><path class="L" d="M92 94 Q128 62 194 90" stroke-dasharray="8 12"/><path class="T" d="M178 76 L194 90 L172 94 Z"/></g>`;
    }
  },
  {
    id:'switch_spst_closed', label:'Switch SPST Closed', group:'Switches', w:180, h:110,
    ports:[{"id":"P1","x":-60.0,"y":20.0},{"id":"P2","x":60.0,"y":20.0}],
    svgFn:(sel)=>{
      const c=sel?'#1f57a4':'#111';
      return `<g color="${c}" transform="scale(0.45) translate(-128,-128)"><style>.L{stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;fill:none}.T{fill:currentColor;stroke:none}</style><path class="L" d="M28 172 H64 M192 172 H228 M64 172 H192"/><circle cx="64" cy="172" r="5" fill="currentColor"/><circle cx="192" cy="172" r="5" fill="currentColor"/><path class="L" d="M92 94 Q128 62 194 90" stroke-dasharray="8 12"/><path class="T" d="M178 76 L194 90 L172 94 Z"/></g>`;
    }
  },
  {
    id:'switch_push_no', label:'Push Switch NO', group:'Switches', w:190, h:120,
    ports:[{"id":"P1","x":-62.0,"y":24.0},{"id":"P2","x":62.0,"y":24.0}],
    svgFn:(sel)=>{
      const c=sel?'#1f57a4':'#111';
      return `<g color="${c}" transform="scale(0.45) translate(-128,-128)"><style>.L{stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;fill:none}.T{fill:currentColor;stroke:none}</style><path class="L" d="M22 176 H62 M198 176 H236 M62 176 L150 124 M128 48 V82 M106 48 H150"/><circle cx="62" cy="176" r="5" fill="currentColor"/><circle cx="198" cy="176" r="5" fill="currentColor"/><path class="L" d="M100 74 Q136 44 194 76" stroke-dasharray="8 12"/><path class="T" d="M178 62 L194 76 L172 80 Z"/></g>`;
    }
  },
  {
    id:'switch_push_nc', label:'Push Switch NC', group:'Switches', w:190, h:120,
    ports:[{"id":"P1","x":-62.0,"y":24.0},{"id":"P2","x":62.0,"y":24.0}],
    svgFn:(sel)=>{
      const c=sel?'#1f57a4':'#111';
      return `<g color="${c}" transform="scale(0.45) translate(-128,-128)"><style>.L{stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;fill:none}.T{fill:currentColor;stroke:none}</style><path class="L" d="M22 176 H62 M198 176 H236 M62 176 H198 M128 48 V82 M106 48 H150"/><circle cx="62" cy="176" r="5" fill="currentColor"/><circle cx="198" cy="176" r="5" fill="currentColor"/><path class="L" d="M100 74 Q136 44 194 76" stroke-dasharray="8 12"/><path class="T" d="M178 62 L194 76 L172 80 Z"/></g>`;
    }
  },
  {
    id:'switch_spdt', label:'Switch SPDT', group:'Switches', w:210, h:130,
    ports:[{"id":"COM","x":-66.0,"y":28.0},{"id":"P1","x":64.0,"y":-8.0},{"id":"P2","x":64.0,"y":42.0}],
    svgFn:(sel)=>{
      const c=sel?'#1f57a4':'#111';
      return `<g color="${c}" transform="scale(0.45) translate(-128,-128)"><style>.L{stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;fill:none}.T{fill:currentColor;stroke:none}</style><path class="L" d="M18 184 H62 M198 112 H236 M198 214 H236 M62 184 L172 128"/><circle cx="62" cy="184" r="5" fill="currentColor"/><circle cx="198" cy="112" r="5" fill="currentColor"/><circle cx="198" cy="214" r="5" fill="currentColor"/><path class="L" d="M98 58 Q144 28 206 58" stroke-dasharray="8 12"/><path class="T" d="M190 44 L206 58 L184 62 Z"/></g>`;
    }
  },
  {
    id:'switch_toggle', label:'Switch Toggle', group:'Switches', w:190, h:120,
    ports:[{"id":"P1","x":-62.0,"y":24.0},{"id":"P2","x":62.0,"y":24.0}],
    svgFn:(sel)=>{
      const c=sel?'#1f57a4':'#111';
      return `<g color="${c}" transform="scale(0.45) translate(-128,-128)"><style>.L{stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;fill:none}.T{fill:currentColor;stroke:none}</style><path class="L" d="M22 176 H62 M198 176 H236 M62 176 L152 120 M128 48 L144 30"/><circle cx="62" cy="176" r="5" fill="currentColor"/><circle cx="198" cy="176" r="5" fill="currentColor"/><path class="L" d="M100 74 Q136 44 194 70" stroke-dasharray="8 12"/><path class="T" d="M178 56 L194 70 L172 74 Z"/></g>`;
    }
  },

];

// Custom symbols are imported only from the structured SVG maker JSON. This
// retains editable vector data and avoids injecting arbitrary SVG or HTML.
const CIRC_CUSTOM_SYMBOLS_STORAGE = 'qsStudioCustomCircuitSymbolsV2';

function _cCustomNumber(value, fallback=0){
  const n=Number(value);
  return Number.isFinite(n) ? Math.max(-5000,Math.min(5000,n)) : fallback;
}
function _cCustomStrokeWidth(raw, fallback=2){
  const source=raw&&typeof raw==='object' ? (raw.sw ?? raw.strokeWidth ?? raw.style?.strokeWidth) : raw;
  const n=Number(source);
  return Number.isFinite(n) ? Math.max(.05,Math.min(160,n)) : fallback;
}
function _cCustomColor(value, fallback='#111'){
  const color=String(value||'').trim();
  return /^(?:#[0-9a-f]{3,8}|none|transparent|currentColor)$/i.test(color) ? color : fallback;
}
function _cCustomPortName(value, fallback){
  const name=String(value||'').toUpperCase().replace(/[^A-Z0-9_]/g,'').slice(0,16);
  return name||fallback;
}
function _cCustomTextValue(value){ return String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').slice(0,1200); }
function _cSvgDataUrl(svgText){
  const svg=String(svgText||'');
  try{
    const bytes=new TextEncoder().encode(svg);
    let binary='';
    bytes.forEach(byte=>{ binary+=String.fromCharCode(byte); });
    return 'data:image/svg+xml;charset=utf-8;base64,'+btoa(binary);
  }catch(_){
    return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
  }
}
function _cCustomMathWordMap(){return {alpha:'α',beta:'β',gamma:'γ',delta:'δ',epsilon:'ε',varepsilon:'ϵ',zeta:'ζ',eta:'η',theta:'θ',vartheta:'ϑ',iota:'ι',kappa:'κ',lambda:'λ',mu:'μ',nu:'ν',xi:'ξ',pi:'π',rho:'ρ',varrho:'ϱ',sigma:'σ',varsigma:'ς',tau:'τ',upsilon:'υ',phi:'φ',varphi:'ϕ',chi:'χ',psi:'ψ',omega:'ω',Gamma:'Γ',Delta:'Δ',Theta:'Θ',Lambda:'Λ',Xi:'Ξ',Pi:'Π',Sigma:'Σ',Upsilon:'Υ',Phi:'Φ',Psi:'Ψ',Omega:'Ω',pm:'±',mp:'∓',times:'×',div:'÷',cdot:'·',leq:'≤',le:'≤',geq:'≥',ge:'≥',neq:'≠',ne:'≠',approx:'≈',simeq:'≃',sim:'∼',cong:'≅',equiv:'≡',infty:'∞',partial:'∂',nabla:'∇',forall:'∀',exists:'∃',leftarrow:'←',rightarrow:'→',leftrightarrow:'↔',Rightarrow:'⇒',Leftarrow:'⇐',Leftrightarrow:'⇔',cup:'∪',cap:'∩',subset:'⊂',supset:'⊃',subseteq:'⊆',supseteq:'⊇',in:'∈',notin:'∉',emptyset:'∅',varnothing:'∅',parallel:'∥',perp:'⊥',propto:'∝',degree:'°',ohm:'Ω'};}
function _cCustomScriptText(value,mode){const map=mode==='sub'?{'0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉','+':'₊','-':'₋','=':'₌','(':'₍',')':'₎','a':'ₐ','e':'ₑ','h':'ₕ','i':'ᵢ','j':'ⱼ','k':'ₖ','l':'ₗ','m':'ₘ','n':'ₙ','o':'ₒ','p':'ₚ','r':'ᵣ','s':'ₛ','t':'ₜ','u':'ᵤ','v':'ᵥ','x':'ₓ'}:{'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','+':'⁺','-':'⁻','=':'⁼','(':'⁽',')':'⁾','n':'ⁿ','i':'ⁱ','a':'ᵃ','b':'ᵇ','c':'ᶜ','d':'ᵈ','e':'ᵉ','f':'ᶠ','g':'ᵍ','h':'ʰ','j':'ʲ','k':'ᵏ','l':'ˡ','m':'ᵐ','o':'ᵒ','p':'ᵖ','r':'ʳ','s':'ˢ','t':'ᵗ','u':'ᵘ','v':'ᵛ','w':'ʷ','x':'ˣ','y':'ʸ','z':'ᶻ'};return [...String(value||'')].map(ch=>map[ch]||map[ch.toLowerCase()]||ch).join('');}
function _cCustomMathText(source){let out=_cCustomRepairLatex(source);for(let guard=0;guard<80;guard++){const next=out.replace(/\\(?:dfrac|tfrac|frac)\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g,'$1⁄$2').replace(/\\sqrt\s*\{([^{}]*)\}/g,'√($1)').replace(/\\(?:vec|bar|overline)\s*\{([^{}]*)\}/g,'$1\u0305').replace(/\\(?:operatorname|operatornamewithlimits)\s*\{([^{}]*)\}/g,'$1').replace(/\\(?:mathrm|mathbf|mathit|mathbb|mathcal|mathscr|text)\s*\{([^{}]*)\}/g,'$1').replace(/\\left\s*/g,'').replace(/\\right\s*/g,'');if(next===out)break;out=next;}out=out.replace(/\\([A-Za-z]+)(?=[^A-Za-z]|$)/g,(m,word)=>_cCustomMathSymbol(word)||word);out=out.replace(/\b(alpha|beta|gamma|delta|epsilon|varepsilon|zeta|eta|theta|vartheta|iota|kappa|lambda|mu|nu|xi|pi|varpi|rho|varrho|sigma|varsigma|tau|upsilon|phi|varphi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Upsilon|Phi|Psi|Omega|partial|nabla|infty|times|div|cdot|pm|mp|leq|geq|neq|approx|simeq|sim|cong|equiv|propto|notin|ni|subset|supset|subseteq|supseteq|cup|cap|setminus|emptyset|varnothing|forall|exists|nexists|oplus|otimes|odot|therefore|because|degree|hbar|ell|Re|Im|perp|parallel|angle|mapsto|ohm)\b/g,m=>_cCustomMathSymbol(m)||m);out=out.replace(/\^(\{([^{}]+)\}|[A-Za-z0-9+\-=()])/g,(_,all,body)=>_cCustomScriptText(body||all,'sup'));out=out.replace(/_(\{([^{}]+)\}|[A-Za-z0-9+\-=()])/g,(_,all,body)=>_cCustomScriptText(body||all,'sub'));return out.replace(/[{}]/g,'');}
function _cCustomKatexHtml(source){
  const k=window.katex;
  if(!k || typeof k.renderToString!=='function') return '';
  const latex=_cCustomRepairLatex(source).trim();
  if(!latex) return '';
  try{
    const html=k.renderToString(latex,{throwOnError:false,strict:'ignore',displayMode:false,output:'html'});
    if(/(?:merror|katex-error)/i.test(html)) return '';
    return html;
  }catch(_){ return ''; }
}
function _cCustomEscapeHtml(value){return String(value||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
const _cCustomBareCommandWords=new Set(['alpha','beta','gamma','delta','epsilon','varepsilon','zeta','eta','theta','vartheta','iota','kappa','lambda','mu','nu','xi','pi','varpi','rho','varrho','sigma','varsigma','tau','upsilon','phi','varphi','chi','psi','omega','Gamma','Delta','Theta','Lambda','Xi','Pi','Sigma','Upsilon','Phi','Psi','Omega','partial','nabla','infty','times','div','cdot','pm','mp','leq','geq','neq','approx','simeq','sim','cong','equiv','propto','ll','gg','rightarrow','leftarrow','leftrightarrow','Rightarrow','Leftarrow','Leftrightarrow','mapsto','notin','ni','subset','supset','subseteq','supseteq','cup','cap','setminus','emptyset','varnothing','forall','exists','nexists','neg','land','lor','oplus','otimes','odot','bigoplus','bigotimes','bigcap','bigcup','therefore','because','degree','hbar','ell','Re','Im','perp','parallel','angle','sin','cos','tan','cot','sec','csc','sinh','cosh','tanh','ln','log','exp','lim','mod','det','min','max','arg','gcd','lcm','sqrt','sum','prod','int','iint','iiint','oint']);
const _cCustomBareAliases={eq:'=',ne:'\\neq',le:'\\leq',ge:'\\geq',infinity:'\\infty',empty:'\\emptyset',ohm:'\\Omega',ceil:'\\lceil',floor:'\\lfloor',isin:'\\in',plusminus:'\\pm'};
const _cCustomTextGroupCommands=new Set(['operatorname','operatornamewithlimits','text','mathrm','mathbf','mathit','mathbb','mathcal','mathscr']);
const _cCustomUnicodeSupMap={'⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','⁺':'+','⁻':'-','⁼':'=','⁽':'(','⁾':')','ᵃ':'a','ᵇ':'b','ᶜ':'c','ᵈ':'d','ᵉ':'e','ᶠ':'f','ᵍ':'g','ʰ':'h','ᶦ':'i','ⁱ':'i','ʲ':'j','ᵏ':'k','ˡ':'l','ᵐ':'m','ⁿ':'n','ᵒ':'o','ᵖ':'p','ʳ':'r','ˢ':'s','ᵗ':'t','ᵘ':'u','ᵛ':'v','ʷ':'w','ˣ':'x','ʸ':'y','ᶻ':'z','ᴬ':'A','ᴮ':'B','ᴰ':'D','ᴱ':'E','ᴳ':'G','ᴴ':'H','ᴵ':'I','ᴶ':'J','ᴷ':'K','ᴸ':'L','ᴹ':'M','ᴺ':'N','ᴼ':'O','ᴾ':'P','ᴿ':'R','ᵀ':'T','ᵁ':'U','ⱽ':'V','ᵂ':'W'};
const _cCustomUnicodeSubMap={'₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9','₊':'+','₋':'-','₌':'=','₍':'(','₎':')','ₐ':'a','ₑ':'e','ₕ':'h','ᵢ':'i','ⱼ':'j','ₖ':'k','ₗ':'l','ₘ':'m','ₙ':'n','ₒ':'o','ₚ':'p','ᵣ':'r','ₛ':'s','ₜ':'t','ᵤ':'u','ᵥ':'v','ₓ':'x'};
function _cCustomDecodeScriptRun(run,map){return [...String(run||'')].map(ch=>map[ch]||ch).join('');}
function _cCustomRepairUnicodeScripts(value){const sup=Object.keys(_cCustomUnicodeSupMap).join(''),sub=Object.keys(_cCustomUnicodeSubMap).join(''),base='([A-Za-z0-9)\\]}α-ωΑ-Ωϑϕϱϵ∂∇∞∫∮∑∏ΦΨΩεσρτχ])';let text=_cCustomTextValue(value);text=text.replace(new RegExp(base+'(['+sup+']+)','g'),(_,head,run)=>head+'^{'+_cCustomDecodeScriptRun(run,_cCustomUnicodeSupMap)+'}');text=text.replace(new RegExp(base+'(['+sub+']+)','g'),(_,head,run)=>head+'_{'+_cCustomDecodeScriptRun(run,_cCustomUnicodeSubMap)+'}');return text;}
function _cCustomRepairUnicodeMath(value){const map={'α':'\\alpha ','β':'\\beta ','γ':'\\gamma ','δ':'\\delta ','ε':'\\epsilon ','ϵ':'\\varepsilon ','ζ':'\\zeta ','η':'\\eta ','θ':'\\theta ','ϑ':'\\vartheta ','ι':'\\iota ','κ':'\\kappa ','λ':'\\lambda ','μ':'\\mu ','ν':'\\nu ','ξ':'\\xi ','π':'\\pi ','ρ':'\\rho ','ϱ':'\\varrho ','σ':'\\sigma ','ς':'\\varsigma ','τ':'\\tau ','υ':'\\upsilon ','φ':'\\phi ','ϕ':'\\varphi ','χ':'\\chi ','ψ':'\\psi ','ω':'\\omega ','Γ':'\\Gamma ','Δ':'\\Delta ','Θ':'\\Theta ','Λ':'\\Lambda ','Ξ':'\\Xi ','Π':'\\Pi ','Σ':'\\Sigma ','Υ':'\\Upsilon ','Φ':'\\Phi ','Ψ':'\\Psi ','Ω':'\\Omega ','±':'\\pm ','∓':'\\mp ','×':'\\times ','÷':'\\div ','·':'\\cdot ','≤':'\\leq ','≥':'\\geq ','≠':'\\neq ','≈':'\\approx ','≃':'\\simeq ','∼':'\\sim ','≅':'\\cong ','≡':'\\equiv ','∝':'\\propto ','∞':'\\infty ','∂':'\\partial ','∇':'\\nabla ','∀':'\\forall ','∃':'\\exists ','∄':'\\nexists ','←':'\\leftarrow ','→':'\\rightarrow ','↔':'\\leftrightarrow ','⇒':'\\Rightarrow ','⇐':'\\Leftarrow ','⇔':'\\Leftrightarrow ','↦':'\\mapsto ','∪':'\\cup ','∩':'\\cap ','⊂':'\\subset ','⊃':'\\supset ','⊆':'\\subseteq ','⊇':'\\supseteq ','∈':'\\in ','∉':'\\notin ','∅':'\\varnothing ','∥':'\\parallel ','⊥':'\\perp ','⊕':'\\oplus ','⊗':'\\otimes ','⊙':'\\odot ','∴':'\\therefore ','∵':'\\because ','ℏ':'\\hbar ','∠':'\\angle '};return _cCustomRepairUnicodeScripts(value).replace(/[αβγδεϵζηθϑικλμνξπρϱσςτυφϕχψωΓΔΘΛΞΠΣΥΦΨΩ±∓×÷·≤≥≠≈≃∼≅≡∝∞∂∇∀∃∄←→↔⇒⇐⇔↦∪∩⊂⊃⊆⊇∈∉∅∥⊥⊕⊗⊙∴∵ℏ∠]/g,ch=>map[ch]||ch);}
function _cCustomProtectTextGroups(value,mapper){const text=_cCustomTextValue(value),groups=[],re=/\\([A-Za-z]+)\s*\{/g;let masked='',cursor=0,match;while((match=re.exec(text))){const command=match[1]||'';if(!_cCustomTextGroupCommands.has(command))continue;const braceIndex=re.lastIndex-1,next=_cCustomLatexGroupEnd(text,braceIndex);if(next<=braceIndex)continue;const token='\\uE000QSC'+groups.length+'QSC\\uE001';groups.push(text.slice(match.index,next));masked+=text.slice(cursor,match.index)+token;cursor=next;re.lastIndex=next;}if(!groups.length)return mapper(text);masked+=text.slice(cursor);return String(mapper(masked)).replace(/\\uE000QSC(\d+)QSC\\uE001/g,(_,idx)=>groups[+idx]||'');}
function _cCustomRepairBareWords(value){return _cCustomProtectTextGroups(value,text=>String(text||'').replace(/(^|[^\\A-Za-z])([A-Za-z][A-Za-z0-9]*)(_[A-Za-z0-9]+|\^\{?[^ \t\r\n{}]+\}?)?/g,(match,prefix,word,suffix='')=>{const command=_cCustomBareAliases[word]||(_cCustomBareCommandWords.has(word)?'\\'+word:'');return command?prefix+command+(suffix||''):match;}));}
function _cCustomRepairLatex(value){let text=_cCustomRepairUnicodeMath(value).replace(/\r\n/g,'\n');const prefix=(input,commands,lookahead)=>input.replace(new RegExp('(^|[^\\\\A-Za-z])('+commands.join('|')+')(?='+lookahead+')','g'),(_,lead,command)=>lead+'\\'+command);text=prefix(text,['sqrt'],'\\s*(?:\\[|\\{)');text=prefix(text,['dfrac','tfrac','frac','binom'],'\\s*\\{');text=prefix(text,['begin','end'],'\\s*\\{');text=prefix(text,['left','right'],'\\s*(?:\\\\|[()\\[\\]{}|.])');text=prefix(text,['iiint','iint','oint','int','sum','prod','lim'],'\\s*(?:[_^\\{]|$|[A-Za-z0-9])');text=prefix(text,['operatorname','operatornamewithlimits','mathrm','mathbf','mathit','mathbb','mathcal','mathscr','text'],'\\s*\\{');text=prefix(text,['ln','log','sin','cos','tan','cot','sec','csc','sinh','cosh','tanh','exp','mod','det','min','max'],'\\s*(?:\\{|\\(|[A-Za-z0-9_\\\\])');text=prefix(text,['vec','hat','bar','dot','ddot','tilde','overline','underline','overrightarrow','overleftarrow'],'\\s*(?:\\{|[A-Za-z0-9\\\\])');text=prefix(text,['lfloor','rfloor','lceil','rceil','lvert','rvert','lVert','rVert'],'\\b');return _cCustomRepairBareWords(text).replace(/\\degree\b/g,'^\\circ').replace(/\\ceil\b/g,'\\lceil').replace(/\\floor\b/g,'\\lfloor');}
function _cCustomMathSymbol(word){const extra={varpi:'ϖ',hbar:'ℏ',ell:'ℓ',Re:'ℜ',Im:'ℑ',setminus:'∖',nexists:'∄',bigcup:'⋃',bigcap:'⋂',oplus:'⊕',otimes:'⊗',odot:'⊙',therefore:'∴',because:'∵',angle:'∠',mapsto:'↦',varnothing:'∅'};return _cCustomMathWordMap()[word]||extra[word]||'';}
function _cCustomStandaloneLatex(source){
  const text=_cCustomRepairLatex(source).trim();
  if(!text) return false;
  if(_cCustomHasProseWords(text)) return false;
  if(/^\\(?:frac|dfrac|tfrac|sqrt|begin|left|int|iint|iiint|oint|sum|prod|lim|operatorname|operatornamewithlimits|vec|hat|bar|dot|ddot|tilde|overline|alpha|beta|gamma|delta|theta|lambda|mu|pi|rho|sigma|phi|psi|omega|Gamma|Delta|Theta|Lambda|Pi|Sigma|Phi|Psi|Omega|partial|nabla|cup|cap|subset|supset|exists|forall|hbar|degree|approx|simeq|neq|leq|geq)\b/.test(text)) return true;
  return /[\\^_{}]/.test(text) && !/[A-Za-z]{4,}\s+[A-Za-z]{4,}/.test(text);
}
function _cCustomHasProseWords(source){
  let prose=_cCustomTextValue(source);
  for(let guard=0;guard<8;guard++){
    const next=prose.replace(/\\(?:operatorname|operatornamewithlimits|mathrm|mathbf|mathit|mathbb|mathcal|mathscr|text)\s*\{[^{}]*\}/g,' ');
    if(next===prose)break;
    prose=next;
  }
  prose=prose.replace(/\\(?:[A-Za-z]+|.)/g,' ')
    .replace(/[{}()[\]^_+\-*/=,.;:|<>0-9]/g,' ')
    .replace(/\b(?:dx|dy|dz|dt|du|dv|dw|dr|x|y|z|t|u|v|w|r|f|g|h|e|a|b|c|d|n|m|i|j|k|mod|arg|det|min|max|gcd|lcm|sin|cos|tan|ln|log|lim)\b/gi,' ');
  const words=prose.match(/[A-Za-z]{3,}/g)||[];
  return words.length>=2;
}
function _cCustomLatexGroupEnd(text,start){let i=start;while(/\s/.test(text[i]||''))i++;if(text[i]!=='{')return start;let depth=0;for(;i<text.length;i++){if(text[i]==='{')depth++;else if(text[i]==='}'){depth--;if(depth===0)return i+1;}}return text.length;}
function _cCustomConsumeLatexCommand(text,start){let pos=start+1,word=(text.slice(pos).match(/^[A-Za-z]+/)||[''])[0];pos+=word.length||1;if(/^(?:frac|dfrac|tfrac|binom)$/.test(word)){pos=_cCustomLatexGroupEnd(text,pos);pos=_cCustomLatexGroupEnd(text,pos);}else if(word==='sqrt'){while(/\s/.test(text[pos]||''))pos++;if(text[pos]==='['){const close=text.indexOf(']',pos+1);if(close>=0)pos=close+1;}pos=_cCustomLatexGroupEnd(text,pos);}else if(/^(?:operatorname|operatornamewithlimits|mathrm|mathbf|mathit|mathbb|mathcal|mathscr|text|vec|bar|overline|underline|hat|tilde|dot|ddot|overrightarrow|overleftarrow)$/.test(word)){pos=_cCustomLatexGroupEnd(text,pos);}while(/\s/.test(text[pos]||''))pos++;while(text[pos]==='^'||text[pos]==='_'){pos++;const next=_cCustomLatexGroupEnd(text,pos);pos=next!==pos?next:pos+1;while(/\s/.test(text[pos]||''))pos++;}return pos;}
function _cCustomScriptAtomAt(text,start){return /^[A-Za-z0-9](?:[A-Za-z0-9]*)(?:_\{[^{}\n]+\}|_[A-Za-z0-9+\-=()]|\^\{[^{}\n]+\}|\^[A-Za-z0-9+\-=()])/.test(String(text||'').slice(start));}
function _cCustomMathContinuationAt(text,start){const next=String(text||'').slice(start);return next[0]==='\\'||/^[+\-*/=,)|\]<>]/.test(next)||_cCustomScriptAtomAt(text,start);}
function _cCustomConsumeLatexRun(text,start){let pos=start;for(let guard=0;guard<80&&pos<text.length;guard++){const before=pos,gapStart=pos;while(/[ \t]/.test(text[pos]||''))pos++;if(pos>gapStart&&gapStart>start&&!_cCustomMathContinuationAt(text,pos))return gapStart;if(text[pos]==='\n'||text[pos]==='\r')return before;if(text[pos]==='\\')pos=_cCustomConsumeLatexCommand(text,pos);else if(/[A-Za-z0-9()[\]{}+\-*/=,.|<>]/.test(text[pos]||'')){if(/[A-Za-z]/.test(text[pos]||'')){const word=(text.slice(pos).match(/^[A-Za-z]+/)||[''])[0],named=/^(?:dx|dy|dz|dt|du|dv|dw|dr|ln|log|sin|cos|tan|lim|mod|min|max|arg|det|gcd|lcm)$/.test(word);if(word.length>1&&!named)break;pos+=word.length||1;}else pos++;while(text[pos]==='^'||text[pos]==='_'){pos++;const next=_cCustomLatexGroupEnd(text,pos);pos=next!==pos?next:pos+1;}}else break;if(pos<=before)break;}return pos;}
function _cCustomKatexMixedHtml(source){
  const text=_cCustomRepairLatex(source);
  if(!text.trim()) return '';
  if(_cCustomStandaloneLatex(text)){const whole=_cCustomKatexHtml(text);if(whole)return whole;}
  let out='';
  for(let i=0;i<text.length;){
    if(text[i]==='\\'||_cCustomScriptAtomAt(text,i)){
      const end=_cCustomConsumeLatexRun(text,i),latex=text.slice(i,Math.max(end,i+1)).trim(),html=latex?_cCustomKatexHtml(latex):'';
      if(html){out+=html;i=Math.max(end,i+1);continue;}
    }
    let j=i+1;
    while(j<text.length&&text[j]!=='\\'&&!_cCustomScriptAtomAt(text,j))j++;
    out+=_cCustomEscapeHtml(text.slice(i,j)).replace(/\n/g,'<br>');
    i=j;
  }
  return out;
}
function _cCustomKatexBox(item,text,html=''){
  const size=Math.max(8,Math.min(160,_cCustomNumber(item.fs,16)));
  if(html && document?.body){
    try{
      const probe=document.createElement('span');
      probe.style.cssText='position:absolute;left:-10000px;top:-10000px;visibility:hidden;white-space:nowrap;font-size:'+size+'px;color:#111';
      probe.innerHTML=html;
      document.body.appendChild(probe);
      const rect=probe.getBoundingClientRect();
      probe.remove();
      return {w:Math.max(24,Math.ceil(rect.width)+8),h:Math.max(size+8,Math.ceil(rect.height)+8)};
    }catch(_){ }
  }
  const plain=String(text||'');
  return {w:Math.max(24,Math.ceil(plain.length*size*.72)+12),h:Math.max(size+8,Math.ceil(size*1.45))};
}
function _cCustomKatexSvg(item,x,y,fill,family){
  if(item.type!=='mathText') return '';
  const html=_cCustomKatexMixedHtml(item.text);
  if(!html) return '';
  const size=Math.max(8,Math.min(160,_cCustomNumber(item.fs,16)));
  const box=_cCustomKatexBox(item,_cCustomMathText(item.text),html);
  return `<foreignObject x="${x}" y="${y-box.h+Math.max(2,size*.12)}" width="${box.w}" height="${box.h}" data-qsmath-renderer="katex" data-qsmath-source="${_cSvgAttrEsc(item.text||'')}"><div xmlns="http://www.w3.org/1999/xhtml" style="font-size:${size}px;line-height:1;color:${fill};font-family:${_cSvgAttrEsc(family)};white-space:nowrap">${_cXhtmlForSvgImage(html)}</div></foreignObject>`;
}
function _cCustomTextMetrics(item){
  const size=Math.max(8,Math.min(160,_cCustomNumber(item?.fs,16)));
  const source=_cCustomTextValue(item?.text);
  const display=item?.type==='mathText' ? _cCustomMathText(source) : source;
  const lines=String(display||'').replace(/\r\n?/g,'\n').split('\n');
  const longest=lines.reduce((max,line)=>Math.max(max,line.length),0);
  return {
    text:display,
    lines,
    fs:size,
    w:Math.max(24,Math.ceil(longest*size*.62)+12),
    h:Math.max(size+8,Math.ceil(Math.max(1,lines.length)*size*1.28)+8)
  };
}
function _cCustomScriptGroup(source,start){
  const text=String(source||'');
  let i=start;
  while(/\s/.test(text[i]||'')) i++;
  if(text[i]==='{'){
    let depth=0;
    for(let j=i;j<text.length;j++){
      if(text[j]==='{') depth++;
      else if(text[j]==='}'){
        depth--;
        if(depth===0) return {body:text.slice(i+1,j),next:j+1};
      }
    }
    return {body:text.slice(i+1),next:text.length};
  }
  return {body:text[i]||'',next:Math.min(text.length,i+1)};
}
function _cCustomPortableMathText(source){
  let out=_cCustomRepairLatex(source);
  for(let guard=0;guard<80;guard++){
    const next=out
      .replace(/\\(?:dfrac|tfrac|frac)\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g,'$1⁄$2')
      .replace(/\\sqrt\s*\{([^{}]*)\}/g,'√($1)')
      .replace(/\\(?:vec|bar|overline)\s*\{([^{}]*)\}/g,'$1\u0305')
      .replace(/\\(?:operatorname|operatornamewithlimits)\s*\{([^{}]*)\}/g,'$1')
      .replace(/\\(?:mathrm|mathbf|mathit|mathbb|mathcal|mathscr|text)\s*\{([^{}]*)\}/g,'$1')
      .replace(/\\left\s*/g,'')
      .replace(/\\right\s*/g,'');
    if(next===out) break;
    out=next;
  }
  return out.replace(/\\([A-Za-z]+)(?=[^A-Za-z]|$)/g,(m,word)=>_cCustomMathSymbol(word)||word)
    .replace(/\b(alpha|beta|gamma|delta|epsilon|varepsilon|zeta|eta|theta|vartheta|iota|kappa|lambda|mu|nu|xi|pi|varpi|rho|varrho|sigma|varsigma|tau|upsilon|phi|varphi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Upsilon|Phi|Psi|Omega|partial|nabla|infty|times|div|cdot|pm|mp|leq|geq|neq|approx|simeq|sim|cong|equiv|propto|notin|ni|subset|supset|subseteq|supseteq|cup|cap|setminus|emptyset|varnothing|forall|exists|nexists|oplus|otimes|odot|therefore|because|degree|hbar|ell|Re|Im|perp|parallel|angle|mapsto|ohm)\b/g,m=>_cCustomMathSymbol(m)||m);
}
function _cCustomPortableMathLines(source){
  return _cCustomPortableMathText(source).replace(/\r\n?/g,'\n').split('\n').map(line=>{
    const runs=[];
    let plain='';
    const flush=()=>{ if(plain){ runs.push({text:plain,script:''}); plain=''; } };
    for(let i=0;i<line.length;){
      const ch=line[i];
      if((ch==='^'||ch==='_') && i<line.length-1){
        flush();
        const group=_cCustomScriptGroup(line,i+1);
        runs.push({text:group.body.replace(/[{}]/g,''),script:ch==='^'?'sup':'sub'});
        i=group.next;
        continue;
      }
      if(ch!=='{'&&ch!=='}') plain+=ch;
      i++;
    }
    flush();
    return runs.length?runs:[{text:' ',script:''}];
  });
}
function _cCustomPortableMathSvg(source,x,y,opts={}){
  const size=Math.max(8,Math.min(160,_cCustomNumber(opts.size,16)));
  const fill=_cCustomColor(opts.fill,'#111');
  const family=_cSvgAttrEsc(opts.family||'Georgia, Times New Roman, serif');
  const weight=opts.bold?'700':'400',style=opts.italic?'italic':'normal',decoration=opts.underline?'underline':'none';
  const lines=_cCustomPortableMathLines(source);
  const lineHeight=size*1.25,scriptSize=Math.max(6,Math.round(size*.68));
  const approxH=Math.max(size+8,lines.length*lineHeight+size*.55);
  const top=y-approxH+Math.max(2,size*.12);
  const firstBaseline=top+size;
  return `<text x="${x}" y="${Number(firstBaseline.toFixed(2))}" fill="${fill}" font-size="${size}" font-family="${family}" font-weight="${weight}" font-style="${style}" text-decoration="${decoration}" dominant-baseline="alphabetic">${lines.map((line,lineIndex)=>`<tspan x="${x}" dy="${lineIndex?lineHeight:0}">${line.map(run=>run.script?`<tspan font-size="${scriptSize}" baseline-shift="${run.script==='sup'?'super':'sub'}">${_cSvgEsc(run.text)}</tspan>`:`<tspan>${_cSvgEsc(run.text)}</tspan>`).join('')}</tspan>`).join('')}</text>`;
}
function _cCustomElementTextMarkup(item,ox,oy,selected=false){
  const source=_cCustomTextValue(item?.text);
  if(!source) return '';
  const fill=_cCustomColor(item.fill==='none'?item.stroke:item.fill, selected?'#1f57a4':'#111');
  const family=_cCustomTextValue(item.fontFamily||'Georgia, Times New Roman, serif')||'Georgia, Times New Roman, serif';
  const x=_cCustomNumber(item.x)-ox,y=_cCustomNumber(item.y)-oy,size=Math.max(8,Math.min(160,_cCustomNumber(item.fs,16)));
  if(item.type==='mathText') return _cCustomPortableMathSvg(source,x,y,{size,fill,family,bold:item.bold,italic:item.italic,underline:item.underline});
  const fallbackText=source;
  const fallbackLines=String(fallbackText||'').replace(/\r\n?/g,'\n').split('\n');
  return `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" font-family="${_cSvgAttrEsc(family)}" font-weight="${item.bold?'700':'400'}" font-style="${item.italic?'italic':'normal'}" text-decoration="${item.underline?'underline':'none'}" dominant-baseline="alphabetic">${fallbackLines.map((line,index)=>`<tspan x="${x}" dy="${index?size*1.25:0}">${_cSvgEsc(line)}</tspan>`).join('')}</text>`;
}
function _cCustomMarkerId(id){ return 'qsCustomArrow_'+String(id||'symbol').replace(/[^A-Za-z0-9_]/g,'_'); }
function _cCustomRotation(value){ return Math.max(-360,Math.min(360,_cCustomNumber(value,0))); }
function _cCustomDotted(item){ return ['dottedLine','dottedArrow','dottedArc','dottedCurveArrow'].includes(item?.type)||!!item?.dotted; }
function _cCustomArrow(item){ return ['arrow','curveArrow','dottedArrow','dottedCurveArrow'].includes(item?.type); }
function _cCustomLine(item){ return ['line','arrow','wave','curveArrow','arc','dottedLine','dottedArrow','dottedArc','dottedCurveArrow'].includes(item?.type); }
function _cCustomPolylinePoints(points){ return Array.isArray(points) ? points.slice(0,160).filter(point=>point&&typeof point==='object').map(point=>({x:_cCustomNumber(point.x),y:_cCustomNumber(point.y)})) : []; }
function _cCustomPolylinePointString(points,ox=0,oy=0){ return _cCustomPolylinePoints(points).map(point=>`${point.x-ox},${point.y-oy}`).join(' '); }
function _cCustomFreehandPoints(points){ return Array.isArray(points) ? points.slice(0,480).filter(point=>point&&typeof point==='object').map(point=>({x:_cCustomNumber(point.x),y:_cCustomNumber(point.y)})) : []; }
function _cCustomPointDistance(a,b){ return Math.hypot((a?.x||0)-(b?.x||0),(a?.y||0)-(b?.y||0)); }
function _cCustomPerpendicularDistance(point,lineStart,lineEnd){
  const dx=lineEnd.x-lineStart.x,dy=lineEnd.y-lineStart.y,len2=dx*dx+dy*dy;
  if(!len2) return _cCustomPointDistance(point,lineStart);
  return Math.abs(dy*point.x-dx*point.y+lineEnd.x*lineStart.y-lineEnd.y*lineStart.x)/Math.sqrt(len2);
}
function _cCustomSimplifyRdp(points,tolerance=1.5){
  const safe=_cCustomFreehandPoints(points);
  if(safe.length<3||tolerance<=0) return safe;
  let index=0,maxDist=0;
  for(let i=1;i<safe.length-1;i+=1){
    const dist=_cCustomPerpendicularDistance(safe[i],safe[0],safe[safe.length-1]);
    if(dist>maxDist){ index=i; maxDist=dist; }
  }
  if(maxDist>tolerance){
    const left=_cCustomSimplifyRdp(safe.slice(0,index+1),tolerance);
    const right=_cCustomSimplifyRdp(safe.slice(index),tolerance);
    return left.slice(0,-1).concat(right);
  }
  return [safe[0],safe[safe.length-1]];
}
function _cCustomChaikinSmooth(points,iterations=2,closed=false){
  let pts=_cCustomFreehandPoints(points);
  const count=Math.max(0,Math.min(5,Math.round(_cCustomNumber(iterations,2))));
  for(let pass=0;pass<count;pass+=1){
    if(pts.length<3) break;
    const next=[];
    if(!closed) next.push(pts[0]);
    const limit=closed?pts.length:pts.length-1;
    for(let i=0;i<limit;i+=1){
      const a=pts[i],b=pts[(i+1)%pts.length];
      next.push({x:a.x*.75+b.x*.25,y:a.y*.75+b.y*.25},{x:a.x*.25+b.x*.75,y:a.y*.25+b.y*.75});
    }
    if(!closed) next.push(pts[pts.length-1]);
    pts=next;
  }
  return pts;
}
function _cCustomProcessedFreehandPoints(item){
  const raw=_cCustomFreehandPoints(item?.points);
  if(raw.length<2) return raw;
  const simplified=_cCustomSimplifyRdp(raw,Number.isFinite(+item.simplify)?+item.simplify:1.5);
  return _cCustomChaikinSmooth(simplified,Number.isFinite(+item.smooth)?+item.smooth:2,!!item.closed);
}
function _cCustomCatmullRomPath(points,closed=false){
  const pts=_cCustomFreehandPoints(points);
  if(!pts.length) return '';
  const fmt=value=>Number(value).toFixed(1).replace(/\.0$/,'');
  if(pts.length===1) return `M ${fmt(pts[0].x)} ${fmt(pts[0].y)}`;
  let d=`M ${fmt(pts[0].x)} ${fmt(pts[0].y)}`;
  if(closed&&pts.length>2){
    const n=pts.length;
    for(let i=0;i<n;i+=1){
      const p0=pts[(i-1+n)%n],p1=pts[i],p2=pts[(i+1)%n],p3=pts[(i+2)%n];
      const c1={x:p1.x+(p2.x-p0.x)/6,y:p1.y+(p2.y-p0.y)/6},c2={x:p2.x-(p3.x-p1.x)/6,y:p2.y-(p3.y-p1.y)/6};
      d+=` C ${fmt(c1.x)} ${fmt(c1.y)} ${fmt(c2.x)} ${fmt(c2.y)} ${fmt(p2.x)} ${fmt(p2.y)}`;
    }
    return d+' Z';
  }
  for(let i=0;i<pts.length-1;i+=1){
    const p0=pts[i-1]||pts[i],p1=pts[i],p2=pts[i+1],p3=pts[i+2]||p2;
    const c1={x:p1.x+(p2.x-p0.x)/6,y:p1.y+(p2.y-p0.y)/6},c2={x:p2.x-(p3.x-p1.x)/6,y:p2.y-(p3.y-p1.y)/6};
    d+=` C ${fmt(c1.x)} ${fmt(c1.y)} ${fmt(c2.x)} ${fmt(c2.y)} ${fmt(p2.x)} ${fmt(p2.y)}`;
  }
  return d;
}
function _cCustomFreehandPath(item,ox=0,oy=0){
  const pts=_cCustomProcessedFreehandPoints(item).map(point=>({x:point.x-ox,y:point.y-oy}));
  return _cCustomCatmullRomPath(pts,!!item.closed);
}
function _cCustomFreehandBounds(item){
  const pts=_cCustomProcessedFreehandPoints(item);
  if(!pts.length) return null;
  const xs=pts.map(point=>point.x),ys=pts.map(point=>point.y),pad=Math.max(4,+item.sw||2);
  return {minX:Math.min(...xs)-pad,minY:Math.min(...ys)-pad,maxX:Math.max(...xs)+pad,maxY:Math.max(...ys)+pad};
}
function _cCustomComponentDefaults(value){
  const raw=value&&typeof value==='object'?value:{};
  return {
    reference:_cCustomTextValue(raw.reference||raw.name||'').trim(),
    value:_cCustomTextValue(raw.value||raw.unit||'').trim(),
    legend:_cCustomTextValue(raw.legend||'').trim()
  };
}

function _cCustomSanitizeElement(raw,index){
  if(!raw||typeof raw!=='object') return null;
  const type=String(raw.type||'');
  const common={type,stroke:_cCustomColor(raw.stroke,'#111'),fill:_cCustomColor(raw.fill,'none'),sw:_cCustomStrokeWidth(raw,2),strokeWidth:_cCustomStrokeWidth(raw,2),opacity:Math.max(.05,Math.min(1,_cCustomNumber(raw.opacity,1))),rotation:_cCustomRotation(raw.rotation)};
  if(['rect','ellipse','triangle','triangleDown','diamond'].includes(type)) return {...common,x:_cCustomNumber(raw.x),y:_cCustomNumber(raw.y),w:Math.max(1,Math.min(3000,_cCustomNumber(raw.w,1))),h:Math.max(1,Math.min(3000,_cCustomNumber(raw.h,1))),rx:Math.max(0,Math.min(200,_cCustomNumber(raw.rx,0)))};
  if(type==='cuboid') return {...common,x:_cCustomNumber(raw.x),y:_cCustomNumber(raw.y),w:Math.max(12,Math.min(3000,_cCustomNumber(raw.w,12))),h:Math.max(12,Math.min(3000,_cCustomNumber(raw.h,12))),depth:Math.max(6,Math.min(600,_cCustomNumber(raw.depth,24)))};
  if(type==='embeddedSvg') return {...common,x:_cCustomNumber(raw.x),y:_cCustomNumber(raw.y),w:Math.max(1,Math.min(5000,_cCustomNumber(raw.w,1))),h:Math.max(1,Math.min(5000,_cCustomNumber(raw.h,1))),svg:_cCustomSourceSvgText(raw.svg||raw.sourceSvg||'')};
  if(type==='polyline'){const points=_cCustomPolylinePoints(raw.points);return points.length>=2?{...common,points}:null;}
  if(type==='freehand'){const points=_cCustomFreehandPoints(raw.points);return points.length>=2?{...common,points,closed:!!raw.closed,dotted:!!raw.dotted,smooth:Math.max(0,Math.min(5,_cCustomNumber(raw.smooth,2))),simplify:Math.max(0,Math.min(12,_cCustomNumber(raw.simplify,1.5)))}:null;}
  if(_cCustomLine({type})) return {...common,x1:_cCustomNumber(raw.x1),y1:_cCustomNumber(raw.y1),x2:_cCustomNumber(raw.x2),y2:_cCustomNumber(raw.y2),amp:Math.max(4,Math.min(120,_cCustomNumber(raw.amp,14))),coil:!!raw.coil,turns:Math.max(2,Math.min(24,Math.round(_cCustomNumber(raw.turns,4)))),bend:Math.max(-600,Math.min(600,_cCustomNumber(raw.bend,32)))};
  if(type==='text'||type==='mathText'){const text=_cCustomTextValue(raw.text);return text?{...common,type,x:_cCustomNumber(raw.x),y:_cCustomNumber(raw.y),text,fs:Math.max(4,Math.min(260,_cCustomNumber(raw.fs||raw.fontSize,16))),fontSize:Math.max(4,Math.min(260,_cCustomNumber(raw.fs||raw.fontSize,16))),bold:!!raw.bold,italic:!!raw.italic,underline:!!raw.underline,fontFamily:_cCustomTextValue(raw.fontFamily||'Georgia, Times New Roman, serif')}:null;}
  if(['plus','minus','ground'].includes(type)) return {...common,x:_cCustomNumber(raw.x),y:_cCustomNumber(raw.y),size:Math.max(6,Math.min(240,_cCustomNumber(raw.size,type==='ground'?22:16)))};
  if(type==='port') return {...common,x:_cCustomNumber(raw.x),y:_cCustomNumber(raw.y),name:_cCustomPortName(raw.name,'P'+(index+1)),size:Math.max(4,Math.min(20,_cCustomNumber(raw.size,6)))};
  return null;
}

function _cCustomBounds(elements,fallbackW=120,fallbackH=80){
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  const include=(x,y)=>{minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);};
  let maxStroke=2;
  elements.forEach(item=>{
    maxStroke=Math.max(maxStroke,_cCustomStrokeWidth(item,2));
    if(['rect','ellipse','triangle','triangleDown','diamond','cuboid'].includes(item.type)){include(item.x,item.y);include(item.x+item.w,item.y+item.h);return;}
    if(item.type==='embeddedSvg'){include(item.x,item.y);include(item.x+item.w,item.y+item.h);return;}
    if(item.type==='polyline'){_cCustomPolylinePoints(item.points).forEach(point=>include(point.x,point.y));return;}
    if(item.type==='freehand'){const box=_cCustomFreehandBounds(item);if(box){include(box.minX,box.minY);include(box.maxX,box.maxY);}return;}
    if(_cCustomLine(item)){const pad=['curveArrow','arc','dottedCurveArrow','dottedArc'].includes(item.type)?Math.abs(item.bend||0):item.type==='wave'?Math.abs(item.amp||0):0;include(item.x1-pad,item.y1-pad);include(item.x2+pad,item.y2+pad);return;}
    if(item.type==='text'||item.type==='mathText'){const metrics=_cCustomTextMetrics(item);include(item.x,item.y-metrics.fs);include(item.x+metrics.w,item.y-metrics.fs+metrics.h);return;}
    const size=item.size||12;include(item.x-size,item.y-size);include(item.x+size,item.y+size);
  });
  if(!Number.isFinite(minX)){minX=0;minY=0;maxX=Math.max(20,_cCustomNumber(fallbackW,120));maxY=Math.max(20,_cCustomNumber(fallbackH,80));}
  const pad=Math.max(10,maxStroke*2);
  return {minX:minX-pad,minY:minY-pad,maxX:maxX+pad,maxY:maxY+pad,originX:(minX+maxX)/2,originY:(minY+maxY)/2,w:Math.max(24,Math.min(5000,maxX-minX+pad*2)),h:Math.max(24,Math.min(5000,maxY-minY+pad*2))};
}

function _cCustomSourceSvgText(value){
  const svg=String(value||'').trim().replace(/^<\?xml[\s\S]*?\?>\s*/i,'');
  if(!/^<svg[\s>]/i.test(svg)) return '';
  if(/<script[\s>]/i.test(svg) || /\s+on[a-z]+\s*=/i.test(svg) || /javascript\s*:/i.test(svg)) return '';
  const safe=_cCustomInlineKatexSvg(_cXhtmlForSvgImage(svg));
  const vectorized=_cCustomVectorizeForeignObjects(safe);
  return _cCustomSvgLooksRenderable(vectorized) ? vectorized : safe;
}
function _cCustomSvgLooksRenderable(svg){
  const text=String(svg||'');
  const visibleText=(text.match(/<text\b/gi)||[]).length;
  const vectorShapes=(text.match(/<(?:path|line|polyline|polygon|rect|circle|ellipse)\b/gi)||[]).length;
  const foreignObjects=(text.match(/<foreignObject\b/gi)||[]).length;
  const emptyGroups=(text.match(/<g\b[^>]*>\s*<\/g>/gi)||[]).length;
  return (visibleText + vectorShapes + foreignObjects) >= 3 && emptyGroups < 40;
}
function _cCustomInlineKatexSvg(svg){
  const text=String(svg||'');
  if(!/class=["'][^"']*\bkatex\b/i.test(text) || /data-qs-katex-inline/i.test(text)) return text;
  const css='.katex{font:normal 1.21em KaTeX_Main,Times New Roman,serif;line-height:1.2;text-rendering:auto}.katex-html{display:inline-block}.katex .base{position:relative;display:inline-block;white-space:nowrap}.katex .strut,.katex .mord,.katex .mop,.katex .mbin,.katex .mrel,.katex .mopen,.katex .mclose,.katex .mpunct,.katex .minner,.katex .mspace{display:inline-block}.katex .vlist-t{display:inline-table;table-layout:fixed}.katex .vlist-r{display:table-row}.katex .vlist{display:inline-block;position:relative;height:1em}.katex .vlist>span{display:block;height:0;position:relative}.katex .vlist-s{display:table-cell;vertical-align:bottom;font-size:1px;width:2px;min-width:2px}.katex .sizing.reset-size6.size3,.katex .reset-size6.size3{font-size:.7em}.katex .mfrac .frac-line,.katex .frac-line{display:inline-block;width:100%;border-bottom:0.04em solid currentColor}.katex .sqrt>.root{margin-left:.27777778em;margin-right:-.55555556em}';
  return text.replace(/(<div\b[^>]*xmlns=["']http:\/\/www\.w3\.org\/1999\/xhtml["'][^>]*>)/i,`$1<style data-qs-katex-inline="1">${css}</style>`);
}
function _cCustomAttrNumber(attrs,name,fallback=0){
  const value=(String(attrs||'').match(new RegExp(`\\b${name}\\s*=\\s*["']([0-9.+-]+)`,'i'))||[])[1];
  const n=Number(value);
  return Number.isFinite(n) ? n : fallback;
}
function _cCustomHtmlDecode(value){
  const text=String(value||'');
  if(typeof document==='undefined' || !document.createElement) return text;
  const box=document.createElement('textarea');
  box.innerHTML=text;
  return box.value;
}
function _cCustomReadStyleManifestFromSvg(svg){
  const raw=(String(svg||'').match(/<metadata\b[^>]*(?:id=["']qs-style-manifest["']|data-preserve-styles=["']1["'])[^>]*>([\s\S]*?)<\/metadata>/i)||[])[1];
  if(!raw) return null;
  try{
    const parsed=JSON.parse(_cCustomHtmlDecode(raw));
    return parsed&&typeof parsed==='object'&&parsed.schema==='qs-studio-style-preservation/v1' ? parsed : null;
  }catch(_){
    return null;
  }
}
function _cCustomStyleFromAttrs(attrs){
  return _cCustomHtmlDecode((String(attrs||'').match(/\bstyle\s*=\s*["']([^"']*)["']/i)||[])[1]||'');
}
function _cCustomSourceFromAttrs(attrs){
  return _cCustomHtmlDecode((String(attrs||'').match(/\bdata-qsmath-source\s*=\s*["']([\s\S]*?)["']/i)||[])[1]||'');
}
function _cCustomComputedSvgTextStyle(node){
  const st=window.getComputedStyle ? window.getComputedStyle(node.parentElement||node) : {};
  const size=parseFloat(st.fontSize)||12;
  return {
    fill:_cCustomColor(st.color||'#111','#111'),
    size,
    family:st.fontFamily||'KaTeX_Main, "Times New Roman", serif',
    weight:st.fontWeight||'400',
    style:st.fontStyle||'normal'
  };
}
function _cCustomTextNodeSvgFragments(host,foX,foY){
  const out=[];
  const hostRect=host.getBoundingClientRect();
  const walker=document.createTreeWalker(host,NodeFilter.SHOW_TEXT,{
    acceptNode(node){
      return String(node.nodeValue||'').replace(/\u200b/g,'').trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });
  let node;
  while((node=walker.nextNode())){
    const text=String(node.nodeValue||'').replace(/\u200b/g,'');
    if(!text.trim()) continue;
    const range=document.createRange();
    range.selectNodeContents(node);
    const style=_cCustomComputedSvgTextStyle(node);
    const rects=[...range.getClientRects()];
    range.detach?.();
    rects.forEach(rect=>{
      if(rect.width<=0 || rect.height<=0) return;
      const x=foX + rect.left - hostRect.left;
      const y=foY + rect.top - hostRect.top + rect.height*.78;
      out.push(`<text x="${Number(x.toFixed(2))}" y="${Number(y.toFixed(2))}" fill="${_cSvgAttrEsc(style.fill)}" font-size="${Number(style.size.toFixed(2))}" font-family="${_cSvgAttrEsc(style.family)}" font-weight="${_cSvgAttrEsc(style.weight)}" font-style="${_cSvgAttrEsc(style.style)}">${_cSvgEsc(text)}</text>`);
    });
  }
  return out;
}
function _cCustomRuleSvgFragments(host,foX,foY){
  const out=[];
  const hostRect=host.getBoundingClientRect();
  host.querySelectorAll('.frac-line,.sqrt-line,.overline-line').forEach(el=>{
    const rect=el.getBoundingClientRect();
    if(rect.width<=0) return;
    const st=window.getComputedStyle ? window.getComputedStyle(el) : {};
    const color=_cCustomColor(st.borderTopColor||st.borderBottomColor||st.color||'#111','#111');
    const sw=Math.max(.45,parseFloat(st.borderTopWidth||st.borderBottomWidth)||.75);
    const x1=foX + rect.left - hostRect.left;
    const y=foY + rect.top - hostRect.top + rect.height/2;
    const x2=x1 + rect.width;
    out.push(`<line x1="${Number(x1.toFixed(2))}" y1="${Number(y.toFixed(2))}" x2="${Number(x2.toFixed(2))}" y2="${Number(y.toFixed(2))}" stroke="${_cSvgAttrEsc(color)}" stroke-width="${Number(sw.toFixed(2))}" stroke-linecap="square"/>`);
  });
  return out;
}
function _cCustomVectorizeForeignObject(attrs,inner){
  if(typeof document==='undefined' || !document.body || !document.createElement || !window.getComputedStyle) return '';
  const foX=_cCustomAttrNumber(attrs,'x',0),foY=_cCustomAttrNumber(attrs,'y',0);
  const foW=Math.max(1,_cCustomAttrNumber(attrs,'width',240)),foH=Math.max(1,_cCustomAttrNumber(attrs,'height',80));
  const source=_cCustomSourceFromAttrs(attrs);
  const host=document.createElement('div');
  const baseStyle=_cCustomStyleFromAttrs(inner.match(/<div\b([^>]*)>/i)?.[1]||'');
  host.style.cssText=`position:absolute;left:-20000px;top:-20000px;width:${foW}px;min-height:${foH}px;white-space:nowrap;visibility:hidden;${baseStyle}`;
  const storedHtml=String(inner||'').replace(/^<div\b[^>]*>/i,'').replace(/<\/div>\s*$/i,'');
  host.innerHTML=storedHtml.trim() || (source ? _cCustomKatexMixedHtml(source) : '');
  document.body.appendChild(host);
  try{
    const pieces=[..._cCustomRuleSvgFragments(host,foX,foY),..._cCustomTextNodeSvgFragments(host,foX,foY)];
    return pieces.length ? `<g data-qsmath-vectorized="1" data-qsmath-source="${_cSvgAttrEsc(source)}">${pieces.join('')}</g>` : '';
  }catch(_){
    return '';
  }finally{
    host.remove();
  }
}
function _cCustomVectorizeForeignObjects(svg){
  return String(svg||'').replace(/<foreignObject\b([^>]*)>([\s\S]*?)<\/foreignObject>/gi,(all,attrs,inner)=>{
    const vector=_cCustomVectorizeForeignObject(attrs,inner);
    return vector || all;
  });
}
function _cCustomSourceSvgViewBox(svg,fallbackW=120,fallbackH=80){
  const viewBox=(svg.match(/\bviewBox\s*=\s*["']([^"']+)["']/i)||[])[1];
  if(viewBox){
    const parts=viewBox.trim().split(/[\s,]+/).map(Number);
    if(parts.length===4 && parts.every(Number.isFinite) && parts[2]>0 && parts[3]>0){
      return {x:parts[0],y:parts[1],w:parts[2],h:parts[3]};
    }
  }
  const width=Number((svg.match(/\bwidth\s*=\s*["']([0-9.]+)/i)||[])[1]);
  const height=Number((svg.match(/\bheight\s*=\s*["']([0-9.]+)/i)||[])[1]);
  return {x:0,y:0,w:Math.max(24,width||_cCustomNumber(fallbackW,120)),h:Math.max(24,height||_cCustomNumber(fallbackH,80))};
}
function _cCustomSourceSvgInner(svg){
  const openEnd=svg.indexOf('>');
  const closeStart=svg.toLowerCase().lastIndexOf('</svg>');
  if(openEnd<0 || closeStart<=openEnd) return '';
  return svg.slice(openEnd+1,closeStart).trim();
}
function _cCustomPrepareSourceSvg(value,fallbackW=120,fallbackH=80){
  const svg=_cCustomSourceSvgText(value);
  if(!svg) return null;
  const inner=_cCustomSourceSvgInner(svg);
  if(!inner) return null;
  const viewBox=_cCustomSourceSvgViewBox(svg,fallbackW,fallbackH);
  return {svg,inner,viewBox};
}
function _cCustomSourceDrawBounds(source,elements,fallbackW=120,fallbackH=80){
  const base=_cCustomBounds(elements,fallbackW,fallbackH);
  let minX=Number.isFinite(+base.minX)?+base.minX:base.originX-base.w/2;
  let minY=Number.isFinite(+base.minY)?+base.minY:base.originY-base.h/2;
  let maxX=Number.isFinite(+base.maxX)?+base.maxX:base.originX+base.w/2;
  let maxY=Number.isFinite(+base.maxY)?+base.maxY:base.originY+base.h/2;
  let detectedSvgPaint=false;
  const include=(x,y,w=0,h=0)=>{
    if(![x,y,w,h].every(Number.isFinite)) return;
    detectedSvgPaint=true;
    minX=Math.min(minX,x); minY=Math.min(minY,y);
    maxX=Math.max(maxX,x+Math.max(0,w)); maxY=Math.max(maxY,y+Math.max(0,h));
  };
  const svg=source?.svg||'';
  svg.replace(/<foreignObject\b([^>]*)>/gi,(_,attrs)=>{
    const get=name=>Number((attrs.match(new RegExp(`\\b${name}\\s*=\\s*["']([0-9.+-]+)`,'i'))||[])[1]);
    include(get('x'),get('y'),get('width'),get('height'));
    return _;
  });
  svg.replace(/<text\b([^>]*)>([\s\S]*?)<\/text>/gi,(_,attrs,body)=>{
    const get=name=>Number((attrs.match(new RegExp(`\\b${name}\\s*=\\s*["']([0-9.+-]+)`,'i'))||[])[1]);
    const x=get('x'),y=get('y'),fs=get('font-size')||12;
    const plain=_cCustomHtmlDecode(String(body||'').replace(/<[^>]+>/g,''));
    include(x,y-fs,Math.max(8,plain.length*fs*.58),fs*1.25);
    return _;
  });
  svg.replace(/<line\b([^>]*)\/?>/gi,(_,attrs)=>{
    const get=name=>Number((attrs.match(new RegExp(`\\b${name}\\s*=\\s*["']([0-9.+-]+)`,'i'))||[])[1]);
    const x1=get('x1'),y1=get('y1'),x2=get('x2'),y2=get('y2');
    const sw=Math.max(0,_cCustomAttrNumber(attrs,'stroke-width',0));
    include(Math.min(x1,x2)-sw,Math.min(y1,y2)-sw,Math.abs(x2-x1)+sw*2,Math.abs(y2-y1)+sw*2);
    return _;
  });
  if(!detectedSvgPaint && source?.viewBox){
    const viewBox=source.viewBox;
    include(viewBox.x,viewBox.y,viewBox.w,viewBox.h);
  }
  const pad=6;
  minX-=pad; minY-=pad; maxX+=pad; maxY+=pad;
  return {minX,minY,maxX,maxY,originX:(minX+maxX)/2,originY:(minY+maxY)/2,w:Math.max(24,Math.min(5000,maxX-minX)),h:Math.max(24,Math.min(5000,maxY-minY))};
}
function _cCustomScopedSourceSvgInner(markup,scope){
  const safeScope=String(scope||'src').replace(/[^A-Za-z0-9_]/g,'_');
  const ids=[];
  let out=String(markup||'').replace(/\bid\s*=\s*["']([^"']+)["']/g,(all,id)=>{
    if(!ids.includes(id)) ids.push(id);
    return all.replace(id,`${safeScope}_${id}`);
  });
  ids.forEach(id=>{
    const scoped=`${safeScope}_${id}`;
    const escId=id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    out=out
      .replace(new RegExp(`url\\(#${escId}\\)`,'g'),`url(#${scoped})`)
      .replace(new RegExp(`(["'])#${escId}\\1`,'g'),`"${
        '#'+scoped
      }"`);
  });
  return out;
}

function _cCustomSymbolDefinition(payload){
  if(!payload||payload.kind!=='qs-studio-circuit-symbol'||!Array.isArray(payload.elements)) return null;
  const elements=payload.elements.map(_cCustomSanitizeElement).filter(Boolean);
  if(!elements.length) return null;
  const preparedSource=_cCustomPrepareSourceSvg(payload.svg||payload.sourceSvg,payload.width,payload.height);
  const source=preparedSource;
  const styleManifest=payload.styleManifest||_cCustomReadStyleManifestFromSvg(source?.svg||payload.svg||payload.sourceSvg||'')||null;
  const rawId=String(payload.id||payload.label||'custom_symbol').toLowerCase().replace(/[^a-z0-9_]+/g,'_').replace(/^_|_$/g,'').slice(0,80)||'custom_symbol';
  const id=rawId.startsWith('custom_') ? rawId : `custom_${rawId}`;
  const libraryKey=String(payload.libraryKey||rawId).toLowerCase().replace(/[^a-z0-9_]+/g,'_').replace(/^_|_$/g,'').slice(0,80)||rawId;
  const rawBounds=source ? _cCustomSourceDrawBounds(source,elements,payload.width,payload.height) : _cCustomBounds(elements,payload.width,payload.height);
  const bounds=source ? {
    ...rawBounds,
    originX:Number.isFinite(+rawBounds.minX) ? +rawBounds.minX : rawBounds.originX-rawBounds.w/2,
    originY:Number.isFinite(+rawBounds.minY) ? +rawBounds.minY : rawBounds.originY-rawBounds.h/2
  } : rawBounds;
  const ports=elements.filter(item=>item.type==='port').map((item,index)=>({id:_cCustomPortName(item.name,'P'+(index+1)),x:item.x-bounds.originX,y:item.y-bounds.originY}));
  const editableTexts=source ? [] : elements.filter(item=>item.type==='text'||item.type==='mathText').map(item=>({type:item.type,text:item.text,x:item.x-bounds.originX,y:item.y-bounds.originY,fill:item.fill==='none'?item.stroke:item.fill,fs:item.fs,bold:!!item.bold,italic:!!item.italic,underline:!!item.underline,fontFamily:item.fontFamily||'Georgia, Times New Roman, serif',rotation:_cCustomRotation(item.rotation)}));
  return {version:1,kind:'qs-studio-circuit-symbol',id,libraryKey,label:_cCustomTextValue(payload.label||'Custom Symbol')||'Custom Symbol',group:'Custom',w:bounds.w,h:bounds.h,originX:bounds.originX,originY:bounds.originY,anchorMode:source?'top-left':'center',ports,elements,editableTexts,svg:source?.svg||'',sourceSvgInner:source?.inner||'',sourceViewBox:source?.viewBox||null,styleManifest,componentDefaults:_cCustomComponentDefaults(payload.componentDefaults)};
}

function _cCustomWavePath(item,ox,oy){
  const x1=item.x1-ox,y1=item.y1-oy,x2=item.x2-ox,y2=item.y2-oy,dx=x2-x1,dy=y2-y1,len=Math.max(1,Math.hypot(dx,dy)),px=-dy/len,py=dx/len,steps=Math.max(18,Math.round(len/5)),amp=item.amp||14,turns=item.coil?Math.max(2,Math.min(24,Math.round(item.turns||4))):4;
  let d='';for(let i=0;i<=steps;i+=1){const t=i/steps,across=Math.sin(t*Math.PI*turns)*amp;d+=(i?' L':'M')+(x1+dx*t+px*across).toFixed(1)+' '+(y1+dy*t+py*across).toFixed(1);}return d;
}
function _cCustomCurveArrowPath(item,ox,oy){const x1=item.x1-ox,y1=item.y1-oy,x2=item.x2-ox,y2=item.y2-oy,dx=x2-x1,dy=y2-y1,len=Math.max(1,Math.hypot(dx,dy)),bend=item.bend||32,cx=(x1+x2)/2-(dy/len)*bend,cy=(y1+y2)/2+(dx/len)*bend;return `M ${x1} ${y1} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${x2} ${y2}`;}
function _cCustomArcPath(item,ox,oy){return _cCustomCurveArrowPath(item,ox,oy);}
function _cCustomRotationTransform(item,ox,oy){
  const angle=_cCustomRotation(item.rotation);
  if(!angle) return '';
  let x=0,y=0;
  if(['rect','ellipse','triangle','triangleDown','diamond','cuboid'].includes(item.type)){x=item.x-ox+item.w/2;y=item.y-oy+item.h/2;}
  else if(item.type==='polyline'){const points=_cCustomPolylinePoints(item.points);x=(Math.min(...points.map(point=>point.x))+Math.max(...points.map(point=>point.x)))/2-ox;y=(Math.min(...points.map(point=>point.y))+Math.max(...points.map(point=>point.y)))/2-oy;}
  else if(item.type==='freehand'){const box=_cCustomFreehandBounds(item);if(box){x=(box.minX+box.maxX)/2-ox;y=(box.minY+box.maxY)/2-oy;}}
  else if(_cCustomLine(item)){x=(item.x1+item.x2)/2-ox;y=(item.y1+item.y2)/2-oy;}
  else{x=(item.x||0)-ox;y=(item.y||0)-oy;}
  return ` transform="rotate(${angle} ${x} ${y})"`;
}
function _cCustomCuboidFaces(item,ox,oy){const x=item.x-ox,y=item.y-oy,w=Math.max(12,item.w),h=Math.max(12,item.h),d=Math.max(6,Math.min(item.depth||Math.min(w,h)*.22,Math.min(w,h)*.45));return{front:`${x},${y+d} ${x+w-d},${y+d} ${x+w-d},${y+h} ${x},${y+h}`,top:`${x},${y+d} ${x+d},${y} ${x+w},${y} ${x+w-d},${y+d}`,side:`${x+w-d},${y+d} ${x+w},${y} ${x+w},${y+h-d} ${x+w-d},${y+h}`};}

function _cCustomSymbolMarkup(def,selected,markerScope=''){
  if(def.sourceSvgInner){
    const ox=def.originX||0,oy=def.originY||0;
    const scope=`raw_${markerScope||def.id||'custom'}`;
    return `<g transform="translate(${-ox},${-oy})">${_cCustomScopedSourceSvgInner(def.sourceSvgInner,scope)}</g>`;
  }
  // Each placed copy owns its arrow marker. Reusing one SVG id makes arrows vanish
  // when the complete circuit is assembled into a single exported SVG.
  const ox=def.originX||0,oy=def.originY||0,color=selected?'#1f57a4':null,markerId=_cCustomMarkerId(markerScope?`${def.id}_${markerScope}`:def.id),stroke=item=>color||_cCustomColor(item.stroke,'#111');
  const includeInlineText=String(markerScope||'').startsWith('palette_');
  const body=def.elements.map(item=>{
    if((item.type==='text'||item.type==='mathText') && !includeInlineText) return '';
    const fill=_cCustomColor(item.fill,'none'),s=stroke(item),opacity=Math.max(.05,Math.min(1,_cCustomNumber(item.opacity,1)));
    let markup='';
    if(item.type==='rect') markup=`<rect x="${item.x-ox}" y="${item.y-oy}" width="${item.w}" height="${item.h}" rx="${item.rx||0}" fill="${fill}" stroke="${s}" stroke-width="${item.sw}"/>`;
    else if(item.type==='ellipse') markup=`<ellipse cx="${item.x-ox+item.w/2}" cy="${item.y-oy+item.h/2}" rx="${item.w/2}" ry="${item.h/2}" fill="${fill}" stroke="${s}" stroke-width="${item.sw}"/>`;
    else if(item.type==='triangle') markup=`<polygon points="${item.x-ox+item.w/2},${item.y-oy} ${item.x-ox+item.w},${item.y-oy+item.h} ${item.x-ox},${item.y-oy+item.h}" fill="${fill}" stroke="${s}" stroke-width="${item.sw}" stroke-linejoin="round"/>`;
    else if(item.type==='triangleDown') markup=`<polygon points="${item.x-ox},${item.y-oy} ${item.x-ox+item.w},${item.y-oy} ${item.x-ox+item.w/2},${item.y-oy+item.h}" fill="${fill}" stroke="${s}" stroke-width="${item.sw}" stroke-linejoin="round"/>`;
    else if(item.type==='diamond') markup=`<polygon points="${item.x-ox+item.w/2},${item.y-oy} ${item.x-ox+item.w},${item.y-oy+item.h/2} ${item.x-ox+item.w/2},${item.y-oy+item.h} ${item.x-ox},${item.y-oy+item.h/2}" fill="${fill}" stroke="${s}" stroke-width="${item.sw}" stroke-linejoin="round"/>`;
    else if(item.type==='cuboid'){const faces=_cCustomCuboidFaces(item,ox,oy);markup=`<polygon points="${faces.front}" fill="${fill}" stroke="${s}" stroke-width="${item.sw}" stroke-linejoin="round"/><polygon points="${faces.top}" fill="${fill}" fill-opacity=".86" stroke="${s}" stroke-width="${item.sw}" stroke-linejoin="round"/><polygon points="${faces.side}" fill="${fill}" fill-opacity=".72" stroke="${s}" stroke-width="${item.sw}" stroke-linejoin="round"/>`;}
    else if(item.type==='embeddedSvg'&&item.svg){const src=_cCustomPrepareSourceSvg(item.svg,item.w,item.h);if(src){const vb=src.viewBox||{x:0,y:0,w:item.w||1,h:item.h||1},sx=(item.w||vb.w)/Math.max(1,vb.w),sy=(item.h||vb.h)/Math.max(1,vb.h);markup=`<g transform="translate(${item.x-ox} ${item.y-oy}) scale(${sx} ${sy}) translate(${-vb.x} ${-vb.y})">${_cCustomScopedSourceSvgInner(src.inner,`${markerId}_embedded_${item.id||''}`)}</g>`;}}
    else if(['line','arrow','dottedLine','dottedArrow'].includes(item.type)) markup=`<line x1="${item.x1-ox}" y1="${item.y1-oy}" x2="${item.x2-ox}" y2="${item.y2-oy}" stroke="${s}" stroke-width="${item.sw}" stroke-linecap="round"${_cCustomDotted(item)?' stroke-dasharray="1 7"':''}${_cCustomArrow(item)?` marker-end="url(#${markerId})"`:''}/>`;
    else if(item.type==='polyline') markup=`<polyline points="${_cCustomPolylinePointString(item.points,ox,oy)}" fill="none" stroke="${s}" stroke-width="${item.sw}" stroke-linecap="square" stroke-linejoin="miter"/>`;
    else if(item.type==='freehand') markup=`<path d="${_cCustomFreehandPath(item,ox,oy)}" fill="${item.closed?fill:'none'}" stroke="${s}" stroke-width="${item.sw}" stroke-linecap="round" stroke-linejoin="round"${_cCustomDotted(item)?' stroke-dasharray="1 7"':''}/>`;
    else if(item.type==='arc'||item.type==='dottedArc') markup=`<path d="${_cCustomArcPath(item,ox,oy)}" fill="none" stroke="${s}" stroke-width="${item.sw}" stroke-linecap="round" stroke-linejoin="round"${_cCustomDotted(item)?' stroke-dasharray="1 7"':''}/>`;
    else if(item.type==='curveArrow'||item.type==='dottedCurveArrow') markup=`<path d="${_cCustomCurveArrowPath(item,ox,oy)}" fill="none" stroke="${s}" stroke-width="${item.sw}" stroke-linecap="round" stroke-linejoin="round"${_cCustomDotted(item)?' stroke-dasharray="1 7"':''} marker-end="url(#${markerId})"/>`;
    else if(item.type==='wave') markup=`<path d="${_cCustomWavePath(item,ox,oy)}" fill="none" stroke="${s}" stroke-width="${item.sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
    else if(item.type==='plus'||item.type==='minus'){const size=item.size||16,x=item.x-ox,y=item.y-oy,d=item.type==='plus'?`M ${x-size} ${y} H ${x+size} M ${x} ${y-size} V ${y+size}`:`M ${x-size} ${y} H ${x+size}`;markup=`<path d="${d}" fill="none" stroke="${s}" stroke-width="${item.sw}" stroke-linecap="round"/>`;}
    else if(item.type==='ground'){const size=item.size||22,x=item.x-ox,y=item.y-oy;markup=`<path d="M ${x} ${y-size} V ${y-size/3} M ${x-size} ${y-size/3} H ${x+size} M ${x-size*.65} ${y+size*.05} H ${x+size*.65} M ${x-size*.3} ${y+size*.4} H ${x+size*.3}" fill="none" stroke="${s}" stroke-width="${item.sw}" stroke-linecap="round"/>`;}
    else if(item.type==='port') markup=`<circle cx="${item.x-ox}" cy="${item.y-oy}" r="${item.size||5}" fill="#fff" stroke="${s}" stroke-width="${item.sw}"/>`;
    else if(item.type==='text'||item.type==='mathText') markup=_cCustomElementTextMarkup(item,ox,oy,!!color);
    return markup?`<g opacity="${opacity}"${_cCustomRotationTransform(item,ox,oy)}>${markup}</g>`:'';
  }).join('');
  const defs=def.elements.some(item=>_cCustomArrow(item))?`<defs><marker id="${markerId}" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="4" markerHeight="4" markerUnits="strokeWidth" orient="auto"><path d="M0 0L12 6L0 12Z" fill="${color||'#111'}"/></marker></defs>`:'';
  return `<g>${defs}${body}</g>`;
}

function _cCustomSymbolFromDefinition(def){ return {...def,customDefinition:def,svgFn:(selected,markerScope='')=>_cCustomSymbolMarkup(def,selected,markerScope)}; }
function _cPersistCustomSymbols(){ try{const items=CIRC_SYMBOLS.filter(sym=>sym.group==='Custom'&&sym.customDefinition).map(sym=>sym.customDefinition);localStorage.setItem(CIRC_CUSTOM_SYMBOLS_STORAGE,JSON.stringify(items));}catch(_){ } }
function _cRegisterCustomSymbol(payload,persist=true){const def=_cCustomSymbolDefinition(payload);if(!def)return null;const sym=_cCustomSymbolFromDefinition(def),index=CIRC_SYMBOLS.findIndex(entry=>entry.id===sym.id||(entry.group==='Custom'&&entry.customDefinition?.libraryKey===sym.libraryKey));if(index>=0)CIRC_SYMBOLS.splice(index,1,sym);else CIRC_SYMBOLS.push(sym);if(persist)_cPersistCustomSymbols();return sym;}
function _cRegisterCustomSymbolBundle(payload,persist=true){
  const items=Array.isArray(payload?.symbols)?payload.symbols:(Array.isArray(payload)?payload:[payload]);
  const registered=[];
  items.forEach(item=>{const sym=_cRegisterCustomSymbol(item,persist);if(sym)registered.push(sym);});
  return registered;
}
function _cEnsureCustomTab(){
  const tabs=document.getElementById('cEdGrpTabs');
  if(!tabs||[...tabs.querySelectorAll('button')].some(button=>button.textContent.trim()==='Custom'))return;
  const tab=document.createElement('button');
  tab.className='tool-btn';
  tab.type='button';
  tab.textContent='Custom';
  tab.onclick=()=>cEdSetGroup('Custom');
  tabs.appendChild(tab);
}
function _cLoadCustomSymbols(){try{const items=JSON.parse(localStorage.getItem(CIRC_CUSTOM_SYMBOLS_STORAGE)||'[]');return _cRegisterCustomSymbolBundle(items,false).length;}catch(_){return 0;}}
function _cRefreshSharedCustomSymbols(){
  const count=_cLoadCustomSymbols();
  if(count)_cEnsureCustomTab();
  const active=[...(document.querySelectorAll?.('#cEdGrpTabs .tool-btn')||[])].some(button=>button.textContent.trim()==='Custom'&&button.classList.contains('active'));
  if(count&&active)cEdSetGroup('Custom');
  return count;
}
_cLoadCustomSymbols();
window.addEventListener?.('storage',event=>{if(event?.key===CIRC_CUSTOM_SYMBOLS_STORAGE)_cRefreshSharedCustomSymbols();});
window.addEventListener?.('focus',()=>_cRefreshSharedCustomSymbols());
window.addEventListener?.('qsStudioCustomSymbolsUpdated',()=>_cRefreshSharedCustomSymbols());
try{
  const _cSharedCustomSymbolChannel=typeof BroadcastChannel==='function' ? new BroadcastChannel('qsStudioCustomCircuitSymbols') : null;
  _cSharedCustomSymbolChannel?.addEventListener?.('message',event=>{
    if(event?.data?.type==='updated')_cRefreshSharedCustomSymbols();
  });
}catch(_){ }

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  STATE  (all prefixed _c_ to avoid any global collision)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let _cTargetKey   = null;
let _cComps       = [];    // {uid, id, sym, x, y, rot, name, nameHtml, nameAlign, legend, legendHtml, legendAlign, nameBox, legendBox}
let _cWires       = [];    // {uid, x1, y1, x2, y2}
let _cTexts       = [];    // {uid, x, y, w, h, text, html, align}
let _cTextEditApply = null;
let _cSelUid      = null;
let _cSelBox      = null;
let _cTool        = 'select'; // 'select' | 'wire' | 'text'
let _cWireStart   = null;     // {x,y} mid-draw anchor
let _cHoverPort   = null;
let _cHoverAnchor = null;
let _cMousePt     = {x:0,y:0};
let _cUID         = 0;
let _cDrawRaf     = 0;
let _cEditingFigureIndex = -1;
const _cW = 1040, _cH = 620;
function _cMkUid(){ return 'e'+(++_cUID)+'_'+Date.now(); }
function _cSnapWithStep(v,step){ const g=Math.max(1,+step||CIRC_GRID_SMALL); return Math.round(v/g)*g; }
function _cSnap(v){ return _cSnapWithStep(v,_cGridStep); }
function _cSnapPt(x,y){ return {x:_cSnap(x),y:_cSnap(y)}; }
function _cGridPatternMarkup(){
  const g=Math.max(1,+_cGridStep||CIRC_GRID_SMALL);
  return `<pattern id="cEdGrid" width="${g}" height="${g}" patternUnits="userSpaceOnUse">
    <path d="M${g} 0 L0 0 0 ${g}" fill="none" stroke="#dde8f6" stroke-width="0.5"/>
  </pattern>`;
}
function _cRefreshGridUi(){
  const defs=document.querySelector('#cEdSvg defs');
  if(defs) defs.innerHTML=_cGridPatternMarkup();
  document.querySelectorAll('[data-cgridstep]').forEach(btn=>{
    const on=Number(btn.getAttribute('data-cgridstep'))===Number(_cGridStep);
    btn.classList.toggle('active', on);
  });
}
function cEdSetGrid(step){
  const oldStep=_cGridStep;
  const oldPortKeys=[];
  _cComps.forEach(comp=>{
    (comp.sym.ports||[]).forEach(p=>{
      const oldPos=_cPortWorldAt(comp,p,comp.x,comp.y,comp.rot||0,_cCompScale(comp),oldStep);
      oldPortKeys.push({key:_cPortKey(oldPos.x,oldPos.y), comp, port:p});
    });
  });
  _cGridStep=Math.max(1, Number(step)||CIRC_GRID_SMALL);
  const byKey={};
  oldPortKeys.forEach(item=>{
    const next=_cPortWorldAt(item.comp,item.port);
    byKey[item.key]={x:next.x,y:next.y};
  });
  _cWires.forEach(w=>{
    const k1=_cPortKey(w.x1,w.y1), k2=_cPortKey(w.x2,w.y2);
    if(byKey[k1]){ w.x1=byKey[k1].x; w.y1=byKey[k1].y; }
    if(byKey[k2]){ w.x2=byKey[k2].x; w.y2=byKey[k2].y; }
  });
  _cRefreshGridUi();
  _cDraw();
  const st=document.getElementById('cEdStatus');
  if(st) st.textContent=`Grid ${_cGridStep}px active.`;
}
function _cApplyViewportUi(){
  const svg=document.getElementById('cEdSvg');
  const root=document.getElementById('cEdRoot');
  const card=document.querySelector('.modal-card');
  const zoomLbl=document.getElementById('cEdZoomLbl');
  if(svg){
    svg.style.width=`${Math.round(_cW*_cViewZoom)}px`;
    svg.style.height=`${Math.round(_cH*_cViewZoom)}px`;
  }
  if(root) root.style.height=_cExpanded ? '92vh' : '80vh';
  if(card){
    card.style.width=_cExpanded ? 'min(1480px,99.4vw)' : 'min(1240px,98.8vw)';
    card.style.maxHeight=_cExpanded ? '99vh' : '96vh';
  }
  if(zoomLbl) zoomLbl.textContent=`${Math.round(_cViewZoom*100)}%`;
}
function cEdSetZoom(z){
  _cViewZoom=Math.max(0.5, Math.min(3, Number(z)||1));
  _cApplyViewportUi();
}
function cEdZoom(delta){
  cEdSetZoom(Number((_cViewZoom + delta).toFixed(2)));
}
function cEdToggleExpand(){
  _cExpanded=!_cExpanded;
  _cApplyViewportUi();
}
function _cSvgEsc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function _cSvgAttrEsc(s){ return _cSvgEsc(s).replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function _cXhtmlForSvgImage(html){
  return String(html||'')
    .replace(/<br\s*>/gi,'<br/>')
    .replace(/&nbsp;/gi,'&#160;');
}

function _cRequestDraw(){
  if(_cDrawRaf) return;
  _cDrawRaf=requestAnimationFrame(()=>{
    _cDrawRaf=0;
    _cDraw();
  });
}


function _cLabelAlignToAnchor(align){
  return align==='center' ? 'middle' : (align==='right' ? 'end' : 'start');
}

function _cPlainFromHtml(html=''){
  const tmp=document.createElement('div');
  tmp.innerHTML=String(html||'');
  return String(tmp.textContent || tmp.innerText || '').replace(/Â /g,' ').trim();
}

function _cExtractRichLines(html=''){
  const host=document.createElement('div');
  host.innerHTML=String(html||'').trim() || '';
  const lines=[[]];
  const pushText=(txt, style)=>{
    String(txt||'').split(/\n/).forEach((part, idx, arr)=>{
      if(part) lines[lines.length-1].push({ text:part, style:{...style} });
      if(idx < arr.length-1) lines.push([]);
    });
  };
  const walk=(node, style)=>{
    if(node.nodeType===Node.TEXT_NODE){ pushText(node.textContent || '', style); return; }
    if(node.nodeType!==Node.ELEMENT_NODE) return;
    if(node.tagName==='BR'){ lines.push([]); return; }
    const next={...style};
    if(/^(B|STRONG)$/i.test(node.tagName)) next.bold=true;
    if(/^(I|EM)$/i.test(node.tagName)) next.italic=true;
    if(/^U$/i.test(node.tagName)) next.underline=true;
    if(/^SUB$/i.test(node.tagName)) next.sub=true;
    if(/^SUP$/i.test(node.tagName)) next.sup=true;
    [...node.childNodes].forEach(child=>walk(child,next));
    if(/^(DIV|P)$/i.test(node.tagName)) lines.push([]);
  };
  [...host.childNodes].forEach(node=>walk(node,{bold:false,italic:false,underline:false,sub:false,sup:false}));
  while(lines.length && !lines[lines.length-1].length) lines.pop();
  return lines.length ? lines : [[{text:_cPlainFromHtml(html), style:{bold:false,italic:false,underline:false,sub:false,sup:false}}]];
}

function _cRichTextSvg(html, x, y, opts={}){
  const lines=_cExtractRichLines(html);
  if(!lines.length) return '';
  const fontSize=opts.fontSize || 13;
  const lineHeight=opts.lineHeight || Math.round(fontSize*1.25);
  const fill=opts.fill || '#222';
  const anchor=_cLabelAlignToAnchor(opts.align || 'left');
  const family=opts.family || 'Arial,Helvetica,sans-serif';
  const esc=s=>_cSvgEsc(String(s||''));
  let out=`<text x="${x}" y="${y}" fill="${fill}" font-family="${family}" text-anchor="${anchor}" dominant-baseline="hanging">`;
  lines.forEach((line, idx)=>{
    const dy = idx===0 ? 0 : lineHeight;
    out += `<tspan x="${x}" dy="${dy}">`;
    line.forEach(run=>{
      const style=run.style || {};
      const subSup = style.sub || style.sup;
      const runSize=subSup ? Math.max(9, Math.round(fontSize*0.72)) : fontSize;
      const attrs=[
        `font-size="${runSize}"`,
        `font-weight="${style.bold ? 700 : 400}"`,
        `font-style="${style.italic ? 'italic' : 'normal'}"`,
        `text-decoration="${style.underline ? 'underline' : 'none'}"`
      ];
      if(style.sub) attrs.push('baseline-shift="sub"');
      if(style.sup) attrs.push('baseline-shift="super"');
      out += `<tspan ${attrs.join(' ')}>${esc(run.text)}</tspan>`;
    });
    out += `</tspan>`;
  });
  out += `</text>`;
  return out;
}

function _cCompTextY(comp, kind){
  // Labels live inside the component's transformed SVG group, so use local
  // dimensions here. The group scale then enlarges symbol and labels together.
  const halfH=(comp.sym?.h || 80)/2;
  return kind==='legend' ? (halfH + 12) : (-halfH - 26);
}
function _cEnsureCompTextBoxes(comp){
  const baseW=Math.max(84, (comp.sym?.w || 80) + 18);
  const mk=(kind)=>({ x:-baseW/2, y:_cCompTextY(comp, kind), w:baseW, h:20 });
  if(!comp.nameBox) comp.nameBox = mk('name');
  if(!comp.legendBox) comp.legendBox = mk('legend');
}
function _cCompTextMeta(comp, kind){
  _cEnsureCompTextBoxes(comp);
  const isLegend = kind==='legend';
  const text = isLegend ? (comp.legend || '') : (comp.name || '');
  const html = isLegend ? (comp.legendHtml || '') : (comp.nameHtml || '');
  const align = isLegend ? (comp.legendAlign || 'left') : (comp.nameAlign || 'left');
  const box = isLegend ? comp.legendBox : comp.nameBox;
  return {
    kind,
    text,
    html,
    align,
    box,
    placeholder: isLegend ? 'Legend' : 'Text'
  };
}
function _cCompTextBoxSvg(comp, kind, selected=false){
  if(kind==='name' && !_cCompHasNameBox(comp)) return '';
  const meta=_cCompTextMeta(comp, kind);
  const w=Math.max(70, meta.box.w || 84);
  const h=Math.max(20, meta.box.h || 20);
  const x=meta.box.x;
  const y=meta.box.y;
  const hasContent=!!(meta.text || _cPlainFromHtml(meta.html));
  const stroke=selected ? '#1f57a4' : 'transparent';
  const fill=selected ? 'rgba(31,87,164,0.07)' : 'transparent';
  const textFill=selected ? '#1f57a4' : '#444';
  const clipId=`cboxclip_${comp.uid}_${kind}`;
  const content = hasContent
    ? `<g clip-path="url(#${clipId})">${_cRichTextSvg(meta.html || _cSvgEsc(meta.text), x+8, y+4, { fontSize:11, fill:textFill, family:'Times New Roman,serif', align:meta.align || 'left' })}</g>`
    : '';
  return `<g data-ccompbox="${comp.uid}:${kind}" style="cursor:${selected?'move':'text'};pointer-events:all">
    <defs><clipPath id="${clipId}"><rect x="${x+3}" y="${y+2}" width="${Math.max(1,w-6)}" height="${Math.max(1,h-4)}" rx="4"/></clipPath></defs>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="transparent" stroke="transparent" stroke-width="10" opacity="0.001"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="${fill}" stroke="${stroke}" stroke-width="1.1" stroke-dasharray="${selected ? '4 3' : 'none'}"/>
    ${content}
    ${selected ? `<rect data-cboxhandle="${comp.uid}:${kind}" x="${x+w-9}" y="${y+h-9}" width="9" height="9" rx="2" fill="#1f57a4" stroke="none" style="cursor:nwse-resize"/>` : ''}
  </g>`;
}
function _cCompTextExportSvg(comp, kind){
  if(kind==='name' && !_cCompHasNameBox(comp)) return '';
  const meta=_cCompTextMeta(comp, kind);
  const plain=_cPlainFromHtml(meta.html) || meta.text || '';
  if(!plain.trim()) return '';
  const w=Math.max(70, meta.box.w || 84);
  const h=Math.max(20, meta.box.h || 20);
  const x=meta.box.x;
  const y=meta.box.y;
  const clipId=`cboxexp_${comp.uid}_${kind}`;
  return `<defs><clipPath id="${clipId}"><rect x="${x+3}" y="${y+2}" width="${Math.max(1,w-6)}" height="${Math.max(1,h-4)}" rx="4"/></clipPath></defs><g clip-path="url(#${clipId})">${_cRichTextSvg(meta.html || _cSvgEsc(meta.text), x+8, y+4, { fontSize:11, fill:'#444', family:'Times New Roman,serif', align:meta.align || 'left' })}</g>`;
}

function _cCustomTextSvg(comp){
  if(!Array.isArray(comp.customTexts)||!comp.customTexts.length) return '';
  return comp.customTexts.map((item,index)=>{
    const source=_cCustomTextValue(item.text);
    const metrics=_cCustomTextMetrics(item);
    const text=metrics.text;
    if(!text) return '';
    const fill=_cCustomColor(item.fill,'#111');
    const size=Math.max(8,Math.min(160,_cCustomNumber(item.fs,16)));
    const x=_cCustomNumber(item.x),y=_cCustomNumber(item.y),rotation=_cCustomRotation(item.rotation),family=_cCustomTextValue(item.fontFamily||'Georgia, Times New Roman, serif')||'Georgia, Times New Roman, serif';
    const mathAttrs=item.type==='mathText'?` data-qsmath-type="mathText" data-qsmath-source="${_cSvgAttrEsc(source)}"`:'';
    if(item.type==='mathText'){
      const body=_cCustomPortableMathSvg(source,x,y,{size,fill,family,bold:item.bold,italic:item.italic,underline:item.underline});
      return `<g data-ccustomtext="${comp.uid}:${index}"${mathAttrs}${rotation?` transform="rotate(${rotation} ${x} ${y})`:''} style="cursor:text;pointer-events:all">${body}</g>`;
    }
    const fallback=`<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" font-family="${_cSvgAttrEsc(family)}" font-weight="${item.bold?'700':'400'}" font-style="${item.italic?'italic':'normal'}" text-decoration="${item.underline?'underline':'none'}" dominant-baseline="alphabetic" style="cursor:text;pointer-events:all">${metrics.lines.map((line,lineIndex)=>`<tspan x="${x}" dy="${lineIndex?size*1.25:0}">${_cSvgEsc(line)}</tspan>`).join('')}</text>`;
    return `<g data-ccustomtext="${comp.uid}:${index}"${mathAttrs}${rotation?` transform="rotate(${rotation} ${x} ${y})`:''} style="cursor:text;pointer-events:all">${fallback}</g>`;
  }).join('');
}

function _cNormFreeTextBox(t){
  if(!t) return t;
  if(!Number.isFinite(t.w)) t.w = Math.max(120, (((_cPlainFromHtml(t.html) || t.text || '').length || 4) * 7) + 26);
  if(!Number.isFinite(t.h)) t.h = 24;
  if(!Number.isFinite(t.x)) t.x = 0;
  if(!Number.isFinite(t.y)) t.y = 0;
  return t;
}
function _cFreeTextBoxSvg(t, selected=false){
  _cNormFreeTextBox(t);
  const plain=_cPlainFromHtml(t.html) || t.text || '';
  const w=Math.max(90, t.w || 120);
  const h=Math.max(20, t.h || 24);
  const x=t.x, y=t.y;
  const clipId=`ctextclip_${t.uid}`;
  const stroke=selected ? '#1f57a4' : 'transparent';
  const fill=selected ? 'rgba(31,87,164,0.07)' : 'transparent';
  const textFill=selected ? '#1f57a4' : '#222';
  const content = plain.trim()
    ? `<g clip-path="url(#${clipId})">${_cRichTextSvg(t.html || _cSvgEsc(t.text), x+8, y+4, { fontSize:13, fill:textFill, family:'Times New Roman,serif', align:t.align || 'left' })}</g>`
    : '';
  return `<g data-ctext="${t.uid}" style="cursor:${selected?'move':'text'};pointer-events:all">
    <defs><clipPath id="${clipId}"><rect x="${x+3}" y="${y+2}" width="${Math.max(1,w-6)}" height="${Math.max(1,h-4)}" rx="4"/></clipPath></defs>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="transparent" stroke="transparent" stroke-width="10" opacity="0.001"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="${fill}" stroke="${stroke}" stroke-width="1.1" stroke-dasharray="${selected ? '4 3' : 'none'}"/>
    ${content}
    ${selected ? `<rect data-ctexthandle="${t.uid}" x="${x+w-9}" y="${y+h-9}" width="9" height="9" rx="2" fill="#1f57a4" stroke="none" style="cursor:nwse-resize"/>` : ''}
  </g>`;
}
function _cFreeTextExportSvg(t){
  _cNormFreeTextBox(t);
  const plain=_cPlainFromHtml(t.html) || t.text || '';
  if(!plain.trim()) return '';
  const w=Math.max(90, t.w || 120);
  const h=Math.max(20, t.h || 24);
  const x=t.x, y=t.y;
  const clipId=`ctextexp_${t.uid}`;
  return `<defs><clipPath id="${clipId}"><rect x="${x+3}" y="${y+2}" width="${Math.max(1,w-6)}" height="${Math.max(1,h-4)}" rx="4"/></clipPath></defs><g clip-path="url(#${clipId})">${_cRichTextSvg(t.html || _cSvgEsc(t.text), x+8, y+4, { fontSize:13, fill:'#222', family:'Times New Roman,serif', align:t.align || 'left' })}</g>`;
}
function _cFreeTextDown(e){
  if(_cTool!=='select') return;
  e.preventDefault();
  e.stopPropagation();
  const uid=String(e.currentTarget.getAttribute('data-ctext')||'');
  const t=_cTexts.find(x=>x.uid===uid); if(!t) return;
  _cNormFreeTextBox(t);
  _cSelUid=uid; _cSelBox=null;
  const svg=document.getElementById('cEdSvg');
  const svgR=svg.getBoundingClientRect();
  const sx=_cW/Math.max(1,svgR.width), sy=_cH/Math.max(1,svgR.height);
  const ox=t.x, oy=t.y;
  const startCX=e.clientX, startCY=e.clientY;
  let dragged=false;
  try{ svg.setPointerCapture(e.pointerId); }catch(_){ }
  function onMove(ev){
    const dx=(ev.clientX-startCX)*sx;
    const dy=(ev.clientY-startCY)*sy;
    t.x=_cSnap(ox+dx);
    t.y=_cSnap(oy+dy);
    dragged=true;
    _cDraw();
  }
  function onUp(ev){
    try{ svg.releasePointerCapture(ev.pointerId); }catch(_){ }
    window.removeEventListener('pointermove',onMove);
    window.removeEventListener('pointerup',onUp);
    if(!dragged) _cDraw();
  }
  window.addEventListener('pointermove',onMove);
  window.addEventListener('pointerup',onUp);
}
function _cFreeTextResizeDown(e){
  if(_cTool!=='select') return;
  e.preventDefault();
  e.stopPropagation();
  const uid=String(e.currentTarget.getAttribute('data-ctexthandle')||'');
  const t=_cTexts.find(x=>x.uid===uid); if(!t) return;
  _cNormFreeTextBox(t);
  _cSelUid=uid; _cSelBox=null;
  const svg=document.getElementById('cEdSvg');
  const svgR=svg.getBoundingClientRect();
  const sx=_cW/Math.max(1,svgR.width), sy=_cH/Math.max(1,svgR.height);
  const ow=t.w, oh=t.h;
  const startCX=e.clientX, startCY=e.clientY;
  let dragged=false;
  try{ svg.setPointerCapture(e.pointerId); }catch(_){ }
  function onMove(ev){
    const dx=(ev.clientX-startCX)*sx;
    const dy=(ev.clientY-startCY)*sy;
    t.w=Math.max(90, _cSnap(ow+dx));
    t.h=Math.max(20, _cSnap(oh+dy));
    dragged=true;
    _cDraw();
  }
  function onUp(ev){
    try{ svg.releasePointerCapture(ev.pointerId); }catch(_){ }
    window.removeEventListener('pointermove',onMove);
    window.removeEventListener('pointerup',onUp);
    if(!dragged) _cDraw();
  }
  window.addEventListener('pointermove',onMove);
  window.addEventListener('pointerup',onUp);
}
function _cBoostStrokeMarkup(svg, mult=1.22, minStroke=3.15){
  const fmt=(n)=>{
    const v=Math.max(minStroke, Number(n||0) * mult);
    return Number(v.toFixed(2)).toString();
  };
  let out = String(svg||'')
    .replace(/stroke-width="([0-9.]+)"/g, (_,n)=>`stroke-width="${fmt(n)}"`)
    .replace(/stroke-width:([0-9.]+)/g, (_,n)=>`stroke-width:${fmt(n)}`);
  if(out.startsWith('<g ')){
    out = out.replace('<g ', '<g shape-rendering="geometricPrecision" text-rendering="geometricPrecision" color-rendering="optimizeQuality" ');
  }
  return out;
}
function _cCompBoxDown(e){
  if(_cTool!=='select') return;
  e.preventDefault();
  e.stopPropagation();
  const [uid,kind] = String(e.currentTarget.getAttribute('data-ccompbox')||'').split(':');
  const comp=_cComps.find(c=>c.uid===uid); if(!comp) return;
  _cEnsureCompTextBoxes(comp);
  _cSelUid=null;
  _cSelBox=null;
  _cSelBox=`${uid}:${kind}`;
  const box = kind==='legend' ? comp.legendBox : comp.nameBox;
  const svg=document.getElementById('cEdSvg');
  const svgR=svg.getBoundingClientRect();
  const sx=_cW/Math.max(1,svgR.width), sy=_cH/Math.max(1,svgR.height);
  const ox=box.x, oy=box.y;
  const startCX=e.clientX, startCY=e.clientY;
  let dragged=false;
  try{ svg.setPointerCapture(e.pointerId); }catch(_){ }
  function onMove(ev){
    const dx=(ev.clientX-startCX)*sx;
    const dy=(ev.clientY-startCY)*sy;
    const local=_cInvRotPt(dx,dy,comp.rot||0);
    box.x=_cSnap(ox+local.x);
    box.y=_cSnap(oy+local.y);
    dragged=true;
    _cDraw();
  }
  function onUp(ev){
    try{ svg.releasePointerCapture(ev.pointerId); }catch(_){ }
    window.removeEventListener('pointermove',onMove);
    window.removeEventListener('pointerup',onUp);
    if(!dragged) _cDraw();
  }
  window.addEventListener('pointermove',onMove);
  window.addEventListener('pointerup',onUp);
}
function _cCompBoxResizeDown(e){
  if(_cTool!=='select') return;
  e.preventDefault();
  e.stopPropagation();
  const [uid,kind] = String(e.currentTarget.getAttribute('data-cboxhandle')||'').split(':');
  const comp=_cComps.find(c=>c.uid===uid); if(!comp) return;
  _cEnsureCompTextBoxes(comp);
  _cSelUid=null;
  _cSelBox=`${uid}:${kind}`;
  const box = kind==='legend' ? comp.legendBox : comp.nameBox;
  const svg=document.getElementById('cEdSvg');
  const svgR=svg.getBoundingClientRect();
  const sx=_cW/Math.max(1,svgR.width), sy=_cH/Math.max(1,svgR.height);
  const startCX=e.clientX, startCY=e.clientY;
  const ow=box.w, oh=box.h;
  let dragged=false;
  try{ svg.setPointerCapture(e.pointerId); }catch(_){ }
  function onMove(ev){
    const dx=(ev.clientX-startCX)*sx;
    const dy=(ev.clientY-startCY)*sy;
    const local=_cInvRotPt(dx,dy,comp.rot||0);
    box.w=Math.max(70, _cSnap(ow+local.x));
    box.h=Math.max(20, _cSnap(oh+local.y));
    dragged=true;
    _cDraw();
  }
  function onUp(ev){
    try{ svg.releasePointerCapture(ev.pointerId); }catch(_){ }
    window.removeEventListener('pointermove',onMove);
    window.removeEventListener('pointerup',onUp);
    if(!dragged) _cDraw();
  }
  window.addEventListener('pointermove',onMove);
  window.addEventListener('pointerup',onUp);
}

function _cDefaultCompPreset(symId){
  const byId={
    battery:{ name:'VCC', legend:'' },
    supply_vdd:{ name:'VDD', legend:'' },
    current_source:{ name:'I_ref', legend:'' },
    ac_voltage_source:{ name:'v_in', legend:'AC source' },
    ac_current_source:{ name:'i_in', legend:'AC source' },
    switch_spst_open:{ name:'S1', legend:'OPEN' },
    switch_spst_closed:{ name:'S1', legend:'CLOSED' },
    switch_push_no:{ name:'S1', legend:'NO' },
    switch_push_nc:{ name:'S1', legend:'NC' },
    switch_spdt:{ name:'S1', legend:'COM / NO / NC' },
    switch_toggle:{ name:'S1', legend:'TOGGLE' },
    res:{ name:'R1', legend:'' },
    cap:{ name:'C1', legend:'' },
    ind:{ name:'L1', legend:'' },
    diode:{ name:'D1', legend:'' },
    diode_rev:{ name:'D1', legend:'' },
    led:{ name:'LED1', legend:'' },
    photodiode:{ name:'PD1', legend:'' },
    npn:{ name:'Q1', legend:'' },
    pnp:{ name:'Q1', legend:'' },
    nmos:{ name:'M1', legend:'' },
    nmos_2:{ name:'M1', legend:'' },
    pmos:{ name:'M1', legend:'' },
    jfet_n_1:{ name:'J1', legend:'' },
    jfet_n_2:{ name:'J1', legend:'' },
    jfet_p:{ name:'J1', legend:'' },
    ground:{ name:'', legend:'' }
  };
  return byId[symId] || { name:'', legend:'' };
}

function _cOpenLabelEditor({title='Edit Label', initialHtml='', initialAlign='left', onApply}){
  _cCloseLabelEditor();
  _cTextEditApply = typeof onApply==='function' ? onApply : null;
  const panel=document.createElement('div');
  panel.id='cEdTextEditorPanel';
  panel.style.cssText='position:absolute;right:14px;top:14px;z-index:40;width:min(440px,42vw);max-width:46%;background:#fff;border:2px solid var(--border2);border-radius:12px;box-shadow:0 12px 34px rgba(0,0,0,.22);padding:12px;display:flex;flex-direction:column;gap:8px';
  panel.dataset.align=initialAlign || 'left';
  panel.innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
      <div style="font-weight:700;color:var(--text)">${title}</div>
      <button class="btn" type="button" onclick="_cCloseLabelEditor()">Close</button>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <button class="btn" type="button" onmousedown="event.preventDefault()" onclick="_cFormatLabelEditor('bold')"><b>B</b></button>
      <button class="btn" type="button" onmousedown="event.preventDefault()" onclick="_cFormatLabelEditor('italic')"><em>I</em></button>
      <button class="btn" type="button" onmousedown="event.preventDefault()" onclick="_cFormatLabelEditor('underline')"><u>U</u></button>
      <button class="btn" type="button" onmousedown="event.preventDefault()" onclick="_cFormatLabelEditor('subscript')">Sub</button>
      <button class="btn" type="button" onmousedown="event.preventDefault()" onclick="_cFormatLabelEditor('superscript')">Sup</button>
      <button class="btn" type="button" onclick="_cSetLabelAlign('left')">Left</button>
      <button class="btn" type="button" onclick="_cSetLabelAlign('center')">Center</button>
      <button class="btn" type="button" onclick="_cSetLabelAlign('right')">Right</button>
    </div>
    <div style="font-size:10px;color:var(--muted)">Use the same rich label flow here for VDD, VCC, vin, vout, legends, and terminal names.</div>
    <div id="cEdTextEditor" contenteditable="true" spellcheck="true" style="min-height:120px;max-height:280px;overflow:auto;padding:10px 12px;border:2px solid var(--border2);border-radius:10px;font:16px Arial,Helvetica,sans-serif;line-height:1.35;white-space:pre-wrap"></div>
    <div style="display:flex;justify-content:flex-end;gap:8px">
      <button class="btn" type="button" onclick="_cCloseLabelEditor()">Cancel</button>
      <button class="btn pri" type="button" onclick="_cApplyLabelEditor()">Apply</button>
    </div>
  `;
  const host=document.getElementById('cEdRoot') || document.body;
  host.appendChild(panel);
  const editor=panel.querySelector('#cEdTextEditor');
  editor.innerHTML=initialHtml || '';
  editor.focus();
  _cRefreshLabelAlignButtons();
}

function _cCloseLabelEditor(){
  const panel=document.getElementById('cEdTextEditorPanel');
  if(panel) panel.remove();
  _cTextEditApply = null;
}

function _cFormatLabelEditor(cmd){
  const editor=document.getElementById('cEdTextEditor');
  if(!editor) return;
  editor.focus();
  try{ document.execCommand(cmd,false,null); }catch(_){ }
}

function _cSetLabelAlign(align){
  const panel=document.getElementById('cEdTextEditorPanel');
  if(!panel) return;
  panel.dataset.align=align;
  _cRefreshLabelAlignButtons();
}

function _cRefreshLabelAlignButtons(){
  const panel=document.getElementById('cEdTextEditorPanel');
  if(!panel) return;
  const align=panel.dataset.align || 'left';
  [...panel.querySelectorAll('button')].forEach(btn=>{
    if(btn.textContent==='Left' || btn.textContent==='Center' || btn.textContent==='Right'){
      const key=btn.textContent.toLowerCase();
      btn.classList.toggle('active', key===align);
    }
  });
}

function _cApplyLabelEditor(){
  const panel=document.getElementById('cEdTextEditorPanel');
  const editor=document.getElementById('cEdTextEditor');
  if(!panel || !editor || !_cTextEditApply) return;
  const html=editor.innerHTML.trim();
  const text=_cPlainFromHtml(html);
  const align=panel.dataset.align || 'left';
  _cTextEditApply({ html, text, align });
  _cCloseLabelEditor();
}

window._cCloseLabelEditor = _cCloseLabelEditor;
window._cFormatLabelEditor = _cFormatLabelEditor;
window._cSetLabelAlign = _cSetLabelAlign;
window._cApplyLabelEditor = _cApplyLabelEditor;

function _cRotPt(x,y,rot){
  const r=((rot%360)+360)%360;
  if(r===90) return {x:-y,y:x};
  if(r===180) return {x:-x,y:-y};
  if(r===270) return {x:y,y:-x};
  return {x,y};
}
function _cInvRotPt(x,y,rot){
  return _cRotPt(x,y,(360-((rot%360)+360)%360)%360);
}
function _cCompScale(comp){ return Math.max(0.25, Number(comp?.scale)||1); }
function _cSymTopLeftAnchored(sym){ return String(sym?.anchorMode||'')==='top-left'; }
function _cCompLocalBox(comp,pad=0){
  const sym=comp?.sym || {};
  const w=Math.max(1,+sym.w||1), h=Math.max(1,+sym.h||1);
  return _cSymTopLeftAnchored(sym)
    ? {x:-pad,y:-pad,w:w+pad*2,h:h+pad*2}
    : {x:-w/2-pad,y:-h/2-pad,w:w+pad*2,h:h+pad*2};
}
function _cCompWorldBox(comp,pad=0){
  const s=_cCompScale(comp), box=_cCompLocalBox(comp,pad);
  return {
    x:(+comp.x||0)+box.x*s,
    y:(+comp.y||0)+box.y*s,
    w:box.w*s,
    h:box.h*s
  };
}
function _cCompHasNameBox(comp){
  const group=String(comp?.sym?.group||'');
  return group==='MOSFET' || (group==='Custom' && !!String(comp?.name||_cPlainFromHtml(comp?.nameHtml)||'').trim());
}
function _cCompPortLocal(comp,p,scale){
  const s=Number.isFinite(+scale) ? Math.max(0.5,+scale) : _cCompScale(comp);
  return {x:(+p.x||0)*s, y:(+p.y||0)*s};
}
function _cPortWorldAt(comp,p,cx=comp.x,cy=comp.y,rot=comp.rot||0,scale=_cCompScale(comp),gridStep=_cGridStep){
  const lp=_cCompPortLocal(comp,p,scale);
  const rp=_cRotPt(lp.x,lp.y,rot||0);
  return {
    x:_cSnapWithStep((+cx||0)+rp.x,gridStep),
    y:_cSnapWithStep((+cy||0)+rp.y,gridStep),
    comp,
    port:p,
    kind:'port',
    key:`port:${comp.uid}:${p.id||''}`
  };
}
function _cPortRenderLocal(comp,p){
  const wp=_cPortWorldAt(comp,p);
  const local=_cInvRotPt(wp.x-comp.x, wp.y-comp.y, comp.rot||0);
  const s=_cCompScale(comp);
  return {x:local.x/s, y:local.y/s};
}
function _cAllPorts(){
  const pts=[];
  _cComps.forEach(comp=>{
    (comp.sym.ports||[]).forEach(p=>{
      pts.push(_cPortWorldAt(comp,p));
    });
  });
  return pts;
}
function _cNearestPort(x,y,maxDist=14){
  let best=null, bestD=maxDist*maxDist;
  _cAllPorts().forEach(p=>{
    const dx=p.x-x, dy=p.y-y, d=dx*dx+dy*dy;
    if(d<bestD){ bestD=d; best=p; }
  });
  return best;
}
function _cSmartSnapPt(x,y,opts={}){
  const near=_cNearestPort(x,y,Math.max(14,_cGridStep*2.5));
  if(near) return {x:Math.round(near.x), y:Math.round(near.y), port:true, portRef:near, kind:'port', key:near.key};
  const wire=_cNearestWireAnchor(x,y,Math.max(12,_cGridStep*2.2), opts.excludeWireUid || null);
  if(wire) return {x:Math.round(wire.x), y:Math.round(wire.y), port:false, portRef:null, wire:true, wireRef:wire, kind:wire.kind, key:wire.key};
  const g=_cSnapPt(x,y);
  return {x:g.x,y:g.y,port:false,portRef:null,wire:false,wireRef:null,kind:'grid',key:`grid:${g.x},${g.y}`};
}
function _cPortKey(x,y){ return `${Math.round(x)},${Math.round(y)}`; }
function _cCompPortKeys(comp){
  const keys=[];
  (comp.sym.ports||[]).forEach(p=>{
    const wp=_cPortWorldAt(comp,p);
    keys.push(_cPortKey(wp.x, wp.y));
  });
  return keys;
}
function _cPortRefPos(ref){
  if(!ref||!ref.comp||!ref.port) return null;
  const wp=_cPortWorldAt(ref.comp,ref.port);
  return {x:Math.round(wp.x), y:Math.round(wp.y)};
}
function _cCollectConnectedCompUids(seedUid){
  const seen=new Set([seedUid]);
  let changed=true;
  while(changed){
    changed=false;
    const compsSnapshot=_cComps.filter(c=>seen.has(c.uid));
    const keySet=new Set(compsSnapshot.flatMap(_cCompPortKeys));
    _cWires.forEach(w=>{
      const k1=_cPortKey(w.x1,w.y1), k2=_cPortKey(w.x2,w.y2);
      if(!(keySet.has(k1)||keySet.has(k2))) return;
      _cComps.forEach(c=>{
        if(seen.has(c.uid)) return;
        const cKeys=_cCompPortKeys(c);
        if(cKeys.includes(k1)||cKeys.includes(k2)){
          seen.add(c.uid);
          changed=true;
        }
      });
    });
  }
  return seen;
}
function _cTranslateCompNetwork(seedUid, dx, dy){
  if(!dx&&!dy) return;
  const group=_cCollectConnectedCompUids(seedUid);
  const portKeys=new Set();
  _cComps.forEach(c=>{ if(group.has(c.uid)) _cCompPortKeys(c).forEach(k=>portKeys.add(k)); });
  _cComps.forEach(c=>{ if(group.has(c.uid)){ c.x=_cSnap(c.x+dx); c.y=_cSnap(c.y+dy); } });
  _cWires.forEach(w=>{
    const k1=_cPortKey(w.x1,w.y1), k2=_cPortKey(w.x2,w.y2);
    if(portKeys.has(k1)){ w.x1=Math.round(w.x1+dx); w.y1=Math.round(w.y1+dy); }
    if(portKeys.has(k2)){ w.x2=Math.round(w.x2+dx); w.y2=Math.round(w.y2+dy); }
  });
}
function _cAutoAlignWireEndpoints(startPt,endPt){
  if(!startPt?.portRef || !endPt?.portRef) return {start:startPt,end:endPt,aligned:false};
  if(startPt.portRef.comp.uid===endPt.portRef.comp.uid) return {start:startPt,end:endPt,aligned:false};
  const endGroup=_cCollectConnectedCompUids(endPt.portRef.comp.uid);
  if(endGroup.has(startPt.portRef.comp.uid)) return {start:startPt,end:endPt,aligned:false};
  const sPos=_cPortRefPos(startPt.portRef), ePos=_cPortRefPos(endPt.portRef);
  if(!sPos||!ePos) return {start:startPt,end:endPt,aligned:false};
  const dx=sPos.x-ePos.x, dy=sPos.y-ePos.y;
  const moveX=Math.abs(dx)<Math.abs(dy) ? _cSnap(dx) : 0;
  const moveY=Math.abs(dy)<=Math.abs(dx) ? _cSnap(dy) : 0;
  _cTranslateCompNetwork(endPt.portRef.comp.uid, moveX, moveY);
  const resolvedEnd=_cPortRefPos(endPt.portRef) || {x:endPt.x,y:endPt.y};
  return {
    start:{...startPt,x:sPos.x,y:sPos.y},
    end:{...endPt,x:resolvedEnd.x,y:resolvedEnd.y},
    aligned:!!(moveX||moveY)
  };
}
function _cCancelWireMode(exitTool=false){
  _cWireStart=null;
  if(_cDrawRaf){ cancelAnimationFrame(_cDrawRaf); _cDrawRaf=0; }
  const prev=document.getElementById('cEdWirePrev'); if(prev) prev.innerHTML='';
  if(exitTool) cEdSetTool('select');
  const st=document.getElementById('cEdStatus');
  if(st) st.textContent=exitTool ? 'Wire mode cancelled.' : 'Wire cancelled.';
}
function _cWireRoute(w){
  if(w.route==='hv' || w.route==='vh') return w.route;
  const dx=Math.abs((+w.x2)-(+w.x1)), dy=Math.abs((+w.y2)-(+w.y1));
  return dx>=dy ? 'hv' : 'vh';
}
function _cWireBend(w){
  const route=_cWireRoute(w);
  if(route==='hv') return Number.isFinite(+w.bend) ? +w.bend : +w.x2;
  return Number.isFinite(+w.bend) ? +w.bend : +w.y2;
}
function _cWireBendHandle(w){
  const x1=+w.x1,y1=+w.y1,x2=+w.x2,y2=+w.y2;
  const route=_cWireRoute(w), bend=_cWireBend(w);
  if(x1===x2 || y1===y2) return {x:(x1+x2)/2, y:(y1+y2)/2, axis:'free'};
  if(route==='hv') return {x:bend, y:(y1+y2)/2, axis:'x'};
  return {x:(x1+x2)/2, y:bend, axis:'y'};
}
function _cWirePath(w){
  const x1=+w.x1,y1=+w.y1,x2=+w.x2,y2=+w.y2;
  if(x1===x2 || y1===y2) return `M${x1} ${y1} L${x2} ${y2}`;
  const route=_cWireRoute(w), bend=_cWireBend(w);
  if(route==='hv') return `M${x1} ${y1} L${bend} ${y1} L${bend} ${y2} L${x2} ${y2}`;
  return `M${x1} ${y1} L${x1} ${bend} L${x2} ${bend} L${x2} ${y2}`;
}
function _cInitWireGeometry(w){
  w.route=_cWireRoute(w);
  if(!Number.isFinite(+w.bend)) w.bend=(w.route==='hv') ? +w.x2 : +w.y2;
  return w;
}

function _cWirePoints(w){
  _cInitWireGeometry(w);
  const x1=+w.x1,y1=+w.y1,x2=+w.x2,y2=+w.y2;
  if(x1===x2 || y1===y2) return [{x:x1,y:y1},{x:x2,y:y2}];
  const bend=_cWireBend(w);
  return _cWireRoute(w)==='hv'
    ? [{x:x1,y:y1},{x:bend,y:y1},{x:bend,y:y2},{x:x2,y:y2}]
    : [{x:x1,y:y1},{x:x1,y:bend},{x:x2,y:bend},{x:x2,y:y2}];
}
function _cWireSegments(w){
  const pts=_cWirePoints(w);
  const segs=[];
  for(let i=0;i<pts.length-1;i++){
    const a=pts[i], b=pts[i+1];
    if(Math.round(a.x)===Math.round(b.x) && Math.round(a.y)===Math.round(b.y)) continue;
    segs.push({wire:w,x1:a.x,y1:a.y,x2:b.x,y2:b.y});
  }
  return segs;
}
function _cProjectToSegment(x,y,seg){
  const ax=+seg.x1, ay=+seg.y1, bx=+seg.x2, by=+seg.y2;
  const vx=bx-ax, vy=by-ay;
  const len2=vx*vx+vy*vy;
  if(!len2) return {x:ax,y:ay,d2:(x-ax)*(x-ax)+(y-ay)*(y-ay)};
  let t=((x-ax)*vx+(y-ay)*vy)/len2;
  t=Math.max(0,Math.min(1,t));
  const px=ax+vx*t, py=ay+vy*t;
  return {x:px,y:py,d2:(x-px)*(x-px)+(y-py)*(y-py)};
}
function _cNearestWireAnchor(x,y,maxDist=12,excludeWireUid=null){
  let best=null, bestD=maxDist*maxDist;
  _cWires.forEach(w=>{
    if(excludeWireUid && w.uid===excludeWireUid) return;
    _cWirePoints(w).forEach((p,idx)=>{
      const d=(p.x-x)*(p.x-x)+(p.y-y)*(p.y-y);
      if(d<bestD){
        bestD=d;
        best={x:_cSnap(p.x),y:_cSnap(p.y),wire:w,kind:'wire-node',key:`wire-node:${w.uid}:${idx}`};
      }
    });
    _cWireSegments(w).forEach((seg,idx)=>{
      const p=_cProjectToSegment(x,y,seg);
      if(p.d2>=bestD) return;
      let sx=p.x, sy=p.y;
      if(Math.round(seg.y1)===Math.round(seg.y2)){
        sy=_cSnap(seg.y1);
        sx=Math.max(Math.min(seg.x1,seg.x2), Math.min(Math.max(seg.x1,seg.x2), _cSnap(p.x)));
      } else if(Math.round(seg.x1)===Math.round(seg.x2)){
        sx=_cSnap(seg.x1);
        sy=Math.max(Math.min(seg.y1,seg.y2), Math.min(Math.max(seg.y1,seg.y2), _cSnap(p.y)));
      } else {
        sx=_cSnap(p.x); sy=_cSnap(p.y);
      }
      bestD=p.d2;
      best={x:sx,y:sy,wire:w,segment:seg,kind:'wire-segment',key:`wire-segment:${w.uid}:${idx}:${Math.round(sx)},${Math.round(sy)}`};
    });
  });
  return best;
}
function _cPointOnSegment(pt,seg,tol=0.75){
  const p=_cProjectToSegment(pt.x,pt.y,seg);
  if(p.d2>tol*tol) return false;
  const minX=Math.min(seg.x1,seg.x2)-tol, maxX=Math.max(seg.x1,seg.x2)+tol;
  const minY=Math.min(seg.y1,seg.y2)-tol, maxY=Math.max(seg.y1,seg.y2)+tol;
  return pt.x>=minX && pt.x<=maxX && pt.y>=minY && pt.y<=maxY;
}
function _cConnectionNodes(){
  const nodeMap=new Map();
  const add=(x,y)=>{
    const k=_cPortKey(x,y);
    const prev=nodeMap.get(k) || {x:_cSnap(x),y:_cSnap(y),count:0};
    prev.count++;
    nodeMap.set(k,prev);
  };
  const endpoints=[];
  _cWires.forEach(w=>{
    const a={x:_cSnap(w.x1),y:_cSnap(w.y1),wire:w};
    const b={x:_cSnap(w.x2),y:_cSnap(w.y2),wire:w};
    endpoints.push(a,b);
  });
  endpoints.forEach((pt,i)=>{
    endpoints.forEach((other,j)=>{
      if(i>=j || pt.wire.uid===other.wire.uid) return;
      if(_cPortKey(pt.x,pt.y)===_cPortKey(other.x,other.y)) add(pt.x,pt.y);
    });
    _cWires.forEach(w=>{
      if(w.uid===pt.wire.uid) return;
      _cWireSegments(w).forEach(seg=>{ if(_cPointOnSegment(pt,seg)) add(pt.x,pt.y); });
    });
  });
  return [...nodeMap.values()].filter(n=>n.count>0);
}

function _cRefreshAttachedWireEndpoints(comp, prevX, prevY, prevRot=comp.rot||0, prevScale=_cCompScale(comp)){
  const byKey={};
  (comp.sym.ports||[]).forEach(p=>{
    const oldPos=_cPortWorldAt(comp,p,prevX,prevY,prevRot,prevScale);
    const nextPos=_cPortWorldAt(comp,p);
    byKey[_cPortKey(oldPos.x, oldPos.y)]={x:Math.round(nextPos.x), y:Math.round(nextPos.y)};
  });
  _cWires.forEach(w=>{
    const k1=_cPortKey(w.x1,w.y1), k2=_cPortKey(w.x2,w.y2);
    if(byKey[k1]){ w.x1=byKey[k1].x; w.y1=byKey[k1].y; }
    if(byKey[k2]){ w.x2=byKey[k2].x; w.y2=byKey[k2].y; }
  });
}

function _cWireEndDown(e){
  if(_cTool!=='select') return;
  e.preventDefault();
  e.stopPropagation();
  const [uid,which]=String(e.currentTarget.getAttribute('data-cwire-end')||'').split(':');
  const wire=_cWires.find(w=>w.uid===uid); if(!wire) return;
  _cInitWireGeometry(wire);
  _cSelUid=uid; _cSelBox=null; _cDraw();
  const svg=document.getElementById('cEdSvg');
  const svgR=svg.getBoundingClientRect();
  const sx=_cW/Math.max(1,svgR.width), sy=_cH/Math.max(1,svgR.height);
  const startCX=e.clientX, startCY=e.clientY;
  const ox1=wire.x1, oy1=wire.y1, ox2=wire.x2, oy2=wire.y2;
  const ob=wire.bend;
  try{ svg.setPointerCapture(e.pointerId); }catch(_){ }
  function onMove(ev){
    const dx=(ev.clientX-startCX)*sx;
    const dy=(ev.clientY-startCY)*sy;
    const pt=_cSmartSnapPt((which==='start'?ox1:ox2)+dx,(which==='start'?oy1:oy2)+dy,{excludeWireUid:uid});
    if(which==='start'){ wire.x1=pt.x; wire.y1=pt.y; }
    else { wire.x2=pt.x; wire.y2=pt.y; }
    wire.bend=ob;
    _cRequestDraw();
  }
  function onUp(ev){
    try{ svg.releasePointerCapture(ev.pointerId); }catch(_){ }
    window.removeEventListener('pointermove',onMove);
    window.removeEventListener('pointerup',onUp);
    _cDraw();
  }
  window.addEventListener('pointermove',onMove);
  window.addEventListener('pointerup',onUp);
}
function _cWireBendDown(e){
  if(_cTool!=='select') return;
  e.preventDefault();
  e.stopPropagation();
  const uid=String(e.currentTarget.getAttribute('data-cwire-bend')||'');
  const wire=_cWires.find(w=>w.uid===uid); if(!wire) return;
  _cInitWireGeometry(wire);
  _cSelUid=uid; _cSelBox=null; _cDraw();
  const svg=document.getElementById('cEdSvg');
  const svgR=svg.getBoundingClientRect();
  const sx=_cW/Math.max(1,svgR.width), sy=_cH/Math.max(1,svgR.height);
  const startCX=e.clientX, startCY=e.clientY;
  const ob=+wire.bend;
  const route=_cWireRoute(wire);
  try{ svg.setPointerCapture(e.pointerId); }catch(_){ }
  function onMove(ev){
    const dx=(ev.clientX-startCX)*sx;
    const dy=(ev.clientY-startCY)*sy;
    wire.bend = route==='hv' ? _cSnap(ob+dx) : _cSnap(ob+dy);
    _cRequestDraw();
  }
  function onUp(ev){
    try{ svg.releasePointerCapture(ev.pointerId); }catch(_){ }
    window.removeEventListener('pointermove',onMove);
    window.removeEventListener('pointerup',onUp);
    _cDraw();
  }
  window.addEventListener('pointermove',onMove);
  window.addEventListener('pointerup',onUp);
}
function cEdFlipWire(){
  const wire=_cWires.find(w=>w.uid===_cSelUid);
  if(!wire){ const st=document.getElementById('cEdStatus'); if(st) st.textContent='Select a wire first to flip route.'; return; }
  _cInitWireGeometry(wire);
  wire.route = _cWireRoute(wire)==='hv' ? 'vh' : 'hv';
  wire.bend = wire.route==='hv' ? +wire.x2 : +wire.y2;
  _cDraw();
}

function _cWireDown(e){
  if(_cTool!=='select') return;
  e.preventDefault();
  e.stopPropagation();
  const uid=e.currentTarget.getAttribute('data-cwire');
  const wire=_cWires.find(w=>w.uid===uid); if(!wire) return;
  _cSelUid=uid; _cSelBox=null; _cDraw();
  const svg=document.getElementById('cEdSvg');
  const svgR=svg.getBoundingClientRect();
  const sx=_cW/Math.max(1,svgR.width), sy=_cH/Math.max(1,svgR.height);
  const startCX=e.clientX, startCY=e.clientY;
  const ox1=wire.x1, oy1=wire.y1, ox2=wire.x2, oy2=wire.y2;
  const ob=+wire.bend;
  const route=_cWireRoute(wire);
  try{ svg.setPointerCapture(e.pointerId); }catch(_){ }
  function onMove(ev){
    const dx=_cSnap((ev.clientX-startCX)*sx);
    const dy=_cSnap((ev.clientY-startCY)*sy);
    wire.x1=ox1+dx; wire.y1=oy1+dy;
    wire.x2=ox2+dx; wire.y2=oy2+dy;
    wire.bend = route==='hv' ? ob+dx : ob+dy;
    _cRequestDraw();
  }
  function onUp(ev){
    try{ svg.releasePointerCapture(ev.pointerId); }catch(_){ }
    window.removeEventListener('pointermove',onMove);
    window.removeEventListener('pointerup',onUp);
    _cDraw();
  }
  window.addEventListener('pointermove',onMove);
  window.addEventListener('pointerup',onUp);
}


// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  OPEN EDITOR
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function _cSerializableCopy(value){
  try{ return JSON.parse(JSON.stringify(value)); }catch(_){ return null; }
}

function _cCaptureScene(){
  return _cSerializableCopy({
    version:1,
    gridStep:_cGridStep,
    components:_cComps.map(({sym,...component})=>component),
    wires:_cWires,
    texts:_cTexts
  }) || {version:1,gridStep:CIRC_GRID_SMALL,components:[],wires:[],texts:[]};
}

function _cRestoreScene(scene){
  const copy=_cSerializableCopy(scene);
  if(!copy || !Array.isArray(copy.components)) return false;
  const symbols=new Map(CIRC_SYMBOLS.map(sym=>[sym.id,sym]));
  _cComps=copy.components.map(component=>{
    const restoredCustom=component?.customSymbol ? _cRegisterCustomSymbol(component.customSymbol,false) : null;
    const sym=symbols.get(component?.id) || restoredCustom;
    return sym ? {...component,sym} : null;
  }).filter(Boolean);
  _cWires=Array.isArray(copy.wires) ? copy.wires.filter(w=>w && Number.isFinite(+w.x1) && Number.isFinite(+w.y1) && Number.isFinite(+w.x2) && Number.isFinite(+w.y2)) : [];
  _cTexts=Array.isArray(copy.texts) ? copy.texts.filter(text=>text && Number.isFinite(+text.x) && Number.isFinite(+text.y)) : [];
  _cGridStep=Math.max(1,Number(copy.gridStep)||CIRC_GRID_SMALL);
  _cUID=Math.max(_cUID,_cComps.length+_cWires.length+_cTexts.length+1);
  return true;
}

function openCircuitFigureEditor(key, figureIndex){
  const figures=typeof getFigureStore==='function' ? getFigureStore(key) : [];
  const index=Number.isInteger(+figureIndex) ? +figureIndex : -1;
  const figure=figures[index];
  if(!figure || figure.kind!=='circuit-svg' || !figure.circuitScene){
    toast('Select a saved vector circuit first.');
    return false;
  }
  openCircuitEditor(key,{scene:figure.circuitScene,figureIndex:index});
  return true;
}

function openCircuitEditorForSelection(key){
  const index=Number(selectedFigureByKey?.[key]);
  if(Number.isInteger(index) && openCircuitFigureEditor(key,index)) return;
  openCircuitEditor(key);
}

function openCircuitEditor(key, options={}){
  _cRefreshSharedCustomSymbols();
  _cTargetKey = key||'q';
  _cComps=[];_cWires=[];_cTexts=[];
  _cSelUid=null;_cSelBox=null;_cTool='select';_cWireStart=null;
  _cGridStep=CIRC_GRID_SMALL;
  _cHoverPort=null;
  _cHoverAnchor=null;
  _cEditingFigureIndex=Number.isInteger(+options?.figureIndex) ? +options.figureIndex : -1;
  if(options?.scene) _cRestoreScene(options.scene);

  const groups=[...(new Set(CIRC_SYMBOLS.map(s=>s.group)))];

  openModal({
    title:'Circuit Figure Panel',
    subtitle:_cEditingFigureIndex>=0 ? 'Edit the saved vector figure, then update it in place.' : 'Place components, wires, and labels, then apply the vector figure to the canvas.',
    closable:true,
    body:`
<div id="cEdRoot" style="position:relative;display:flex;gap:0;height:80vh;min-height:420px;border:2px solid var(--border2);border-radius:10px;overflow:hidden">

  <!-- PALETTE -->
  <div style="width:192px;flex-shrink:0;background:linear-gradient(180deg,#f0f6ff,#ddeaff);border-right:2px solid var(--border2);display:flex;flex-direction:column;overflow:hidden">
    <div id="cEdGrpTabs" style="padding:6px;border-bottom:1px solid var(--border2);display:flex;flex-wrap:wrap;gap:3px;background:rgba(255,255,255,.55);flex-shrink:0">
      ${groups.map((g,i)=>`<button class="tool-btn${i===0?' active':''}" type="button" onclick="cEdSetGroup('${g}')" style="font-size:9px;padding:2px 6px">${g}</button>`).join('')}
    </div>
    <div id="cEdSymList" style="flex:1;overflow-y:auto;padding:7px;display:flex;flex-wrap:wrap;gap:6px;align-content:flex-start">
      ${_cPaletteHTML(groups[0])}
    </div>
    <div style="padding:6px 8px;border-top:1px solid var(--border2);font-size:9px;color:var(--muted);line-height:1.55;flex-shrink:0">
      <button class="tool-btn" type="button" onclick="cEdImportCustomSymbol()" style="width:100%;font-size:10px;margin-bottom:5px">Import SVG Symbol</button>
      <button class="tool-btn" type="button" onclick="cEdLoadLocalSymbolLibrary()" style="width:100%;font-size:10px;margin-bottom:5px">Load Local Library</button>
      <input id="cEdCustomSymbolInput" type="file" accept="application/json,.json" style="display:none" onchange="cEdLoadCustomSymbol(event)">
      Click to place at centre.<br>Drag placed symbol to move.
    </div>
  </div>

  <!-- DRAWING AREA -->
  <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0">

    <!-- toolbar -->
    <div style="display:flex;gap:4px;align-items:center;padding:5px 7px;background:linear-gradient(180deg,#e8f0ff,#d0e3ff);border-bottom:2px solid var(--border2);flex-wrap:wrap;flex-shrink:0">
      <button id="cEdBtnSelect" class="tool-btn active" type="button" onclick="cEdSetTool('select')">&#9654; Select</button>
      <button id="cEdBtnWire"   class="tool-btn"        type="button" onclick="cEdSetTool('wire')">&#9632;&#9135; Wire</button>
      <button id="cEdBtnText"   class="tool-btn"        type="button" onclick="cEdSetTool('text')">T Label</button>
      <div style="width:1px;height:20px;background:var(--border2)"></div>
      <span style="font-size:9px;color:var(--muted);font-family:monospace">Grid</span>
      <button class="tool-btn active" data-cgridstep="${CIRC_GRID_SMALL}" type="button" onclick="cEdSetGrid(${CIRC_GRID_SMALL})">Small</button>
      <button class="tool-btn" data-cgridstep="${CIRC_GRID_DEFAULT}" type="button" onclick="cEdSetGrid(${CIRC_GRID_DEFAULT})">Def</button>
      <button class="tool-btn" data-cgridstep="${CIRC_GRID_2X}" type="button" onclick="cEdSetGrid(${CIRC_GRID_2X})">2x</button>
      <button class="tool-btn" data-cgridstep="${CIRC_GRID_3X}" type="button" onclick="cEdSetGrid(${CIRC_GRID_3X})">3x</button>
      <div style="width:1px;height:20px;background:var(--border2)"></div>
      <button class="tool-btn" type="button" onclick="cEdZoom(-0.1)">&#8722; Zoom</button>
      <span id="cEdZoomLbl" style="font-size:9px;color:var(--muted);font-family:monospace;min-width:38px;text-align:center">100%</span>
      <button class="tool-btn" type="button" onclick="cEdZoom(0.1)">&#43; Zoom</button>
      <button class="tool-btn" type="button" onclick="cEdToggleExpand()">Pane</button>
      <div style="width:1px;height:20px;background:var(--border2)"></div>
      <button class="tool-btn" type="button" onclick="cEdFlipWire()">&#8646; Flip</button>
      <button class="tool-btn" type="button" onclick="cEdScaleComp(-0.1)">Comp &#8722;</button>
      <button class="tool-btn" type="button" onclick="cEdScaleComp(0.1)">Comp &#43;</button>
      <button class="tool-btn" type="button" onclick="cEdRotate(1)">&#8635; CW</button>
      <button class="tool-btn" type="button" onclick="cEdRotate(-1)">&#8634; CCW</button>
      <button class="tool-btn del" type="button" onclick="cEdDelete()">&#10005; Del</button>
      <div style="width:1px;height:20px;background:var(--border2)"></div>
      <button class="tool-btn" type="button" onclick="cEdUndo()">&#8617; Undo</button>
      <button class="tool-btn" type="button" onclick="cEdClear()">&#8856; Clear</button>
      <div style="flex:1;min-width:4px"></div>
      <span id="cEdStatus" style="font-size:9px;color:var(--muted);font-family:monospace;white-space:nowrap">Select tool active</span>
      <div style="width:1px;height:20px;background:var(--border2)"></div>
      <button class="btn pri" type="button" onclick="cEdApply()">&#10003; Apply</button>
    </div>

    <!-- Wire-mode status bar (visible only when wire tool active) -->
    <div id="cEdWireBar" style="display:none;padding:3px 10px;background:#fff3cd;border-bottom:1px solid #d4a800;font-size:10px;color:#7a5b00;font-family:monospace;flex-shrink:0">
      &#9135; Wire mode â€” click start point on canvas, then click end point. Press Esc or click Select to cancel.
    </div>

    <!-- SVG canvas -->
    <div style="flex:1;overflow:auto;position:relative;background:#fff">
      <svg id="cEdSvg" width="${_cW}" height="${_cH}"
        xmlns="http://www.w3.org/2000/svg"
        style="display:block;touch-action:none;user-select:none;cursor:default">
        <defs>
          ${_cGridPatternMarkup()}
        </defs>
        <rect width="100%" height="100%" fill="url(#cEdGrid)" style="pointer-events:none"/>
        <g id="cEdWires"></g>
        <g id="cEdWirePrev"></g>
        <g id="cEdComps"></g>
        <g id="cEdTexts"></g>
        <g id="cEdCursor" style="pointer-events:none"></g>
      </svg>
    </div>
  </div>
</div>

<div class="modal-actions" style="margin-top:8px">
  <button class="btn pri" type="button" onclick="cEdApply()">&#10003; Apply to Canvas</button>
  <button class="btn"     type="button" onclick="closeModal()">Cancel</button>
</div>
    `
  });

  // Widen modal
  const card=document.querySelector('.modal-card');
  if(card){ card.style.width='min(1080px,98vw)'; card.style.maxHeight='95vh'; }

  // Bind SVG after paint
  setTimeout(()=>{
    const svg=document.getElementById('cEdSvg');
    if(!svg) return;
    svg.addEventListener('click',     _cClick,    false);
    svg.addEventListener('dblclick',  _cDblClick, true);
    svg.addEventListener('pointermove', _cMouseMove,false);
    svg.addEventListener('keydown',   _cKeyDown,  false);
    svg.setAttribute('tabindex','0'); // so keydown works
    cEdSetTool('select');
    _cRefreshGridUi();
    _cApplyViewportUi();
    _cDraw();
  },0);
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  PALETTE
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function _cPaletteHTML(group){
  return CIRC_SYMBOLS.filter(s=>s.group===group).map(s=>{
    const vb=`${-s.w/2-8} ${-s.h/2-8} ${s.w+16} ${s.h+16}`;
    const markup=s.group==='Custom' ? s.svgFn(false,`palette_${s.id}`) : _cBoostStrokeMarkup(s.svgFn(false), 1.75, 5.6);
    const label=_cSvgEsc(s.label||s.id);
    if(s.group==='Custom') return `<div style="width:100%;display:flex;gap:4px;align-items:stretch">
      <button class="elec-sym-btn" type="button" onclick="cEdPlace('${s.id}')" title="${label}" style="flex:1;min-width:0">
        <div class="elec-sym-preview"><svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" style="overflow:visible;width:62px;height:42px">${markup}</svg></div>
        <div class="elec-sym-label">${label}</div>
      </button>
      <button class="tool-btn del" type="button" onclick="cEdDeleteCustomSymbol('${s.id}')" title="Delete ${label}" style="align-self:center">Delete</button>
    </div>`;
    return `<button class="elec-sym-btn" type="button" onclick="cEdPlace('${s.id}')" title="${s.label}">
      <div class="elec-sym-preview">
        <svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" style="overflow:visible;width:62px;height:42px">${markup}</svg>
      </div>
      <div class="elec-sym-label">${s.label}</div>
    </button>`;
  }).join('');
}

function cEdSetGroup(g){
  const list=document.getElementById('cEdSymList');
  if(list) list.innerHTML=_cPaletteHTML(g);
  document.querySelectorAll('#cEdGrpTabs .tool-btn').forEach(b=>{
    b.classList.toggle('active',b.textContent.trim()===g);
  });
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  TOOL SWITCHING
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function cEdSetTool(tool){
  _cTool=tool;
  _cSelBox=null;
  _cHoverPort=null;
  _cHoverAnchor=null;
  if(tool!=='wire'){ _cWireStart=null; const p=document.getElementById('cEdWirePrev'); if(p) p.innerHTML=''; }
  const svg=document.getElementById('cEdSvg');
  const cursorLayer=document.getElementById('cEdCursor');
  if(svg) svg.style.cursor=(tool==='wire')?'none':(tool==='text')?'text':'default';
  if(cursorLayer && tool!=='wire') cursorLayer.innerHTML='';
  ['Select','Wire','Text'].forEach(t=>{
    const b=document.getElementById('cEdBtn'+t); if(b) b.classList.toggle('active',t.toLowerCase()===tool);
  });
  const bar=document.getElementById('cEdWireBar');
  if(bar) bar.style.display=(tool==='wire')?'block':'none';
  const msgs={select:'Click to select. Drag to move.',wire:'Click start port, then end port.',text:'Click to place label.'};
  const st=document.getElementById('cEdStatus'); if(st) st.textContent=msgs[tool]||'';
  _cDraw(); // refresh pins/highlights for all tools
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  PLACE SYMBOL
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function cEdPlace(symId){
  const sym=CIRC_SYMBOLS.find(s=>s.id===symId); if(!sym) return;
  // Stagger placement so multiple drops don't stack exactly
  const off=(_cComps.length%5)*_cGridStep;
  const topLeftCustom=_cSymTopLeftAnchored(sym);
  const cx=topLeftCustom ? _cSnap(40+off) : _cSnap(_cW/2)+off;
  const cy=topLeftCustom ? _cSnap(40+(_cComps.length%3)*_cGridStep) : _cSnap(_cH/2)+(_cComps.length%3)*_cGridStep;
  const custom=!!sym.customDefinition;
  const defaults=custom ? _cCustomComponentDefaults(sym.componentDefaults) : null;
  const preset=custom
    ? {name:defaults.reference,legend:[defaults.value,defaults.legend].filter(Boolean).join('\n')}
    : _cDefaultCompPreset(symId);
  const customScale=1;
  _cComps.push({uid:_cMkUid(),id:symId,sym,x:cx,y:cy,rot:0,scale:customScale,name:preset.name||'',nameHtml:preset.name ? _cSvgEsc(preset.name) : '',nameAlign:'left',legend:preset.legend||'',legendHtml:preset.legend ? _cSvgEsc(preset.legend) : '',legendAlign:'left',nameBox:null,legendBox:null,customSymbol:custom?_cSerializableCopy(sym.customDefinition):null,customTexts:custom?_cSerializableCopy(sym.editableTexts||[]):[]});
  _cDraw();
  const st=document.getElementById('cEdStatus'); if(st) st.textContent=sym.label+' placed â€” drag to move.';
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  SVG COORD
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function _cPt(e){
  const svg=document.getElementById('cEdSvg'); if(!svg) return{x:0,y:0};
  const r=svg.getBoundingClientRect();
  const sx=_cW/Math.max(1,r.width), sy=_cH/Math.max(1,r.height);
  return{x:(e.clientX-r.left)*sx, y:(e.clientY-r.top)*sy};
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  SVG EVENT HANDLERS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function _cClick(e){
  // In wire mode we still allow clicks over symbols so users can start/end at pins.
  const compEl=e.target.closest('[data-ccomp]');
  const textEl=e.target.closest('[data-ctext]');
  if(_cTool!=='wire' && (compEl||textEl)) return;

  const pt=_cPt(e);
  const sp=_cSmartSnapPt(pt.x,pt.y);

  if(_cTool==='wire'){
    if(!_cWireStart){
      _cWireStart=sp;
      const st=document.getElementById('cEdStatus');
      if(st) st.textContent=`Start locked (${sp.x},${sp.y}) - click end point`;
    } else {
      let startPt=_cWireStart;
      let endPt=sp;
      if(startPt.x!==endPt.x||startPt.y!==endPt.y){
        const aligned=_cAutoAlignWireEndpoints(startPt,endPt);
        startPt=aligned.start;
        endPt=aligned.end;
        _cWires.push(_cInitWireGeometry({uid:_cMkUid(),x1:startPt.x,y1:startPt.y,x2:endPt.x,y2:endPt.y}));
        _cDraw();
        const st=document.getElementById('cEdStatus');
        if(st) st.textContent=aligned.aligned ? 'Wire drawn. Connected components auto-aligned.' : 'Wire drawn. Click next start or double-click to finish.';
      } else {
        const st=document.getElementById('cEdStatus');
        if(st) st.textContent='Same point selected. Wire ignored.';
      }
      _cWireStart=null;
      const prev=document.getElementById('cEdWirePrev'); if(prev) prev.innerHTML='';
    }
    return;
  }

  if(_cTool==='text'){
    _cOpenLabelEditor({
      title:'Add Circuit Label',
      initialHtml:'',
      initialAlign:'left',
      onApply:({html,text,align})=>{
        if(text && text.trim()){
          const plain=text.trim();
          const w=Math.max(120, (plain.length * 7) + 26);
          _cTexts.push({uid:_cMkUid(),x:_cSnap(sp.x),y:_cSnap(sp.y-18),w,h:24,text:plain,html,align:align||'left'});
          _cDraw();
        }
      }
    });
    return;
  }

  // select tool - click background to deselect
  _cSelUid=null; _cSelBox=null; _cDraw();
}

function _cPaintWireCursor(){
  const cur=document.getElementById('cEdCursor');
  if(!cur) return;
  if(_cTool!=='wire'){
    cur.innerHTML='';
    return;
  }
  const x=Number(_cMousePt?.x||0), y=Number(_cMousePt?.y||0);
  const anchorKind=_cHoverAnchor?.kind || '';
  const locked=anchorKind==='port' || anchorKind==='wire-node' || anchorKind==='wire-segment';
  const color=anchorKind==='port' ? '#006dff' : (locked ? '#d97706' : '#1f57a4');
  cur.innerHTML=`<g opacity="0.98">
    ${locked ? `<circle cx="${x}" cy="${y}" r="${anchorKind==='port'?8.2:7.2}" fill="none" stroke="${color}" stroke-width="2.6" opacity="0.85"/>` : ''}
    <circle cx="${x}" cy="${y}" r="4.4" fill="${color}" stroke="#ffffff" stroke-width="1.4"/>
    <path d="M${x-10} ${y} H${x+10} M${x} ${y-10} V${y+10}" stroke="${color}" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M${x-10} ${y} H${x+10} M${x} ${y-10} V${y+10}" stroke="#ffffff" stroke-width="0.7" stroke-linecap="round" opacity="0.8"/>
  </g>`;
}

function cEdImportCustomSymbol(){
  document.getElementById('cEdCustomSymbolInput')?.click();
}

function cEdLoadCustomSymbol(event){
  const file=event?.target?.files?.[0];
  if(!file) return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const symbols=_cRegisterCustomSymbolBundle(JSON.parse(String(reader.result||'')),true);
      if(!symbols.length) throw new Error('This is not a valid QS Studio symbol file.');
      _cEnsureCustomTab();
      cEdSetGroup('Custom');
      const st=document.getElementById('cEdStatus');
      if(st) st.textContent=symbols.length===1
        ? `${symbols[0].label} imported. Click it in the Custom palette to place it.`
        : `${symbols.length} custom symbols imported. Click one in the Custom palette to place it.`;
    }catch(error){
      showNotice(error?.message||'Could not import this symbol file.','Circuit Editor');
    }finally{
      event.target.value='';
    }
  };
  reader.readAsText(file);
}

async function cEdLoadLocalSymbolLibrary(){
  try{
    const response=await fetch(`custom-symbols/library.json?${Date.now()}`,{cache:'no-store'});
    if(!response.ok) throw new Error('The local symbol library was not found.');
    const library=await response.json();
    const count=_cRegisterCustomSymbolBundle(library,true).length;
    _cEnsureCustomTab();
    cEdSetGroup('Custom');
    const st=document.getElementById('cEdStatus');
    if(st) st.textContent=count?`${count} custom symbol${count===1?'':'s'} loaded from library.`:'No symbols found in the local library.';
  }catch(_){
    showNotice('Could not load custom-symbols/library.json. Open QS Studio through its local server, then save a symbol to the library first.','Circuit Editor');
  }
}

function cEdDeleteCustomSymbol(id){
  const index=CIRC_SYMBOLS.findIndex(symbol=>symbol.id===id&&symbol.group==='Custom');
  if(index<0) return;
  const symbol=CIRC_SYMBOLS[index];
  askConfirm(`Delete ${symbol.label} from the custom symbol library?`,async()=>{
    let removedFromFolder=false;
    if(window.showDirectoryPicker){
      try{
        const root=await window.showDirectoryPicker({mode:'readwrite'});
        const directory=await root.getDirectoryHandle('custom-symbols');
        const key=String(symbol.libraryKey||symbol.id).replace(/[^a-z0-9_]+/gi,'_');
        try{await directory.removeEntry(`${key}.qs-symbol.json`);}catch(_){ }
        const handle=await directory.getFileHandle('library.json',{create:true});
        let library={version:1,symbols:[]};
        try{library=JSON.parse(await (await handle.getFile()).text());}catch(_){ }
        const list=Array.isArray(library.symbols)?library.symbols:[];
        library.symbols=list.filter(item=>item&&item.libraryKey!==symbol.libraryKey&&item.id!==symbol.id);
        const writer=await handle.createWritable();
        await writer.write(JSON.stringify({version:1,symbols:library.symbols},null,2));
        await writer.close();
        removedFromFolder=true;
      }catch(error){
        if(error?.name==='AbortError') return;
        showNotice('The selected folder could not be updated. The symbol was kept unchanged.','Circuit Editor');
        return;
      }
    }
    CIRC_SYMBOLS.splice(index,1);
    _cPersistCustomSymbols();
    cEdSetGroup('Custom');
    const st=document.getElementById('cEdStatus');
    if(st) st.textContent=removedFromFolder?`${symbol.label} deleted from the local library.`:`${symbol.label} removed from this browser library.`;
  });
}

function _cMouseMove(e){
  const raw=_cPt(e);
  const sp=_cSmartSnapPt(raw.x,raw.y);
  const prevHoverKey=_cHoverAnchor?.key || '';
  const nextHover=sp.portRef || null;
  const nextAnchor=(sp.kind==='port' && sp.portRef) ? sp.portRef : ((sp.kind==='wire-node' || sp.kind==='wire-segment') ? sp.wireRef : null);
  const nextHoverKey=sp.key || '';
  _cMousePt={x:sp.x,y:sp.y};
  _cHoverPort=nextHover;
  _cHoverAnchor=nextAnchor;
  const prev=document.getElementById('cEdWirePrev');
  if(_cTool!=='wire') return;
  if(prev && _cWireStart){
    prev.innerHTML=`
      <path d="${_cWirePath({x1:_cWireStart.x,y1:_cWireStart.y,x2:sp.x,y2:sp.y})}" fill="none" stroke="#1f57a4" stroke-width="3.1" stroke-dasharray="7,4" opacity="0.72" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${_cWireStart.x}" cy="${_cWireStart.y}" r="4" fill="#1f57a4" opacity="0.5"/>
      <circle cx="${sp.x}" cy="${sp.y}" r="3" fill="#1f57a4" opacity="0.4"/>
    `;
  }
  _cPaintWireCursor();
  const hoverChanged=prevHoverKey!=nextHoverKey;
  if(hoverChanged) _cRequestDraw();
}

function _cDblClick(e){
  if(_cTool!=='wire') return;
  e.preventDefault();
  e.stopPropagation();
  _cCancelWireMode(true);
}

function _cKeyDown(e){
  if(e.key==='Escape'){
    if(_cTool==='wire' || _cWireStart) _cCancelWireMode(true);
    else cEdSetTool('select');
  }
  if((e.key==='Delete'||e.key==='Backspace')&&_cSelUid){ cEdDelete(); e.preventDefault(); }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  DRAW  â€” full redraw with fresh event bindings (no stacking)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function _cDraw(){
  const wl=document.getElementById('cEdWires');
  const cl=document.getElementById('cEdComps');
  const tl=document.getElementById('cEdTexts');
  const cur=document.getElementById('cEdCursor');
  if(!wl||!cl||!tl||!cur) return;

  // â”€â”€ wires â”€â”€
  const wireSvg=_cWires.map(w=>{
    _cInitWireGeometry(w);
    const sel=_cSelBox===null && w.uid===_cSelUid;
    const bend=_cWireBendHandle(w);
    return `<g>
      <path data-cwire="${w.uid}" d="${_cWirePath(w)}"
        fill="none" stroke="${sel?'#1f57a4':'#111'}" stroke-width="${sel?3.8:3.15}" stroke-linecap="round" stroke-linejoin="round"
        style="pointer-events:stroke;cursor:pointer"/>
      ${sel ? `<circle data-cwire-end="${w.uid}:start" cx="${w.x1}" cy="${w.y1}" r="5.2" fill="#fff" stroke="#1f57a4" stroke-width="2" style="cursor:move"/>
      <circle data-cwire-end="${w.uid}:end" cx="${w.x2}" cy="${w.y2}" r="5.2" fill="#fff" stroke="#1f57a4" stroke-width="2" style="cursor:move"/>
      <rect data-cwire-bend="${w.uid}" x="${bend.x-5}" y="${bend.y-5}" width="10" height="10" rx="2" fill="#1f57a4" stroke="#ffffff" stroke-width="1.4" style="cursor:${bend.axis==='x'?'ew-resize':(bend.axis==='y'?'ns-resize':'move')}"/>` : ''}
    </g>`;
  }).join('');
  const nodeSvg=_cConnectionNodes().map(n=>
    `<circle cx="${n.x}" cy="${n.y}" r="3.2" fill="#111" stroke="#fff" stroke-width="0.8" style="pointer-events:none"/>`
  ).join('');
  const hoverNode=(_cTool==='wire' && _cHoverAnchor && _cHoverAnchor.kind!=='port')
    ? `<circle cx="${_cMousePt.x}" cy="${_cMousePt.y}" r="5.8" fill="rgba(217,119,6,0.18)" stroke="#d97706" stroke-width="2" style="pointer-events:none"/>`
    : '';
  wl.innerHTML=wireSvg+nodeSvg+hoverNode;

  // â”€â”€ components â”€â”€
  cl.innerHTML=_cComps.map(comp=>{
    const sel=_cSelBox===null && comp.uid===_cSelUid;
    const nameSel=_cSelBox===`${comp.uid}:name`;
    const legendSel=_cSelBox===`${comp.uid}:legend`;
    const scale=_cCompScale(comp);
    const localSelBox=_cCompLocalBox(comp,10/Math.max(0.25,scale));
    const selBox=sel?`<rect
      x="${localSelBox.x}" y="${localSelBox.y}"
      width="${localSelBox.w}" height="${localSelBox.h}"
      fill="rgba(31,87,164,0.07)" stroke="#1f57a4" stroke-width="1.5" stroke-dasharray="5,3" rx="5"
      style="pointer-events:none"/>`:'' ;
    return `<g data-ccomp="${comp.uid}"
      transform="translate(${comp.x},${comp.y}) rotate(${comp.rot}) scale(${_cCompScale(comp)})"
      style="cursor:${_cTool==='wire'?'crosshair':'move'}">
      ${selBox}
      ${comp.sym.group==='Custom' ? comp.sym.svgFn(sel,comp.uid) : _cBoostStrokeMarkup(comp.sym.svgFn(sel), 1.85, 5.9)}
      ${comp.sym.sourceSvgInner ? '' : _cCustomTextSvg(comp)}
      ${_cCompTextBoxSvg(comp,'name',nameSel)}
      ${_cCompTextBoxSvg(comp,'legend',legendSel)}
      ${_cTool==='wire' ? (comp.sym.ports||[]).map(p=>{
        const lp=_cPortRenderLocal(comp,p);
        const hover=_cHoverPort && _cHoverPort.comp?.uid===comp.uid && _cHoverPort.port?.id===p.id;
        return `<circle cx="${lp.x}" cy="${lp.y}" r="${hover?6.8:4.4}" fill="${hover?'#006dff':'#1f57a4'}" opacity="${hover?0.98:0.68}" stroke="${hover?'#b9dcff':'#ffffff'}" stroke-width="${hover?2.3:0.8}" style="pointer-events:none"/>`;
      }).join('') : ''}
    </g>`;
  }).join('');

  // â”€â”€ labels â”€â”€
  tl.innerHTML=_cTexts.map(t=>{
    const sel=_cSelBox===null && t.uid===_cSelUid;
    return _cFreeTextBoxSvg(t, sel);
  }).join('');

  _cPaintWireCursor();

  // â”€â”€ bind events fresh (no accumulation) â”€â”€
  // Use setTimeout so the DOM has updated before we query
  setTimeout(()=>{
    // Imported SVG-maker text remains a separate editable SVG layer.
    document.querySelectorAll('[data-ccustomtext]').forEach(el=>{
      el.addEventListener('pointerdown',e=>{
        if(_cTool==='wire') return;
        e.preventDefault();
        e.stopPropagation();
        const uid=String(el.getAttribute('data-ccustomtext')||'').split(':')[0];
        _cSelUid=uid;
        _cSelBox=null;
        _cDraw();
      },{passive:false});
      el.addEventListener('dblclick',e=>{
        if(_cTool==='wire'){ _cDblClick(e); return; }
        e.preventDefault();
        e.stopPropagation();
        const [uid,indexRaw]=String(el.getAttribute('data-ccustomtext')||'').split(':');
        const comp=_cComps.find(item=>item.uid===uid);
        const text=comp?.customTexts?.[Number(indexRaw)];
        if(!text) return;
        _cOpenLabelEditor({
          title:'Edit Imported Symbol Text',
          initialHtml:_cSvgEsc(text.text||''),
          initialAlign:'left',
          onApply:({html,text:plain})=>{
            text.text=_cCustomTextValue(plain||text.text);
            text.bold=/(?:<b\b|<strong\b)/i.test(html||'');
            text.italic=/(?:<i\b|<em\b)/i.test(html||'');
            _cDraw();
          }
        });
      });
    });
    // Component drag + select
    document.querySelectorAll('[data-ccomp]').forEach(el=>{
      el.addEventListener('pointerdown',_cCompDown,{passive:false});
      el.addEventListener('dblclick',(e)=>{
        if(_cTool==='wire'){ _cDblClick(e); return; }
        e.stopPropagation();
        const uid=el.getAttribute('data-ccomp');
        const comp=_cComps.find(c=>c.uid===uid); if(!comp) return;
        const editName=_cCompHasNameBox(comp);
        _cOpenLabelEditor({
          title:editName ? 'Edit Symbol Text' : 'Edit Symbol Legend',
          initialHtml:editName ? (comp.nameHtml || _cSvgEsc(comp.name || '')) : (comp.legendHtml || _cSvgEsc(comp.legend || '')),
          initialAlign:editName ? (comp.nameAlign || 'left') : (comp.legendAlign || 'left'),
          onApply:({html,text,align})=>{
            if(editName){
              comp.nameHtml=html;
              comp.name=text || '';
              comp.nameAlign=align || 'left';
            } else {
              comp.legendHtml=html;
              comp.legend=text || '';
              comp.legendAlign=align || 'left';
            }
            _cDraw();
          }
        });
      });
    });
    // Wire select
    document.querySelectorAll('[data-cwire]').forEach(el=>{
      el.addEventListener('pointerdown',_cWireDown,{passive:false});
      el.addEventListener('click',(e)=>{
        e.stopPropagation();
        if(_cTool!=='select') return;
        _cSelUid=el.getAttribute('data-cwire');
        _cSelBox=null;
        _cDraw();
      });
    });
    document.querySelectorAll('[data-cwire-end]').forEach(el=>{
      el.addEventListener('pointerdown',_cWireEndDown,{passive:false});
      el.addEventListener('click',(e)=>e.stopPropagation());
    });
    document.querySelectorAll('[data-cwire-bend]').forEach(el=>{
      el.addEventListener('pointerdown',_cWireBendDown,{passive:false});
      el.addEventListener('click',(e)=>e.stopPropagation());
    });
    // Text select + double-click edit
    document.querySelectorAll('[data-ctext]').forEach(el=>{
      el.addEventListener('pointerdown',_cFreeTextDown,{passive:false});
      el.addEventListener('click',(e)=>{
        e.stopPropagation();
        if(_cTool!=='select') return;
        _cSelUid=el.getAttribute('data-ctext');
        _cSelBox=null;
        _cDraw();
      });
      el.addEventListener('dblclick',(e)=>{
        if(_cTool==='wire'){ _cDblClick(e); return; }
        e.stopPropagation();
        const uid=el.getAttribute('data-ctext');
        const t=_cTexts.find(x=>x.uid===uid); if(!t) return;
        _cOpenLabelEditor({
          title:'Edit Circuit Label',
          initialHtml:t.html || _cSvgEsc(t.text),
          initialAlign:t.align || 'left',
          onApply:({html,text,align})=>{
            t.html=html;
            t.text=text || t.text;
            t.align=align || 'left';
            _cDraw();
          }
        });
      });
    });
    document.querySelectorAll('[data-ctexthandle]').forEach(el=>{
      el.addEventListener('pointerdown',_cFreeTextResizeDown,{passive:false});
      el.addEventListener('click',(e)=>{ e.stopPropagation(); });
      el.addEventListener('dblclick',(e)=>{ e.stopPropagation(); });
    });

    document.querySelectorAll('[data-ccompbox]').forEach(el=>{
      el.addEventListener('pointerdown',_cCompBoxDown,{passive:false});
      el.addEventListener('click',(e)=>{
        e.stopPropagation();
      });
      el.addEventListener('dblclick',(e)=>{
        if(_cTool==='wire'){ _cDblClick(e); return; }
        e.stopPropagation();
        const [uid,kind] = String(el.getAttribute('data-ccompbox')||'').split(':');
        const comp=_cComps.find(c=>c.uid===uid); if(!comp) return;
        const isLegend = kind==='legend';
        _cOpenLabelEditor({
          title:isLegend ? 'Edit Symbol Legend' : 'Edit Symbol Text',
          initialHtml:isLegend ? (comp.legendHtml || _cSvgEsc(comp.legend || '')) : (comp.nameHtml || _cSvgEsc(comp.name || '')),
          initialAlign:isLegend ? (comp.legendAlign || 'left') : (comp.nameAlign || 'left'),
          onApply:({html,text,align})=>{
            if(isLegend){
              comp.legendHtml=html;
              comp.legend=text || '';
              comp.legendAlign=align || 'left';
            } else {
              comp.nameHtml=html;
              comp.name=text || '';
              comp.nameAlign=align || 'left';
            }
            _cDraw();
          }
        });
      });
    });
    document.querySelectorAll('[data-cboxhandle]').forEach(el=>{
      el.addEventListener('pointerdown',_cCompBoxResizeDown,{passive:false});
      el.addEventListener('click',(e)=>{ e.stopPropagation(); });
      el.addEventListener('dblclick',(e)=>{ e.stopPropagation(); });
    });
  },0);
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  DRAG COMPONENTS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function _cCompDown(e){
  if(_cTool!=='select') return;
  if(e.target.closest('[data-ccompbox]') || e.target.closest('[data-cboxhandle]')) return;
  e.preventDefault();
  e.stopPropagation();

  const el=e.currentTarget;
  const uid=el.getAttribute('data-ccomp');
  _cSelUid=uid;

  // Update selection box immediately without full redraw
  document.querySelectorAll('[data-ccomp]').forEach(g=>{
    const sel=g.getAttribute('data-ccomp')===uid;
    // Toggle first child (selBox rect) visibility â€” simplest: just redraw
  });
  _cDraw();

  const comp=_cComps.find(c=>c.uid===uid);
  if(!comp) return;

  const svg=document.getElementById('cEdSvg');
  const svgR=svg.getBoundingClientRect();
  const sx=_cW/Math.max(1,svgR.width), sy=_cH/Math.max(1,svgR.height);

  const ox=comp.x, oy=comp.y;
  let lastX=comp.x, lastY=comp.y;
  const startCX=e.clientX, startCY=e.clientY;

  // Try pointer capture on the SVG itself to avoid losing events
  try{ svg.setPointerCapture(e.pointerId); }catch(_){}

  function onMove(ev){
    const dx=(ev.clientX-startCX)*sx;
    const dy=(ev.clientY-startCY)*sy;
    comp.x=_cSnap(ox+dx);
    comp.y=_cSnap(oy+dy);
    _cRefreshAttachedWireEndpoints(comp, lastX, lastY);
    lastX=comp.x; lastY=comp.y;
    _cRequestDraw();
  }
  function onUp(ev){
    try{ svg.releasePointerCapture(ev.pointerId); }catch(_){}
    window.removeEventListener('pointermove',onMove);
    window.removeEventListener('pointerup',onUp);
    _cDraw(); // full redraw once on drop
  }
  window.addEventListener('pointermove',onMove);
  window.addEventListener('pointerup',onUp);
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  TOOLBAR ACTIONS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function cEdScaleComp(delta){
  const comp=_cComps.find(c=>c.uid===_cSelUid);
  if(!comp){ const st=document.getElementById('cEdStatus'); if(st) st.textContent='Select a component first to scale.'; return; }
  const oldScale=_cCompScale(comp);
  comp.scale=Math.max(0.25, Math.min(2.5, Number((_cCompScale(comp)+delta).toFixed(2))));
  _cRefreshAttachedWireEndpoints(comp, comp.x, comp.y, comp.rot||0, oldScale);
  comp.nameBox=null; comp.legendBox=null;
  _cDraw();
}

function cEdRotate(dir){
  const comp=_cComps.find(c=>c.uid===_cSelUid);
  if(comp){
    const oldRot=comp.rot||0;
    comp.rot=(comp.rot+dir*90+360)%360;
    _cRefreshAttachedWireEndpoints(comp, comp.x, comp.y, oldRot, _cCompScale(comp));
    _cDraw();
    return;
  }
  const st=document.getElementById('cEdStatus');
  if(st) st.textContent='Select a component first to rotate.';
}

function cEdDelete(){
  if(!_cSelUid && !_cSelBox){ const st=document.getElementById('cEdStatus'); if(st) st.textContent='Select something first.'; return; }
  if(_cSelBox){ const st=document.getElementById('cEdStatus'); if(st) st.textContent='Select the symbol body or a free label to delete items.'; return; }
  _cComps =_cComps.filter(c=>c.uid!==_cSelUid);
  _cWires =_cWires.filter(w=>w.uid!==_cSelUid);
  _cTexts =_cTexts.filter(t=>t.uid!==_cSelUid);
  _cSelUid=null;
  _cSelBox=null;
  _cDraw();
}

function cEdUndo(){
  if(_cWireStart){
    _cCancelWireMode(false);
    return;
  }
  if(_cTexts.length){ _cTexts.pop(); _cDraw(); return; }
  if(_cWires.length){ _cWires.pop(); _cDraw(); return; }
  if(_cComps.length){ _cComps.pop(); _cDraw(); return; }
  toast('Nothing to undo');
}

function cEdClear(){
  if(!_cComps.length&&!_cWires.length&&!_cTexts.length){ toast('Already empty'); return; }
  askConfirm('Clear all components, wires and labels?',()=>{
    _cComps=[];_cWires=[];_cTexts=[];
    _cSelUid=null;_cSelBox=null;_cWireStart=null;
    const p=document.getElementById('cEdWirePrev'); if(p) p.innerHTML='';
    _cDraw();
  });
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  APPLY â€” preserve SVG + editable scene â†’ placed vector figure
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function cEdApply(){
  if(!_cComps.length&&!_cWires.length&&!_cTexts.length){
    showNotice('Nothing drawn yet.','Circuit Editor'); return;
  }
  const key=_cTargetKey;
  const cv=document.getElementById(key+'Canvas');
  if(!cv){ showNotice('Target canvas not found.','Circuit Editor'); return; }

  _cSelUid=null;
  const preserveEditorTopLeft=_cComps.some(c=>_cSymTopLeftAnchored(c.sym));
  const PAD=preserveEditorTopLeft ? 8 : 34;
  // Tight bounding box
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  _cComps.forEach(c=>{
    const box=_cCompWorldBox(c,14/Math.max(0.25,_cCompScale(c)));
    x0=Math.min(x0,box.x); y0=Math.min(y0,box.y);
    x1=Math.max(x1,box.x+box.w); y1=Math.max(y1,box.y+box.h);
  });
  _cWires.forEach(w=>{
    x0=Math.min(x0,Math.min(w.x1,w.x2));
    y0=Math.min(y0,Math.min(w.y1,w.y2));
    x1=Math.max(x1,Math.max(w.x1,w.x2));
    y1=Math.max(y1,Math.max(w.y1,w.y2));
  });
  _cTexts.forEach(t=>{
    _cNormFreeTextBox(t);
    x0=Math.min(x0,t.x);
    y0=Math.min(y0,t.y);
    x1=Math.max(x1,t.x+Math.max(90,t.w||120));
    y1=Math.max(y1,t.y+Math.max(20,t.h||24));
  });
  if(!isFinite(x0)){ x0=0;y0=0;x1=_cW;y1=_cH; }

  const vx=x0-PAD;
  const vy=y0-PAD;
  const vw=x1-x0+PAD*2;
  const vh=y1-y0+PAD*2;

  const wSVG=_cWires.map(w=>
    `<path d="${_cWirePath(w)}" fill="none" stroke="#111" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>`
  ).join('');
  const nSVG=_cConnectionNodes().map(n=>
    `<circle cx="${n.x}" cy="${n.y}" r="3.2" fill="#111" stroke="#fff" stroke-width="0.65"/>`
  ).join('');
  const cSVG=_cComps.map(c=>{
    const nameSvg=_cCompTextExportSvg(c,'name');
    const legendSvg=_cCompTextExportSvg(c,'legend');
    // Match the editor's built-in-symbol stroke transform exactly. A different
    // export multiplier makes component bodies jump thinner/thicker beside wires.
    const symSvg=c.sym.group==='Custom'
      ? c.sym.svgFn(false,c.uid)
      : _cBoostStrokeMarkup(c.sym.svgFn(false), 1.85, 5.9);
    return `<g transform="translate(${c.x},${c.y}) rotate(${c.rot}) scale(${_cCompScale(c)})">${symSvg}${c.sym.sourceSvgInner ? '' : _cCustomTextSvg(c)}${nameSvg}${legendSvg}</g>`;
  }).join('');
  const tSVG=_cTexts.map(t=>_cFreeTextExportSvg(t)).join('');

  const svgStr=`<svg xmlns="http://www.w3.org/2000/svg" width="${vw}" height="${vh}" viewBox="${vx} ${vy} ${vw} ${vh}" preserveAspectRatio="xMinYMin meet" shape-rendering="geometricPrecision" text-rendering="geometricPrecision" color-rendering="optimizeQuality">
    <rect width="100%" height="100%" fill="#fff"/>
    ${wSVG}${nSVG}${cSVG}${tSVG}
  </svg>`;
  const targetW=preserveEditorTopLeft ? Math.max(160,(cv.width||640)-16) : 1360;
  const targetH=preserveEditorTopLeft ? Math.max(120,(cv.height||360)-16) : 1040;
  const fitScale=Math.min(1, targetW/Math.max(1,vw), targetH/Math.max(1,vh));
  const dw=Math.max(1,Math.round(vw*fitScale)), dh=Math.max(1,Math.round(vh*fitScale));
  const vectorDataUrl=_cSvgDataUrl(svgStr);
  const scene=_cCaptureScene();
  const editingIndex=_cEditingFigureIndex;
  const previousFigure=editingIndex>=0 ? (getFigureStore(key)||[])[editingIndex] : null;
  const figImg=new Image();
  figImg.onload=()=>{
    figImg.dataset.logicalWidth=String(dw);
    figImg.dataset.logicalHeight=String(dh);
    closeModal();
    openImagePlacementBox(key, figImg, {
      mode:editingIndex>=0 ? 'replace' : 'insert',
      figureIndex:editingIndex>=0 ? editingIndex : null,
      logicalWidth:dw,
      logicalHeight:dh,
      preferredPlacement:previousFigure ? {x:previousFigure.x,y:previousFigure.y,w:previousFigure.w,h:previousFigure.h,crop:previousFigure.crop} : (preserveEditorTopLeft ? {x:0,y:0,w:dw,h:dh,crop:{l:0,t:0,r:0,b:0}} : null),
      figureMetadata:{
        kind:'circuit-svg',
        circuitScene:scene,
        sourceSvg:svgStr,
        sourceViewBox:{x:vx,y:vy,w:vw,h:vh},
        naturalWidth:vw,
        naturalHeight:vh,
        displayWidth:dw,
        displayHeight:dh,
        alignment:preserveEditorTopLeft?'editor-top-left':'tight'
      }
    });
    toast(editingIndex>=0 ? 'Circuit updated. Apply to keep it in the same frame position.' : 'Vector circuit ready — drag/resize it, then Apply. Double-click it later to edit.');
  };
  figImg.onerror=()=>showNotice('Vector circuit could not be prepared in this browser.','Circuit Editor');
  figImg.src=vectorDataUrl;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  GLOBAL EXPOSURE
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
window.openCircuitEditor = openCircuitEditor;
window.openCircuitFigureEditor = openCircuitFigureEditor;
window.cEdSetGroup       = cEdSetGroup;
window.cEdSetTool        = cEdSetTool;
window.cEdSetGrid        = cEdSetGrid;
window.cEdZoom           = cEdZoom;
window.cEdSetZoom        = cEdSetZoom;
window.cEdToggleExpand   = cEdToggleExpand;
window.cEdFlipWire       = cEdFlipWire;
window.cEdScaleComp      = cEdScaleComp;
window.cEdPlace          = cEdPlace;
window.cEdRotate         = cEdRotate;
window.cEdDelete         = cEdDelete;
window.cEdUndo           = cEdUndo;
window.cEdClear          = cEdClear;
window.cEdApply          = cEdApply;

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  AUTO-INJECT Circuit Fig button into every canvas toolbar
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
(function(){
  function _inject(){
    function add(el,key){
      if(!el||el.querySelector('.circ-inject-btn')) return;
      const b=document.createElement('button');
      b.type='button'; b.className='tool-btn circ circ-inject-btn';
      b.textContent='Circuit Fig'; b.title='Open the circuit figure panel or edit the selected vector figure';
      b.onclick=()=>openCircuitEditorForSelection(key);
      el.appendChild(b);
    }
    add(document.getElementById('qTools'),'q');
    for(let i=0;i<4;i++) add(document.getElementById('opt'+i+'Tools'),'opt'+i);
  }
  const mo=new MutationObserver(_inject);
  mo.observe(document.body,{childList:true,subtree:true});
  setTimeout(_inject,0);
})();

