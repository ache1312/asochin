// Preview: the four CD8 Slingshot trajectories, one per slide, plus all four together (data: window.DECK_TRAJ).
(function () {
  const FIGS = (window.FIGS = window.FIGS || {});
  const D = window.DECK_TRAJ;
  const FONT = "'Source Sans 3', system-ui, sans-serif";
  const INK = "#0f172a", MUTED = "#64748b", GRID = "#e2e8f0", GREY = "#cbd5e1", BLOOD = "#d62728", TUMOR = "#1f6fb4";
  const LCOL = ["#0891b2", "#7c3aed", "#16a34a", "#d97706"];
  const SHORT = { 10: "effector", 19: "resident, exhausted", 15: "resident memory (CD103⁺)", 13: "central memory" };

  const LO = [241, 245, 249], HI = [49, 46, 129];
  const ramp = (v) => `rgb(${LO.map((a, i) => Math.round(a + (HI[i] - a) * v)).join(",")})`;
  const mix = (hex, t) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); return `rgb(${c.map((v) => Math.round(255 + (v - 255) * t)).join(",")})`; };
  function ctx(c) { const W = parseFloat(c.style.width), H = parseFloat(c.style.height), k = c.width / W; const x = c.getContext("2d"); x.setTransform(k, 0, 0, k, 0, 0); x.clearRect(0, 0, W, H); return [x, W, H]; }
  function smooth(x, pts) { x.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], mx = (x0 + x1) / 2; x.bezierCurveTo(mx, y0, mx, y1, x1, y1); } }
  // shared 2D/3D map helper
  function mapper(box, mode, yaw, pitch, C = D.cells) {
    if (mode === "3d") {
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const s = Math.min(box.w, box.h) / 1.6, cx0 = box.x + box.w / 2, cy0 = box.y + box.h / 2;
      return (a, b, c, out = [], i = 0) => {
        const xr = a * cy + c * sy, zr = -a * sy + c * cy;
        out[i] = cx0 + xr * s; out[i + 1] = cy0 - (b * cp - zr * sp) * s; out[i + 2] = b * sp + zr * cp;
        return out;
      };
    }
    const sx0 = C.xr[1] - C.xr[0], sy0 = C.yr[1] - C.yr[0], s = Math.min(box.w / sx0, box.h / sy0);
    const ox = box.x + (box.w - s * sx0) / 2, oy = box.y + (box.h - s * sy0) / 2;
    return (a, b, c, out = [], i = 0) => {
      out[i] = ox + (a - C.xr[0]) * s; out[i + 1] = oy + s * sy0 - (b - C.yr[0]) * s; out[i + 2] = 0;
      return out;
    };
  }
  function drawCells(x, proj, mode, colorOf, alphaOf) {
    const C = D.cells, N = C.x.length, pts = new Array(N);
    for (let i = 0; i < N; i++) pts[i] = mode === "3d" ? proj(C.p3[3 * i], C.p3[3 * i + 1], C.p3[3 * i + 2]) : proj(C.x[i], C.y[i]);
    const order = Array.from({ length: N }, (_, i) => i);
    if (mode === "3d") order.sort((a, b) => pts[a][2] - pts[b][2]);
    for (const i of order) { x.globalAlpha = alphaOf(i); x.fillStyle = colorOf(i); x.fillRect(pts[i][0] - 1.3, pts[i][1] - 1.3, 2.6, 2.6); }
    x.globalAlpha = 1;
  }
  function overviewScatter(canvas, cells) {
    const n = cells.dom.length, palette = LCOL.map((color) => mix(color, 0.7));
    const xy = Float32Array.from(cells.xy, (v) => v / 1000), xyz = Float32Array.from(cells.p3, (v) => v / 1000);
    const pointLayer = window.deckPointCloud?.(canvas, cells.dom, LCOL, { radius: 0.95, alpha: 0.68, colorMix: 0.7 });
    const pts = new Float32Array(n * 3);
    const order = (pointLayer ? Uint16Array : Uint32Array).from({ length: n }, (_, i) => i);
    return (x, proj, mode) => {
      const is3d = mode === "3d";
      for (let i = 0, p = 0, q = 0; i < n; i++, p += 3, q += 2) {
        if (is3d) proj(xyz[p], xyz[p + 1], xyz[p + 2], pts, p);
        else proj(xy[q], xy[q + 1], 0, pts, p);
      }
      if (is3d) order.sort((a, b) => pts[3 * a + 2] - pts[3 * b + 2]);
      if (pointLayer && pointLayer(pts, is3d ? order : null)) return;
      x.globalAlpha = 0.68;
      for (let k = 0; k < n; k++) {
        const i = is3d ? order[k] : k, p = 3 * i;
        x.fillStyle = palette[cells.dom[i]];
        x.fillRect(pts[p] - 0.95, pts[p + 1] - 0.95, 1.9, 1.9);
      }
      x.globalAlpha = 1;
    };
  }
  function drawPath(x, proj, mode, L, col) {
    const path = mode === "3d" ? L.path3.map((q) => proj(q[0], q[1], q[2])) : L.path2.map((q) => proj(q[0], q[1]));
    [["rgba(255,255,255,.95)", 8], [col, 3.5]].forEach(([c, lw]) => { x.beginPath(); smooth(x, path); x.strokeStyle = c; x.lineWidth = lw; x.lineJoin = "round"; x.stroke(); });
    const a = path[path.length - 2], b = path[path.length - 1], ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    x.fillStyle = col; x.beginPath(); x.moveTo(b[0] + 12 * Math.cos(ang), b[1] + 12 * Math.sin(ang));
    x.lineTo(b[0] + 12 * Math.cos(ang + 2.5), b[1] + 12 * Math.sin(ang + 2.5)); x.lineTo(b[0] + 12 * Math.cos(ang - 2.5), b[1] + 12 * Math.sin(ang - 2.5)); x.fill();
    x.beginPath(); x.arc(path[0][0], path[0][1], 5, 0, 2 * Math.PI); x.fill();
    return b;
  }
  function interactive(fig, el, canvasSel) {
    fig.mode = "2d"; fig.yaw = 0.5; fig.pitch = -0.3; fig.raf = 0;
    const cv = el.querySelector(canvasSel);
    el.querySelectorAll(".tj-mode button").forEach((b) => b.addEventListener("click", () => {
      el.querySelectorAll(".tj-mode button").forEach((o) => o.classList.toggle("on", o === b));
      fig.mode = b.dataset.m; fig.mode === "3d" ? fig.spin() : fig.stop(); fig.draw();
    }));
    let drag = null;
    cv.addEventListener("pointerdown", (e) => { if (fig.mode !== "3d") return; drag = [e.clientX, e.clientY, fig.yaw, fig.pitch]; fig.stop(); cv.setPointerCapture(e.pointerId); });
    cv.addEventListener("pointermove", (e) => { if (!drag) return; fig.yaw = drag[2] + (e.clientX - drag[0]) * 0.01; fig.pitch = Math.max(-1.4, Math.min(1.4, drag[3] + (e.clientY - drag[1]) * 0.01)); fig.draw(); });
    cv.addEventListener("pointerup", () => { drag = null; });
    cv.addEventListener("click", (e) => { if (fig.mode === "3d") e.stopPropagation(); });
    fig.spin = function () { this.stop(); if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; const tick = () => { this.yaw += this.speed || 0.006; this.draw(); this.raf = requestAnimationFrame(tick); }; this.raf = requestAnimationFrame(tick); };
    fig.stop = function () { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; };
    fig.leave = function () { this.stop(); };
  }

  // one slide per trajectory
  D.lineages.forEach((L, j) => {
    const fig = {
      init(el) { this.cv = el.querySelector(".tj-path"); this.map = el.querySelector(".tj-map"); interactive(this, el, ".tj-map"); },
      enter() { this.draw(); if (this.mode === "3d") this.spin(); },
      draw() {
        let [x, W, H] = ctx(this.cv);
        const left = 110, right = W - 12, plotW = right - left, B = L.strip[0].rel.length, bw = plotW / B, rowH = 30, top = 28;
        x.font = `600 20px ${FONT}`; x.textBaseline = "middle"; x.textAlign = "right";
        L.strip.forEach((r, i) => { const y = top + i * rowH; x.fillStyle = INK; x.fillText(r.marker, left - 12, y + rowH / 2);
          r.rel.forEach((v, b) => { if (v === null) return; x.fillStyle = ramp(v); x.fillRect(left + b * bw, y + 2, bw + 0.6, rowH - 4); }); });
        x.font = `18px ${FONT}`; x.fillStyle = MUTED; x.textAlign = "left"; x.textBaseline = "alphabetic";
        x.fillText("CD8 T cells on this path: marker level along the path (low → high)", left, top - 8);
        const stripBot = top + L.strip.length * rowH, dTop = stripBot + 70, dBot = H - 150, dH = dBot - dTop;
        // one marker per thesis cluster (mean position of its FlowCV groups); nearby markers alternate rows
        const byTh = []; L.clusters.forEach((c) => { const g = byTh.find((q) => q.thesis === c.thesis); if (g) g.ts.push(c.t); else byTh.push({ thesis: c.thesis, ts: [c.t] }); });
        let lastX = -1e9, alt = 0;
        byTh.map((g) => ({ thesis: g.thesis, t: g.ts.reduce((a, b) => a + b, 0) / g.ts.length })).sort((a, b) => a.t - b.t).forEach((c) => {
          const cx = left + c.t * plotW; alt = cx - lastX < 26 ? 1 - alt : 0; lastX = cx; const cy = stripBot + 22 + alt * 24;
          x.strokeStyle = "#94a3b8"; x.lineWidth = 1; x.beginPath(); x.moveTo(cx, stripBot + 2); x.lineTo(cx, cy - 11); x.stroke();
          x.beginPath(); x.arc(cx, cy, 11, 0, 2 * Math.PI); x.fillStyle = "#fff"; x.fill(); x.strokeStyle = INK; x.lineWidth = 1.5; x.stroke();
          x.fillStyle = INK; x.font = `700 13px ${FONT}`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(String(c.thesis), cx, cy + 0.5); x.textBaseline = "alphabetic"; });
        const maxT = Math.max(...L.density.blood, ...L.density.tumor);
        x.strokeStyle = GRID; x.lineWidth = 1; x.beginPath(); x.moveTo(left, dBot); x.lineTo(right, dBot); x.stroke();
        [["blood", BLOOD], ["tumor", TUMOR]].forEach(([k, col], q) => {
          const pts = L.density[k].map((v, b) => [left + (b + 0.5) * bw, dBot - (v / maxT) * dH * 0.95]);
          x.beginPath(); x.moveTo(left, dBot); x.lineTo(pts[0][0], pts[0][1]); smooth(x, pts); x.lineTo(right, dBot); x.closePath();
          x.globalAlpha = 0.2; x.fillStyle = col; x.fill(); x.globalAlpha = 1; x.beginPath(); smooth(x, pts); x.strokeStyle = col; x.lineWidth = 3; x.stroke();
          x.font = `700 22px ${FONT}`; x.fillStyle = col; x.textAlign = "right"; x.fillText(`● ${k}`, right - (1 - q) * 110, dTop + 4);
        });
        x.font = `600 20px ${FONT}`; x.fillStyle = INK; x.textAlign = "left"; x.fillText(`start · ${L.clusters[0].name}`, left, dBot + 30);
        x.textAlign = "right"; x.fillText(`end · ${L.end_name}`, right, dBot + 30);
        x.textAlign = "center"; x.font = `18px ${FONT}`; x.fillStyle = MUTED; x.fillText("pseudotime (inferred order)", left + plotW / 2, dBot + 54);
        const seen = new Set(), items = []; L.clusters.forEach((c) => { if (!seen.has(c.thesis)) { seen.add(c.thesis); items.push(`${c.thesis} ${c.name}`); } });
        x.textAlign = "left"; x.font = `17px ${FONT}`; x.fillStyle = MUTED;
        x.fillText("Cell types on the path (numbers = original clusters, matched by expression profile):", left, dBot + 80);
        x.fillStyle = INK; let lx = left, ly = dBot + 104;
        items.forEach((it, i) => { const txt = it + (i < items.length - 1 ? "   ·   " : ""), wd = x.measureText(txt).width; if (lx + wd > right) { lx = left; ly += 22; } x.fillText(txt, lx, ly); lx += wd; });
        // right: UMAP with this path
        [x, W, H] = ctx(this.map);
        x.font = `600 22px ${FONT}`; x.fillStyle = INK; x.textAlign = "left"; x.fillText("The path on the CD8 UMAP", 0, 26);
        x.font = `18px ${FONT}`; x.fillStyle = MUTED; x.fillText(`${L.cells.toLocaleString("en-US")} cells (${L.pct_cd8}% of CD8) · ${Math.round(L.tumor_share)}% tumor`, 0, 50);
        const box = { x: 10, y: 70, w: W - 20, h: H - 76 }, proj = mapper(box, this.mode, this.yaw, this.pitch), T = D.cells.t[j];
        drawCells(x, proj, this.mode, (i) => (T[i] < 0 ? GREY : ramp(0.3 + 0.7 * T[i])), (i) => (T[i] < 0 ? 0.3 : 0.85));
        drawPath(x, proj, this.mode, L, "#86198f");
      },
    };
    FIGS[`s-traj-${j + 1}`] = fig;
  });

  // all four together
  FIGS["s-traj-all"] = {
    init(el) {
      this.map = el.querySelector(".tj-map"); this.side = el.querySelector(".tj-side");
      this.cells = window.DECK_RCC_UMAP_DETAIL;
      this.drawPoints = overviewScatter(this.map, this.cells);
      const count = this.cells.dom.length.toLocaleString("en-US");
      el.querySelector(".tj-map-sample").textContent = `${count} plotted CD8 cells · enriched for naive, central memory and resident memory`;
      interactive(this, el, ".tj-map"); this.mode = "3d"; this.speed = 0.0025;
    },
    enter() { this.drawSide(); this.draw(); if (this.mode === "3d") this.spin(); },
    draw() {
      const [x, W, H] = ctx(this.map);
      const box = { x: 30, y: 90, w: W - 70, h: H - 110 }, proj = mapper(box, this.mode, this.yaw, this.pitch, this.cells);
      this.drawPoints(x, proj, this.mode);
      D.lineages.forEach((L, j) => { const end = drawPath(x, proj, this.mode, L, LCOL[j]);
        x.font = `700 18px ${FONT}`; x.textAlign = "left"; x.textBaseline = "middle"; x.lineWidth = 5; x.strokeStyle = "rgba(255,255,255,.95)";
        const lab = SHORT[L.end_thesis] || L.end_name; const tw = x.measureText(lab).width, lx = Math.min(end[0] + 12, W - tw - 6);
        x.strokeText(lab, lx, end[1]); x.fillStyle = LCOL[j]; x.fillText(lab, lx, end[1]); x.textBaseline = "alphabetic"; });
      // the common root of the four paths: naive CD8 T cells (thesis cluster 14)
      { const L0 = D.lineages[0], q = this.mode === "3d" ? proj(L0.path3[0][0], L0.path3[0][1], L0.path3[0][2]) : proj(L0.path2[0][0], L0.path2[0][1]);
        x.beginPath(); x.arc(q[0], q[1], 10, 0, 2 * Math.PI); x.fillStyle = INK; x.fill(); x.lineWidth = 3; x.strokeStyle = "#fff"; x.stroke();
        const r1 = "Selected root: naive CD8 T cells", r2 = (L0.clusters[0] && L0.clusters[0].name) ? "CCR7⁺ TCF-1⁺ · four inferred trajectories" : "";
        x.textAlign = "left"; x.textBaseline = "middle"; x.lineJoin = "round"; x.lineWidth = 6; x.strokeStyle = "rgba(255,255,255,.95)";
        x.font = `700 20px ${FONT}`; const tx = Math.min(q[0] + 18, W - x.measureText(r1).width - 8);
        x.strokeText(r1, tx, q[1] - 10); x.fillStyle = INK; x.fillText(r1, tx, q[1] - 10);
        x.font = `16px ${FONT}`; x.strokeText(r2, tx, q[1] + 12); x.fillStyle = MUTED; x.fillText(r2, tx, q[1] + 12); x.textBaseline = "alphabetic"; }
    },
    drawSide() {
      const [x, W, H] = ctx(this.side);
      const rowH = (H - 10) / 4;
      D.lineages.forEach((L, j) => {
        const y0 = 6 + j * rowH;
        x.fillStyle = LCOL[j]; x.fillRect(0, y0 + 4, 8, rowH - 16);
        x.fillStyle = INK; x.font = `700 21px ${FONT}`; x.textAlign = "left"; x.fillText(`Naive → ${SHORT[L.end_thesis] || L.end_name}`, 18, y0 + 22);
        x.fillStyle = MUTED; x.font = `17px ${FONT}`; x.fillText(`${L.pct_cd8}% of CD8 T cells`, 18, y0 + 44);
        const nb = L.density.blood.length, cut = Math.round(nb * 2 / 3), last = (k) => Math.round(100 * L.density[k].slice(cut).reduce((p, q) => p + q, 0));
        x.textAlign = "right"; x.font = `15px ${FONT}`; x.fillStyle = MUTED; x.fillText("in the last third:", W - 6, y0 + 20);
        x.font = `700 18px ${FONT}`; x.fillStyle = TUMOR; x.fillText(`tumor ${last("tumor")}%`, W - 6, y0 + 42);
        const wt = x.measureText(`tumor ${last("tumor")}%`).width; x.fillStyle = BLOOD; x.fillText(`blood ${last("blood")}%  ·  `, W - 6 - wt, y0 + 42); x.textAlign = "left";
        const gx = 18, gw = W - 24, gb = y0 + rowH - 14, gh = rowH - 72, maxT = Math.max(...L.density.blood, ...L.density.tumor), bw = gw / nb;
        const cx3 = gx + cut * bw; x.strokeStyle = "#94a3b8"; x.lineWidth = 1; x.setLineDash([4, 4]); x.beginPath(); x.moveTo(cx3, gb - gh - 4); x.lineTo(cx3, gb); x.stroke(); x.setLineDash([]);
        x.strokeStyle = GRID; x.lineWidth = 1; x.beginPath(); x.moveTo(gx, gb); x.lineTo(gx + gw, gb); x.stroke();
        [["blood", BLOOD], ["tumor", TUMOR]].forEach(([k, col]) => { const pts = L.density[k].map((v, b) => [gx + (b + 0.5) * bw, gb - (v / maxT) * gh]);
          x.beginPath(); x.moveTo(gx, gb); x.lineTo(pts[0][0], pts[0][1]); smooth(x, pts); x.lineTo(gx + gw, gb); x.closePath(); x.globalAlpha = 0.18; x.fillStyle = col; x.fill(); x.globalAlpha = 1;
          x.beginPath(); smooth(x, pts); x.strokeStyle = col; x.lineWidth = 2.2; x.stroke(); });
      });
    },
  };
})();
