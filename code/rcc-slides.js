// ccRCC slides for index-en-spectral.html (10 Nov 2026), loaded after figs.js and before deck.js.
// s-rccres  (slide 15): tumor CD8 T cells patient by patient along the exhaustion path (rcc-patients.js).
// s-rcccomp (backup):   blood vs tumor composition, each tissue clustered separately, 2D/3D maps (rcc-separate.js).
// Overrides figs.js FIGS["s-rccres"] for this deck only; the other decks keep their own slide.
(function () {
  const FIGS = (window.FIGS = window.FIGS || {});
  const FONT = "'Source Sans 3', system-ui, sans-serif";
  const INK = "#0f172a", MUTED = "#64748b", GRID = "#e2e8f0", GREY = "#cbd5e1";
  const LO = [241, 245, 249], HI = [49, 46, 129];
  const RDYLBU = [[0, [49, 54, 149]], [.25, [116, 173, 209]], [.5, [254, 224, 144]], [.75, [244, 109, 67]], [1, [165, 0, 38]]];
  const rdylbu = (t) => { t = Math.max(0, Math.min(1, t)); let i = 0; while (i < RDYLBU.length - 2 && t > RDYLBU[i + 1][0]) i++;
    const [s0, a] = RDYLBU[i], [s1, b] = RDYLBU[i + 1], f = (t - s0) / (s1 - s0); return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * f)).join(",")})`; };
  const VIRIDIS = [[0, [68, 1, 84]], [.25, [59, 82, 139]], [.5, [33, 145, 140]], [.75, [94, 201, 98]], [1, [253, 231, 37]]];
  const viridis = (t) => { t = Math.max(0, Math.min(1, t)); let i = 0; while (i < VIRIDIS.length - 2 && t > VIRIDIS[i + 1][0]) i++;
    const [s0, a] = VIRIDIS[i], [s1, b] = VIRIDIS[i + 1], f = (t - s0) / (s1 - s0); return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * f)).join(",")})`; };
  const ramp = (v) => `rgb(${LO.map((a, i) => Math.round(a + (HI[i] - a) * v)).join(",")})`;
  const EXH = "#4338ca", PROG = "#0d9488", OTHER = "#94a3b8";
  function ctx(c) {
    const W = parseFloat(c.style.width), H = parseFloat(c.style.height), k = c.width / W;
    const x = c.getContext("2d"); x.setTransform(k, 0, 0, k, 0, 0); x.clearRect(0, 0, W, H);
    return [x, W, H];
  }
  function smooth(x, pts) {
    x.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], mx = (x0 + x1) / 2;
      x.bezierCurveTo(mx, y0, mx, y1, x1, y1);
    }
  }

  // ---------- slide 15: patients differ along the CD8 exhaustion path ----------
  const P = window.DECK_RCC_PATIENTS;
  FIGS["s-rccres"] = {
    init(el) {
      this.cv = el.querySelector("#rp-path"); this.bars = el.querySelector("#rp-bars"); this.n = 0;
      this.mode = "3d"; this.yaw = 0.5; this.pitch = -0.3; this.raf = 0;
      el.querySelectorAll("#rp-mode button").forEach((b) => b.addEventListener("click", () => {
        el.querySelectorAll("#rp-mode button").forEach((o) => o.classList.toggle("on", o === b));
        this.mode = b.dataset.m; this.mode === "3d" ? this.spin() : this.stop(); this.draw();
      }));
      let drag = null;
      this.bars.addEventListener("pointerdown", (e) => { if (this.n < 3 || this.mode !== "3d") return; drag = [e.clientX, e.clientY, this.yaw, this.pitch]; this.stop(); this.bars.setPointerCapture(e.pointerId); });
      this.bars.addEventListener("pointermove", (e) => { if (!drag) return; this.yaw = drag[2] + (e.clientX - drag[0]) * 0.01; this.pitch = Math.max(-1.4, Math.min(1.4, drag[3] + (e.clientY - drag[1]) * 0.01)); this.draw(); });
      this.bars.addEventListener("pointerup", () => { drag = null; });
      this.bars.addEventListener("click", (e) => { if (this.n >= 3 && this.mode === "3d") e.stopPropagation(); });
    },
    enter() { this.draw(); if (this.n >= 3 && this.mode === "3d") this.spin(); },
    leave() { this.stop(); },
    step(n) { this.n = n; if (n < 3) this.stop(); else if (this.mode === "3d") this.spin(); this.draw(); },
    spin() {
      this.stop();
      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const tick = () => { this.yaw += 0.0025; this.draw(); this.raf = requestAnimationFrame(tick); };
      this.raf = requestAnimationFrame(tick);
    },
    stop() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; },
    drawUmap(oy = 0) {
      const U = window.DECK_RCC_UMAP; if (!U) return;
      const cv = this.bars, W = parseFloat(cv.style.width), H = parseFloat(cv.style.height), kk = cv.width / W;
      const x = cv.getContext("2d"); x.setTransform(kk, 0, 0, kk, 0, 0); if (!oy) x.clearRect(0, 0, W, H);
      x.font = `600 22px ${FONT}`; x.fillStyle = INK; x.textAlign = "left"; x.textBaseline = "alphabetic";
      x.fillText("The path on the CD8 UMAP", 0, oy + 26);
      x.font = `18px ${FONT}`; x.fillStyle = MUTED; x.textAlign = "left"; x.fillText("colour = pseudotime   early", 0, oy + 50);
      const gx = x.measureText("colour = pseudotime   early").width + 8, gw = 120;
      for (let i = 0; i < gw; i++) { x.fillStyle = rdylbu(i / (gw - 1)); x.fillRect(gx + i, oy + 38, 1.2, 14); }
      x.fillStyle = MUTED; x.fillText("late", gx + gw + 8, oy + 50);
      const top = oy + 90, box = { x: 10, y: top, w: W - 20, h: H - top - 26 };
      const N = U.x.length, PX = new Float32Array(N), PY = new Float32Array(N), D = new Float32Array(N);
      let proj;
      if (this.mode === "3d") {
        const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw), cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
        const s = Math.min(box.w, box.h) / 1.9, cx0 = box.x + box.w / 2, cy0 = box.y + box.h * 0.58;
        proj = (a, b, c) => { const xr = a * cy + c * sy, zr = -a * sy + c * cy; return [cx0 + xr * s, cy0 - (b * cp - zr * sp) * s, b * sp + zr * cp]; };
        for (let i = 0; i < N; i++) { const q = proj(U.p3[3 * i], U.p3[3 * i + 1], U.p3[3 * i + 2]); PX[i] = q[0]; PY[i] = q[1]; D[i] = q[2]; }
      } else {
        const sx0 = U.xr[1] - U.xr[0], sy0 = U.yr[1] - U.yr[0], s = Math.min(box.w / sx0, box.h / sy0);
        const ox = box.x + (box.w - s * sx0) / 2, oy = box.y + (box.h - s * sy0) / 2;
        proj = (a, b) => [ox + (a - U.xr[0]) * s, oy + s * sy0 - (b - U.yr[0]) * s, 0];
        for (let i = 0; i < N; i++) { const q = proj(U.x[i], U.y[i]); PX[i] = q[0]; PY[i] = q[1]; }
      }
      const order = Array.from({ length: N }, (_, i) => i);
      if (this.mode === "3d") order.sort((a, b) => D[a] - D[b]); else order.sort((a, b) => U.t[a] - U.t[b]);
      for (const i of order) {
        const t = U.t[i];
        x.globalAlpha = t < 0 ? 0.22 : 0.85; x.fillStyle = t < 0 ? "#cbd5e1" : rdylbu(t);
        x.fillRect(PX[i] - 1.3, PY[i] - 1.3, 2.6, 2.6);
      }
      x.globalAlpha = 1;
      const path = (this.mode === "3d" ? U.path3.map((q) => proj(q[0], q[1], q[2])) : U.path2.map((q) => proj(q[0], q[1])));
      [["rgba(255,255,255,.95)", 8], ["#86198f", 3.5]].forEach(([col, lw]) => { x.beginPath(); smooth(x, path); x.strokeStyle = col; x.lineWidth = lw; x.lineJoin = "round"; x.stroke(); });
      const a = path[path.length - 2], b = path[path.length - 1], ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      x.fillStyle = "#86198f"; x.beginPath(); x.moveTo(b[0] + 12 * Math.cos(ang), b[1] + 12 * Math.sin(ang));
      x.lineTo(b[0] + 12 * Math.cos(ang + 2.5), b[1] + 12 * Math.sin(ang + 2.5)); x.lineTo(b[0] + 12 * Math.cos(ang - 2.5), b[1] + 12 * Math.sin(ang - 2.5)); x.fill();
      x.beginPath(); x.arc(path[0][0], path[0][1], 6, 0, 2 * Math.PI); x.fill();
      x.textBaseline = "alphabetic";
      x.font = `600 18px ${FONT}`; x.fillStyle = "#86198f"; x.textAlign = "right"; x.textBaseline = "middle";
      x.lineWidth = 5; x.strokeStyle = "rgba(255,255,255,.95)";
      x.strokeText("start", path[0][0] - 12, path[0][1]); x.fillText("start", path[0][0] - 12, path[0][1]);
      x.strokeText("end", b[0] - 16, b[1]); x.fillText("end", b[0] - 16, b[1]); x.textBaseline = "alphabetic";
    },
    order() { return P.patients.slice().sort((a, b) => b.exhausted_per_progenitor - a.exhausted_per_progenitor); },
    colorOf(p) {
      const o = this.order();
      return p === o[0].patient ? EXH : p === o[o.length - 1].patient ? PROG : OTHER;
    },
    draw() {
      if (!P || !this.cv) return;
      // left: marker strip + tumor density per patient
      let [x, W, H] = ctx(this.cv);
      const left = 110, right = W - 12, plotW = right - left, B = P.bins, bw = plotW / B, rowH = 30, top = 28;
      x.font = `600 22px ${FONT}`; x.textBaseline = "middle"; x.textAlign = "right";
      P.strip.forEach((r, i) => {
        const y = top + i * rowH;
        x.fillStyle = INK; x.fillText(r.marker, left - 14, y + rowH / 2);
        r.rel.forEach((v, b) => { if (v === null) return; x.fillStyle = viridis(v); x.fillRect(left + b * bw, y + 2, bw + 0.6, rowH - 4); });
      });
      x.font = `18px ${FONT}`; x.fillStyle = MUTED; x.textAlign = "left"; x.textBaseline = "alphabetic";
      x.fillText("CD8 T cells: marker level along the path   low", left, top - 8);
      { const lx0 = left + x.measureText("CD8 T cells: marker level along the path   low").width + 8; for (let i = 0; i < 90; i++) { x.fillStyle = viridis(i / 89); x.fillRect(lx0 + i, top - 20, 1.2, 12); } x.fillStyle = MUTED; x.fillText("high", lx0 + 98, top - 8); }
      const stripBot = top + P.strip.length * rowH, dTop = stripBot + 104, dBot = H - 72, dH = dBot - dTop;
      // cell types along the path (thesis clusters matched by expression profile), named at their mean position
      const U = window.DECK_RCC_UMAP;
      if (U && U.clusters) {
        const g = []; U.clusters.forEach((c) => { const q = g.find((v) => v.name === c.thesis_name); if (q) q.ts.push(c.t); else g.push({ name: c.thesis_name, ts: [c.t] }); });
        const rowsEnd = [];
        x.font = `600 16px ${FONT}`; x.textBaseline = "middle";
        g.forEach((v) => { v.cx = left + (v.ts.reduce((p, q) => p + q, 0) / v.ts.length) * plotW; }); g.sort((p, q) => p.cx - q.cx).forEach((v) => {
          const wd = x.measureText(v.name).width, lx = Math.max(left, Math.min(right - wd, v.cx - wd / 2));
          let r = 0; while (rowsEnd[r] !== undefined && rowsEnd[r] > lx - 14) r++; rowsEnd[r] = lx + wd;
          v.lx = lx; v.wd = wd; v.ly = stripBot + 20 + r * 26;
        });
        const placed = g.map((v) => v).filter((v) => v.ly);
        placed.forEach((v) => { x.strokeStyle = "#94a3b8"; x.lineWidth = 1; x.beginPath(); x.moveTo(v.cx, stripBot + 2); x.lineTo(v.cx, v.ly - 9); x.stroke(); });
        placed.forEach((v) => { x.fillStyle = "#fafaf9"; x.fillRect(v.lx - 4, v.ly - 11, v.wd + 8, 22); x.fillStyle = INK; x.textAlign = "left"; x.fillText(v.name, v.lx, v.ly); });
        x.textBaseline = "alphabetic";
      }
      x.strokeStyle = GRID; x.lineWidth = 1; x.beginPath(); x.moveTo(left, dBot); x.lineTo(right, dBot); x.stroke();
      const T = window.DECK_PSEUDO;
      if (this.n === 1 && T) {
        const maxT = Math.max(...T.density.BLOOD, ...T.density.TUMOR);
        [["BLOOD", "#d62728", "blood"], ["TUMOR", "#1f6fb4", "tumor"]].forEach(([k, col, lab], j) => {
          const pts = T.density[k].map((v, b) => [left + (b + 0.5) * bw, dBot - (v / maxT) * dH * 0.95]);
          x.beginPath(); x.moveTo(left, dBot); x.lineTo(pts[0][0], pts[0][1]); smooth(x, pts); x.lineTo(right, dBot); x.closePath();
          x.globalAlpha = 0.2; x.fillStyle = col; x.fill(); x.globalAlpha = 1;
          x.beginPath(); smooth(x, pts); x.strokeStyle = col; x.lineWidth = 3; x.stroke();
          x.font = `700 22px ${FONT}`; x.fillStyle = col; x.textAlign = "right"; x.fillText(`● ${lab}`, right - (1 - j) * 110, dTop + 4);
        });
        // where the exhausted part starts (TIM-3 and CD39 high) and how much of each tissue lies beyond it
        const tim = P.strip.find((r) => r.marker === "TIM-3").rel, cd39 = P.strip.find((r) => r.marker === "CD39").rel;
        const b0 = tim.findIndex((v, b) => v !== null && cd39[b] !== null && v >= 0.6 && cd39[b] >= 0.6);
        if (b0 > 0) {
          const share = (k) => Math.round(100 * T.density[k].slice(b0).reduce((p, q) => p + q, 0));
          const xb = left + b0 * bw;
          x.strokeStyle = INK; x.lineWidth = 1.5; x.setLineDash([6, 5]); x.beginPath(); x.moveTo(xb, dTop + 20); x.lineTo(xb, dBot); x.stroke(); x.setLineDash([]);
          x.font = `600 15px ${FONT}`; x.fillStyle = INK; x.textAlign = "left"; x.fillText("exhausted part →", xb + 6, dBot - 8);
          x.textAlign = "right"; x.font = `600 18px ${FONT}`; x.fillStyle = INK; x.fillText("in the exhausted part:", right, dTop + 42);
          x.font = `700 24px ${FONT}`; x.fillStyle = "#d62728"; x.fillText(`blood ${share("BLOOD")}%`, right, dTop + 72);
          x.fillStyle = "#1f6fb4"; x.fillText(`tumor ${share("TUMOR")}%`, right, dTop + 102);
          x.fillStyle = MUTED; x.font = `15px ${FONT}`; x.fillText("of each tissue's CD8 T cells on this path", right, dTop + 124); x.textAlign = "left";
        }
      }
      if (this.n >= 1) { x.save(); x.translate(left - 16, (dTop + dBot) / 2); x.rotate(-Math.PI / 2); x.textAlign = "center"; x.font = `15px ${FONT}`; x.fillStyle = MUTED; x.fillText("share of cells", 0, 0); x.restore(); }
      if (this.n >= 2) {
        const maxD = Math.max(...P.patients.flatMap((p) => p.density));
        const pts = (p) => p.density.map((v, b) => [left + (b + 0.5) * bw, dBot - (v / maxD) * dH * 0.95]);
        const lines = P.patients.slice().sort((a, b) => (this.colorOf(a.patient) === OTHER ? -1 : 1) - (this.colorOf(b.patient) === OTHER ? -1 : 1));
        lines.forEach((p) => {
          const col = this.colorOf(p.patient), hl = col !== OTHER;
          x.beginPath(); smooth(x, pts(p)); x.strokeStyle = col; x.lineWidth = hl ? 4 : 2; x.globalAlpha = hl ? 1 : 0.6; x.stroke();
          if (hl) {
            const q = pts(p), peak = q.reduce((m, c) => (c[1] < m[1] ? c : m));
            x.globalAlpha = 1; x.font = `700 22px ${FONT}`; x.fillStyle = col; x.textAlign = "center";
            x.fillText(p.patient, peak[0], peak[1] - 12);
          }
        });
        x.globalAlpha = 1;
      } else if (this.n === 0) {
        x.font = `20px ${FONT}`; x.fillStyle = "#94a3b8"; x.textAlign = "center";
        x.fillText("where the cells sit along the path", left + plotW / 2, dTop + dH / 2);
      }
      x.font = `600 20px ${FONT}`; x.fillStyle = INK; x.textAlign = "left";
      x.fillText("start · naive", left, dBot + 30);
      x.textAlign = "right"; x.fillText("end · resident, exhausted, dividing", right, dBot + 30);
      x.textAlign = "center"; x.font = `18px ${FONT}`; x.fillStyle = MUTED;
      x.fillText("pseudotime (inferred order)", left + plotW / 2, dBot + 54);

      // right: exhausted cells per progenitor, per patient (step 3: the path on the CD8 UMAP instead)
      [x, W, H] = ctx(this.bars);
      const compact = this.n >= 3;
      const on = this.n >= 2, rows = this.order(), maxV = Math.max(...rows.map((r) => r.exhausted_per_progenitor));
      x.globalAlpha = on ? 1 : 0.25;
      x.font = `600 22px ${FONT}`; x.fillStyle = INK; x.textAlign = "left"; x.textBaseline = "alphabetic";
      x.fillText("Exhausted per progenitor", 0, 26);
      x.font = `18px ${FONT}`; x.fillStyle = MUTED; x.fillText("PD-1⁺ CD8 T cells in each tumor", 0, 50);
      const by = compact ? 62 : 78, rh = compact ? 30 : 50, bx = 56, bwMax = W - bx - 100;
      rows.forEach((r, i) => {
        const y = by + i * rh, col = this.colorOf(r.patient);
        x.font = `600 ${compact ? 18 : 21}px ${FONT}`; x.fillStyle = INK; x.textAlign = "left"; x.textBaseline = "middle";
        x.fillText(r.patient, 0, y + rh / 2 - (compact ? 0 : 4));
        if (on) {
          x.fillStyle = col; x.fillRect(bx, y + (compact ? 6 : 8), (r.exhausted_per_progenitor / maxV) * bwMax, rh - (compact ? 12 : 24));
          x.fillStyle = INK; x.font = `600 ${compact ? 18 : 21}px ${FONT}`;
          x.fillText(`${r.exhausted_per_progenitor.toFixed(0)} : 1`, bx + (r.exhausted_per_progenitor / maxV) * bwMax + 10, y + rh / 2 - (compact ? 0 : 4));
        }
      });
      x.globalAlpha = 1; x.textBaseline = "alphabetic";
      if (compact) this.drawUmap(by + 6 * rh + 18);
    },
  };

  // ---------- backup: blood vs tumor composition, separate clustering, 2D/3D ----------
  const S = window.DECK_RCC_SEP;
  const LIN = ["#2563eb", "#16a34a"], GRP = ["#7c3aed", "#0891b2", "#db2777"], TIS = { blood: "#dc2626", tumor: "#a16207" };
  const GNAMES = ["CD8 resident, exhausted", "CD8 effector", "Regulatory CD4 (Treg)"];
  const UNITS = ["% of CD8", "% of CD8", "% of CD4"];
  FIGS["s-rcccomp"] = {
    init(el) {
      this.map = el.querySelector("#rc-map"); this.pair = el.querySelector("#rc-pair"); this.leg = el.querySelector("#rc-leg");
      this.n = 0; this.mode = "2d"; this.yaw = 0.6; this.pitch = -0.25; this.raf = 0;
      el.querySelectorAll("#rc-mode button").forEach((b) => b.addEventListener("click", (e) => {
        e.stopPropagation();
        el.querySelectorAll("#rc-mode button").forEach((o) => o.classList.toggle("on", o === b));
        this.mode = b.dataset.m; this.mode === "3d" ? this.spin() : this.stop(); this.draw();
      }));
      let drag = null;
      this.map.addEventListener("pointerdown", (e) => { if (this.mode !== "3d") return; e.stopPropagation(); drag = [e.clientX, e.clientY, this.yaw, this.pitch]; this.stop(); this.map.setPointerCapture(e.pointerId); });
      this.map.addEventListener("pointermove", (e) => { if (!drag) return; this.yaw = drag[2] + (e.clientX - drag[0]) * 0.01; this.pitch = Math.max(-1.4, Math.min(1.4, drag[3] + (e.clientY - drag[1]) * 0.01)); this.draw(); });
      this.map.addEventListener("pointerup", (e) => { if (drag) e.stopPropagation(); drag = null; });
      this.map.addEventListener("click", (e) => { if (this.mode === "3d") e.stopPropagation(); });
      el.querySelector("#rc-mode").addEventListener("click", (e) => e.stopPropagation());
    },
    enter() { this.draw(); if (this.mode === "3d") this.spin(); },
    leave() { this.stop(); },
    step(n) { this.n = n; this.draw(); },
    spin() {
      this.stop();
      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const tick = () => { this.yaw += 0.006; this.draw(); this.raf = requestAnimationFrame(tick); };
      this.raf = requestAnimationFrame(tick);
    },
    stop() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; },
    draw() {
      if (!S || !this.map) return;
      let [x, W, H] = ctx(this.map);
      const g = Math.min(this.n, 3), gap = 18, pw = (W - gap) / 2, top = 46, pad = 10;
      const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw), cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
      ["blood", "tumor"].forEach((t, j) => {
        const m = S.maps[t], ox = j * (pw + gap), bw = pw - 2 * pad, bh = H - top - 2 * pad;
        let px, py, order = null, depth = null;
        if (this.mode === "3d") {
          const N = m.x.length, X2 = new Float32Array(N), Y2 = new Float32Array(N); depth = new Float32Array(N);
          for (let i = 0; i < N; i++) {
            const a = m.p3[3 * i], b = m.p3[3 * i + 1], c = m.p3[3 * i + 2];
            const xr = a * cy + c * sy, zr = -a * sy + c * cy, yr = b * cp - zr * sp; depth[i] = b * sp + zr * cp;
            X2[i] = xr; Y2[i] = yr;
          }
          const s = Math.min(bw, bh) / 1.7, cx0 = ox + pad + bw / 2, cy0 = top + pad + bh / 2;
          px = (i) => cx0 + X2[i] * s; py = (i) => cy0 - Y2[i] * s;
          order = Array.from({ length: N }, (_, i) => i).sort((a, b) => depth[a] - depth[b]);
        } else {
          const sx0 = m.xr[1] - m.xr[0], sy0 = m.yr[1] - m.yr[0], s = Math.min(bw / sx0, bh / sy0);
          const offx = ox + pad + (bw - s * sx0) / 2, offy = top + pad + (bh - s * sy0) / 2;
          px = (i) => offx + (m.x[i] - m.xr[0]) * s; py = (i) => offy + s * sy0 - (m.y[i] - m.yr[0]) * s;
        }
        x.globalAlpha = 1; x.fillStyle = TIS[t]; x.font = `700 26px ${FONT}`; x.textAlign = "left"; x.textBaseline = "alphabetic";
        x.fillText(t === "blood" ? "Blood" : "Tumor", ox + pad, 32);
        const idx = order || Array.from({ length: m.x.length }, (_, i) => i);
        const colorOf = (i) => g === 0 ? (m.l[i] === 2 ? GREY : LIN[m.l[i]]) : (m.g[i] === g ? GRP[g - 1] : GREY);
        const pass = (sel, a, r) => { for (const i of idx) { if (!sel(i)) continue; x.globalAlpha = a; x.fillStyle = colorOf(i); x.fillRect(px(i) - r, py(i) - r, 2 * r, 2 * r); } };
        if (g === 0) pass(() => true, 0.6, 1.2);
        else { pass((i) => m.g[i] !== g, 0.4, 1.1); pass((i) => m.g[i] === g, 0.9, 1.5); }
      });
      x.globalAlpha = 1; x.strokeStyle = GRID; x.lineWidth = 1.5;
      x.beginPath(); x.moveTo(pw + gap / 2, 14); x.lineTo(pw + gap / 2, H - 14); x.stroke();
      this.leg.innerHTML = g === 0
        ? `<span style="color:${LIN[0]}">●</span> CD4 T &nbsp; <span style="color:${LIN[1]}">●</span> CD8 T &nbsp;·&nbsp; each tissue clustered on its own`
        : `<span style="color:${GRP[g - 1]}">●</span> ${GNAMES[g - 1]}`;

      // paired panels
      [x, W, H] = ctx(this.pair);
      const pw2 = (W - 40) / 3, ptop = 74, pbot = H - 78, yv = (v) => pbot - (v / 100) * (pbot - ptop);
      S.paired.forEach((p, k) => {
        const ox = k * (pw2 + 20), on = this.n >= k + 1, col = GRP[k];
        x.globalAlpha = on ? 1 : 0.25;
        x.fillStyle = INK; x.font = `600 22px ${FONT}`; x.textAlign = "left"; x.fillText(GNAMES[k], ox + 4, 26);
        x.fillStyle = MUTED; x.font = `18px ${FONT}`; x.fillText(UNITS[k], ox + 4, 50);
        x.strokeStyle = GRID; x.lineWidth = 1;
        [0, 50, 100].forEach((t) => { x.beginPath(); x.moveTo(ox + 40, yv(t)); x.lineTo(ox + pw2 - 10, yv(t)); x.stroke(); x.fillStyle = "#94a3b8"; x.textAlign = "right"; x.fillText(String(t), ox + 32, yv(t) + 6); });
        const xa = ox + 90, xb = ox + pw2 - 60;
        x.textAlign = "center"; x.font = `600 19px ${FONT}`; x.fillStyle = TIS.blood; x.fillText("blood", xa, pbot + 30);
        x.fillStyle = TIS.tumor; x.fillText("tumor", xb, pbot + 30);
        if (on) {
          p.vals.forEach(([a, b]) => {
            x.strokeStyle = col; x.lineWidth = 2.5; x.globalAlpha = 0.85; x.beginPath(); x.moveTo(xa, yv(a)); x.lineTo(xb, yv(b)); x.stroke();
            x.fillStyle = col; [[xa, a], [xb, b]].forEach(([qx, v]) => { x.beginPath(); x.arc(qx, yv(v), 5.5, 0, 2 * Math.PI); x.fill(); });
          });
          x.globalAlpha = 1;
          const up = p.vals.filter(([a, b]) => b > a).length;
          x.fillStyle = col; x.font = `600 19px ${FONT}`; x.textAlign = "right";
          x.fillText(up === 6 ? "up in 6 of 6" : up === 0 ? "down in 6 of 6" : `up in ${up} of 6`, ox + pw2 - 4, 50);
        }
        x.globalAlpha = 1;
      });
    },
  };
})();
