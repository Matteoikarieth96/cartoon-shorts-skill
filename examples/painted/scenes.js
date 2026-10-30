// Example episode in the painted storybook style: "Tomato pasta in 15 minutes, for 2 euros".
// Three scenes keyed to four voice lines (L0..L3): hook (meadow + teaser plate), kitchen (the cooking step), plate (the payoff).
window.buildEpisode = (world, S) => {
  const { E, tr, scene, ov, during, clamp, eout, eio, T } = S;
  const P = window.Painted, { F, Cook, talkAt, blinkAt, lin, rad, blur } = P;
  const at = (t, a, b) => clamp((t - T(a)) / (T(b) - T(a)));

  // ---------------------------------------------------------------- pasta: a twirled nest of a few broad glossy bands, sauce on top
  // (F.nest draws many thin strands; for a big hero plate a few broad bands read better and look more painted)
  const pastaNest = (p, { w = 300, h = 120, turns = 3, seed = 4, basil = true } = {}) => {
    const g = E('g', {}, p), hw = w / 2, bw = w * .13, r = P.rng(seed), R = Math.PI * 2 * turns;
    E('ellipse', { cx: 0, cy: hw * .14, rx: hw * 1.02, ry: hw * .36, fill: '#5a2a10', opacity: .28, filter: blur(p, 6) }, g);
    // the mound under the bands, shaded darker at the bottom: the gaps between bands read as pasta in shadow
    E('path', { d: `M${-hw * .9},${hw * .12} C${-hw * .96},${-h * .95} ${hw * .96},${-h * .95} ${hw * .9},${hw * .12} C${hw * .5},${hw * .4} ${-hw * .5},${hw * .4} ${-hw * .9},${hw * .12}Z`,
      fill: lin(p, [[0, '#e6a050'], [1, '#a95a24']]), stroke: '#7a3a16', 'stroke-width': 3 }, g);
    // one spiral from the outer ring (low, wide) to the top (small, high); each half-turn is a band
    const pt = th => {
      const k = th / R, rx = hw * (.84 - .56 * k), cy = -h * .7 * Math.sin(k * Math.PI / 2);
      return [rx * Math.cos(th + .5), cy + rx * .42 * Math.sin(th + .5)];
    };
    const halves = Math.ceil(turns * 2), bands = [];
    for (let j = 0; j < halves; j++) {
      const a = j * Math.PI, b = Math.min((j + 1) * Math.PI, R), pts = [];
      for (let i = 0; i <= 18; i++) pts.push(pt(a + (b - a) * i / 18));
      bands.push({ d: 'M' + pts.map(q => q.map(v => v.toFixed(1)).join(',')).join(' L'), front: j % 2 === 0, k: j / halves });
    }
    // back halves first, then front halves bottom to top: the front of every ring sits over the back of the ring below
    [...bands.filter(x => !x.front), ...bands.filter(x => x.front)].forEach(({ d, front, k }) => {
      E('path', { d, fill: 'none', stroke: '#7a3a16', 'stroke-width': bw + 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
      E('path', { d, fill: 'none', stroke: front ? P.mix('#eeac58', '#f6c878', k) : '#d0883e', 'stroke-width': bw, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
      E('path', { d, fill: 'none', stroke: front ? '#ffe2a6' : '#e8a85c', 'stroke-width': bw * .3, 'stroke-linecap': 'round', transform: `translate(0,${(-bw * .24).toFixed(1)})`, opacity: .9 }, g);
      if (front) E('path', { d, fill: 'none', stroke: '#fffaf0', 'stroke-width': bw * .14, 'stroke-linecap': 'round', 'stroke-dasharray': `${(w * .05).toFixed(0)} ${(w * .45).toFixed(0)}`, 'stroke-dashoffset': (r() * w * .4).toFixed(0), transform: `translate(0,${(-bw * .3).toFixed(1)})` }, g);
    });
    // the sauce: a glossy red pool on the top of the twirl, lobes running down over the bands, small tomato chunks and glints
    const sy = -h * .7, sw = w * .3;
    E('path', { d: `M${-sw},${sy} C${-sw},${sy - sw * .38} ${sw},${sy - sw * .42} ${sw},${sy} C${sw * 1.04},${sy + sw * .34} ${sw * .78},${sy + sw * .7} ${sw * .56},${sy + sw * .36} C${sw * .36},${sy + sw * .5} ${sw * .1},${sy + sw * .74} ${-sw * .08},${sy + sw * .4} C${-sw * .3},${sy + sw * .62} ${-sw * .62},${sy + sw * .66} ${-sw * .72},${sy + sw * .3} C${-sw * .86},${sy + sw * .34} ${-sw * 1.02},${sy + sw * .2} ${-sw},${sy}Z`,
      fill: rad(p, [[0, '#f0623a'], [.6, '#cf3a22'], [1, '#9c2414']], .42, .38, .7), stroke: '#7a1c10', 'stroke-width': 2.6, 'stroke-linejoin': 'round' }, g);
    [[-.6, .06, .11], [-.05, -.12, .13], [.5, .1, .1], [.18, .28, .08], [-.38, .3, .07]].forEach(([fx, fy, fr], i) => {
      const x = sw * fx, y = sy + sw * fy, cr = sw * fr * 1.8, q = i * 47 - 40;
      E('path', { d: `M${-cr},0 C${-cr},${-cr * .8} ${cr * .9},${-cr * .9} ${cr},${-cr * .1} C${cr * 1.1},${cr * .6} ${-cr * .6},${cr * .8} ${-cr},0Z`, transform: `translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${q})`, fill: i % 2 ? '#e14a2a' : '#ee6a44', stroke: '#9a2414', 'stroke-width': 1.4 }, g);
      E('path', { d: `M${(x - cr * .6).toFixed(1)},${(y - cr * .2).toFixed(1)} q${(cr * .4).toFixed(1)},${(-cr * .45).toFixed(1)} ${(cr * .9).toFixed(1)},${(-cr * .35).toFixed(1)}`, fill: 'none', stroke: '#fff', 'stroke-width': Math.max(1.5, cr * .18).toFixed(1), opacity: .8, 'stroke-linecap': 'round' }, g);
    });
    E('path', { d: `M${-sw * .7},${sy - sw * .14} C${-sw * .4},${sy - sw * .3} ${-sw * .05},${sy - sw * .32} ${sw * .2},${sy - sw * .28}`, fill: 'none', stroke: '#fff', 'stroke-width': w * .016, opacity: .7, 'stroke-linecap': 'round' }, g);
    if (basil) [[-.1, -1, -28], [.28, -.8, 34]].forEach(([fx, fy, rot]) => {
      const lf = E('g', { transform: `translate(${(sw * fx * 1.6).toFixed(1)},${(sy + sw * .1 * fy - sw * .22).toFixed(1)}) rotate(${rot}) scale(${(w / 300).toFixed(3)})` }, g);
      E('path', { d: 'M0,0 C10,-18 34,-22 52,-6 C34,10 12,10 0,0Z', fill: lin(p, [[0, '#6cbf4e'], [1, '#2f7a2a']]), stroke: '#1f4a18', 'stroke-width': 2.2, 'stroke-linejoin': 'round' }, lf);
      E('path', { d: 'M4,-1 C18,-6 32,-7 46,-5', fill: 'none', stroke: '#a8e08a', 'stroke-width': 2, 'stroke-linecap': 'round' }, lf);
      E('path', { d: 'M14,-10 C22,-14 30,-14 36,-12', fill: 'none', stroke: '#fff', 'stroke-width': 2.6, opacity: .7, 'stroke-linecap': 'round' }, lf);
    });
    return g;
  };
  const clockIco = '<svg viewBox="-30 -30 60 60" width="44" height="44"><circle r="25" fill="#fffaf0" stroke="#4a3426" stroke-width="5"/><path d="M0,-14 L0,0 L10,6" fill="none" stroke="#4a3426" stroke-width="5" stroke-linecap="round"/></svg>';

  // ================================================================ hook: dish, time and cost readable from frame 0
  {
    const sc = scene(world, 'hook', 'cut');
    const land = P.landscape(sc.cam, { seed: 3 });
    const plate = E('g', {}, sc.cam);
    F.plate(plate, 250, 100);
    pastaNest(plate, { w: 300, h: 118, seed: 9 });
    const steam = F.steam(plate, 0, -150, 3, .9);
    during('hook', 'hooke', (t, k) => {
      land(t);
      tr(plate, 540, 1190 + Math.sin(t * 1.4) * 4, 1.3 + .05 * k);
      steam.update(t, 1);
      sc.cam.setAttribute('transform', `translate(540,900) scale(${(1 + .04 * k).toFixed(4)}) translate(-540,-900)`);
    });
    // no entry animation on the title and the stats: they must be on screen in the very first frame
    ov(sc, 'Tomato<br>Pasta', 'left:0;right:0;top:150px;text-align:center', 'nudge@L0%10:0.4', '', 'dish');
    ov(sc, `<div class="stat">${clockIco}<b>15 min</b></div>`, 'left:80px;top:520px', 'nudge@L0%45');
    ov(sc, '<div class="stat"><b><i>€</i>2</b><small>serves 2</small></div>', 'left:400px;top:520px', 'nudge@L0%70');
    ov(sc, '<div class="stat"><b>Easy</b><small>one pan</small></div>', 'left:720px;top:520px', 'nudge@L0%85');
  }

  // ================================================================ kitchen: garlic and oil, tomatoes crushed in, it bubbles
  {
    const sc = scene(world, 'kitchen', 'whip');
    const kit = P.kitchen(sc.cam);
    const cook = Cook(sc.cam, { x: 270, y: 800, s: .9 });
    P.counter(sc.cam, 1240);
    // the pasta pot at the back right, with spaghetti sticking out (drawn before the pot so its body hides their feet)
    const potG = E('g', { opacity: 0 }, sc.cam);
    const sticks = E('g', {}, potG);
    for (let i = 0; i < 9; i++) E('line', { x1: 880 + (i - 4) * 9, y1: 1060, x2: 880 + (i - 4) * 26, y2: 930 - Math.abs(i - 4) * 6, stroke: i % 3 ? '#f1c463' : '#d9a443', 'stroke-width': 7, 'stroke-linecap': 'round' }, sticks);
    const pot = F.pot(E('g', { transform: 'translate(880,1120) scale(.38)' }, potG));
    const potSteam = F.steam(sc.cam, 880, 1040, 2, .55);
    // the pan, inside: an oil pool, garlic slices, then the tomato sauce
    const pan = F.pan(E('g', { transform: 'translate(540,1250) scale(.55)' }, sc.cam));
    const oil = E('ellipse', { cx: 0, cy: 10, rx: 260, ry: 108, fill: rad(sc.svg, [[0, '#f6d77a', .8], [.7, '#e2ae44', .55], [1, '#d9a63a', 0]]), opacity: 0 }, pan.inside);
    const garlic = [...Array(7)].map((_, i) => { const s = E('g', {}, pan.inside); E('ellipse', { cx: 0, cy: 0, rx: 22, ry: 13, fill: '#fbeec8', stroke: '#b0884a', 'stroke-width': 2.4 }, s); E('ellipse', { cx: -6, cy: -4, rx: 7, ry: 3, fill: '#fff', opacity: .8 }, s); return s; });
    const sauce = E('g', { opacity: 0 }, pan.inside);
    E('ellipse', { cx: 0, cy: 8, rx: 304, ry: 128, fill: rad(sc.svg, [[0, '#ee6038'], [.55, '#cf3d24'], [.85, '#a82a18'], [1, '#7a1c10']], .45, .42, .62) }, sauce);
    for (let i = 0; i < 12; i++) { const x = Math.sin(i * 2.3) * 210, y = Math.cos(i * 1.7) * 70;
      E('ellipse', { cx: x.toFixed(1), cy: y.toFixed(1), rx: 22, ry: 13, fill: i % 3 ? '#e85a3a' : '#f27850', stroke: '#9a2414', 'stroke-width': 2 }, sauce);
      E('ellipse', { cx: (x - 8).toFixed(1), cy: (y - 5).toFixed(1), rx: 8, ry: 3, fill: '#fff', opacity: .85 }, sauce); }
    const bubbles = [...Array(9)].map(() => E('circle', { r: 6, fill: 'none', stroke: '#ffa080', 'stroke-width': 5, opacity: 0 }, sauce));
    const toms = [...Array(3)].map(() => { const g = E('g', {}, sc.cam); F.tomato(g, 44); return g; });
    const panSteam = F.steam(sc.cam, 540, 1160, 3, 1);
    // a wooden spoon held in the cook's right hand
    const spoon = E('g', {}, sc.cam);
    E('path', { d: 'M0,-60 L0,150', stroke: '#8a5a33', 'stroke-width': 16, 'stroke-linecap': 'round' }, spoon);
    E('path', { d: 'M0,-60 L0,150', stroke: '#c99560', 'stroke-width': 9, 'stroke-linecap': 'round' }, spoon);
    E('ellipse', { cx: 0, cy: 172, rx: 22, ry: 30, fill: '#c99560', stroke: '#8a5a33', 'stroke-width': 4 }, spoon);
    ov(sc, '<div class="step"><i>1</i><span>Garlic, oil, tomatoes</span></div>', 'left:60px;top:130px', 'left@kitchen+.1', 'kitchen..L2');
    ov(sc, '<div class="step"><i>2</i><span>Let it bubble</span></div>', 'left:60px;top:130px', 'left@L2', 'L2..kitchene');
    ov(sc, 'while the<br>pasta cooks', 'left:560px;top:290px;width:420px;text-align:center', 'pop@L2%35', '', 'tip');
    during('kitchen', 'kitchene', (t, k) => {
      kit.update(t);
      // stir: the upper arm swings a little, the spoon follows the hand
      const stir = at(t, 'L1%30', 'kitchene') > 0 ? 1 : 0, sw = Math.sin(t * 7) * 7 * stir;
      cook.set({ ra: [34 + sw, -6], la: [18, -60], headR: 4 * Math.sin(t * 1.7) + 6, talk: talkAt(t), blink: blinkAt(t), bob: Math.sin(t * 2.2) * 3, happy: t > T('L2%60') });
      const h = cook.hands.r, hx = 270 + .9 * h[0], hy = 800 + Math.sin(t * 2.2) * 3 + .9 * h[1];
      tr(spoon, hx, hy, .9, -18 + sw * 1.5);
      oil.setAttribute('opacity', (eio(at(t, 'L1%25', 'L1%45'))).toFixed(2));
      garlic.forEach((s, i) => {
        const a = eout(at(t, `L1%${6 + i * 3}`, `L1%${14 + i * 3}`)), x = -160 + i * 52, y = -30 + (i % 3) * 30;
        tr(s, x, y - 360 * (1 - a), 1, i * 40);
        s.style.display = a > 0 ? '' : 'none';
        s.firstChild.setAttribute('fill', P.mix('#fbeec8', '#f0c060', at(t, 'L1%40', 'L1%70')));
      });
      toms.forEach((g, i) => {
        const a = at(t, `L1%${60 + i * 8}`, `L1%${72 + i * 8}`);
        tr(g, 470 + i * 70, 820 + 420 * eio(a), 1 - .4 * a, i * 50 + a * 90);
        g.style.display = a > 0 && a < 1 ? '' : 'none';
      });
      const sa = eio(at(t, 'L1%72', 'L2%10'));
      sauce.setAttribute('opacity', sa.toFixed(2));
      bubbles.forEach((b, i) => { const ph = (t * .9 + i * .31) % 1; b.setAttribute('cx', (Math.sin(i * 3.7) * 200).toFixed(1)); b.setAttribute('cy', (Math.cos(i * 2.1) * 70).toFixed(1)); b.setAttribute('r', (3 + 16 * ph).toFixed(1)); b.setAttribute('opacity', (sa * (1 - ph)).toFixed(2)); });
      panSteam.update(t, .35 + .65 * sa);
      const pp = eout(at(t, 'L2', 'L2%25'));
      potG.setAttribute('opacity', pp.toFixed(2));
      potSteam.update(t, pp);
      pot.water.querySelectorAll('circle').forEach(c => c.remove());
      for (let i = 0; i < 5; i++) { const ph = (t * 1.1 + i * .3) % 1; E('circle', { cx: -150 + i * 70, cy: -140, r: 4 + ph * 14, fill: 'none', stroke: '#e9f8ff', 'stroke-width': 5, opacity: (pp * (1 - ph)).toFixed(2) }, pot.water); }
      sc.cam.setAttribute('transform', `translate(540,1100) scale(${(1 + .05 * k).toFixed(4)}) translate(-540,-1100)`);
    });
  }

  // ================================================================ plate: the payoff, the cook cheers
  {
    const sc = scene(world, 'plate', 'zoom');
    const kit = P.kitchen(sc.cam);
    const cook = Cook(sc.cam, { x: 540, y: 760, s: .85 });
    P.counter(sc.cam, 1240);
    const plate = E('g', {}, sc.cam);
    F.plate(plate, 250, 100);
    pastaNest(plate, { w: 300, h: 118, seed: 12 });
    tr(plate, 540, 1215, 1.5);
    const steam = F.steam(sc.cam, 540, 1040, 3, .85);
    const spark = [...Array(7)].map(() => E('path', { d: 'M0,-22 L5,-5 L22,0 L5,5 L0,22 L-5,5 L-22,0 L-5,-5Z', fill: '#fff6c8', opacity: 0 }, sc.cam));
    ov(sc, `<div class="recap"><b>Tomato Pasta</b><div class="row"><span>${clockIco} 15 min</span><span><i>€</i>2</span><span>serves 2</span></div></div>`, 'left:110px;right:110px;top:130px', 'down@plate+.05');
    during('plate', 'platee', (t, k) => {
      kit.update(t);
      const cheer = eout(at(t, 'L3%55', 'L3%80'));
      cook.set({ la: [30 + 120 * cheer, 20 + 30 * cheer], ra: [30 + 120 * cheer, 20 + 30 * cheer], talk: talkAt(t), happy: true, headR: 3 * Math.sin(t * 2), bob: Math.sin(t * 2.4) * 4 - 12 * cheer });
      steam.update(t, .75);
      spark.forEach((s, i) => { const ph = (t * .7 + i / 7) % 1; s.setAttribute('transform', `translate(${(540 + Math.cos(i * 2.4) * 330).toFixed(1)},${(1130 + Math.sin(i * 1.7) * 110).toFixed(1)}) scale(${Math.sin(Math.PI * ph).toFixed(3)}) rotate(${ph * 90})`); s.setAttribute('opacity', (Math.sin(Math.PI * ph) * .95).toFixed(2)); });
      sc.cam.setAttribute('transform', `translate(540,1150) scale(${(1 + .05 * k).toFixed(4)}) translate(-540,-1150)`);
    });
  }
};
