/* Drain-pipe animation: flow → clog → pressure → snake → WOOSH → clear */
(function () {
  'use strict';

  const canvas = document.getElementById('pipe-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  /* ---- layout ---- */
  let W, H, PY, CX, VLX, VRX, VTY;
  const PH  = 32;   /* pipe interior height */
  const PW  = 7;    /* pipe wall thickness */
  const VPW = 30;   /* vertical pipe interior width */

  function resize() {
    const rect = canvas.getBoundingClientRect();
    W  = canvas.width  = rect.width;
    H  = canvas.height = rect.height;
    PY  = H * 0.60;                 /* horizontal pipe centre Y */
    CX  = W * 0.55;                 /* clog centre X */
    VLX = W * 0.25;                 /* left vertical pipe X */
    VRX = W * 0.75;                 /* right vertical pipe X */
    VTY = 10;                       /* vertical pipe top Y */
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  /* ---- cycle / phases ---- */
  const CYCLE = 22000;
  const T = { clog: 5000, pressure: 8500, snake: 11500, burst: 18500, clear: 20500 };

  function phase(elapsed) {
    const t = elapsed % CYCLE;
    if (t < T.clog)     return { name: 'flow',     p: t / T.clog };
    if (t < T.pressure) return { name: 'clog',     p: (t - T.clog)     / (T.pressure - T.clog) };
    if (t < T.snake)    return { name: 'pressure', p: (t - T.pressure) / (T.snake - T.pressure) };
    if (t < T.burst)    return { name: 'snake',    p: (t - T.snake)    / (T.burst - T.snake) };
    if (t < T.clear)    return { name: 'burst',    p: (t - T.burst)    / (T.clear - T.burst) };
    return { name: 'clear', p: (t - T.clear) / (CYCLE - T.clear) };
  }

  /* ---- particle pools ---- */
  let drops = [];      /* horizontal flow droplets */
  let vDrops = [];     /* vertical drip droplets */
  let burst = [];      /* explosion particles */
  let t0 = null;

  /* ================================================================
     HELPERS
  ================================================================ */

  function drawRoundPipe(x, y, w, h, isV) {
    const r = Math.min(w, h) / 2;
    /* body */
    const g = isV
      ? ctx.createLinearGradient(x, 0, x + w, 0)
      : ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0,   '#1c3462');
    g.addColorStop(0.35,'#0e1f3b');
    g.addColorStop(0.65,'#0b1830');
    g.addColorStop(1,   '#1c3462');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
    /* rim */
    ctx.strokeStyle = 'rgba(14,165,233,0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    /* sheen */
    const sh = isV
      ? ctx.createLinearGradient(x, 0, x + 6, 0)
      : ctx.createLinearGradient(0, y, 0, y + 6);
    sh.addColorStop(0, 'rgba(255,255,255,0.09)');
    sh.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sh;
    ctx.beginPath();
    if (isV) ctx.roundRect(x + 2, y + 2, 6, h - 4, r * 0.5);
    else      ctx.roundRect(x + 2, y + 2, w - 4, 6, r * 0.5);
    ctx.fill();
  }

  function withClip(fn) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, PY - PH / 2, W, PH);
    ctx.rect(VLX - VPW / 2, VTY, VPW, PY - PH / 2 - VTY);
    ctx.rect(VRX - VPW / 2, VTY, VPW, PY - PH / 2 - VTY);
    ctx.clip();
    fn();
    ctx.restore();
  }

  /* ================================================================
     DRAW FUNCTIONS
  ================================================================ */

  function drawPipes() {
    /* verticals first so horizontal overlaps them at junction */
    drawRoundPipe(VLX - VPW / 2 - PW, VTY, VPW + PW * 2, PY - PH / 2 - VTY + PH / 2 + PW, true);
    drawRoundPipe(VRX - VPW / 2 - PW, VTY, VPW + PW * 2, PY - PH / 2 - VTY + PH / 2 + PW, true);
    /* horizontal */
    drawRoundPipe(0, PY - PH / 2 - PW, W, PH + PW * 2, false);
  }

  function drawJoints() {
    /* collar rings along horizontal */
    [0.10, 0.30, 0.45, 0.60, 0.75, 0.90].forEach(f => {
      const jx = W * f;
      ctx.fillStyle = '#162d55';
      ctx.strokeStyle = 'rgba(14,165,233,0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(jx - 7, PY - PH / 2 - PW - 3, 14, PH + PW * 2 + 6, 3);
      ctx.fill(); ctx.stroke();
    });
    /* T-junction caps */
    [VLX, VRX].forEach(vx => {
      ctx.fillStyle = '#1a3060';
      ctx.strokeStyle = 'rgba(14,165,233,0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(vx - VPW / 2 - PW - 3, PY - PH / 2 - PW - 3, VPW + PW * 2 + 6, PH + PW * 2 + 6, 5);
      ctx.fill(); ctx.stroke();
    });
  }

  function waterColor(ph) {
    if (ph.name === 'pressure') {
      const r = Math.round(14  + ph.p * 234);
      const g = Math.round(165 - ph.p * 52);
      const b = Math.round(233 - ph.p * 213);
      return `rgba(${r},${g},${b},0.85)`;
    }
    if (ph.name === 'burst') return 'rgba(255,255,255,0.95)';
    return 'rgba(14,165,233,0.82)';
  }

  function drawWater(ph, elapsed) {
    const clogProg = ph.name === 'clog'     ? ph.p
                   : ph.name === 'pressure' ? 1
                   : ph.name === 'snake'    ? 1
                   : ph.name === 'burst'    ? 1 - ph.p
                   : 0;
    const clogL = CX - 52 * clogProg;
    const clogR = CX + 52 * clogProg;
    const wc = waterColor(ph);
    const shimOff = (elapsed * 0.13) % (W + 300);

    function fillW(x, y, w, h) {
      if (w <= 0 || h <= 0) return;
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0,   wc);
      g.addColorStop(0.4, wc.replace('0.82', '0.9').replace('0.85', '0.92').replace('0.95', '1'));
      g.addColorStop(1,   wc.replace('0.82', '0.65').replace('0.85', '0.68').replace('0.95', '0.75'));
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
      /* shimmer */
      if (ph.name !== 'burst') {
        ctx.save();
        ctx.globalAlpha = 0.14;
        ctx.fillStyle = '#fff';
        [0, 180, 360, 540, 720].forEach(off => {
          const sx = (shimOff + off) % (W + 300) - 150;
          if (sx > x && sx < x + w) {
            ctx.fillRect(sx, y + h * 0.12, 70, 2);
            ctx.fillRect(sx + 35, y + h * 0.48, 42, 1.5);
          }
        });
        ctx.restore();
      }
    }

    withClip(() => {
      const hasClog = clogProg > 0.04;

      /* horizontal */
      if (hasClog) {
        fillW(0, PY - PH / 2, clogL, PH);
        /* stagnant right side */
        const dg = ctx.createLinearGradient(0, PY - PH / 2, 0, PY + PH / 2);
        dg.addColorStop(0, 'rgba(5,12,26,0.65)');
        dg.addColorStop(1, 'rgba(3,8,15,0.85)');
        ctx.fillStyle = dg;
        ctx.fillRect(clogR, PY - PH / 2, W - clogR, PH);
      } else {
        fillW(0, PY - PH / 2, W, PH);
      }

      /* left vertical */
      const vtH = PY - PH / 2 - VTY;
      if (hasClog && (ph.name === 'pressure' || ph.name === 'snake')) {
        /* back-up creeping upward */
        const backH = vtH * Math.min(ph.p, 1);
        fillW(VLX - VPW / 2, PY - PH / 2 - backH, VPW, backH);
        ctx.fillStyle = 'rgba(3,8,15,0.5)';
        ctx.fillRect(VLX - VPW / 2, VTY, VPW, vtH - backH);
      } else {
        fillW(VLX - VPW / 2, VTY, VPW, vtH);
      }

      /* right vertical */
      if (!hasClog || ph.name === 'burst' || ph.name === 'clear' || ph.name === 'flow') {
        fillW(VRX - VPW / 2, VTY, VPW, vtH);
      } else {
        ctx.fillStyle = 'rgba(5,12,26,0.7)';
        ctx.fillRect(VRX - VPW / 2, VTY, VPW, vtH);
      }
    });
  }

  function drawClog(ph) {
    const s = ph.name === 'clog'     ? ph.p
            : ph.name === 'pressure' ? 1
            : ph.name === 'snake'    ? 1
            : ph.name === 'burst'    ? 1 - ph.p
            : 0;
    if (s <= 0) return;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, PY - PH / 2, W, PH);
    ctx.clip();

    ctx.shadowColor = 'rgba(80,30,10,0.9)';
    ctx.shadowBlur = 18 * s;

    const rx = 54 * s, ry = (PH / 2 - 1) * s;

    ctx.beginPath();
    ctx.ellipse(CX, PY, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#5c3317'; ctx.fill();

    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.ellipse(CX - 10, PY, rx * 0.5, ry * 0.65, -0.15, 0, Math.PI * 2);
    ctx.fillStyle = '#3d1a0a'; ctx.fill();

    ctx.beginPath();
    ctx.ellipse(CX + 12, PY + 3, rx * 0.35, ry * 0.48, 0.25, 0, Math.PI * 2);
    ctx.fillStyle = '#4a2010'; ctx.fill();

    if (s > 0.4) {
      ctx.globalAlpha = 0.45 * s;
      ctx.strokeStyle = '#2d0f05';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(CX + Math.cos(a) * rx * 0.3, PY + Math.sin(a) * ry * 0.3);
        ctx.quadraticCurveTo(
          CX + Math.cos(a + 0.4) * rx * 0.68,
          PY + Math.sin(a + 0.4) * ry * 0.68,
          CX + Math.cos(a + 0.1) * rx * 0.96,
          PY + Math.sin(a + 0.1) * ry * 0.96
        );
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function spawnDroplets(ph, elapsed) {
    /* horizontal droplets */
    if ((ph.name === 'flow' || ph.name === 'clear') && Math.random() < 0.18) {
      drops.push({ x: 0, y: PY + (Math.random() - 0.5) * (PH - 6), r: 2 + Math.random() * 3, spd: 1.8 + Math.random() * 1.4, color: Math.random() > 0.5 ? '#22d3ee' : '#7dd3fc', life: 1 });
    }
    if (ph.name === 'clog' && Math.random() < 0.14 * (1 - ph.p)) {
      drops.push({ x: 0, y: PY + (Math.random() - 0.5) * (PH - 6), r: 2 + Math.random() * 2, spd: (1 - ph.p) * 1.8, color: '#22d3ee', life: 1 });
    }
    /* vertical drips */
    if (Math.random() < 0.07) {
      [VLX, VRX].forEach(vx => {
        vDrops.push({ x: vx + (Math.random() - 0.5) * (VPW - 6), y: VTY, r: 2 + Math.random() * 2, vy: 1.4 + Math.random() * 1.2, color: '#0ea5e9', life: 1 });
      });
    }
  }

  function updateAndDrawDroplets(ph) {
    const clogS = ph.name === 'clog' ? ph.p : ph.name === 'pressure' || ph.name === 'snake' ? 1 : 0;
    const clogL = CX - 54 * clogS;

    /* horizontal */
    drops = drops.filter(d => d.life > 0);
    drops.forEach(d => {
      d.x += d.spd;
      if (clogS > 0.05 && d.x >= clogL) d.life = 0;
      if (d.x > W) d.life = 0;
      ctx.save();
      ctx.globalAlpha = d.life * 0.65;
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fillStyle = d.color; ctx.fill();
      ctx.restore();
    });

    /* vertical */
    vDrops = vDrops.filter(d => d.life > 0);
    vDrops.forEach(d => {
      d.y += d.vy;
      if (d.y >= PY - PH / 2) d.life = 0;
      /* suppress right-pipe drips when clogged */
      if (clogS > 0.1 && Math.abs(d.x - VRX) < VPW) d.life = 0;
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fillStyle = d.color; ctx.fill();
      ctx.restore();
    });
  }

  function drawPressureVFX(ph, elapsed) {
    if (ph.name !== 'pressure') return;
    const pulse = 0.4 + 0.6 * Math.abs(Math.sin(elapsed * 0.007));

    ctx.save();
    ctx.globalAlpha = pulse * ph.p;
    ctx.font = `bold ${11 + ph.p * 3}px monospace`;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f87171';
    ctx.fillText('⚠ PRESSURE', VLX - 50, VTY + 14);
    ctx.restore();

    /* backed-up bubbles in left vertical */
    const vtH = PY - PH / 2 - VTY;
    const numB = Math.floor(ph.p * 5);
    for (let i = 0; i < numB; i++) {
      const bx = VLX + (Math.random() - 0.5) * (VPW - 6);
      const by = PY - PH / 2 - Math.random() * vtH * Math.min(ph.p, 1);
      ctx.save();
      ctx.globalAlpha = 0.3 + Math.random() * 0.3;
      ctx.beginPath(); ctx.arc(bx, by, 2 + Math.random() * 3, 0, Math.PI * 2);
      ctx.strokeStyle = '#f87171'; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    }
  }

  function drawSnakeTool(ph, elapsed) {
    if (ph.name !== 'snake') return;

    const clogL = CX - 54;
    const tipX  = -50 + (clogL - (-50)) * Math.min(ph.p * 1.12, 1);
    const wave  = Math.sin(elapsed * 0.004) * 3 * (1 - ph.p);

    ctx.save();

    /* cable */
    const cg = ctx.createLinearGradient(0, 0, tipX, 0);
    cg.addColorStop(0, '#374151');
    cg.addColorStop(1, '#94a3b8');
    ctx.strokeStyle = cg;
    ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, PY + wave * 0.25);
    ctx.quadraticCurveTo(tipX * 0.45, PY + wave, tipX, PY);
    ctx.stroke();
    /* cable highlight */
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, PY + wave * 0.25 - 1.5);
    ctx.quadraticCurveTo(tipX * 0.45, PY + wave - 1.5, tipX, PY - 1.5);
    ctx.stroke();

    /* auger head — spins as it advances */
    ctx.translate(tipX, PY);
    ctx.rotate(elapsed * 0.012);

    const hr = 13;
    const hg = ctx.createRadialGradient(0, 0, 0, 0, 0, hr);
    hg.addColorStop(0, '#64748b');
    hg.addColorStop(1, '#1e293b');
    ctx.beginPath(); ctx.arc(0, 0, hr, 0, Math.PI * 2);
    ctx.fillStyle = hg; ctx.fill();
    ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1.5; ctx.stroke();

    /* blades */
    ctx.strokeStyle = '#0ea5e9'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 4, Math.sin(a) * 4);
      ctx.lineTo(Math.cos(a) * (hr - 2), Math.sin(a) * (hr - 2));
      ctx.stroke();
    }

    /* glowing centre */
    ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#22d3ee'; ctx.fill();
    ctx.shadowBlur = 0;

    ctx.restore();

    /* impact sparks near clog */
    if (ph.p > 0.82) {
      const alpha = (ph.p - 0.82) / 0.18;
      for (let i = 0; i < 4; i++) {
        const angle = Math.random() * Math.PI * 2;
        const d = 5 + Math.random() * 18;
        ctx.save();
        ctx.globalAlpha = alpha * 0.7;
        ctx.beginPath();
        ctx.arc(tipX + Math.cos(angle) * d, PY + Math.sin(angle) * d * 0.4, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = '#fbbf24'; ctx.fill();
        ctx.restore();
      }
    }
  }

  function drawBurstVFX(ph) {
    if (ph.name !== 'burst') return;

    /* spawn particles once */
    if (ph.p < 0.07 && burst.length === 0) {
      for (let i = 0; i < 35; i++) {
        const a = Math.random() * Math.PI * 2;
        const spd = 1.5 + Math.random() * 6;
        burst.push({
          x: CX, y: PY + (Math.random() - 0.5) * PH * 0.5,
          vx: Math.abs(Math.cos(a)) * spd * 1.6 * (Math.random() > 0.3 ? 1 : -1),
          vy: Math.sin(a) * spd * 0.45,
          r: 2 + Math.random() * 5, life: 1,
          dec: 0.015 + Math.random() * 0.02,
          c: ['#22d3ee','#7dd3fc','#0ea5e9','#bae6fd','#fff','#38bdf8'][Math.floor(Math.random() * 6)]
        });
      }
    }

    /* expanding ring */
    ctx.save();
    ctx.globalAlpha = (1 - ph.p) * 0.6;
    ctx.beginPath(); ctx.arc(CX, PY, ph.p * 130, 0, Math.PI * 2);
    ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 3; ctx.stroke();
    ctx.globalAlpha = (1 - ph.p) * 0.28;
    ctx.beginPath(); ctx.arc(CX, PY, ph.p * 80, 0, Math.PI * 2);
    ctx.strokeStyle = '#7dd3fc'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();

    /* flash */
    if (ph.p < 0.25) {
      ctx.save();
      ctx.globalAlpha = (0.25 - ph.p) / 0.25 * 0.5;
      ctx.fillStyle = '#bae6fd';
      ctx.fillRect(CX - 220, PY - PH / 2, 680, PH);
      ctx.restore();
    }

    /* speed rush lines */
    ctx.save();
    ctx.globalAlpha = ph.p * 0.9;
    [[-10, 2, '#22d3ee'], [-1, 3, '#7dd3fc'], [8, 2, '#38bdf8']].forEach(([off, lw, col]) => {
      const len = (85 + lw * 40) * ph.p;
      ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(CX + 14, PY + off);
      ctx.lineTo(CX + 14 + len, PY + off);
      ctx.stroke();
    });
    ctx.restore();

    /* particles */
    burst = burst.filter(p => p.life > 0);
    burst.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.07; p.life -= p.dec;
      ctx.save();
      ctx.globalAlpha = p.life * 0.88;
      ctx.shadowColor = p.c; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
      ctx.fillStyle = p.c; ctx.fill();
      ctx.restore();
    });
  }

  function drawLabel(ph) {
    const INFO = {
      flow:     ['WATER FLOWING FREELY', 'rgba(14,165,233,0.55)'],
      clog:     ['CLOG FORMING...', 'rgba(251,191,36,0.8)'],
      pressure: ['⚠  PRESSURE BUILDING', 'rgba(248,113,113,0.9)'],
      snake:    ['SENDING IN THE SNAKE', 'rgba(148,163,184,0.85)'],
      burst:    ['💥  CLOG CLEARED!', 'rgba(34,211,238,1)'],
      clear:    ['DRAIN FLOWING FREE', 'rgba(74,222,128,0.85)'],
    };
    const [text, color] = INFO[ph.name] || INFO.flow;
    ctx.save();
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.letterSpacing = '0.1em';
    ctx.fillStyle = color;
    ctx.fillText(text, W / 2, PY + PH / 2 + PW + 22);
    ctx.restore();
  }

  /* ================================================================
     MAIN LOOP
  ================================================================ */
  function frame(ts) {
    if (!t0) t0 = ts;
    const elapsed = ts - t0;
    const ph = phase(elapsed);

    /* reset burst pool at each new cycle */
    if (elapsed % CYCLE < 80) burst = [];

    ctx.clearRect(0, 0, W, H);

    drawPipes();
    drawWater(ph, elapsed);
    drawClog(ph);
    spawnDroplets(ph, elapsed);
    updateAndDrawDroplets(ph);
    drawJoints();           /* over water for depth */
    drawSnakeTool(ph, elapsed);
    drawPressureVFX(ph, elapsed);
    drawBurstVFX(ph);
    drawLabel(ph);

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
