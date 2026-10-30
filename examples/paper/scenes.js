// "The Last Night of the Lighthouse Keeper": the paper style example (engine/styles/paper.js, window.Paper).
//   lamp  (L0-L1): a cut-paper night seascape, the lighthouse lamp ignites and its beam sweeps the sea; paper title, night counter
//   last  (L2):    he climbs the tower stairs in a shaft of light, then a profile close-up as the great lens glows
//   shore (L3-L4): from the gallery, the whole village lights candles along the shore; he raises a hand
// Every scene is a stack of paper layers moved by Paper.camera (parallax). Moving things are redrawn every frame by live().
window.buildEpisode = (world, S) => {
  const P = window.Paper, { E, f, clamp, rng } = P, { T, eout, eio } = S;
  const back = x => { x = clamp(x); return 1 + 2.7 * Math.pow(x - 1, 3) + 1.7 * Math.pow(x - 1, 2); };
  const win = id => [S.sceneById[id].start, S.sceneById[id].end];
  // a group cleared and redrawn every frame while its scene is on (paper shapes are cheap to rebuild)
  const live = (id, parent, fn) => {
    const g = E('g', {}, parent), [a, b] = win(id);
    S.ups.push(t => { if (t < a || t >= b) return; while (g.firstChild) g.firstChild.remove(); fn(g, t); });
    return g;
  };
  const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const CREAM = [[0, '#f7eedb'], [1, '#e3d2ae']], INK = '#1a1626', WARM = '#ffd97a';
  // the keeper's look for the Toon rig: a cap, a beard, long trousers (all black under the silhouette filter)
  const KEEPER = { cap: '#000', beard: true, legs: 'pants', build: 1.1 };
  const op = x => f(clamp(x) * 100) / 100;

  // a paper card with a word on it, scaling in with a small overshoot (k 0..1)
  function card(g, k, x0, y0, x1, y1, text, size, o = {}) {
    if (k <= 0) return;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, s = back(k);
    const grp = E('g', { transform: `translate(${cx} ${cy}) rotate(${o.rot ?? -2}) scale(${s.toFixed(3)}) translate(${-cx} ${-cy})` }, g);
    P.layer(grp, rect(x0, y0, x1, y1), '#efe2c6', { amp: 3.5, seed: o.seed ?? 9, grad: CREAM });
    P.word(grp, cx, cy + size * .36, text, size, o.fill || INK, { shadow: false, italic: o.italic, font: o.font, weight: o.weight, ls: o.ls });
  }
  // the caption zone: a soft dark band so the words always read
  const band = g => E('rect', { y: 1220, width: 1080, height: 700, fill: P.grad(g, 'lin', [[0, '#05070f', 0], [.35, '#05070f', .7], [1, '#05070f', .92]]) }, g);
  // sea: wavy paper strips from y0 down, rocking with t
  function sea(g, t, y0, rows, gap, cols, seed) {
    for (let i = 0; i < rows; i++) {
      const y = y0 + i * gap, ph = i * 1.3;
      P.layer(g, P.ridge(-80, 1160, 1960, x => y + 7 * Math.sin(x / 80 + t * 1.3 + ph) + 4 * Math.sin(x / 31 - t * .8), 40),
        cols[i % cols.length], { amp: 2.5, seed: seed + i, small: true, edge: 'rgba(200,220,255,.18)' });
    }
  }
  // the lighthouse body (static): base at (x, y), 575 units tall at s = 1, the lamp at (x, y - 486 s)
  function lighthouse(g, x, y, s) {
    const grp = E('g', { transform: `translate(${x} ${y}) scale(${s})` }, g);
    const hw = yy => 62 - 20 * (-yy / 440);
    for (let i = 0; i < 5; i++) {
      const y0 = -i * 88, y1 = -(i + 1) * 88;
      P.layer(grp, [[-hw(y0), y0], [hw(y0), y0], [hw(y1), y1], [-hw(y1), y1]], '#888', {
        amp: 1.2, seed: 20 + i, small: true, edge: 'rgba(255,240,210,.25)',
        grad: i % 2 ? [[0, '#6e2a33'], [1, '#3a1520']] : [[0, '#a59fa8'], [1, '#5c5868']] });
    }
    E('path', { d: 'M -14 0 L -14 -46 Q 0 -60 14 -46 L 14 0 Z', fill: '#0b1020' }, grp);
    P.layer(grp, rect(-70, -452, 70, -440), '#1b1d2c', { amp: 1, seed: 26, small: true });
    for (let x = -64; x <= 64; x += 16) E('rect', { x: x - 1.5, y: -474, width: 3, height: 22, fill: '#1b1d2c' }, grp);
    E('rect', { x: -70, y: -476, width: 140, height: 4, fill: '#1b1d2c' }, grp);
    P.layer(grp, 'M -50 -520 L 0 -572 L 50 -520 Z', '#2a1a22', { small: true, edge: 'rgba(255,217,122,.35)' });
    E('circle', { cx: 0, cy: -578, r: 7, fill: '#2a1a22' }, grp);
    return grp;
  }
  // the lamp room glass, lit 0..1 (drawn over the body every frame)
  function lamp(g, x, y, s, lit, t) {
    const lx = x, ly = y - 486 * s, fl = .92 + .08 * Math.sin(t * 9);
    E('rect', { x: f(lx - 40 * s), y: f(y - 520 * s), width: f(80 * s), height: f(68 * s), fill: lit > 0 ? '#ffe6a8' : '#20263a', opacity: op(.25 + .75 * lit) }, g);
    for (const dx of [-20, 0, 20]) E('rect', { x: f(lx + (dx - 1.5) * s), y: f(y - 520 * s), width: f(3 * s), height: f(68 * s), fill: '#1b1d2c' }, g);
    if (lit > 0) { P.glow(g, lx, ly, 380 * s, WARM, .9 * lit * fl); P.glow(g, lx, ly, 120 * s, '#fff6dc', lit); }
    return [lx, ly];
  }

  // ================================================================ lamp: the beam over a paper sea
  {
    const sc = S.scene(world, 'lamp', 'cut'), [a, b] = win('lamp');
    const L = ['sky', 'far', 'seaB', 'cliff', 'near'].map(() => E('g', {}, sc.cam));
    const [sky, far, seaB, cliff, near] = L;
    E('rect', { x: -200, y: -200, width: 1480, height: 2320, fill: P.grad(sky, 'lin', [[0, '#070b1c'], [.45, '#15204a'], [.55, '#2b3160'], [1, '#0b1020']]) }, sky);
    const R = rng(4);
    for (let i = 0; i < 90; i++) E('circle', { cx: f(R() * 1080), cy: f(R() * 900), r: f(.8 + R() * 2.2), fill: '#f6efd8', opacity: f(.2 + R() * .6) }, sky);
    P.layer(far, P.ridge(-120, 560, 1060, x => 985 - 40 * Math.exp(-(((x - 160) / 180) ** 2)) - 10 * Math.sin(x / 50), 24), '#1a2142', { amp: 2, seed: 31 });
    live('lamp', seaB, (g, t) => {
      sea(g, t, 1000, 6, 52, ['#1d2a55', '#18244a', '#142040', '#101a36'], 40);
      // where the beam touches the water
      const ang = 180 + 26 * Math.sin((t - a) * 1.1 - .6), lit = clamp((t - .1) / .5);
      if (lit > 0) P.glow(g, 800 + Math.cos(ang * Math.PI / 180) * 520, 1080, 240, WARM, .35 * lit);
    });
    P.layer(cliff, [[470, 1400], [520, 1190], [600, 1120], [660, 1090], [720, 1080], [1160, 1070], [1160, 1400]], '#10172c',
      { amp: 5, seed: 51, grad: [[0, '#222a46'], [1, '#0a0f1e']] });
    lighthouse(cliff, 800, 1082, .95);
    live('lamp', cliff, (g, t) => {
      const lit = clamp((t - .1) / .5);
      const [lx, ly] = lamp(g, 800, 1082, .95, lit, t);
      const ang = 180 + 26 * Math.sin((t - a) * 1.1 - .6);
      if (lit > 0) {
        P.rays(g, lx, ly, ang, 9, 1500, 6, '#ffe6a8', .42 * lit, t, 3);
        P.rays(g, lx, ly, ang + 180, 9, 500, 4, '#ffe6a8', .25 * lit, t, 5);
        P.dust(g, t, 34, [lx - 300, ly - 220, 560, 440], '#fff6d6', 6, { op: .55 * lit, size: 2.6 });
      }
      // the keeper, tiny on the gallery
      P.figure(g, Object.assign({}, window.Toon.P.stand, { turn: .3 }), 852, 1082 - 440 * .95, { s: .13, dir: -1, look: KEEPER, filter: P.silFilter(g, '#0b1020', WARM, -2, -2, 1) });
    });
    live('lamp', near, (g, t) => {
      sea(g, t, 1300, 3, 70, ['#0e1730', '#0b132a', '#081022'], 60);
    });
    P.layer(near, [[-80, 1960], [-80, 1360], [90, 1320], [210, 1380], [330, 1460], [380, 1960]], '#070b16', { amp: 6, seed: 71 });
    P.layer(near, [[760, 1960], [840, 1450], [960, 1390], [1160, 1360], [1160, 1960]], '#070b16', { amp: 6, seed: 72 });
    band(near);
    S.ups.push(t => { if (t >= a && t < b) P.camera(L.map((g, i) => [g, [6, 4, 2.6, 1.6, 1][i]]), eio(S.prog(t, a, b)), 800, 640, .12, [-30, 20]); });
    // titles: outside the camera, on top of the light
    live('lamp', sc.svg, (g, t) => {
      card(g, clamp((t - T('L0%28')) / .45), 120, 220, 960, 410, 'FORTY YEARS', 104, { seed: 11 });
      const k = clamp((t - T('L1')) / .35);
      if (k > 0) {
        const n = Math.round(1 + 14609 * eio(S.prog(t, 'L1', 'L1e')));
        card(g, k, 300, 450, 780, 530, `${n.toLocaleString('en-US')} NIGHTS`, 44, { seed: 12, rot: 2, font: 'Anton', weight: 400, ls: 3, fill: '#6e2a33' });
      }
    });
  }

  // ================================================================ last: up the stairs, then the lens
  {
    const sc = S.scene(world, 'last', 'zoom'), [a, b] = win('last'), CUT = T('L2%46');
    const L = [0, 1, 2].map(() => E('g', {}, sc.cam));
    // shot A: a stair in a shaft of light from the lamp room above
    live('last', L[0], (g, t) => {
      if (t >= CUT) return;
      E('rect', { x: -200, y: -200, width: 1480, height: 2320, fill: P.grad(g, 'lin', [[0, '#2a2a40'], [.5, '#151a2e'], [1, '#080b16']]) }, g);
      P.layer(g, 'M 150 520 L 150 330 Q 200 250 250 330 L 250 520 Z', '#22305e', { grad: [[0, '#3a4a80'], [1, '#18224a']], small: true });
      for (let i = 0; i < 7; i++) P.layer(g, rect(-40, 140 + i * 230, 1120, 150 + i * 230), '#1c2236', { amp: 2, seed: 100 + i, shadow: false, edge: 'rgba(255,240,210,.08)' });
      P.glow(g, 760, 160, 640, WARM, .75);
      P.rays(g, 760, -80, 104, 34, 1700, 9, '#ffe6a8', .2, t, 7);
    });
    live('last', L[1], (g, t) => {
      if (t >= CUT) return;
      const pts = [[-80, 1960], [-80, 1400]];
      for (let i = 0; i < 10; i++) { const x = 20 + i * 100, y = 1400 - i * 86; pts.push([x, y], [x + 100, y]); if (i < 9) pts.push([x + 100, y - 86]); }
      pts.push([1160, 626], [1160, 1960]);
      P.layer(g, pts, '#0f1426', { amp: 2, seed: 120, grad: [[0, '#2a3048'], [1, '#0b0f1c']], step: 22 });
      // hand rail along the nosing, balusters down to each step
      E('path', { d: 'M -40 1150 L 1100 170', stroke: '#0b0f1c', 'stroke-width': 10, 'stroke-linecap': 'round' }, g);
      for (let i = 0; i < 10; i++) E('rect', { x: 64 + i * 100, y: f(1150 - (104 + i * 100) * .86), width: 6, height: f(250), fill: '#0b0f1c' }, g);
      // the keeper climbs: a walk cycle with high knees, moving up the slope
      const k = S.prog(t, a, CUT), x = 160 + 420 * k, ph = (t - a) * 7;
      const cyc = window.Toon.cycle(ph, 1, 'walk');
      const pose = Object.assign({}, window.Toon.P.stand, cyc, { tor: 12, hd: -6, nth: cyc.nth + 22, fth: cyc.fth + 22, nsh: cyc.nsh - 26, fsh: cyc.fsh - 26, turn: .25 });
      P.figure(g, pose, x, 1400 - (x - 20) * .86 + 10, { s: .78, dir: 1, look: KEEPER, filter: P.silFilter(g, '#0b1020', WARM, 0, -4, 1.8) });
      P.dust(g, t, 40, [420, 120, 700, 1100], '#fff6d6', 8, { op: .5 });
      band(g);
    });
    // shot B: profile close-up, the big lens ignites
    live('last', L[0], (g, t) => {
      if (t < CUT) return;
      E('rect', { x: -200, y: -200, width: 1480, height: 2320, fill: P.grad(g, 'lin', [[0, '#0a0f24'], [.5, '#1a2550'], [1, '#070b16']]) }, g);
      sea(g, t, 980, 5, 60, ['#1d2a55', '#18244a', '#142040'], 140);
      for (const x of [80, 420, 760]) E('rect', { x, y: -200, width: 26, height: 2400, fill: '#070a14' }, g);
      E('rect', { x: -200, y: 1240, width: 1480, height: 30, fill: '#070a14' }, g);
    });
    live('last', L[1], (g, t) => {
      if (t < CUT) return;
      const lit = clamp((t - T('L2%58')) / .4), fl = .94 + .06 * Math.sin(t * 8);
      P.glow(g, 720, 760, 700, WARM, .55 * lit * fl);
      for (let i = 0; i < 6; i++) {
        const r = 240 - i * 38;
        E('ellipse', { cx: 860, cy: 760, rx: r * .82, ry: r, fill: P.grad(g, 'rad', [[0, '#fff3c8'], [.7, '#e8b860'], [1, '#8a5a2a']]), opacity: op(.35 + .6 * lit), stroke: '#5a3a1e', 'stroke-width': 3 }, g);
      }
      P.glow(g, 720, 760, 200, '#fff6dc', lit);
      if (lit > 0) P.rays(g, 720, 760, 186, 46, 1300, 9, '#ffe6a8', .24 * lit, t, 9);
      P.dust(g, t, 36, [260, 420, 640, 700], '#fff6d6', 4, { op: .55 * lit });
    });
    live('last', L[2], (g, t) => {
      if (t < CUT) return;
      E('rect', { x: -40, y: 1440, width: 690, height: 700, fill: '#0b1020' }, g); // the suit goes on below the frame
      P.profile(g, 330, 980, 1.55, { glint: '#fff1c4' });
      band(g);
    });
    live('last', sc.svg, (g, t) => card(g, clamp((t - T('L2%70')) / .4), 160, 220, 920, 400, 'LAST NIGHT', 104, { seed: 13, italic: true, rot: 2 }));
    S.ups.push(t => {
      if (t < a || t >= b) return;
      const shotA = t < CUT, k = shotA ? S.prog(t, a, CUT) : S.prog(t, CUT, b);
      P.camera(L.map((g, i) => [g, [3, 1.8, 1][i]]), eio(k), shotA ? 540 : 400, shotA ? 700 : 820, shotA ? .1 : .14, shotA ? [-40, 60] : [20, 0]);
    });
  }

  // ================================================================ shore: the village answers
  {
    const sc = S.scene(world, 'shore', 'zoom'), [a, b] = win('shore');
    const L = ['sky', 'hill', 'shoreL', 'front'].map(() => E('g', {}, sc.cam));
    const [sky, hill, shoreL, front] = L;
    const C0 = T('L3%22'), C1 = T('L3e');
    E('rect', { x: -200, y: -200, width: 1480, height: 2320, fill: P.grad(sky, 'lin', [[0, '#070b1c'], [.3, '#1a2148'], [.42, '#3a3358'], [1, '#0b1020']]) }, sky);
    const R = rng(8);
    for (let i = 0; i < 70; i++) E('circle', { cx: f(R() * 1080), cy: f(R() * 560), r: f(.8 + R() * 2), fill: '#f6efd8', opacity: f(.2 + R() * .5) }, sky);
    P.layer(sky, P.ridge(-120, 1200, 1100, x => 640 - 50 * Math.sin(x / 260 + 1) - 12 * Math.sin(x / 70), 24), '#1b2241', { amp: 2, seed: 81 });
    // the village on its hill: houses whose windows light up with the candles
    P.layer(hill, P.ridge(-120, 1200, 1100, x => 760 - 30 * Math.sin(x / 200), 24), '#232b4a', { amp: 2.5, seed: 82, grad: [[0, '#2d3558'], [1, '#141a30']] });
    const houses = [];
    for (let i = 0; i < 11; i++) {
      const x = 40 + i * 95 + (i % 3) * 12, w = 64 + (i % 2) * 20, h = 52 + (i * 7) % 26, y = 770 - 30 * Math.sin(x / 200) + (i % 2) * 14;
      P.layer(hill, [[x, y], [x, y - h], [x + w / 2, y - h - 34], [x + w, y - h], [x + w, y]], '#2f3554', { amp: 1.5, seed: 90 + i, small: true, grad: [[0, '#3c4368'], [1, '#232845']] });
      houses.push([x + w / 2 - 8, y - h + 14]);
    }
    live('shore', hill, (g, t) => {
      houses.forEach(([x, y], i) => {
        const k = clamp((t - C0 - .15 * i) / .3);
        if (k > 0) { E('rect', { x, y, width: 16, height: 20, fill: '#ffd98a', opacity: op(k) }, g); P.glow(g, x + 8, y + 10, 40, WARM, .6 * k); }
      });
    });
    // beach and sea; the villagers stand along the water with their candles
    P.layer(shoreL, P.ridge(-120, 1200, 1960, x => 860 + 18 * Math.sin(x / 300), 24), '#4a4458', { amp: 2.5, seed: 83, grad: [[0, '#6a6070'], [1, '#3a3448']] });
    const folk = [], RF = rng(12);
    for (let i = 0; i < 26; i++) folk.push([30 + i * 40 + (RF() - .5) * 14, 900 + 18 * Math.sin((30 + i * 40) / 300) + (RF() - .5) * 10, .1 + RF() * .03, RF() < .5 ? 1 : -1]);
    // light order: from the middle outwards, like a wave
    const order = folk.map((p, i) => [Math.abs(p[0] - 540), i]).sort((p, q) => p[0] - q[0]).map(p => p[1]);
    const litAt = []; order.forEach((i, r) => { litAt[i] = C0 + (C1 - C0) * .85 * r / folk.length; });
    live('shore', shoreL, (g, t) => {
      sea(g, t, 940, 6, 50, ['#16224a', '#132042', '#101b3a', '#0d1732'], 160);
      folk.forEach(([x, y, s], i) => {
        const k = clamp((t - litAt[i]) / .25);
        if (k <= 0) return;
        const fl = .85 + .15 * Math.sin(t * 11 + i * 2.3);
        E('ellipse', { cx: f(x), cy: f(y + 70 + 40), rx: 5, ry: 46, fill: '#ffd98a', opacity: op(.28 * k * fl) }, g);
      });
      folk.forEach(([x, y, s, d], i) => {
        const k = clamp((t - litAt[i]) / .25);
        const pose = Object.assign({}, window.Toon.P.stand, { turn: .5, nua: 6 + 40 * k, nfa: 14 + 60 * k, hd: 8 });
        const hand = P.figure(g, pose, x, y, { s, dir: d, filter: P.silFilter(g, '#0b1020', k > 0 ? WARM : '#3a4470', 0, -2, 1) }).toon.at('hand');
        if (k > 0) {
          const fl = .85 + .15 * Math.sin(t * 11 + i * 2.3);
          P.glow(g, hand[0], hand[1], 46, WARM, .8 * k * fl);
          E('circle', { cx: f(hand[0]), cy: f(hand[1]), r: 3, fill: '#fff6dc', opacity: op(k) }, g);
        }
      });
      const lit = clamp((t - C0) / (C1 - C0));
      P.dust(g, t, Math.round(50 * lit), [0, 560, 1080, 360], '#ffd98a', 9, { up: 34, op: .6, size: 2.4 });
    });
    // the gallery: the keeper at the rail, the lamp above him sweeps the sky
    live('shore', front, (g, t) => {
      const ang = 30 + 24 * Math.sin((t - a) * .9);
      P.rays(g, 90, -160, ang, 8, 1700, 5, '#ffe6a8', .2, t, 13);
      P.glow(g, 120, -60, 520, WARM, .5);
      const w = clamp((t - T('L4')) / .5), base = { tor: 6, hd: 20, nua: 22, nfa: 24, fua: 18, ffa: 28, turn: .2 };
      const wave = { tor: 0, hd: 4, nua: 126, nfa: 34 + 14 * Math.sin((t - T('L4')) * 5), fua: 18, ffa: 28, turn: .2, hand: 'open' };
      P.figure(g, window.Toon.mix(base, wave, eout(w)), 230, 1320, { s: 1.2, dir: 1, look: KEEPER, filter: P.silFilter(g, '#0b1020', WARM, -4, -4, 1.8) });
      E('rect', { x: -200, y: 1170, width: 1480, height: 16, fill: '#080b16' }, g);
      for (let x = -40; x < 1120; x += 74) E('rect', { x, y: 1170, width: 9, height: 150, fill: '#080b16' }, g);
      P.layer(g, rect(-120, 1310, 1200, 1980), '#070a14', { amp: 3, seed: 140 });
    });
    live('shore', sc.svg, (g, t) => card(g, clamp((t - T('L4+.2')) / .45), 170, 220, 910, 400, 'THANK YOU', 112, { seed: 14 }));
    S.ups.push(t => { if (t >= a && t < b) P.camera(L.map((g, i) => [g, [6, 3, 2, 1][i]]), eio(S.prog(t, a, b)), 600, 900, .1, [-20, -30]); });
  }
};
