// Scenes of one episode. Every scene id must match a "scene" in short.json; every time is keyed to the voice lines
// (L0 = line 0 starts, L0e = it ends, L0%50 = halfway, hook = scene starts, hooke = scene ends). See references/engine-api.md.
window.buildEpisode = (world, S) => {
  const { E, tr, scene, ov, camera, during, prog, eout, clamp } = S;

  // ---------------------------------------------------------------- hook: the payoff from frame 0
  {
    const sc = scene(world, 'hook', 'cut');
    // background: rays turning slowly behind a big number
    const rays = E('g', { opacity: .35 }, sc.cam);
    for (let i = 0; i < 18; i++) E('path', { d: 'M0,0 L-70,-1400 L70,-1400Z', fill: i % 2 ? '#ffb81c' : '#ff5a3d', transform: `rotate(${i * 20})` }, rays);
    during('hook', 'hooke', t => tr(rays, 540, 760, 1, t * 12));
    E('circle', { cx: 540, cy: 760, r: 300, fill: '#ffb81c', stroke: '#17111b', 'stroke-width': 16 }, sc.cam);
    const num = ov(sc, '3', 'left:0;right:0;top:470px;text-align:center', 'slam@0.05', '', 'boom');
    num.style.fontSize = '420px';
    ov(sc, 'SECONDS', 'left:0;right:0;top:1100px;text-align:center', 'up@L0%35', '', 'title');
    camera(sc, 'hook', 'hooke', 1, 1.08);
    S.shake('0.08', .35, 26);
  }

  // ---------------------------------------------------------------- points: one card per line
  {
    const sc = scene(world, 'points', 'whip');
    E('rect', { width: 1080, height: 1920, fill: '#2a2250' }, sc.cam);
    ov(sc, '<span class="pill">1. Payoff first</span>', 'left:0;right:0;top:420px;text-align:center', 'smash@L1');
    ov(sc, '<span class="pill" style="background:#4fb3ff">2. Then the story</span>', 'left:0;right:0;top:700px;text-align:center', 'smash@L2');
    // a progress bar that fills while the scene runs
    const bar = ov(sc, '', 'left:140px;top:1000px;width:800px;height:26px;border-radius:13px;background:#fbf3e4;border:6px solid #17111b;transform-origin:left center');
    during('points', 'pointse', (t, k) => { bar.style.transform = `scaleX(${eout(k).toFixed(3)})`; });
  }

  // ---------------------------------------------------------------- end: call to action
  {
    const sc = scene(world, 'end', 'zoom');
    E('rect', { width: 1080, height: 1920, fill: '#ffb81c' }, sc.cam);
    ov(sc, 'WHAT NEXT?', 'left:0;right:0;top:520px;text-align:center', 'slam@end+.1', '', 'title');
    ov(sc, '<span class="pill" style="background:#fbf3e4">Comment below</span>', 'left:0;right:0;top:760px;text-align:center', 'pop@L3%50');
  }
};
