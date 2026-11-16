f = r"c:/Users/Usuario/Documents/juegos/rajo-kart/index.html"
h = open(f, encoding="utf8").read()
js = r"""  {      // pared norte y oriente de la fase 7: pie y bancos rectos, paralelos a cada tramo del borde, que doblan en quiebres (no en curva)
    const smt = v => { v = Math.min(1, Math.max(0, v)); return v * v * (3 - 2 * v); };
    const CH = F7.slice(0, 8), NS7 = CH.length - 1, SG7 = [];
    for (let k = 0; k < NS7; k++) { const [ax, az] = CH[k], [bx, bz] = CH[k + 1], L = Math.hypot(bx - ax, bz - az); let nx = (bz - az) / L, nz = -(bx - ax) / L; if (inF7((ax + bx) / 2 + nx * 5, (az + bz) / 2 + nz * 5)) { nx = -nx; nz = -nz; } SG7.push({ ax, az, dx: (bx - ax) / L, dz: (bz - az) / L, L, nx, nz, c: 0 }); }
    const N = GNX * GNZ, own = new Int8Array(N).fill(-1), pm = new Float32Array(N), ht = new Float32Array(N), Rr = new Float32Array(N), ew = new Float32Array(N), bdA = new Float32Array(N);
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [x, z] of CH) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    const ia = Math.max(1, Math.floor((x0 - 300 - GX0) / CELL)), ib = Math.min(GNX - 2, Math.ceil((x1 + 300 - GX0) / CELL)), ja = Math.max(1, Math.floor((z0 - 300 - GZ0) / CELL)), jb = Math.min(GNZ - 2, Math.ceil((z1 + 300 - GZ0) / CELL));
    const plane = (s, x, z) => (x - s.ax) * s.nx + (z - s.az) * s.nz;
    for (let iz = ja; iz <= jb; iz++) for (let ix = ia; ix <= ib; ix++) {      // a qué tramo pertenece cada celda (el más cercano) y su distancia en ángulo recto
      const i = iz * GNX + ix, x = GX0 + ix * CELL, z = GZ0 + iz * CELL;
      let bk = -1, bd = 1e9, bt = 0;
      for (let k = 0; k < NS7; k++) { const s = SG7[k], t = Math.max(0, Math.min(s.L, (x - s.ax) * s.dx + (z - s.az) * s.dz)), d = Math.hypot(s.ax + s.dx * t - x, s.az + s.dz * t - z); if (d < bd) { bd = d; bk = k; bt = t; } }
      if (bd > 300) continue;
      { let od = 1e9; for (let k = 8; k < F7.length; k++) { const [ax, az] = F7[k], [bx, bz] = F7[(k + 1) % F7.length], dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz))); od = Math.min(od, Math.hypot(ax + dx * t - x, az + dz * t - z)); } if (od < bd) continue; }      // más cerca de otro borde de la fase 7
      const s = SG7[bk]; own[i] = bk; bdA[i] = bd; ht[i] = f7h(s.ax + s.dx * bt, s.az + s.dz * bt);
      let e = 1; if (bk === 0 && bt <= 0) e = Math.max(0, 1 - bd / 60); if (bk === NS7 - 1 && bt >= s.L) e = Math.max(0, 1 - bd / 60); ew[i] = e;      // en los extremos se funde con lo que hay
      if (inF7(x, z) && !f7[i] && e >= 1) { const m = plane(s, x, z); if (m > -70) s.c = Math.max(s.c, -m + 4); }      // el piso no alcanza el borde (ahí pasa un camino): el pie recto se corre hacia adentro
    }
    for (const s of SG7) s.c = Math.min(60, s.c);
    const mit = (k, x, z) => { let m = -1e9; for (let j = Math.max(0, k - 1); j <= Math.min(NS7 - 1, k + 1); j++) m = Math.max(m, plane(SG7[j], x, z) + SG7[j].c); return m; };      // distancia "a escuadra": esquinas en quiebre
    for (let iz = ja; iz <= jb; iz++) for (let ix = ia; ix <= ib; ix++) { const i = iz * GNX + ix; if (own[i] < 0) continue; const x = GX0 + ix * CELL, z = GZ0 + iz * CELL;
      pm[i] = mit(own[i], x, z);
      if (f7[i] && pm[i] > 0 && ew[i] >= 1) { f7[i] = 0; fix[i] = 0; }      // piso que queda fuera del pie recto: pasa a ser pared
      Rr[i] = (F[i] - ht[i]) / Math.max(15, bdA[i]); }
    const fd = new Float32Array(N).fill(1e9); for (let i = 0; i < N; i++) if (fix[i] && !f7[i]) fd[i] = 0;      // distancia a caminos y a la superficie
    for (let pass = 0; pass < 2; pass++) { for (let iz = 1; iz < GNZ - 1; iz++) for (let ix = 1; ix < GNX - 1; ix++) { const i = iz * GNX + ix; fd[i] = Math.min(fd[i], fd[i - 1] + CELL, fd[i - GNX] + CELL, fd[i - GNX - 1] + CELL * 1.41, fd[i - GNX + 1] + CELL * 1.41); }
      for (let iz = GNZ - 2; iz >= 1; iz--) for (let ix = GNX - 2; ix >= 1; ix--) { const i = iz * GNX + ix; fd[i] = Math.min(fd[i], fd[i + 1] + CELL, fd[i + GNX] + CELL, fd[i + GNX + 1] + CELL * 1.41, fd[i + GNX - 1] + CELL * 1.41); } }
    for (let i = 0; i < N; i++) { if (own[i] < 0 || fix[i] || f7[i]) continue;
      const S = 0.75, r = GD[i] < 150 ? hr[GI[i]] : YTOP;      // pendiente general de la pared (~37°) y nunca sobre la rampa de al lado
      const Fn = Math.min(ht[i] + S * Math.max(0, pm[i]), r - 1, YTOP), w = ew[i] * smt(fd[i] / 15);
      F[i] = F[i] * (1 - w) + Fn * w; }
  }
"""
anchor = "  // bancos (estándar de rajo abierto): berma plana a cota fija"
assert h.count(anchor) == 1
h = h.replace(anchor, js + anchor)
open(f, "w", encoding="utf8", newline="").write(h); print("ok")
