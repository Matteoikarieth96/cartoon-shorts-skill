// Manga style example: a small-town street cook vows to win the city's cooking contest, everyone laughs, he grins and wins.
// Original characters only. Three scenes (vow, laugh, win), every move keyed to the voice lines (L0..L4).
// Needs engine/styles/anime.js then engine/styles/manga.js loaded before core.js.
window.buildEpisode = (world, S) => {
  const { E, scene, ov, T, clamp, eout } = S;
  const { FX } = Anime, M = Manga, INK = M.INK;
  const back = x => { x = clamp(x); const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  const after = (t, at, d = .3) => clamp((t - T(at)) / d);

  // cast: three original faces with contrasting heads, noses, hair and outfits
  const COOK = { head: 'lean', nose: 'small', skin: '#f6c99c', skinS: '#dd9a68', hair: '#2a1a12', hairS: '#120a06', hairH: '#6e4a34', hairStyle: 'spiky',
    eyeW: 56, eyeH: 30, eyeGap: 52, pupil: 12, mouthW: 1.05, outfit: 'kit', shirt: '#f4f1e8', shirtS: '#c9c2b2', trim: '#2a7de1' };
  const JUDGE = { head: 'square', nose: 'long', skin: '#efc093', skinS: '#cf8d5a', hair: '#e2e4ea', hairS: '#959cab', hairH: '#ffffff', hairStyle: 'swept',
    eyeW: 48, eyeH: 26, eyeGap: 54, pupil: 9, age: 1, glasses: true, frame: '#2a2226', outfit: 'suit', suit: '#5a1e2e', suitS: '#3a111d', tie: '#ffc93c' };
  const FAN = { head: 'round', nose: 'wide', skin: '#9a6644', skinS: '#74462c', blushC: '#d0604c', hair: '#1a120e', hairS: '#000', hairH: '#4f4038', hairStyle: 'buzz',
    eyeW: 56, eyeH: 32, eyeGap: 52, pupil: 13, mouthW: 1.1, outfit: 'kit', shirt: '#2f8f5b', shirtS: '#1f6a42', trim: '#ffc93c' };

  // draw() rebuilds the bust every call: S.live() redraws a layer each frame and clears the defs it left
  const live = S.live;
  const bust = (g, look, x, y, s, ex) => new M.Bust(g, look).draw(x, y, s, ex);
  // the cook's blue headband, drawn in head units on the bust's own group (b.g) so it follows tilt and scale
  function band(b) {
    E('path', { d: 'M -128 -132 Q 0 -168 128 -132 L 126 -100 Q 0 -134 -126 -100 Z', fill: '#2a7de1', stroke: INK, 'stroke-width': 5, 'stroke-linejoin': 'round' }, b.g);
    E('path', { d: 'M 120 -120 L 176 -150 L 168 -112 Z M 120 -112 L 170 -92 L 150 -76 Z', fill: '#2a7de1', stroke: INK, 'stroke-width': 4.5, 'stroke-linejoin': 'round' }, b.g);
    return b;
  }
  const burst = (g, c0, c1, cx, cy) => E('rect', { width: 1080, height: 1920, fill: FX.rad(g, [[0, c0], [1, c1]], cx / 1080, cy / 1920, .75) }, g);
  function wok(g, x, y, s, t, fire) {
    const w = E('g', { transform: `translate(${x} ${y}) scale(${s})` }, g);
    if (fire) for (let i = 0; i < 7; i++) {
      const h = 115 + 45 * Math.sin(t * 13 + i * 1.7), xx = -150 + i * 50;
      E('path', { d: `M ${xx - 34} 0 Q ${xx - 40} ${-h * .5} ${xx + 4} ${-h} Q ${xx + 10} ${-h * .5} ${xx + 34} 0 Z`, fill: i % 2 ? '#ffc93c' : '#ff6a2a', stroke: INK, 'stroke-width': 4 }, w);
    }
    E('path', { d: 'M -200 -10 Q 0 120 200 -10 Z', fill: '#2b2b33', stroke: INK, 'stroke-width': 7, 'stroke-linejoin': 'round' }, w);
    E('path', { d: 'M 196 -6 L 330 -40', stroke: INK, 'stroke-width': 18, 'stroke-linecap': 'round' }, w);
    E('path', { d: 'M -150 10 Q 0 40 150 10', fill: 'none', stroke: '#6a6a78', 'stroke-width': 5, 'stroke-linecap': 'round' }, w);
    return w;
  }
  function confetti(g, t, n, seed) {
    const R = FX.rng(seed), cols = ['#ffc93c', '#e23b2e', '#fbf3e4', '#4fb3ff'];
    for (let i = 0; i < n; i++) {
      const x0 = R() * 1080, sp = 200 + R() * 220, ph = R() * 1920, spin = R() * 400;
      const y = (ph + t * sp) % 1980 - 60, x = x0 + Math.sin(t * 2 + i) * 30;
      E('rect', { x: -12, y: -7, width: 24, height: 14, fill: cols[i % 4], stroke: INK, 'stroke-width': 2.5, transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(spin + t * 300).toFixed(1)})` }, g);
    }
  }

  // ---------------------------------------------------------------- vow: the stall at night, then the vow
  {
    const sc = scene(world, 'vow', 'cut');
    live(sc, (g, t) => {
      if (t < T('L1')) {
        E('rect', { width: 1080, height: 1920, fill: FX.lin(g, [[0, '#1d1b3a'], [.6, '#5a2f4a'], [1, '#c4612f']]) }, g);
        // paper lanterns on a string
        E('path', { d: 'M -20 330 Q 540 440 1100 330', fill: 'none', stroke: INK, 'stroke-width': 5 }, g);
        for (let i = 0; i < 5; i++) {
          const x = 120 + i * 210, y = 345 + 90 * Math.sin(Math.PI * x / 1080) * .9, sw = Math.sin(t * 2 + i) * 4;
          const l = E('g', { transform: `translate(${x} ${y}) rotate(${sw.toFixed(1)})` }, g);
          E('ellipse', { cx: 0, cy: 50, rx: 44, ry: 54, fill: '#ff7a3a', stroke: INK, 'stroke-width': 5 }, l);
          E('path', { d: 'M -40 36 Q 0 44 40 36 M -42 64 Q 0 72 42 64', fill: 'none', stroke: INK, 'stroke-width': 3 }, l);
          E('ellipse', { cx: -12, cy: 34, rx: 10, ry: 18, fill: '#ffd9a0', opacity: .8 }, l);
        }
        const b = band(bust(g, COOK, 440, 980 + Math.sin(t * 2.4) * 4, 1.15, { mouth: 'smile', look: [.7, .4], blush: .25, brow: .1 }));
        // the stall counter in front: wood, hard shadow and manga hatching
        E('path', { d: 'M -20 1220 L 1100 1220 L 1100 1940 L -20 1940 Z', fill: '#8a4b2a', stroke: INK, 'stroke-width': 8 }, g);
        E('rect', { x: -20, y: 1220, width: 1120, height: 34, fill: '#b06a3c', stroke: INK, 'stroke-width': 6 }, g);
        M.hatch(g, 'M -20 1254 L 1100 1254 L 1100 1420 L -20 1420 Z', -20, 1254, 1100, 1420, 12, -40, 3, .5);
        wok(g, 780, 1200, .9, t, false);
        for (let i = 0; i < 3; i++) { const x = 720 + i * 60, y = 1110 - ((t * 110 + i * 55) % 170); E('path', { d: `M ${x} ${y + 60} q -20 -20 0 -40 q 20 -20 0 -40`, fill: 'none', stroke: '#fff', 'stroke-width': 8, 'stroke-linecap': 'round', opacity: .75 }, g); }
      } else {
        // the vow: red burst, focus lines, screentone, the shout
        burst(g, '#ffb347', '#a3171c', 540, 820);
        const sl = FX.speedLines(g, 540, 820, 300, 1500, 90, '#fff3d6', .6, 4);
        sl.setAttribute('transform', `rotate(${(t * 12).toFixed(1)} 540 820)`);
        E('rect', { width: 1080, height: 1920, fill: FX.tone(g, '#5a0d10', 18, 3), opacity: .25 }, g);
        const k = back(after(t, 'L1', .3));
        band(bust(g, COOK, 540, 960, 1.05 + .2 * k, { mouth: 'shout', open: .9 + .1 * Math.sin(t * 9), eyes: 'fierce', brow: -.2, tilt: -3 }));
        if (t > T('L1%45')) M.sfx(g, 540, 470, 'DON!!', 200 * back(after(t, 'L1%45', .25)), -8, '#ffc93c');
      }
    });
    ov(sc, 'SMALL TOWN. BIG VOW.', 'left:0;right:0;top:200px;text-align:center;font-size:64px', 'down@0.15 out@L1-.15', 'vow..L1', 'kicker');
    S.shake('L1', .35, 22); S.flashAt('L1', .6, .2); S.shake('L1%45', .3, 16);
  }

  // ---------------------------------------------------------------- laugh: two contrasting faces laugh, the cook sweats
  {
    const sc = scene(world, 'laugh', 'whip');
    live(sc, (g, t) => {
      E('rect', { width: 1080, height: 1920, fill: '#fff1c9' }, g);
      E('rect', { width: 1080, height: 1920, fill: FX.tone(g, '#e2667a', 20, 3.4), opacity: .45 }, g);
      // hatched diagonal shadows in the corners, the manga "spot" tone
      M.hatch(g, 'M 0 0 L 420 0 L 0 520 Z', 0, 0, 420, 520, 14, 35, 4, .6);
      M.hatch(g, 'M 1080 1100 L 1080 1920 L 560 1920 Z', 560, 1100, 1080, 1920, 14, 35, 4, .6);
      const bob = i => Math.abs(Math.sin(t * 9 + i)) * 18;
      // main panel: the two laughing faces, torsos cut by the panel's bottom border
      const top = E('g', { 'clip-path': FX.clip(g, 'M 0 0 L 1080 0 L 1080 1290 L 0 1310 Z') }, g);
      bust(top, JUDGE, 320, 800 - bob(0), .95, { mouth: 'shout', open: .7 + .3 * Math.abs(Math.sin(t * 9)), eyes: 'happy', glare: true, tilt: -6 + Math.sin(t * 9) * 3 });
      bust(top, FAN, 790, 840 - bob(1.3), .85, { mouth: 'grin', open: .8 + .2 * Math.abs(Math.sin(t * 8)), eyes: 'happy', blush: .6, tilt: 7 + Math.sin(t * 8) * 3 });
      E('path', { d: 'M -20 1290 L 1100 1290 L 1100 1310 L -20 1310', fill: 'none', stroke: INK, 'stroke-width': 12 }, g);
      // reaction inset: the cook, sweating, in a tilted panel of his own
      const k = back(after(t, 'L2%35', .3));
      const ins = E('g', { transform: `rotate(-4 820 1160) translate(820 1160) scale(${k.toFixed(3)}) translate(-820 -1160)` }, g);
      const pd = 'M 640 1040 L 1000 1040 L 1000 1280 L 640 1280 Z';
      E('path', { d: pd, fill: '#bfe6ff' }, ins);
      const pin = E('g', { 'clip-path': FX.clip(ins, pd) }, ins);
      FX.speedLines(pin, 820, 1150, 110, 400, 40, '#fff', .8, 3);
      band(bust(pin, COOK, 820, 1160, .52, { mouth: 'line', brow: .8, look: [-.6, -.4], sweat: true }));
      E('path', { d: pd, fill: 'none', stroke: INK, 'stroke-width': 10, 'stroke-linejoin': 'round' }, ins);
      if (t > T('L2%10')) M.sfx(g, 320, 400, 'HA HA HA!', 104 * back(after(t, 'L2%10', .25)), -12, '#ff8a6a');
      if (t > T('L2%40')) M.sfx(g, 800, 470, 'HAHA!', 96 * back(after(t, 'L2%40', .25)), 10, '#ffc93c');
    });
    S.shake('L2%10', .25, 12); S.shake('L2%40', .25, 12);
  }

  // ---------------------------------------------------------------- win: the huge grin over the fire, then the impact frame and joy
  {
    const sc = scene(world, 'win', 'flash');
    live(sc, (g, t) => {
      if (t < T('L4')) {
        burst(g, '#ffd36a', '#b8321a', 540, 900);
        const sl = FX.speedLines(g, 540, 900, 320, 1500, 80, '#fff', .45, 7);
        sl.setAttribute('transform', `rotate(${(-t * 10).toFixed(1)} 540 900)`);
        band(bust(g, COOK, 540, 900, 1.3, { mouth: 'grin', open: 1, eyes: 'fierce', brow: .1, tilt: 2 }));
        wok(g, 800, 1250, .85, t, true);
        if (t > T('L3%45')) M.sfx(g, 540, 420, 'SIZZLE!', 150 * back(after(t, 'L3%45', .25)), -6, '#ffc93c');
      } else {
        burst(g, '#fff6c8', '#e0a018', 540, 820);
        const sl = FX.speedLines(g, 540, 820, 300, 1500, 100, '#fff', .7, 11);
        sl.setAttribute('transform', `rotate(${(t * 18).toFixed(1)} 540 820)`);
        E('rect', { width: 1080, height: 1920, fill: FX.tone(g, '#b06a00', 18, 3), opacity: .2 }, g);
        confetti(g, t, 60, 5);
        const k = back(after(t, 'L4', .3));
        band(bust(g, COOK, 540, 900, 1.2 + .1 * k, { mouth: 'cry', open: .9, eyes: 'closed', tears: 1, fountain: true, brow: .9, tilt: -3 + Math.sin(t * 2) * 1.5 }));
        // the trophy, held up in front of the chest
        const c = E('g', { transform: `translate(540 ${1385 - 30 * k}) scale(${(.6 + .4 * k).toFixed(3)})` }, g);
        E('path', { d: 'M -110 -120 L 110 -120 Q 104 20 0 40 Q -104 20 -110 -120 Z', fill: '#ffc93c', stroke: INK, 'stroke-width': 8, 'stroke-linejoin': 'round' }, c);
        E('path', { d: 'M -110 -96 Q -180 -90 -150 -20 Q -130 10 -86 0 M 110 -96 Q 180 -90 150 -20 Q 130 10 86 0', fill: 'none', stroke: INK, 'stroke-width': 10 }, c);
        E('path', { d: 'M -20 40 L 20 40 L 30 90 L -30 90 Z M -70 90 L 70 90 L 70 120 L -70 120 Z', fill: '#e0a018', stroke: INK, 'stroke-width': 7, 'stroke-linejoin': 'round' }, c);
        E('path', { d: 'M -70 -100 Q -60 -20 -20 10', fill: 'none', stroke: '#fff6c8', 'stroke-width': 10, 'stroke-linecap': 'round' }, c);
        FX.sparkle(g, 700, 1110, 30 + 10 * Math.sin(t * 8), '#fff');
        if (t > T('L4%45')) M.sfx(g, 800, 500, 'WAAAH!', 92 * back(after(t, 'L4%45', .25)), 10, '#8fd3ff');
      }
    });
    ov(sc, '<span class="pill" style="background:#ffc93c;font-size:96px;padding:14px 40px">1ST PRIZE</span>', 'left:0;right:0;top:230px;text-align:center', 'stamp@L4+.05', 'L4..wine');
    // impact frame on L4; the white flash comes after it, or it washes the inverted frames out
    S.impact('L4', 3); S.flashAt('L4+.1', .8, .3); S.shake('L4', .5, 28);
    S.shake('L3%45', .25, 10);
  }
};
