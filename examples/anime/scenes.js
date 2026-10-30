// The Letter: an anime-style example (engine/styles/anime.js). A student opens the acceptance letter she waited a year for.
// Scenes: wait (worry, rain, the envelope), open (eye close-up, the letter slides out), joy (ACCEPTED, tears of joy).
// Every time is keyed to a voice line (L0 = line 0 starts, L3e = line 3 ends), so a re-voice keeps the cuts in sync.
window.buildEpisode = (world, S) => {
  const { E, scene, ov, camera, eout, clamp, T } = S;
  const { FX, INK } = Anime;
  const prog = (t, a, d) => clamp((t - T(a)) / d);
  const back = x => { x = clamp(x); const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };

  // anime.js has three hair styles (spiky, swept, buzz), all short. Long hair with bangs: subclass Bust and
  // override the three hair hooks. hairBack is drawn over the body and neck, hairFront over the face and brows.
  const { curvy, clip, P } = FX;
  // bangs, left to right: [x, y, sharp, tip]; tips hang to y -76..-92, notches rise to -134, the points between bow the clumps
  const BANGS = [];
  {
    const tips = [[-102, -84], [-58, -76], [-16, -82], [24, -92], [66, -76], [106, -82]];
    const notch = [[-82, -116], [-38, -126], [4, -134], [46, -126], [88, -118]];
    tips.forEach(([x, y], i) => {
      BANGS.push([x, y, 1, 1]);
      const n = notch[i];
      if (!n) return;
      BANGS.push([x + 2, n[1] + 8], [n[0], n[1], 1], [tips[i + 1][0] - 2, n[1] + 8]);
    });
  }
  class Girl extends Anime.Bust {
    hairBack(g, o) {
      const R = [[0, -250], [96, -238], [158, -170], [172, -40], [176, 120], [196, 260], [212, 364, 1], [170, 334], [150, 374, 1], [118, 332], [88, 356, 1], [72, 250], [66, 140]];
      const pts = R.concat([[0, 100]], R.slice(1).reverse().map(([x, y, s]) => [-x, y, s]));
      const d = curvy(pts);
      E('path', { d, fill: o.hair, stroke: INK, 'stroke-width': 3.5, 'stroke-linejoin': 'round' }, g);
      const hc = E('g', { 'clip-path': clip(g, d) }, g);
      E('path', { d: 'M 60 -300 C 150 -200 190 60 150 420 L 260 420 L 260 -300 Z', fill: o.hairS, opacity: .55 }, hc);
      E('path', { d: 'M -150 160 C -160 240 -150 300 -130 350 M 140 170 C 150 240 150 300 136 350', fill: 'none', stroke: o.hairS, 'stroke-width': 5, 'stroke-linecap': 'round' }, hc);
    }
    foreheadShadow(fc, o) {
      // the bangs cast their own shape a little lower on the forehead
      const d = 'M -130 -40 ' + BANGS.map(([x, y]) => `L ${x + 6} ${y + 18}`).join(' ') + ' L 130 -40 L 130 -280 L -130 -280 Z';
      E('path', { d, fill: o.skinS }, fc);
    }
    hairFront(g, o) {
      const pts = [[-112, 132, 1], [-128, 40], [-138, -60], [-142, -150], [-104, -226], [-40, -258], [0, -262], [40, -258], [104, -226], [142, -150], [138, -60], [128, 40], [112, 132, 1],
        [106, 60], [112, -30]].concat(BANGS.slice().reverse(), [[-112, -30], [-106, 60]]);
      const d = curvy(pts);
      E('path', { d, fill: o.hair, stroke: INK, 'stroke-width': 3.5, 'stroke-linejoin': 'round' }, g);
      const hc = E('g', { 'clip-path': clip(g, d) }, g);
      E('path', { d: 'M 50 -300 C 130 -250 160 -120 150 140 L 240 140 L 240 -300 Z', fill: o.hairS, opacity: .5 }, hc);
      BANGS.filter(p => p[3]).forEach(([x, y]) =>
        E('path', { d: P('M', x * .15, -252, 'Q', x * .7, -190, x, y + 6), fill: 'none', stroke: INK, 'stroke-width': 2.2, opacity: .4 }, hc));
      // the shiny "angel ring" highlight across the crown: a thin arc with a toothed lower edge
      let ring = 'M -112 -188';
      for (let x = -112; x <= 112; x += 8) ring += ` L ${x} ${(-188 - 44 * (1 - (x / 112) ** 2)).toFixed(1)}`;
      for (let x = 112, k = 0; x >= -112; x -= 14, k++) ring += ` L ${x} ${(-188 - 44 * (1 - (x / 112) ** 2) + (k % 2 ? 22 : 10)).toFixed(1)}`;
      E('path', { d: ring + ' Z', fill: o.hairH, opacity: .9 }, hc);
    }
  }
  const LOOK = {
    skin: '#fde3d0', skinS: '#eab49e', blushC: '#f2708a',
    hair: '#7a4a2a', hairS: '#4e2c16', hairH: '#c48a5c', hairStyle: 'long',
    iris: '#3f63b0', irisL: '#a6d8ff', eyeW: 76, eyeH: 62, eyeGap: 54, lash: 1, jaw: 0,
    shirt: '#f4a9bb', shirtS: '#d9849c', trim: '#fff6ec',
  };

  // a layer redrawn every frame while its scene is on. Bust.draw() adds new gradients and clip paths to <defs>
  // on every call, so drop the ones the previous frame made, or <defs> grows by the hundred each second.
  function live(sc, parent, fn) {
    const g = E('g', {}, parent), info = S.sceneById[sc.id];
    let made = [];
    S.ups.push(t => {
      if (t < info.start || t >= info.end) return;
      while (g.firstChild) g.firstChild.remove();
      made.forEach(d => d.remove());
      const before = new Set(sc.defs.children);
      fn(g, t);
      made = [...sc.defs.children].filter(d => !before.has(d));
    });
    return g;
  }
  const girl = (g, x, y, s, ex) => new Girl(g, LOOK).draw(x, y, s, ex);

  // props: the envelope (back, letter slot, front pocket) and the letter
  // the flap: closed it points down over the front (drawn by envFront), open it folds up behind the letter (envBack)
  const flap = (e, w, h, open) => {
    const fy = -h / 2 + (h * .62) * (1 - 2 * open);
    E('path', { d: P('M', -w / 2, -h / 2, 'L', 0, fy, 'L', w / 2, -h / 2, 'Z'), fill: open > .5 ? '#e8d6b8' : '#f7ead4', stroke: INK, 'stroke-width': 5, 'stroke-linejoin': 'round' }, e);
    return fy;
  };
  function envBack(g, x, y, w, h, rot = 0, open = 0) {
    const e = E('g', { transform: `translate(${x} ${y}) rotate(${rot})` }, g);
    if (open > .5) flap(e, w, h, open);
    E('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 10, fill: '#f3e6d0', stroke: INK, 'stroke-width': 5 }, e);
    return e;
  }
  function envFront(g, x, y, w, h, rot = 0, open = 0) {
    const e = E('g', { transform: `translate(${x} ${y}) rotate(${rot})` }, g);
    E('path', { d: P('M', -w / 2, -h / 2 + 30, 'L', 0, h * .12, 'L', w / 2, -h / 2 + 30, 'L', w / 2, h / 2, 'L', -w / 2, h / 2, 'Z'), fill: '#fbf1df', stroke: INK, 'stroke-width': 5, 'stroke-linejoin': 'round' }, e);
    E('path', { d: P('M', -w / 2, h / 2, 'L', -w * .08, h * .02, 'M', w / 2, h / 2, 'L', w * .08, h * .02), fill: 'none', stroke: '#d8c3a2', 'stroke-width': 4 }, e);
    if (open <= .5) {
      const fy = flap(e, w, h, open);
      E('circle', { cx: 0, cy: fy - 6, r: 30, fill: '#d6455d', stroke: INK, 'stroke-width': 4 }, e);
      FX.sparkle(e, 0, fy - 6, 16, '#ffd0d8');
    }
    return e;
  }
  function hands(g, x, y, w, dy = 0) {
    for (const sd of [-1, 1]) {
      const hx = x + sd * (w / 2 - 6), hy = y + dy;
      E('ellipse', { cx: hx, cy: hy, rx: 44, ry: 58, fill: LOOK.skin, stroke: INK, 'stroke-width': 4.5 }, g);
      E('path', { d: P('M', hx - sd * 30, hy - 20, 'Q', hx - sd * 46, hy, hx - sd * 30, hy + 22), fill: 'none', stroke: LOOK.skinS, 'stroke-width': 5, 'stroke-linecap': 'round' }, g);
    }
  }
  function letter(g, x, y, w, h, rot = 0, word = '') {
    const l = E('g', { transform: `translate(${x} ${y}) rotate(${rot})` }, g);
    E('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 8, fill: '#ffffff', stroke: INK, 'stroke-width': 5 }, l);
    E('circle', { cx: 0, cy: -h / 2 + 56, r: 30, fill: 'none', stroke: '#7d6ab0', 'stroke-width': 5 }, l);
    FX.sparkle(l, 0, -h / 2 + 56, 18, '#7d6ab0');
    const top = -h / 2 + 120;
    if (word) {
      const tx = E('text', { x: 0, y: top + 34, 'text-anchor': 'middle', 'font-family': 'Anton', 'font-size': Math.min(64, w * .18), fill: '#d6455d', 'letter-spacing': 3 }, l);
      tx.textContent = word;
    }
    for (let i = 0; i < 6; i++) E('rect', { x: -w / 2 + 50, y: top + (word ? 70 : 10) + i * 34, width: (w - 100) * (i % 3 === 2 ? .6 : 1), height: 12, rx: 6, fill: '#d9d2e6' }, l);
    return l;
  }

  // ---------------------------------------------------------------- wait: a year of waiting, shaking hands
  {
    const sc = scene(world, 'wait', 'cut');
    E('rect', { width: 1080, height: 1920, fill: FX.lin(sc.cam, [[0, '#17143a'], [.6, '#2e2a63'], [1, '#4b3f7e']]) }, sc.cam);
    // the night window behind her: blurred city lights (bokeh) and rain
    const win = 'M 150 470 L 930 470 L 930 1240 L 150 1240 Z';
    E('path', { d: win, fill: FX.lin(sc.cam, [[0, '#0e1030'], [1, '#2a2c5e']]) }, sc.cam);
    const city = E('g', { 'clip-path': FX.clip(sc.cam, win) }, sc.cam);
    const R = FX.rng(21), cols = ['#ffd166', '#ff9fb2', '#8ec5ff', '#c7b6ff'];
    const lights = E('g', { filter: FX.blur(sc.cam, 3) }, city);
    for (let i = 0; i < 26; i++) FX.bokeh(lights, 170 + R() * 740, 820 + R() * 380, 18 + R() * 34, cols[i % 4], .55);
    live(sc, city, (g, t) => {
      const Rr = FX.rng(5);
      for (let i = 0; i < 70; i++) {
        const x = 150 + Rr() * 780, y = 470 + ((Rr() * 800 + t * (1100 + Rr() * 400)) % 800);
        E('line', { x1: x, y1: y, x2: x - 8, y2: y + 46, stroke: '#b9c8ff', 'stroke-width': 2.5, opacity: .45 }, g);
      }
    });
    E('path', { d: win + ' M 540 470 L 540 1240 M 150 860 L 930 860', fill: 'none', stroke: '#14112e', 'stroke-width': 18 }, sc.cam);
    live(sc, sc.cam, (g, t) => {
      const shaking = t >= T('L1'), blink = Math.abs(t - T('L0%70')) < .06 || Math.abs(t - T('L1%60')) < .06;
      girl(g, 540, 870 + Math.sin(t * 2.2) * 4, 1.45, {
        eyes: blink ? 'closed' : 'open', look: [0, .7], lid: .2, brow: shaking ? .85 : .55, mouth: shaking ? 'frown' : 'line',
        sweat: shaking, wet: shaking ? .5 : 0,
      });
      const j = shaking ? Math.sin(t * 70) * 5 : 0;
      envBack(g, 540 + j, 1175, 420, 220, -3 + j * .3);
      envFront(g, 540 + j, 1175, 420, 220, -3 + j * .3, 0);
      hands(g, 540 + j, 1200, 440, Math.cos(t * 63) * (shaking ? 3 : 0));
      if (shaking) for (const sd of [-1, 1]) E('path', { d: P('M', 540 + sd * 290, 1120, 'q', sd * 18, 20, 0, 40, 'q', -sd * 18, 20, 0, 40), fill: 'none', stroke: '#fff6ec', 'stroke-width': 6, 'stroke-linecap': 'round', opacity: .8 }, g);
    });
    // the counter runs a year in two seconds
    const day = ov(sc, '<div class="kicker">DAY</div><div class="title" style="font-size:170px">1</div>', 'left:60px;right:60px;top:200px;text-align:center', 'down@0.1');
    const num = day.querySelector('.title');
    S.counter(v => { num.textContent = Math.round(v); }, 1, 365, 'L0', T('L0e') - T('L0') - .2);
    camera(sc, 'wait', 'waite', 1, 1.05, 540, 1000);
  }

  // ---------------------------------------------------------------- open: her eyes, the letter slides out
  {
    const sc = scene(world, 'open', 'whip');
    E('rect', { width: 1080, height: 1920, fill: FX.rad(sc.cam, [[0, '#5a4c9c'], [1, '#14112e']], .5, .55, .7) }, sc.cam);
    const lines = FX.speedLines(sc.cam, 540, 1040, 320, 1500, 110, '#ffffff', .35, 7);
    E('rect', { width: 1080, height: 1920, fill: FX.tone(sc.cam, '#0b0920', 16, 2.4), opacity: .35 }, sc.cam);
    S.during('open', 'opene', t => lines.setAttribute('transform', `rotate(${(t * 8).toFixed(2)} 540 1040)`));
    // eye close-up in a panel: the same Bust at scale 3, clipped to a band from the brows to the nose
    const panel = 'M 70 250 L 1010 250 L 1010 700 L 70 700 Z';
    const pg = E('g', { 'clip-path': FX.clip(sc.cam, panel) }, sc.cam);
    E('path', { d: panel, fill: LOOK.skin }, pg);
    live(sc, pg, (g, t) => {
      const k = prog(t, 'L2%50', .6);
      girl(g, 540, 520, 3, { eyes: t > T('L2%55') ? 'wide' : 'open', look: [0, .6 - .6 * k], lid: .15 * (1 - k), brow: .4 - .3 * k, wet: k, mouth: 'line' });
      if (t > T('L2%55')) for (const [x, y, r] of [[250, 330, 34], [830, 340, 40], [880, 620, 22]]) FX.sparkle(g, x, y, r * back(prog(t, 'L2%55', .3)), '#ffffff');
    });
    E('path', { d: panel, fill: 'none', stroke: '#fff6ec', 'stroke-width': 10 }, sc.cam);
    E('path', { d: panel, fill: 'none', stroke: INK, 'stroke-width': 4 }, sc.cam);
    live(sc, sc.cam, (g, t) => {
      const k = eout(prog(t, 'L2%15', T('L2%70') - T('L2%15')));
      envBack(g, 540, 1130, 520, 280, 2, clamp(k * 3));
      letter(g, 540, 1130 - 210 * k, 440, 360, 2 - 3 * k);
      envFront(g, 540, 1130, 520, 280, 2, clamp(k * 3));
      hands(g, 540, 1170, 540, 0);
      if (t > T('L2%10')) {
        const s = back(prog(t, 'L2%10', .3));
        const tx = E('text', { x: 0, y: 0, 'text-anchor': 'middle', 'font-family': 'Bangers', 'font-size': 120, fill: '#ffd166', stroke: INK, 'stroke-width': 12, 'paint-order': 'stroke', 'stroke-linejoin': 'round', transform: `translate(850 860) rotate(12) scale(${s.toFixed(3)})` }, g);
        tx.textContent = 'RIP!';
      }
    });
    camera(sc, 'open', 'opene', 1, 1.06, 540, 900);
  }

  // ---------------------------------------------------------------- joy: ACCEPTED, tears of joy
  {
    const sc = scene(world, 'joy', 'flash');
    E('rect', { width: 1080, height: 1920, fill: FX.rad(sc.cam, [[0, '#fff1c9'], [.45, '#ffb3c1'], [1, '#9c4d86']], .5, .45, .75) }, sc.cam);
    const lines = FX.speedLines(sc.cam, 540, 900, 380, 1600, 90, '#ffffff', .5, 3);
    S.during('joy', 'joye', t => lines.setAttribute('transform', `rotate(${(t * -6).toFixed(2)} 540 900)`));
    // bokeh drifting up and sparkles twinkling around her
    const R = FX.rng(9), bk = [], cols = ['#ffffff', '#ffe08a', '#ffc2d1', '#d8c8ff'];
    for (let i = 0; i < 18; i++) bk.push([FX.bokeh(sc.cam, 0, 0, 24 + R() * 46, cols[i % 4], .5), 80 + R() * 920, R() * 1500, 40 + R() * 60]);
    S.during('joy', 'joye', t => bk.forEach(([c, x, y0, sp], i) => {
      c.setAttribute('cx', (x + Math.sin(t + i) * 20).toFixed(1));
      c.setAttribute('cy', (1400 - ((y0 + t * sp) % 1300)).toFixed(1));
    }));
    const sp = [[150, 520, 40], [930, 600, 52], [200, 1000, 30], [900, 1040, 36], [110, 780, 22], [960, 820, 26]].map(([x, y, r], i) => [FX.sparkle(sc.cam, 0, 0, 1, '#ffffff'), x, y, r, i]);
    S.during('joy', 'joye', t => sp.forEach(([el, x, y, r, i]) => {
      const s = r * back(prog(t, 'L3', .35)) * (.6 + .4 * Math.abs(Math.sin(t * 3 + i)));
      el.setAttribute('transform', `translate(${x} ${y}) rotate(${(t * 40 + i * 30).toFixed(1)}) scale(${s.toFixed(2)})`);
    }));
    live(sc, sc.cam, (g, t) => {
      const cry = t >= T('L3e'), k = prog(t, 'L3e', 1.4), bob = cry ? Math.abs(Math.sin(t * 5)) * -12 : 0;
      // three beats: shock (wide wet eyes), happy crying (closed eyes, tears grow), a teary smile at the viewer
      const smile = t >= T('L4%55');
      girl(g, 540, 960 + bob, 1.5, smile
        ? { eyes: 'open', mouth: 'grin', open: .6, wet: 1, tears: 1, blush: 1, brow: .45, tilt: Math.sin(t * 2.4) * 3 }
        : cry
          ? { eyes: 'closed', mouth: 'grin', open: .8, tears: .35 + .65 * k, blush: 1, brow: .6, tilt: Math.sin(t * 2.4) * 3 }
          : { eyes: 'wide', mouth: 'open', open: .7, wet: 1, tears: .15, blush: .5, brow: .25, look: [0, -.2] });
      // she holds the letter up beside her face, one hand under it
      const lift = 1 - eout(prog(t, 'joy', .5));
      letter(g, 830, 1010 + bob + 160 * lift, 260, 330, 10 - 6 * Math.sin(t * 2.4), 'ACCEPTED');
      E('ellipse', { cx: 812, cy: 1170 + bob + 160 * lift, rx: 46, ry: 56, fill: LOOK.skin, stroke: INK, 'stroke-width': 4.5 }, g);
    });
    ov(sc, 'ACCEPTED!', 'left:60px;right:60px;top:210px;text-align:center;color:#ffd166;font-size:160px', 'stamp@L3', '', 'title');
    ov(sc, 'AFTER 365 DAYS', 'left:60px;right:60px;top:392px;text-align:center;color:#fff6ec;font-size:56px', 'up@L4', '', 'kicker');
    S.flashAt('L3', .9, .3);
    S.shake('L3', .35, 18);
    camera(sc, 'joy', 'joye', 1, 1.07, 540, 950);
  }
};
