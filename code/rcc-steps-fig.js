// ccRCC "four steps" slide (10 Nov 2026): Scale · Map & group · Review · Compare, from the corrected reanalysis.
// Data: rcc-steps.js (window.DECK_RCC_STEPS). One canvas; panel k is revealed at step k (panel 1 from the start).
(function () {
  const FIGS = (window.FIGS = window.FIGS || {});
  const D = window.DECK_RCC_STEPS;
  const FONT = "'Source Sans 3', system-ui, sans-serif";
  const INK = "#0f172a", MUTED = "#64748b", GRID = "#e2e8f0", BLOOD = "#d62728", TUMOR = "#1f6fb4";
  const LO = [241, 245, 249], HI = [49, 46, 129];
  const ramp = (v) => `rgb(${LO.map((a, i) => Math.round(a + (HI[i] - a) * v)).join(",")})`;
  // viridis (same stops as FlowCV's featureDensityColor.ts) for the Review heatmap
  const VIR = [[0, [68, 1, 84]], [.25, [59, 82, 139]], [.5, [33, 145, 140]], [.75, [94, 201, 98]], [1, [253, 231, 37]]];
  const viridis = (t) => { t = Math.max(0, Math.min(1, t)); let i = 0; while (i < VIR.length - 2 && t > VIR[i + 1][0]) i++;
    const [s0, a] = VIR[i], [s1, b] = VIR[i + 1], f = (t - s0) / (s1 - s0); return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * f)).join(",")})`; };
  const short = (s) => s.replace(/^\d+_/, "").replace(/_/g, " ").replace("CD013-", "CD103-").replace(" naive-like", " naive");
  function ctx(c) {
    const W = parseFloat(c.style.width), H = parseFloat(c.style.height), k = c.width / W;
    const x = c.getContext("2d"); x.setTransform(k, 0, 0, k, 0, 0); x.clearRect(0, 0, W, H); return [x, W, H];
  }
  function head(x, ox, n, title, sub) {
    x.fillStyle = "#2563eb"; x.beginPath(); x.arc(ox + 16, 18, 16, 0, 2 * Math.PI); x.fill();
    x.fillStyle = "#fff"; x.font = `700 20px ${FONT}`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(String(n), ox + 16, 19);
    x.fillStyle = INK; x.font = `700 24px ${FONT}`; x.textAlign = "left"; x.fillText(title, ox + 42, 19);
    x.fillStyle = MUTED; x.font = `18px ${FONT}`; x.fillText(sub, ox + 42, 46); x.textBaseline = "alphabetic";
  }
  FIGS["s-rccsteps"] = {
    init(el) { this.cv = el.querySelector("#rs-cv"); this.n = 0; },
    enter() { this.draw(); },
    step(n) { this.n = n; this.draw(); },
    draw() {
      if (!D || !this.cv) return;
      const [x, W, H] = ctx(this.cv);
      // Review (the heatmap) gets the widest panel; Map and Compare the narrowest
      const gap = 28, top = 72, bot = H - 6, WT = [0.95, 0.82, 1.43, 0.8], PW = WT.map((w) => (W - 3 * gap) * w / 4);
      const P = PW.map((_, k) => PW.slice(0, k).reduce((a, b) => a + b + gap, 0));
      let pw = PW[0];
      const fam = D.families;
      // 1 · Scale: distribution of each marker's signal; dashed line = positive threshold; % positive per tissue
      x.globalAlpha = 1; head(x, P[0], 1, "Scale", "signal per cell · % positive");
      const rh = (bot - top - 34) / D.scale.length;
      D.scale.forEach((s, i) => {
        const y0 = top + i * rh, base = y0 + rh - 26, hh = rh - 46, mx = Math.max(...s.blood, ...s.tumor);
        const sx = (v) => P[0] + ((v - s.lo) / (s.hi - s.lo)) * pw;
        x.fillStyle = INK; x.font = `600 20px ${FONT}`; x.textAlign = "left"; x.fillText(s.marker, P[0], y0 + 18);
        if (s.pos_blood !== undefined) {
          x.font = `600 17px ${FONT}`; x.textAlign = "right";
          x.fillStyle = TUMOR; x.fillText(`${Math.round(s.pos_tumor)}%`, P[0] + pw, y0 + 18);
          const wt = x.measureText(`${Math.round(s.pos_tumor)}%`).width;
          x.fillStyle = MUTED; x.font = `16px ${FONT}`; x.fillText(" · ", P[0] + pw - wt, y0 + 18);
          const wd = x.measureText(" · ").width; x.font = `600 17px ${FONT}`;
          x.fillStyle = BLOOD; x.fillText(`${Math.round(s.pos_blood)}%`, P[0] + pw - wt - wd, y0 + 18);
          x.textAlign = "left";
        }
        [["blood", BLOOD], ["tumor", TUMOR]].forEach(([k, col]) => {
          const v = s[k], bw = pw / v.length;
          x.beginPath(); x.moveTo(P[0], base);
          v.forEach((d, b) => x.lineTo(P[0] + (b + 0.5) * bw, base - (d / mx) * hh));
          x.lineTo(P[0] + pw, base); x.closePath(); x.globalAlpha = 0.18; x.fillStyle = col; x.fill();
          x.globalAlpha = 1; x.strokeStyle = col; x.lineWidth = 2.2; x.beginPath();
          v.forEach((d, b) => { const px = P[0] + (b + 0.5) * bw, py = base - (d / mx) * hh; b ? x.lineTo(px, py) : x.moveTo(px, py); }); x.stroke();
        });
        x.strokeStyle = GRID; x.lineWidth = 1; x.beginPath(); x.moveTo(P[0], base); x.lineTo(P[0] + pw, base); x.stroke();
        if (s.thr !== undefined) {
          const tx = sx(s.thr); x.strokeStyle = INK; x.lineWidth = 1.2; x.setLineDash([4, 4]); x.beginPath(); x.moveTo(tx, base); x.lineTo(tx, base - hh - 4); x.stroke(); x.setLineDash([]);
          x.fillStyle = MUTED; x.font = `14px ${FONT}`; x.textAlign = "left"; x.fillText("low", P[0], base + 15);
          x.textAlign = "left"; x.fillText("positive →", tx + 4, base + 15); x.textAlign = "right"; x.fillText("high", P[0] + pw, base + 15); x.textAlign = "left";
        }
      });
      x.font = `600 17px ${FONT}`; x.textAlign = "left"; x.fillStyle = BLOOD; x.fillText("● blood", P[0], bot - 4);
      x.fillStyle = TUMOR; x.fillText("● tumor", P[0] + 84, bot - 4);
      x.fillStyle = MUTED; x.font = `15px ${FONT}`; x.fillText("% = cells above the dashed line", P[0] + 172, bot - 4);
      // 2 · Map & group: the same cells twice, coloured by group (top) and by tissue (bottom)
      pw = PW[1]; x.globalAlpha = this.n >= 1 ? 1 : 0.18; head(x, P[1], 2, "Map & group", "UMAP · by group, then by tissue");
      const m = D.map, sx0 = m.xr[1] - m.xr[0], sy0 = m.yr[1] - m.yr[0], mh = (bot - top - 16) / 2;
      [0, 1].forEach((row) => {
        const by = top + row * (mh + 16), s = Math.min(pw / sx0, (mh - 24) / sy0);
        const ox = P[1] + (pw - s * sx0) / 2, oy = by + 24 + (mh - 24 - s * sy0) / 2;
        x.font = `600 18px ${FONT}`; x.textAlign = "left"; x.fillStyle = row ? INK : MUTED;
        if (row) { x.fillStyle = BLOOD; x.fillText("● blood", P[1], by + 16); x.fillStyle = TUMOR; x.fillText("● tumor", P[1] + 86, by + 16); }
        else x.fillText("FlowSOM groups (legend below)", P[1], by + 16);
        if (this.n < 1) { x.strokeStyle = GRID; x.strokeRect(P[1], by + 24, pw, mh - 24); return; }
        const idx = Array.from({ length: m.x.length }, (_, i) => i);
        for (const i of idx) {
          x.globalAlpha = row ? 0.55 : 1;
          x.fillStyle = row ? (m.t[i] ? TUMOR : BLOOD) : fam[m.f[i]].color;
          x.fillRect(ox + (m.x[i] - m.xr[0]) * s - 1, oy + s * sy0 - (m.y[i] - m.yr[0]) * s - 1, 2, 2);
        }
        x.globalAlpha = 1;
        // lineage labels at the median position of the CD8 groups (0-4) and CD4 groups (5-9)
        [["CD8 T", (f) => f <= 4], ["CD4 T", (f) => f >= 5 && f <= 9]].forEach(([lab, sel]) => {
          const xs = [], ys = []; for (let i = 0; i < m.x.length; i++) if (sel(m.f[i])) { xs.push(m.x[i]); ys.push(m.y[i]); }
          const md = (a) => a.sort((u, v) => u - v)[a.length >> 1];
          const lx = ox + (md(xs) - m.xr[0]) * s, ly = oy + s * sy0 - (md(ys) - m.yr[0]) * s;
          x.font = `700 26px ${FONT}`; x.textAlign = "center"; x.textBaseline = "middle"; x.lineJoin = "round";
          x.lineWidth = 7; x.strokeStyle = "rgba(255,255,255,.95)"; x.strokeText(lab, lx, ly); x.fillStyle = INK; x.fillText(lab, lx, ly);
          x.textBaseline = "alphabetic";
        });
      });
      // 3 · Review: groups bracketed by lineage (CD8 / CD4), named, with their median level of 10 key markers
      pw = PW[2]; x.globalAlpha = this.n >= 2 ? 1 : 0.18; head(x, P[2], 3, "Review", "median marker level per group");
      const hm = D.heat, KEEP = ["CCR7", "TCF-1", "CD45RO", "CD69", "CD103", "PD-1", "TIM-3", "CD39", "GZMB", "FOXP3"];
      const ki = KEEP.map((k) => hm.markers.indexOf(k)).filter((i) => i >= 0);
      const brW = 30, nameW = 232, hx0 = P[2] + brW + 16 + nameW, cw = (P[2] + pw - hx0) / ki.length;
      const cd8 = hm.rows.filter((r) => r.fam <= 4), cd4 = hm.rows.filter((r) => r.fam > 4), gapR = 18;
      const rowH = Math.min(62, (bot - top - 108 - gapR) / hm.rows.length);
      x.save(); x.font = `600 19px ${FONT}`; x.fillStyle = INK; x.textAlign = "left";
      ki.forEach((mi, c) => { x.save(); x.translate(hx0 + (c + 0.5) * cw + 6, top + 82); x.rotate(-Math.PI / 2.6); x.fillText(hm.markers[mi], 0, 0); x.restore(); });
      x.restore();
      // colour key: viridis, low → high (relative median per marker)
      if (this.n >= 2) {
        const kx = P[2] + brW + 4, ky = top + 44, kw = 170, kh = 14;
        for (let i = 0; i < kw; i++) { x.fillStyle = viridis(i / (kw - 1)); x.fillRect(kx + i, ky, 1.2, kh); }
        x.fillStyle = MUTED; x.font = `15px ${FONT}`; x.textBaseline = "alphabetic";
        x.textAlign = "left"; x.fillText("low", kx, ky + kh + 17); x.textAlign = "right"; x.fillText("high", kx + kw, ky + kh + 17);
        x.textAlign = "left"; x.fillText("median, per marker", kx, ky - 7);
      }
      let y = top + 96; const rowY = [];
      [["CD8 T", cd8], ["CD4 T", cd4]].forEach(([lin, rows]) => {
        const y0 = y;
        rows.forEach((r) => {
          x.fillStyle = fam[r.fam].color; x.fillRect(P[2] + brW + 4, y + 4, 12, rowH - 8);
          x.fillStyle = INK; x.font = `18px ${FONT}`; x.textAlign = "left"; x.textBaseline = "middle";
          x.fillText(fam[r.fam].name.replace(/^CD[48] /, ""), P[2] + brW + 24, y + rowH / 2);
          if (this.n >= 2) ki.forEach((mi, c) => { x.fillStyle = viridis(r.rel[mi]); x.fillRect(hx0 + c * cw, y + 1, cw - 1, rowH - 2); });
          rowY[r.fam] = [y, rowH];
          y += rowH;
        });
        // bracket + lineage label
        x.strokeStyle = INK; x.lineWidth = 1.5; x.beginPath(); x.moveTo(P[2] + brW, y0 + 3); x.lineTo(P[2] + brW - 6, y0 + 3); x.lineTo(P[2] + brW - 6, y - 3); x.lineTo(P[2] + brW, y - 3); x.stroke();
        x.save(); x.translate(P[2] + brW - 18, (y0 + y) / 2); x.rotate(-Math.PI / 2); x.textAlign = "center"; x.textBaseline = "middle"; x.font = `700 20px ${FONT}`; x.fillStyle = INK; x.fillText(lin, 0, 0); x.restore();
        y += gapR;
      });
      x.textBaseline = "alphabetic";
      // 4 · Compare (11 Nov 2026, v2): one dumbbell per group, row-aligned with panel 3. Red = blood, blue = tumor
      // (median % of T cells across the 6 patients); the arrow points from blood to tumor; values on the right.
      pw = PW[3]; x.globalAlpha = this.n >= 3 ? 1 : 0.18; head(x, P[3], 4, "Compare", "% of T cells · median");
      const med = (a) => { const b = [...a].sort((u, v) => u - v), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
      const valW = 86, ax0 = P[3] + 6, aw = pw - valW - 14, XMAX = 40, sx = (v) => ax0 + Math.min(v, XMAX) / XMAX * aw;
      const yA = top + 96, yB = rowY.reduce((m, r) => (r ? Math.max(m, r[0] + r[1]) : m), 0);
      // key
      x.textBaseline = "middle"; x.font = `600 18px ${FONT}`; x.textAlign = "left";
      const kd = (cx, cy, col) => { x.beginPath(); x.arc(cx, cy, 7, 0, 2 * Math.PI); x.fillStyle = col; x.fill(); };
      kd(ax0 + 7, top + 74, BLOOD); x.fillStyle = BLOOD; x.fillText("blood", ax0 + 20, top + 74);
      kd(ax0 + 92, top + 74, TUMOR); x.fillStyle = TUMOR; x.fillText("tumor", ax0 + 105, top + 74);
      // grid and axis
      x.strokeStyle = "#e2e8f0"; x.lineWidth = 1; [0, 10, 20, 30, 40].forEach((v) => { x.beginPath(); x.moveTo(sx(v), yA); x.lineTo(sx(v), yB); x.stroke(); });
      x.fillStyle = MUTED; x.font = `15px ${FONT}`; x.textAlign = "center"; x.textBaseline = "alphabetic"; [0, 10, 20, 30, 40].forEach((v) => x.fillText(v + "%", sx(v), yB + 19));
      x.textAlign = "right"; x.fillText("blood → tumor", P[3] + pw, yA - 8);
      if (this.n >= 3) {
        const pct = (v) => (v < 1 ? "<1" : String(Math.round(v)));
        fam.forEach((f, k) => {
          const r = rowY[k]; if (!r) return; const [y, h] = r, cy = y + h / 2;
          const b = med(D.comp.filter((c) => c.sample.endsWith("blood")).map((c) => c.pct[k])), t = med(D.comp.filter((c) => c.sample.endsWith("tumor")).map((c) => c.pct[k]));
          const xb = sx(b), xt = sx(t), up = t > b, big = Math.abs(t - b) >= 5;
          // connector + arrowhead toward tumor
          x.strokeStyle = big ? (up ? "rgba(31,111,180,.55)" : "rgba(214,39,40,.5)") : "#cbd5e1"; x.lineWidth = big ? 5 : 3; x.lineCap = "round";
          const dir = Math.sign(xt - xb) || 1, tip = xt - dir * 10;
          if (Math.abs(xt - xb) > 16) { x.beginPath(); x.moveTo(xb, cy); x.lineTo(tip, cy); x.stroke();
            x.fillStyle = x.strokeStyle; x.beginPath(); x.moveTo(tip + dir * 2, cy); x.lineTo(tip - dir * 9, cy - 8); x.lineTo(tip - dir * 9, cy + 8); x.closePath(); x.fill(); }
          x.lineCap = "butt";
          const dot = (cx, col) => { x.beginPath(); x.arc(cx, cy, 8, 0, 2 * Math.PI); x.fillStyle = col; x.fill(); x.lineWidth = 2; x.strokeStyle = "#fff"; x.stroke(); };
          dot(xb, BLOOD); dot(xt, TUMOR);
          // values: blood → tumor
          x.textBaseline = "middle"; x.textAlign = "right"; x.font = `700 18px ${FONT}`; x.fillStyle = TUMOR; const tt = pct(t) + "%"; x.fillText(tt, P[3] + pw, cy);
          const tw = x.measureText(tt).width; x.font = `500 17px ${FONT}`; x.fillStyle = MUTED; x.fillText("→", P[3] + pw - tw - 4, cy);
          const aw2 = x.measureText("→").width; x.font = `600 17px ${FONT}`; x.fillStyle = BLOOD; x.fillText(pct(b), P[3] + pw - tw - aw2 - 8, cy);
        });
      }
      x.textBaseline = "alphabetic"; x.globalAlpha = 1;
    },
  };
})();
