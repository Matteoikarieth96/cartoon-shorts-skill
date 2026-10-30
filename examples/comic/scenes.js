// Comic style example: a kid misses every shot, practises at night in the rain, then swishes the buzzer-beater.
// Modules: toon.js (Toon puppets, Toon.Ball, Toon.P poses) and fx.js (FX set pieces), loaded before core.js.
// Every time is keyed to the voice lines: L0 = line 0 starts, L4e = line 4 ends, L1%40 = 40% into line 1, rain = scene starts.
window.buildEpisode = (world, S) => {
  const { E, scene, ov, during, eout, eio, clamp, T, ups } = S;
  const P = Toon.P, OL = FX.OL;
  const pose = (...ps) => Object.assign({}, ...ps);
  const lerp = (a, b, k) => a + (b - a) * k;
  // FX builders that make gradients look for svg.defs: give the scene's svg its defs
  const stage = (id, trn) => { const sc = scene(world, id, trn); sc.svg.defs = sc.defs; return sc; };
  // only show a group inside a time window
  const showIn = (el, a, b) => { const A = T(a), B = T(b); ups.push(t => { el.style.display = t >= A && t < B ? '' : 'none'; }); return el; };

  // the kid: an original character (no real player, no team)
  const KID = {kid: true, skin: '#c58c62', skinD: '#9c6844', hair: '#3a2416', hairStyle: 'short', top: 'tee', shirt: '#2f7fd6', shirtD: '#1f5ea8',
    trim: '#ffd23f', num: null, shorts: '#1b2a4a', shortsD: '#111c33', shoe: '#ff5a3d', shoeD: '#c63d24', sock: '#f5f2ea'};
  const KID_RAIN = {...KID, shirt: '#3c7a4a', shirtD: '#2a5935', trim: '#ffd23f', hair: '#1f140c'};
  const KID_GAME = {...KID, top: 'tank', shirt: '#e8343d', shirtD: '#b5222b', trim: '#fbf3e4', num: '7', numFill: '#fbf3e4', shorts: '#e8343d', shortsD: '#b5222b'};
  const READY = pose(P.ready, {tor: 10, hd: -4, nua: 44, nfa: 76, fua: 36, ffa: 80, nth: 24, nsh: -40, fth: 6, fsh: -30, hand: 'open', fhand: 'open'});
  const SX = 300, FLOOR = 1290, KS = 1.6, BR = 30;   // kid x, floor y, kid scale, ball radius

  // one shot cycle: rest -> wind up (shoot) -> release -> back to rest (or `after` once the last shot is gone)
  const WIND = .32;
  const shotPose = (t, R, rest, after) => {
    let i = -1;
    R.forEach((r, k) => { if (t >= r - WIND) i = k; });
    if (i < 0) return rest;
    const ph = t - R[i], next = i < R.length - 1 ? rest : after;
    if (ph < -.1) return Toon.mix(rest, P.shoot, eout((ph + WIND) / (WIND - .1)));
    if (ph < 0) return Toon.mix(P.shoot, P.release, (ph + .1) / .1);
    return Toon.mix(P.release, next, eio(clamp(ph / .35)));
  };
  // parabola from p0 to p1 that rises h above the higher end
  const arc = (p0, p1, h, k) => [lerp(p0[0], p1[0], k), lerp(p0[1], p1[1], k) - (h + Math.abs(p1[1] - p0[1]) / 2) * 4 * k * (1 - k)];
  // a ball knocked off the rim: falls with gravity and bounces on the floor
  const fall = (p, v, dt, floor, g = 2600) => {
    let [x, y] = p, [vx, vy] = v, t = dt;
    for (let n = 0; n < 4; n++) {
      const a = g / 2, tf = (-vy + Math.sqrt(Math.max(0, vy * vy - 4 * a * (y - floor)))) / (2 * a);
      if (t < tf) return [x + vx * t, y + vy * t + a * t * t];
      x += vx * tf; y = floor; vy = -(vy + g * tf) * .5; vx *= .8; t -= tf;
    }
    return [x, y];
  };
  // a full shooting set: kid + one hand ball and one flight ball per shot. shots: [{r: release, hit: rim time, v: bounce or null for a make}]
  function shootingSet(sc, look, layers, hoop, a, b, shots, rest, after, face) {
    const kid = new Toon(layers.kid, look);
    const R = shots.map(s => T(s.r));
    kid.set(P.release, SX, FLOOR, 1, KS);
    const rel = kid.at('hand'), p0 = [rel[0] + 10, rel[1] - BR];
    const balls = shots.map(() => ({hand: new Toon.Ball(layers.hand, BR), fly: new Toon.Ball(layers.fly, BR)}));
    const A = T(a), B = T(b);
    ups.push(t => {
      if (t < A || t >= B) return;
      const p = pose(shotPose(t, R, rest, after), {face: face(t)});
      if (((t + .7) % 3.1) < .09) p.blink = 1;
      kid.set(p, SX, FLOOR, 1, KS, t);
      const h = kid.at('hand');
      let net = 0;
      shots.forEach((s, i) => {
        const r = R[i], hit = T(s.hit), held = t < r && (i === 0 || t >= r - WIND);
        balls[i].hand.set(h[0] + 8, h[1] - BR * .8, 0, 1, held);
        if (t < r) { balls[i].fly.set(0, 0, 0, 1, false); return; }
        const rim = s.v ? [hoop.rim[0] - 42, hoop.rim[1] - BR] : [hoop.rim[0], hoop.rim[1] - 8];
        let q;
        if (t < hit) q = arc(p0, rim, s.h || 110, (t - r) / (hit - r));
        else if (s.v) q = fall(rim, s.v, t - hit, FLOOR - BR);
        else { q = [rim[0], rim[1] + Math.min(1, (t - hit) / .3) * 150]; net = clamp((t - hit) / .45); }
        balls[i].fly.set(q[0], q[1], (t - r) * 620, 1, s.v ? t < hit + 1.6 : t < hit + .3);
      });
      hoop.setNet(net > 0 && net < 1 ? net : 0);
    });
    return kid;
  }
  // a comic sound word with a burst behind it, popped in at `at` and shown until `until`
  function soundWord(sc, layer, word, x, y, rot, at, until, fill = '#ffd23f', size = 150) {
    const g = FX.g(layer);
    FX.burst(g, x, y, size * .75, size * 1.25, 12, fill, OL, 9, Math.round(x + y));
    FX.popIn(g, at, .3, x, y);
    showIn(g, at, until);
    ov(sc, word, `left:${x - 400}px;width:800px;top:${y - size * .55}px;text-align:center;transform:rotate(${rot}deg)`, `slam@${at}`, `${at}..${until}`, 'word')
      .style.fontSize = size + 'px';
  }

  // ---------------------------------------------------------------- miss: the gym, four bricks in a row
  {
    const sc = stage('miss', 'cut'), svg = sc.svg, W = sc.cam;
    FX.rect(W, 0, 0, 1080, 1920, FX.lin(svg, [[0, '#3b2a5c'], [.55, '#6a4a8a'], [1, '#2a1d40']]));
    for (let i = 0; i < 6; i++) FX.rect(W, 0, 760 + i * 64, 1080, 30, '#2b1f45', {opacity: .5});   // empty bleachers
    FX.rect(W, 0, 700, 1080, 14, '#ffd23f', {opacity: .8});
    FX.court(svg, W, -100, 1180, 1150, 800);
    const layers = {fly: FX.g(W)}, hoop = FX.hoop(W, 860, 700, 1);
    layers.kid = FX.g(W); layers.hand = FX.g(W);
    const words = FX.g(sc.svg);
    // face: focus while shooting, wow on the first brick, grit on the next ones, sad at the end
    const face = t => t < T('L0%70') ? 'focus' : t < T('L1') ? 'wow' : t < T('L1%80') ? 'grit' : 'sad';
    const after = pose(P.stand, {hd: 22, tor: 6, nua: 2, fua: -4, tears: .7});
    shootingSet(sc, KID, layers, hoop, 'miss', 'misse', [
      {r: 'L0%70-0.55', hit: 'L0%70', v: [-260, -700]},
      {r: 'L1%8-0.5', hit: 'L1%8', v: [180, -820]},
      {r: 'L1%42-0.5', hit: 'L1%42', v: [-420, -600]},
      {r: 'L1%76-0.5', hit: 'L1%76', v: [-120, -900]},
    ], READY, after, face);
    soundWord(sc, words, 'CLANK!', 660, 540, -8, 'L0%70', 'L1%8', '#ffd23f', 130);
    soundWord(sc, words, 'CLANK!', 640, 560, 6, 'L1%8', 'L1%42', '#ff8a3d', 130);
    soundWord(sc, words, 'CLANK!', 670, 530, -4, 'L1%42', 'L1%76', '#ffd23f', 130);
    soundWord(sc, words, 'CLANK!!', 650, 550, 5, 'L1%76', 'misse', '#ff5a5a', 140);
    ov(sc, '<div class="kicker">Shots made</div><div class="title" style="font-size:180px">0</div>', 'left:0;right:0;top:190px;text-align:center', 'down@miss+0.1');
    S.camera(sc, 'miss', 'misse', 1, 1.06, 540, 1000);
    S.shake('L1%76', .35, 18);
  }

  // ---------------------------------------------------------------- rain: night after night, one finally drops
  {
    const sc = stage('rain', 'flash'), svg = sc.svg, W = sc.cam;
    FX.rect(W, 0, 0, 1080, 1920, FX.lin(svg, [[0, '#070a1c'], [.5, '#1a2550'], [1, '#0c1028']]));
    FX.skyline(W, -40, 1120, 1150, '#1c2240', 6, 220, 560, '#ffd27a');
    FX.rect(W, 0, 1150, 1080, 800, FX.lin(svg, [[0, '#2c3348'], [1, '#141824']]));     // wet asphalt
    for (const [x, y, w] of [[180, 1330, 220], [620, 1250, 300], [880, 1400, 160]]) E('ellipse', {cx: x, cy: y, rx: w / 2, ry: 16, fill: '#6f86c9', opacity: .35}, W);
    FX.streetlight(W, 120, 1180, 640, '#ffd27a', svg);
    const layers = {fly: FX.g(W)}, hoop = FX.hoop(W, 860, 700, 1);
    layers.kid = FX.g(W); layers.hand = FX.g(W);
    shootingSet(sc, KID_RAIN, layers, hoop, 'rain', 'raine', [
      {r: 'L2%35-0.5', hit: 'L2%35', v: [-300, -650]},
      {r: 'L2%88-0.55', hit: 'L2%88', v: null},
    ], READY, pose(P.stand, {hd: -6}), t => t < T('L2%88') ? 'grit' : 'smile');
    FX.rain(FX.g(W), 'rain', 'raine', 160);
    const words = FX.g(sc.svg);
    soundWord(sc, words, 'CLANK!', 660, 560, -6, 'L2%35', 'L2%70', '#6fc3ff', 120);
    soundWord(sc, words, 'SWISH!', 660, 560, 5, 'L2%88', 'raine', '#3ccf6e', 120);
    const night = ov(sc, '<div class="kicker">Night</div><div class="title" style="font-size:180px">1</div>', 'left:0;right:0;top:190px;text-align:center', 'down@rain+0.1').querySelector('.title');
    S.counter(v => { night.textContent = Math.round(v); }, 1, 300, 'rain+0.2', T('L2e') - T('rain') - .2);
    S.flashAt('L2%60', .55, .25);
    S.camera(sc, 'rain', 'raine', 1.04, 1, 540, 1000);
  }

  // ---------------------------------------------------------------- final: last second, the buzzer-beater
  {
    const sc = stage('final', 'zoom'), svg = sc.svg;
    FX.rect(svg, 0, 0, 1080, 1920, FX.lin(svg, [[0, '#07061a'], [.45, '#2a1446'], [1, '#120c1e']]));
    const W = FX.g(svg);                                  // the world group the camera moves
    FX.crowd(W, -300, 1400, 470, 11, 'final', 'finale', t => t < T('L4') ? .35 : 1, 4, .5);
    const rays = showIn(FX.g(W), 'L4', 'finale');
    FX.rays(rays, 820, 640, 20, '#ffd23f', .22, 10);
    FX.court(svg, W, -400, 1500, 1150, 900);
    const layers = {fly: FX.g(W)}, hoop = FX.hoop(W, 860, 640, 1);
    layers.kid = FX.g(W); layers.hand = FX.g(W);
    const rel = T('L4-0.62'), hit = T('L4-0.02');
    const won = t => t >= hit;
    const kid = shootingSet(sc, KID_GAME, layers, hoop, 'final', 'finale', [{r: rel, hit, v: null, h: 120}], READY, P.stand,
      t => t < rel ? 'focus' : t < hit ? 'wow' : 'grin');
    // after the swish he jumps and cheers: the celebrate pose replaces the shot rest pose
    ups.push(t => {
      if (t < hit + .3 || t >= T('finale')) return;
      const k = t - hit - .3, p = pose(P.celebrate, {lift: 70 * Math.abs(Math.sin(k * 7)) * Math.max(.3, 1 - k / 3), open: 1});
      if (((t + .7) % 3.1) < .09) p.blink = 1;
      kid.set(p, SX + 40, FLOOR, 1, KS, t);
    });
    FX.cam(W, [['final', 520, 980, 1.14], [rel, 500, 920, 1.1, 0, 'io'], [hit, 640, 880, 1, -2, 'out'], ['finale', 600, 900, 1.05, 0]]);
    const top = FX.g(svg);
    FX.confetti(FX.g(top), 'L4', 'finale', ['#ffd23f', '#e8343d', '#4fb3ff', '#fbf3e4', '#3ccf6e'], 150);
    // scoreboard: home down by one, clock runs out while the ball is in the air
    const bd = ov(sc, '<div class="tm">HOME <b id="hs">48</b></div><div class="clk" id="clk">0:01</div><div class="tm"><b>49</b> AWAY</div>', '', 'down@final+0.1', '', 'board');
    const hs = bd.querySelector('#hs'), clk = bd.querySelector('#clk');
    ups.push(t => {
      hs.textContent = won(t) ? '50' : '48';
      clk.textContent = t < rel + .17 ? '0:01' : '0:00';
      clk.style.background = t >= rel + .17 ? '#e8343d' : '';
      clk.style.color = t >= rel + .17 ? '#fff' : '';
    });
    ov(sc, 'SWISH!', 'left:0;right:140px;top:340px;text-align:center;transform:rotate(-6deg)', 'smash@L4-0.02', 'L4-0.02..L4%55', 'boom').style.fontSize = '230px';
    ov(sc, '<span class="pill">Buzzer-beater!</span>', 'left:0;right:0;top:420px;text-align:center', 'pop@L4%55', 'L4%55..finale');
    S.impact(hit);
    S.shake(hit, .5, 24);
    S.flashAt(hit + .1, .5, .25);
  }
};
