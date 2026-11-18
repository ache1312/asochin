/* Interactive figures. Every value shown comes from data.js (real public data or saved FlowCV runs). */
(function () {
  const D = window.DECK_DATA, L = D.lymph, N = L.events, MK = L.markers, NM = MK.length;
  const col = (name) => MK.indexOf(name);
  const val = (i, name) => L.m[i * NM + col(name)];
  const popColor = L.pops.map((p) => p.color);
  // Language: index.html is Spanish, index-en.html sets <html lang="en">. tr(es, en) picks the visible text.
  const EN = document.documentElement.lang === "en", tr = (es, en) => (EN ? en : es), PC = EN ? "%" : " %";
  const nf = (x, d = 0) => x.toLocaleString(EN ? "en-US" : "es-ES", { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: "always" });
  const pct = (x, d = 1) => nf(x * 100, d) + PC;
  // population names come from the data files in Spanish; only their display is translated
  const PN = { "Células B": "B cells", "Células NK": "NK cells", "T CD4+": "CD4+ T", "T CD8+": "CD8+ T", "T γδ": "γδ T", "CD4 reguladoras (Treg)": "Regulatory CD4 (Treg)", "CD8 efectoras": "Effector CD8", "CD8 residentes y agotadas": "Resident, exhausted CD8", "de las CD4": "of CD4", "de las CD8": "of CD8" };
  const tn = (s) => (EN && PN[s]) || s;
  const STATE = (window.DECK_STATE = window.DECK_STATE || {});
  const MLABEL = { TCRyd: "TCRγδ", TCRb: "TCRβ", "NK1.1": "NK1.1" };
  const mlabel = (m) => MLABEL[m] || m;

  // ---------- helpers ----------
  function ctxOf(c) { const x = c.getContext("2d"); const k = c.width / parseFloat(c.style.width); x.setTransform(k, 0, 0, k, 0, 0); return x; }
  function cssSize(c) { return [parseFloat(c.style.width), parseFloat(c.style.height)]; }
  function pointer(c, e) { const r = c.getBoundingClientRect(); const [w, h] = cssSize(c); return [(e.clientX - r.left) * w / r.width, (e.clientY - r.top) * h / r.height]; }
  const VIR = ["#440154", "#482878", "#3e4989", "#31688e", "#26828e", "#1f9e89", "#35b779", "#6ece58", "#b5de2b", "#fde725"];
  function hex(h) { return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); }
  const VIRR = VIR.map(hex);
  function viridis(t) {
    t = Math.max(0, Math.min(1, t)) * (VIRR.length - 1); const i = Math.min(VIRR.length - 2, Math.floor(t)), f = t - i;
    const a = VIRR[i], b = VIRR[i + 1]; return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * f)).join(",")})`;
  }
  function axes(x, w, h, pad, xr, yr, xl, yl, ticks = true) {
    x.strokeStyle = "#94a3b8"; x.lineWidth = 1.2; x.beginPath(); x.moveTo(pad.l, pad.t); x.lineTo(pad.l, h - pad.b); x.lineTo(w - pad.r, h - pad.b); x.stroke();
    x.fillStyle = "#475569"; x.font = "600 17px 'Source Sans 3'"; x.textAlign = "center"; x.fillText(xl, pad.l + (w - pad.l - pad.r) / 2, h - 8);
    x.save(); x.translate(16, pad.t + (h - pad.t - pad.b) / 2); x.rotate(-Math.PI / 2); x.fillText(yl, 0, 0); x.restore();
    if (!ticks) return;
    if (ticks === "lgc") return lgcTicks(x, w, h, pad, xr, yr);
    x.font = "15px 'Source Sans 3'"; x.fillStyle = "#64748b";
    for (const v of niceTicks(xr[0], xr[1])) { const px = pad.l + (v - xr[0]) / (xr[1] - xr[0]) * (w - pad.l - pad.r); x.fillText(fmtTick(v), px, h - pad.b + 20); }
    x.textAlign = "right";
    for (const v of niceTicks(yr[0], yr[1])) { const py = h - pad.b - (v - yr[0]) / (yr[1] - yr[0]) * (h - pad.t - pad.b); x.fillText(fmtTick(v), pad.l - 8, py + 5); }
  }
  function niceTicks(a, b) {
    const span = b - a, step0 = Math.pow(10, Math.floor(Math.log10(span / 4))); let step = step0;
    for (const m of [1, 2, 5, 10]) { if (span / (step0 * m) <= 6) { step = step0 * m; break; } }
    const out = []; for (let v = Math.ceil(a / step) * step; v <= b + 1e-9; v += step) out.push(+v.toFixed(6)); return out;
  }
  function fmtTick(v) { return Math.abs(v) >= 1000 ? nf(v) : nf(v, Math.abs(v) < 10 && v % 1 ? 1 : 0); }

  // The panel intensities (ff.fcs) are on flowCore's default logicle scale: T 262144, W 0.5, M 4.5, A 0.
  // lgcPos(raw) gives the position of a raw value on that scale, so axes can be labelled 0, 10², 10³… as in cytometry software.
  const lgcPos = (() => {
    const T = 262144, W = 0.5, M = 4.5, w = W / M, x1 = w, x0 = 2 * w, b = M * Math.LN10;
    let lo = 1e-9, hi = b;
    for (let i = 0; i < 200; i++) { const d = (lo + hi) / 2; if (2 * (Math.log(d) - Math.log(b)) + w * (b + d) > 0) hi = d; else lo = d; }
    const d = (lo + hi) / 2, ca = Math.exp(x0 * (b + d)), mfa = Math.exp(b * x1) - ca / Math.exp(d * x1);
    const a = T / ((Math.exp(b) - mfa) - ca / Math.exp(d)), c = ca * a, f = -mfa * a;
    const S = (y) => { const neg = y < x1, z = neg ? 2 * x1 - y : y, s = a * Math.exp(b * z) + f - c * Math.exp(-d * z); return neg ? -s : s; };
    return (t) => { let l = -2, h = 1.5; for (let i = 0; i < 60; i++) { const m = (l + h) / 2; if (S(m) < t) l = m; else h = m; } return M * (l + h) / 2; };
  })();
  const LGC_TICKS = (() => {
    const out = [{ p: lgcPos(0), e: null, major: true }];
    for (const e of [2, 3, 4, 5]) out.push({ p: lgcPos(10 ** e), e, major: true });
    out.push({ p: lgcPos(-1000), e: 3, neg: true, major: true });
    for (const e of [2, 3, 4]) for (let k = 2; k <= 9; k++) out.push({ p: lgcPos(k * 10 ** e), major: false });
    for (let k = 1; k <= 9; k++) out.push({ p: lgcPos(-k * 100), major: false });
    return out;
  })();
  // "10³" with a raised exponent; align: "center" | "right"
  function powLabel(x, t, px, py, align) {
    if (t.e === null) { x.textAlign = align; x.fillText("0", px, py); return; }
    x.font = "15px 'Source Sans 3'"; const base = (t.neg ? "−" : "") + "10", bw = x.measureText(base).width;
    x.font = "11px 'Source Sans 3'"; const ew = x.measureText(String(t.e)).width;
    const left = align === "center" ? px - (bw + ew) / 2 : px - bw - ew;
    x.textAlign = "left"; x.font = "15px 'Source Sans 3'"; x.fillText(base, left, py);
    x.font = "11px 'Source Sans 3'"; x.fillText(String(t.e), left + bw + 0.5, py - 7); x.font = "15px 'Source Sans 3'";
  }
  function lgcTicks(x, w, h, pad, xr, yr) {
    x.fillStyle = "#64748b"; x.strokeStyle = "#94a3b8"; x.lineWidth = 1.2; x.font = "15px 'Source Sans 3'";
    const X = (v) => pad.l + (v - xr[0]) / (xr[1] - xr[0]) * (w - pad.l - pad.r), Y = (v) => h - pad.b - (v - yr[0]) / (yr[1] - yr[0]) * (h - pad.t - pad.b);
    for (const t of LGC_TICKS) {
      const len = t.major ? 7 : 4;
      if (t.p >= xr[0] && t.p <= xr[1]) { const px = X(t.p); x.beginPath(); x.moveTo(px, h - pad.b); x.lineTo(px, h - pad.b + len); x.stroke(); if (t.major) powLabel(x, t, px, h - pad.b + 24, "center"); }
      if (t.p >= yr[0] && t.p <= yr[1]) { const py = Y(t.p); x.beginPath(); x.moveTo(pad.l, py); x.lineTo(pad.l - len, py); x.stroke(); if (t.major) powLabel(x, t, pad.l - 10, py + 5, "right"); }
    }
    x.textAlign = "center";
  }

  // ---------- reusable 3D scatter ----------
  function make3D(canvas, o) {
    const x = ctxOf(canvas), [W, H] = cssSize(canvas);
    const P = o.P || L.xyz, n = o.n || N, labOf = o.lab || L.lab; let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < n; i++) { cx += P[3 * i]; cy += P[3 * i + 1]; cz += P[3 * i + 2]; }
    // centre on the middle of the 1st–99th percentile box so a large cluster does not pull the view off-centre
    const pc = (k, q) => { const a = []; for (let i = 0; i < n; i++) a.push(P[3 * i + k]); a.sort((x, y) => x - y); return a[Math.floor(q * (n - 1))]; };
    cx = (pc(0, 0.01) + pc(0, 0.99)) / 2; cy = (pc(1, 0.01) + pc(1, 0.99)) / 2; cz = (pc(2, 0.01) + pc(2, 0.99)) / 2;
    const dist = []; for (let i = 0; i < n; i++) dist.push(Math.hypot(P[3 * i] - cx, P[3 * i + 1] - cy, P[3 * i + 2] - cz));
    const r = dist.sort((a, b) => a - b)[Math.floor(n * 0.985)]; // ignore a few outlying cells when sizing the view
    const pts = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pts[3 * i] = (P[3 * i] - cx) / r; pts[3 * i + 1] = (P[3 * i + 1] - cy) / r; pts[3 * i + 2] = (P[3 * i + 2] - cz) / r; }
    const st = { yaw: o.yaw ?? 0.6, pitch: o.pitch ?? -0.35, color: o.color, highlight: -1, active: false, drag: null, auto: o.auto ?? 0.0012 };
    const proj = new Float32Array(n * 3), order = new Uint32Array(n).map((_, i) => i);
    function draw() {
      const cyw = Math.cos(st.yaw), syw = Math.sin(st.yaw), cp = Math.cos(st.pitch), sp = Math.sin(st.pitch);
      for (let i = 0; i < n; i++) {
        const a = pts[3 * i], b = pts[3 * i + 1], c = pts[3 * i + 2];
        const X = a * cyw + c * syw, Z0 = -a * syw + c * cyw, Y = b * cp - Z0 * sp, Z = b * sp + Z0 * cp;
        proj[3 * i] = o.cx + X * o.scale; proj[3 * i + 1] = o.cy - Y * o.scale; proj[3 * i + 2] = Z;
      }
      const key = st.color.sortKey;
      order.sort(key ? (i, j) => key(i) - key(j) || proj[3 * i + 2] - proj[3 * j + 2] : (i, j) => proj[3 * i + 2] - proj[3 * j + 2]);
      x.clearRect(0, 0, W, H); if (o.bg) { x.fillStyle = o.bg; x.fillRect(0, 0, W, H); }
      for (let k = 0; k < n; k++) {
        const i = order[k], z = proj[3 * i + 2], dim = st.highlight >= 0 && labOf[i] !== st.highlight;
        x.globalAlpha = dim ? 0.08 : (o.alpha ?? 0.85) * (0.55 + 0.45 * (z + 1) / 2);
        x.fillStyle = dim ? "#94a3b8" : st.color.fn(i);
        const rad = o.radius * (0.8 + 0.35 * (z + 1) / 2);
        x.fillRect(proj[3 * i] - rad, proj[3 * i + 1] - rad, rad * 2, rad * 2);
      }
      x.globalAlpha = 1; if (o.overlay) o.overlay(x, proj);
    }
    function loop() { if (!st.active) return; if (!st.drag && st.auto) { st.yaw += st.auto; } draw(); requestAnimationFrame(loop); }
    canvas.addEventListener("pointerdown", (e) => { st.drag = pointer(canvas, e); canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener("pointermove", (e) => { if (!st.drag) return; const p = pointer(canvas, e); st.yaw += (p[0] - st.drag[0]) * 0.008; st.pitch = Math.max(-1.4, Math.min(1.4, st.pitch + (p[1] - st.drag[1]) * 0.008)); st.drag = p; });
    canvas.addEventListener("pointerup", () => { st.drag = null; });
    canvas.style.cursor = "grab";
    return {
      st, draw,
      start() { if (st.active) return; st.active = true; loop(); },
      stop() { st.active = false; },
      setColor(c) { st.color = c; draw(); },
      setHighlight(h) { st.highlight = h; draw(); },
    };
  }
  const byPop = { fn: (i) => popColor[L.lab[i]] };
  function byMarker(m) {
    const j = col(m); const v = new Float32Array(N); let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < N; i++) v[i] = L.m[i * NM + j];
    const s = Array.from(v).sort((a, b) => a - b); lo = s[Math.floor(N * 0.01)]; hi = s[Math.floor(N * 0.99)];
    return { fn: (i) => viridis((v[i] - lo) / (hi - lo)), sortKey: (i) => v[i] };
  }

  // CD8 T cells of the kidney case (rcc-cd8-umap.js): 3D UMAP coloured by cell type (thesis clusters matched by profile).
  // Same cells on the title slide (no names) and on s-ctend after the kidney case (with names).
  const CT_COL = ["#e2e8f0", "#f59e0b", "#fde047", "#f472b6", "#22d3ee", "#3b82f6", "#4ade80", "#a3e635", "#a78bfa", "#e879f9"];
  const CT_SHORT = ["Naive", "Central memory", "Circulating memory (TCF-1⁺)", "Progenitor (TCF-1⁺)", "Effector", "Effector memory",
    "Resident memory (CD103⁺)", "Resident memory (CD103⁻)", "Resident, exhausted", "Exhausted, dividing (Ki67⁺)"];
  function cd8Map(canvas, o) {
    const U = window.DECK_RCC_UMAP_MAP || window.DECK_RCC_UMAP; // 12,000 cells (1,000 per file) since 12 Nov 2026; other slides keep the 6,000-cell sample
    if (!U || !U.ct) return make3D(canvas, Object.assign({ color: byPop }, o));
    const ct = Uint8Array.from(U.ct);
    return make3D(canvas, Object.assign({ P: Float32Array.from(U.p3), n: ct.length, lab: ct, color: { fn: (i) => CT_COL[ct[i]] } }, o));
  }

  const FIGS = (window.FIGS = {});

  // ---------- 1 · title ----------
  FIGS["s-title"] = {
    init(el) {
      el.querySelector("#presenter-line").innerHTML = (window.PRESENTER || {}).line || "";
      this.v = cd8Map(el.querySelector("#title3d"), { cx: 1560, cy: 560, scale: 380, radius: 2.0, alpha: 0.9, auto: 0.0016, yaw: 0.9, pitch: -0.3 });
    },
    enter() { this.v.start(); }, leave() { this.v.stop(); },
  };

  // ---------- 2 · what flow cytometry measures ----------
  // The instrument is a schematic; every intensity, bar and dot comes from the real 6,000-cell panel.
  // Markers in the order they are introduced: the slide starts with CD4 and CD8 and adds the other five.
  const DET = [
    { m: "CD4", c: "#0e7490" }, { m: "CD8", c: "#be185d" }, { m: "CD3", c: "#1d4ed8" }, { m: "CD19", c: "#15803d" },
    { m: "TCRb", c: "#c2410c" }, { m: "TCRyd", c: "#7c3aed" }, { m: "NK1.1", c: "#a16207" },
  ];
  addEventListener("beforeprint", () => (STATE.printing = true)); addEventListener("afterprint", () => (STATE.printing = false));
  const GATE_TAB = [1.8, 1.7, 4.1, 4.1]; // parent gate, alpha-beta T cells: CD3 x0, TCRb y0, CD3 x1, TCRb y1
  const GATE_CD4 = [2.2, -0.9, 4.1, 1.6]; // CD4 x0, CD8 y0, CD4 x1, CD8 y1
  const GATE_CD8 = [-1.25, 1.9, 1.9, 4.1]; // CD4−CD8+, used on slides 3 and 4
  const POS_CUT = 1.8; // logicle intensity (≈ 600 raw) above which a marker counts as bound (+)
  const HB = 64, HLO = -1.25, HHI = 4.1; // common intensity axis (logicle) for bars, histograms and small plots
  const boxIn = (i, mx, my, g) => { const a = val(i, mx), b = val(i, my); return a >= g[0] && a <= g[2] && b >= g[1] && b <= g[3]; };
  // Gates shared by slides 2–4. g2: CD4+CD8− with only those two markers. cd4/cd8: after the CD3+TCRβ+ parent
  // (same hierarchy and number as the gating slide). gd: the reviewed γδ T population of the clustering slide.
  const GSET = (() => {
    const o = { g2: new Uint8Array(N), cd4: new Uint8Array(N), cd8: new Uint8Array(N), gd: new Uint8Array(N), n2: 0, n4: 0, n8: 0, ngd: 0, dn: 0, gdOut1: 0, gdOut2: 0 };
    const gdId = L.pops.findIndex((p) => p.name === "T γδ");
    for (let i = 0; i < N; i++) {
      const par = boxIn(i, "CD3", "TCRb", GATE_TAB);
      if (boxIn(i, "CD4", "CD8", GATE_CD4)) { o.g2[i] = 1; o.n2++; if (par) { o.cd4[i] = 1; o.n4++; } }
      if (par && boxIn(i, "CD4", "CD8", GATE_CD8)) { o.cd8[i] = 1; o.n8++; }
      if (L.lab[i] === gdId) { o.gd[i] = 1; o.ngd++; if (!par) o.gdOut1++; else if (!o.cd4[i] && !o.cd8[i]) o.gdOut2++; } // where the tree drops them
      if (val(i, "CD4") < GATE_CD4[0] && val(i, "CD8") < GATE_CD4[3]) o.dn++;
    }
    return o;
  })();
  const BLUE = "rgba(29,78,216,.6)", PINK = "rgba(190,24,93,.6)", PURPLE = "rgba(124,58,237,.75)";
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const ease = (t) => t * t * (3 - 2 * t);

  // Small multiples: every pair of the 7 markers (lower triangle, DET order). Each panel is drawn once and cached.
  const MAT = {
    cache: new Map(),
    layout(W, H) { const n = DET.length - 1, gap = 5, s = Math.min((W - 72) / n, (H - 52) / n) - gap; return { n, gap, s, L0: 64 + (W - 72 - n * (s + gap)) / 2, T0: 20 }; },
    at(lay, q, r) { return [lay.L0 + q * (lay.s + lay.gap), lay.T0 + (r - 1) * (lay.s + lay.gap)]; },
    ux(v) { return clamp01((v - HLO) / (HHI - HLO)); },
    rect(lay, q, r, g) { const [ox, oy] = this.at(lay, q, r), s = lay.s, X = (v) => ox + 2 + this.ux(v) * (s - 4), Y = (v) => oy + s - 2 - this.ux(v) * (s - 4); return [X(g[0]), Y(g[3]), X(g[2]) - X(g[0]), Y(g[1]) - Y(g[3])]; },
    // grey cells, then the cells of each layer in its colour (same 1-in-2 subsample)
    panel(q, r, s, layers) {
      const key = `${q},${r},${Math.round(s)},${layers.map((l) => l.key).join("+")}`;
      if (this.cache.has(key)) return this.cache.get(key);
      const c = document.createElement("canvas"); c.width = c.height = Math.ceil(s * 2); const x = c.getContext("2d"); x.scale(2, 2);
      const mx = DET[q].m, my = DET[r].m;
      const dot = (i, d) => x.fillRect(2 + this.ux(val(i, mx)) * (s - 4) - d, s - 2 - this.ux(val(i, my)) * (s - 4) - d, 2 * d, 2 * d);
      x.fillStyle = "#fff"; x.fillRect(0, 0, s, s);
      x.fillStyle = "rgba(71,85,105,.35)"; for (let i = 0; i < N; i += 2) dot(i, 0.6);
      for (const l of layers) { x.fillStyle = l.color; for (let i = 0; i < N; i += 2) if (l.mask[i]) dot(i, 0.75); }
      this.cache.set(key, c); return c;
    },
    // row labels left of the first column; column labels under the lowest visible row (rows can still be appearing)
    labels(x, lay, alphaOf, lowRow) {
      x.font = "700 15px 'Source Sans 3'"; const s = lay.s, A = x.globalAlpha;
      for (let r = 1; r <= lay.n; r++) { const a = alphaOf(r); if (a <= 0) continue; const [ox, oy] = this.at(lay, 0, r); x.globalAlpha = A * a; x.fillStyle = DET[r].c; x.textAlign = "right"; x.fillText(mlabel(DET[r].m), ox - 8, oy + s / 2 + 5); }
      const yb = lay.T0 + (lowRow - 1) * (s + lay.gap) + s + 20;
      for (let q = 0; q < lay.n; q++) { const a = alphaOf(q + 1); if (a <= 0) continue; const [ox] = this.at(lay, q, 1); x.globalAlpha = A * a; x.fillStyle = DET[q].c; x.textAlign = "center"; x.fillText(mlabel(DET[q].m), ox + s / 2, yb); }
      x.globalAlpha = A; x.textAlign = "left";
    },
  };

  FIGS["s-what"] = {
    init(el) {
      this.cv = el.querySelector("#cyto"); this.dp = el.querySelector("#cyto-dot"); this.cnt = el.querySelector("#cyto-cap");
      this.ask = !!el.querySelector(".say"); // spectral deck 2a: click 1 only asks "how many groups?"; groups are named with the gate
      // index-en-spectral.html: <section data-spectral> adds a conventional → spectral step with real Aurora data (spectral.js)
      this.SP = el.dataset.spectral != null ? window.DECK_SPECTRAL || null : null; this.vs = el.querySelector(".vs"); this.sNext = 0; this.scur = 0;
      let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      this.order = Array.from({ length: N }, (_, i) => i);
      for (let i = N - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [this.order[i], this.order[j]] = [this.order[j], this.order[i]]; }
      // the cell we follow (2a): the gated CD4+ T cell closest to the gate's median CD4 and CD8, sent first
      { const med = (m) => { const a = []; for (let i = 0; i < N; i++) if (GSET.cd4[i]) a.push(val(i, m)); a.sort((u, v) => u - v); return a[a.length >> 1]; };
        const m4 = med("CD4"), m8 = med("CD8"); let best = -1, bd = Infinity;
        for (let i = 0; i < N; i++) if (GSET.cd4[i]) { const d = Math.hypot(val(i, "CD4") - m4, val(i, "CD8") - m8); if (d < bd) { bd = d; best = i; } }
        const k = this.order.indexOf(best); [this.order[0], this.order[k]] = [this.order[k], this.order[0]]; this.me = best; }
      this.xr = [HLO, HHI]; this.yr = [HLO, HHI]; // same range as the small plots, so the big plot shrinks into its panel
      this.mask = { g2: GSET.g2, gR: GSET.cd4 };
      // phenotype of the gated cells, read from the data: + when their median is above the bound threshold
      const signOf = (m) => DET.map((d) => { const a = []; for (let i = 0; i < N; i++) if (m[i]) a.push(val(i, d.m)); a.sort((u, v) => u - v); return a[a.length >> 1] >= POS_CUT ? "+" : "−"; });
      // histograms of the gated cells, on the same bins as the full histograms
      const histOf = (m) => DET.map((d) => { const h = new Float32Array(HB); for (let i = 0; i < N; i++) if (m[i]) { const b = Math.floor((val(i, d.m) - HLO) / (HHI - HLO) * HB); if (b >= 0 && b < HB) h[b]++; } return h; });
      this.sign = { g2: signOf(GSET.g2), gR: signOf(GSET.cd4) }; this.gHist = { g2: histOf(GSET.g2), gR: histOf(GSET.cd4) };
      // the three groups of the two-marker plot, labelled at their median
      const grp = (f) => { const a = [], b = []; for (let i = 0; i < N; i++) if (f(val(i, "CD4"), val(i, "CD8"))) { a.push(val(i, "CD4")); b.push(val(i, "CD8")); } a.sort((u, v) => u - v); b.sort((u, v) => u - v); return [a[a.length >> 1], b[b.length >> 1]]; };
      const [c4, c8] = [GATE_CD4[0], GATE_CD4[3]];
      this.groups = [
        { t: "CD4+", p: grp((a, b) => a >= c4 && b < c8) }, { t: "CD8+", p: grp((a, b) => a < c4 && b >= c8) },
        { t: `CD4− CD8− · ${pct(GSET.dn / N, 0)}`, p: grp((a, b) => a < c4 && b < c8) },
      ];
      this.reset();
    },
    reset() {
      this.cells = []; this.next = 0; this.dots = 0; this.cur = -1; this.flash = 0; this.fast = false; this.spawnY = 0; this.showGate = false; this.gridOn = false; this.ga = 0; this.gm = 0; this.hi = -1; this.hiT = 0;
      this.mk = 2; this.la = 0; this.hm = 0; this.sa = 0; this.specOn = false; this.da = 0; this.decOn = false; this.sw = 0; this.exCell = null; this.hist = DET.map(() => new Float32Array(HB)); this.histN = 0; this.draw();
    },
    alphaM(j) { return j < 2 ? 1 : clamp01(this.mk - j); }, // marker j fades in as mk goes from j to j + 1
    gkey() { return this.mk > 4.95 ? "gR" : "g2"; }, // the gate is refined once CD3 and TCRβ are in
    // per-marker histograms over the cells measured so far (same cells as the dot plot)
    fillHist() {
      for (; this.histN < this.dots; this.histN++) {
        const i = this.order[this.histN];
        DET.forEach((d, k) => { const b = Math.floor((val(i, d.m) - HLO) / (HHI - HLO) * HB); if (b >= 0 && b < HB) this.hist[k][b]++; });
      }
    },
    enter() { this.reset(); this.active = true; this.last = performance.now(); const loop = (t) => { if (!this.active) return; this.tick(Math.max(0, Math.min(0.05, (t - this.last) / 1000))); this.last = t; requestAnimationFrame(loop); }; requestAnimationFrame(loop); },
    leave() { this.active = false; },
    step(n) {
      if (n === 0 && this.fast) this.reset(); // stepping back replays the slow, cell-by-cell view
      this.fast = n >= 1; this.showGate = n >= 2; this.gridOn = n >= 3;
      if (n >= 2) { this.dots = N; this.hm = 1; } // all cells measured: stream stops, distributions complete
      // spectral deck: 4 = one cell's whole spectrum, 5 = that spectrum as fingerprints × amounts, 6 = pros/cons, 7 = problems
      this.specOn = !!this.SP && n >= 4; this.decOn = !!this.SP && n >= 5; if (this.vs) this.vs.classList.toggle("gone", n >= 7);
      if (STATE.printing) {
        this.ga = +this.showGate; this.gm = +this.gridOn; this.mk = this.gridOn ? 7 : 2; this.la = n === (this.ask ? 2 : 1) ? 1 : 0; this.sa = +this.specOn; this.da = +this.decOn;
        if (this.specOn) { this.cells = [this.exCell = { i: this.order[0], y: 280, s: this.SP.example.cell, ex: true, hit: true }]; this.scur = this.SP.example.cell; this.sw = 1; }
      }
      this.draw();
    },
    tick(dt) {
      const P = 280, sp = this.specOn, speed = sp ? 170 : this.fast ? 1400 : 115, gap = sp ? 150 : this.fast ? 46 : 96;
      // spectral: one example cell comes down and stops in the beam; leaving the step lets it fall away
      if (sp && !this.exCell) { this.exCell = { i: this.order[0], y: 70, s: this.SP.example.cell, ex: true }; this.cells.push(this.exCell); this.sw = 0; }
      if (!sp && this.exCell) { this.exCell.ex = false; this.exCell = null; }
      const held = this.cells.find((c) => c.hold > 0);
      if (held) { held.hold -= dt; dt = 0; }
      for (const c of this.cells) c.y = c.ex ? Math.min(P, c.y + speed * dt) : c.y + speed * dt;
      for (const c of this.cells) if (c.i === this.me && !this.fast && c.hold == null && c.y >= P && c.s == null) { c.y = P; c.hold = 2.2; }
      if (this.exCell && this.exCell.y >= P) this.sw = Math.min(1, this.sw + dt / 6); // ≈6 s: the 5 conventional detectors, a pause, then the other 59
      this.spawnY -= speed * dt;
      if (this.spawnY <= 0 && this.dots < N) { this.cells.push({ i: this.order[this.next % N], y: 70, s: this.SP ? this.sNext++ % this.SP.cells.length : null }); this.next++; this.spawnY = gap; }
      for (const c of this.cells) {
        if (!c.hit && c.y >= P) { c.hit = true; this.cur = c.i; this.flash = 1; if (c.s != null) this.scur = c.s; if (!this.fast) { this.hi = c.i; this.hiT = 1.2; } if (this.dots < N) this.dots++; }
      }
      if (this.fast && this.dots < N) this.dots = Math.min(N, this.dots + Math.ceil(N * dt / 3.2));
      this.cells = this.cells.filter((c) => c.y < 590);
      this.flash = Math.max(0, this.flash - dt * (this.fast ? 6 : 2.2)); this.hiT = Math.max(0, this.hiT - dt);
      this.hm = this.fast ? Math.min(1, this.hm + dt * 1.4) : Math.max(0, this.hm - dt * 2);
      const toward = (v, on, k) => (on ? Math.min(1, v + dt * k) : Math.max(0, v - dt * k));
      this.ga = toward(this.ga, this.showGate, 2); this.gm = toward(this.gm, this.gridOn, 1.6); this.sa = toward(this.sa, this.specOn, 1.6); this.da = toward(this.da, this.decOn, 1.4);
      this.la = toward(this.la, this.ask ? this.showGate && !this.gridOn : this.fast && !this.showGate && this.dots >= N * 0.6, 2.5);
      // markers join one by one once the plot has shrunk into the matrix
      if (this.gridOn) { if (this.gm > 0.9) this.mk = Math.min(7, this.mk + dt * 1.25); } else this.mk = Math.max(2, this.mk - dt * 8);
      this.draw();
    },
    draw() {
      this.fillHist(); this.drawInstrument(); this.drawDots();
      let cap;
      if (this.gm > 0.05) {
        const n = 2 + [2, 3, 4, 5, 6].filter((j) => this.alphaM(j) >= 0.5).length, p = n * (n - 1) / 2;
        cap = EN ? `<b>${n} markers → ${p} two-axis ${p === 1 ? "plot" : "plots"}</b>` : `<b>${n} marcadores → ${p} ${p === 1 ? "gráfico" : "gráficos"}</b> de dos ejes`;
      } else cap = this.fast ? tr(`${nf(this.dots)} células · <b>2 marcadores → 1 gráfico</b>`, `${nf(this.dots)} cells · <b>2 markers → 1 plot</b>`) : EN ? `${nf(this.dots)} ${this.dots === 1 ? "cell" : "cells"} · each dot is one cell` : `${nf(this.dots)} ${this.dots === 1 ? "célula" : "células"} · cada punto es una célula`;
      if (this.sa > 0.5) cap = this.da > 0.5 ? "<b>Unmixing: how much of each fingerprint is in this cell.</b> One value per marker, so the plots stay the same." : "<b>Spectral: the whole spectrum of this cell, 64 detectors.</b> A conventional cytometer reads 5 of them.";
      if (cap !== this.capTxt) { this.cnt.innerHTML = cap; this.capTxt = cap; }
    },
    drawInstrument() {
      const x = ctxOf(this.cv), [W, H] = cssSize(this.cv), PX = 200, PY = 280;
      x.clearRect(0, 0, W, H);
      x.font = "600 19px 'Source Sans 3'"; x.fillStyle = "#64748b"; x.textAlign = "center";
      x.fillText(tr("células en fila", "cells in single file"), PX, 24);
      // nozzle and stream
      x.fillStyle = "#e0f2fe"; x.strokeStyle = "#7dd3fc"; x.lineWidth = 1.5;
      x.beginPath(); x.moveTo(PX - 70, 36); x.lineTo(PX + 70, 36); x.lineTo(PX + 11, 92); x.lineTo(PX - 11, 92); x.closePath(); x.fill(); x.stroke();
      x.fillRect(PX - 11, 92, 22, H - 92);
      // laser
      x.strokeStyle = "#0284c7"; x.lineWidth = 7; x.lineCap = "round"; x.beginPath(); x.moveTo(24, PY); x.lineTo(PX, PY); x.stroke();
      x.fillStyle = "#0369a1"; x.textAlign = "left"; x.font = "700 21px 'Source Sans 3'"; x.fillText(tr("láser", "laser"), 24, PY - 18);
      // detector rows: light scatter, then one row per marker; new markers fade in and the block re-centres on the laser
      const X0 = 520, BX = 640, BW = 310, HW = 310, RH = 54;
      const rows = [{ m: null, c: "#64748b", a: 1 }, ...DET.map((d, j) => ({ ...d, j, a: this.alphaM(j) }))];
      const vis = rows.reduce((s, r) => s + r.a, 0), Y0 = PY - (vis - 1) * RH / 2, last = Y0 + (rows.filter((r) => r.a > 0).length - 1) * RH; // legends sit below any row that is fading in
      const hm = this.hm, done = this.dots >= N && !this.cells.length, key = this.gkey();
      x.textAlign = "left"; x.font = "600 19px 'Source Sans 3'"; x.fillStyle = "#64748b";
      x.fillText(hm < 0.5 ? tr("detectores: lo que mide esta célula en cada marcador", "detectors: what this cell measures on each marker") : tr(`distribución en las ${nf(this.dots)} células medidas`, `distribution across the ${nf(this.dots)} cells measured`), X0, Y0 - 34);
      const pos = (v) => BX + HW * clamp01((v - HLO) / (HHI - HLO));
      rows.forEach((r, k) => {
        if (r.a <= 0) return;
        const y = Y0 + k * RH, A = r.a;
        // light ray from the cell to the detector
        x.globalAlpha = A * (0.12 + 0.75 * this.flash) * (1 - this.sa); x.strokeStyle = r.c; x.lineWidth = r.m ? 2.5 : 3;
        x.beginPath(); x.moveTo(PX + 14, PY); x.lineTo(X0 - 12, y); x.stroke(); x.globalAlpha = A;
        x.fillStyle = r.c; x.beginPath(); x.arc(X0, y, 7, 0, 7); x.fill();
        if (!r.m) { x.fillStyle = "#334155"; x.font = "600 21px 'Source Sans 3'"; x.fillText(tr("luz dispersada: tamaño y complejidad", "scattered light: size and complexity"), X0 + 20, y + 7); x.globalAlpha = 1; return; }
        x.fillStyle = r.c; x.font = "700 22px 'Source Sans 3'"; x.fillText(mlabel(r.m), X0 + 20, y + 8);
        // single cell: a bar per marker
        if (hm < 1) {
          x.globalAlpha = A * (1 - hm); x.fillStyle = "#eef2f7"; x.fillRect(BX, y - 11, BW, 22);
          if (this.cur >= 0) {
            const v = val(this.cur, r.m);
            x.fillStyle = r.c; x.fillRect(BX, y - 11, Math.max(4, pos(v) - BX), 22);
            x.fillStyle = "#334155"; x.font = "600 19px 'Liberation Mono', monospace"; x.fillText(nf(v, 2), BX + BW + 12, y + 7);
          }
        }
        // all cells: the histogram of that marker, built from the same cells
        if (hm > 0 && this.histN > 0) {
          const h = this.hist[r.j], sm = Array.from(h, (_, b) => (h[Math.max(0, b - 1)] + 2 * h[b] + h[Math.min(HB - 1, b + 1)]) / 4), mx = Math.max(...sm) || 1, base = y + 21, top = 42;
          x.globalAlpha = A * hm; x.beginPath(); x.moveTo(BX, base);
          sm.forEach((c, b) => x.lineTo(BX + (b + 0.5) / HB * HW, base - c / mx * top)); x.lineTo(BX + HW, base); x.closePath();
          x.fillStyle = r.c + "55"; x.fill(); x.strokeStyle = r.c; x.lineWidth = 2; x.stroke();
          if (this.ga > 0) { // the gated cells, on the same scale: the part of each distribution they occupy
            const g = this.gHist[key][r.j], gs = Array.from(g, (_, b) => (g[Math.max(0, b - 1)] + 2 * g[b] + g[Math.min(HB - 1, b + 1)]) / 4);
            x.globalAlpha = A * hm * this.ga; x.beginPath(); x.moveTo(BX, base);
            gs.forEach((c, b) => x.lineTo(BX + (b + 0.5) / HB * HW, base - c / mx * top)); x.lineTo(BX + HW, base); x.closePath();
            x.fillStyle = "rgba(29,78,216,.62)"; x.fill();
            // + / − of the gated cells on this marker
            x.globalAlpha = A * this.ga; x.textAlign = "center"; x.font = "800 26px 'Source Sans 3'"; x.fillStyle = this.sign[key][r.j] === "+" ? "#1d4ed8" : "#94a3b8"; x.fillText(this.sign[key][r.j], BX + HW + 30, y + 9); x.textAlign = "left";
          }
          x.globalAlpha = A * hm; x.strokeStyle = "#cbd5e1"; x.lineWidth = 1; x.beginPath(); x.moveTo(BX, base + 0.5); x.lineTo(BX + HW, base + 0.5); x.stroke();
          if (this.cur >= 0 && !done) { const px = pos(val(this.cur, r.m)); x.strokeStyle = "#0f172a"; x.lineWidth = 2.5; x.beginPath(); x.moveTo(px, base - top - 2); x.lineTo(px, base + 2); x.stroke(); }
        }
        x.globalAlpha = 1;
      });
      if (this.ga > 0) {
        const yb = last + 74; x.globalAlpha = this.ga; x.fillStyle = "rgba(29,78,216,.62)"; x.fillRect(BX, yb - 14, 18, 18);
        x.fillStyle = "#1d4ed8"; x.font = "700 19px 'Source Sans 3'"; x.fillText(key === "gR" ? tr("T CD4+ del gate: CD3+ TCRβ+ → CD4+ CD8−", "gated CD4+ T: CD3+ TCRβ+ → CD4+ CD8−") : tr("células del gate: CD4+ CD8−", "gated cells: CD4+ CD8−"), BX + 28, yb + 1);
        x.globalAlpha = 1;
      }
      if (hm > 0.5) { const yb = last + 44; x.globalAlpha = (hm - 0.5) * 2; x.fillStyle = "#64748b"; x.font = "600 17px 'Source Sans 3'"; x.fillText(tr("← intensidad baja", "← low intensity"), BX, yb); x.textAlign = "right"; x.fillText(tr("intensidad alta →", "high intensity →"), BX + HW, yb); x.textAlign = "left"; x.globalAlpha = 1; }
      if (this.sa > 0 && this.SP) this.drawSpectral(x, W, H, PX, PY);
      // cells, with a coloured speck for each bound antibody among the markers shown
      for (const c of this.cells) {
        const inBeam = Math.abs(c.y - PY) < 16;
        if (inBeam) { x.fillStyle = "rgba(14,165,233,.25)"; x.beginPath(); x.arc(PX, c.y, 26, 0, 7); x.fill(); }
        const me = c.i === this.me && c.s == null; // the followed cell: amber, as its point in the plot
        x.fillStyle = me ? "#fef3c7" : "#f8fafc"; x.strokeStyle = me ? "#b45309" : "#475569"; x.lineWidth = me ? 3.5 : 2; x.beginPath(); x.arc(PX, c.y, me ? 15 : 13, 0, 7); x.fill(); x.stroke();
        if (c.s != null) { // Aurora cell: ringed while it is the example; its markers show once it has been unmixed
          if (c.ex) { x.globalAlpha = this.sa; x.strokeStyle = "#0f172a"; x.lineWidth = 2.5; x.beginPath(); x.arc(PX, c.y, 21, 0, 7); x.stroke(); x.globalAlpha = 1; }
          x.globalAlpha = this.da; this.SP.fluors.forEach((f, k) => { if (this.SP.unmixed[c.s][k] < 0.3) return; const a = k / 5 * Math.PI * 2 - Math.PI / 2; x.fillStyle = f.color; x.beginPath(); x.arc(PX + Math.cos(a) * 13, c.y + Math.sin(a) * 13, 4.2, 0, 7); x.fill(); });
          x.globalAlpha = 1; continue;
        }
        DET.forEach((d, k) => {
          if (this.alphaM(k) < 0.5 || val(c.i, d.m) < POS_CUT) return;
          const a = k / DET.length * Math.PI * 2 - Math.PI / 2; x.fillStyle = d.c; x.beginPath(); x.arc(PX + Math.cos(a) * 13, c.y + Math.sin(a) * 13, 4.2, 0, 7); x.fill();
        });
      }
    },
    // Spectral detection, from real data (FR-FCM-Z2SK, 5-laser Aurora), for one real cell (a B cell, chosen by rule in
    // tools/build_spectral.py). Step 4: its light across the 64 detectors; the 5 a filter-based cytometer reads come first.
    // Step 5: the same spectrum as stacked contributions, fingerprint × amount (least squares), and the fingerprints below.
    drawSpectral(x, W, H, PX, PY) {
      const SP = this.SP, a = this.sa, d = this.da, ch = SP.channels, nC = ch.length, grp = (c) => c.replace(/\d+$/, "");
      const G5 = ["UV", "V", "B", "YG", "R"], GN = { UV: "UV", V: "violet", B: "blue", YG: "yellow-green", R: "red" };
      const ex = SP.example, y = SP.cells[ex.cell], cf = ex.coef, col = (r) => (r < 5 ? SP.fluors[r].color : "#a8b4c4");
      x.save(); x.globalAlpha = a; x.fillStyle = "#fff"; x.fillRect(PX + 76, 0, W - PX - 76, H);
      const X0 = 330, X1 = W - 24, gG = 10, bw = (X1 - X0 - gG * 4) / nC, xs = [];
      for (let k = 0, cx = X0; k < nC; k++) { if (k && grp(ch[k]) !== grp(ch[k - 1])) cx += gG; xs.push(cx); cx += bw; }
      const span = (g) => { const ks = ch.map((c, k) => (grp(c) === g ? k : -1)).filter((k) => k >= 0); return [xs[ks[0]], xs[ks[ks.length - 1]] + bw]; };
      const top = 66, base = 238, conv = new Set(SP.fluors.map((f) => ch.indexOf(f.conv)));
      const parts = y.map((_, k) => SP.sig.map((s, r) => Math.max(0, cf[r] * s[k]))), mx = Math.max(...y, ...parts.map((p) => p.reduce((u, v) => u + v, 0))) || 1;
      const hY = (v) => (v / mx) * (base - top);
      // the light of the cell, entering the detector array
      const sw = this.sw, lit = Math.min(1, sw * 8);
      const gr = x.createLinearGradient(PX + 20, 0, X0, 0); gr.addColorStop(0, "rgba(56,189,248,.45)"); gr.addColorStop(1, "rgba(56,189,248,.06)");
      x.globalAlpha = a * lit; x.fillStyle = gr; x.beginPath(); x.moveTo(PX + 22, PY - 5); x.lineTo(X0 - 8, top + 6); x.lineTo(X0 - 8, base); x.lineTo(PX + 22, PY + 5); x.closePath(); x.fill();
      x.globalAlpha = a; x.fillStyle = "#334155"; x.font = "700 21px 'Source Sans 3'"; x.textAlign = "left";
      x.fillText(d > 0.5 ? "The same spectrum, as a mix of fingerprints" : "The light of this cell, read by 64 detectors", X0, 34);
      // bars: first the 5 detectors of a conventional cytometer, then the other 59 sweep in; step 5 stacks the contributions
      for (let k = 0; k < nC; k++) {
        const isC = conv.has(k), show = isC ? clamp01(sw / 0.12) : clamp01((sw - 0.28) / 0.62 * nC - k * 0.9 + 1);
        if (show <= 0) continue;
        x.globalAlpha = a * show * (1 - d); x.fillStyle = isC ? "#0f172a" : "#64748b";
        const h = Math.max(1.5, hY(y[k])); x.fillRect(xs[k] + 0.6, base - h, bw - 1.2, h);
        if (d > 0) { let yy = base; x.globalAlpha = a * d; for (const r of [5, 0, 1, 2, 3, 4]) { const h2 = hY(parts[k][r]); if (h2 < 0.3) continue; x.fillStyle = col(r); x.fillRect(xs[k] + 0.6, yy - h2, bw - 1.2, h2); yy -= h2; } }
      }
      if (d > 0) { // the measured spectrum, as an outline over the stacked fit
        x.globalAlpha = a * d; x.strokeStyle = "#0f172a"; x.lineWidth = 2; x.beginPath();
        for (let k = 0; k < nC; k++) { const yy = base - hY(y[k]); x.moveTo(xs[k] - 0.5, yy); x.lineTo(xs[k] + bw + 0.5, yy); } x.stroke();
      }
      x.globalAlpha = a; x.fillStyle = "#cbd5e1"; x.fillRect(X0, base, X1 - X0, 1.5);
      x.font = "600 15px 'Source Sans 3'"; x.textAlign = "center"; x.fillStyle = "#94a3b8";
      for (const g of G5) { const [l, r] = span(g); x.fillText(GN[g], (l + r) / 2, base + 20); }
      x.textAlign = "left"; x.fillText("laser:", X0, base + 20);
      // the one detector per colour of a filter-based cytometer
      x.globalAlpha = a * clamp01(sw / 0.12); x.fillStyle = "#0f172a";
      for (const k of conv) { const cx = xs[k] + bw / 2; x.beginPath(); x.moveTo(cx, base + 28); x.lineTo(cx - 6, base + 38); x.lineTo(cx + 6, base + 38); x.closePath(); x.fill(); }
      x.font = "600 18px 'Source Sans 3'"; x.fillStyle = "#0f172a"; x.fillText("▲ conventional: 5 detectors, one per color", X0, base + 64);
      x.globalAlpha = a * clamp01((sw - 0.88) / 0.12); x.fillStyle = "#475569"; x.textAlign = "right"; x.fillText("spectral: all 64", X1, base + 64); x.textAlign = "left";
      if (d > 0) { x.globalAlpha = a * d; x.textAlign = "right"; x.font = "600 15px 'Source Sans 3'"; x.fillStyle = "#0f172a"; x.fillText(`measured · the mix explains ${(ex.r2 * 100).toFixed(1)}%`, X1, 62); x.fillRect(X1 - x.measureText(`measured · the mix explains ${(ex.r2 * 100).toFixed(1)}%`).width - 26, 56, 18, 2.5); x.textAlign = "left"; }
      // step 4: the question; step 5: the fingerprints (single-stain controls) and how much of each this cell has
      const fy = 350;
      x.globalAlpha = a * clamp01((sw - 0.92) / 0.08) * (1 - d); x.fillStyle = "#64748b"; x.font = "italic 600 24px 'Source Sans 3'";
      x.fillText("64 numbers… but which colors make up this curve?", X0, fy + 70);
      if (d > 0) {
        x.globalAlpha = a * d; x.fillStyle = "#64748b"; x.font = "600 17px 'Source Sans 3'";
        x.fillText("each color's fingerprint (its single-stain control)  ×  how much of it this cell has", X0, fy - 14);
        const n = SP.sig.length, cg = 10, cw = (X1 - X0 - cg * (n - 1)) / n, u = SP.unmixed[ex.cell];
        SP.sig.forEach((s, r) => {
          const ox = X0 + r * (cw + cg), c = col(r), isAF = r === 5;
          x.fillStyle = "#f8fafc"; x.strokeStyle = "#e2e8f0"; x.lineWidth = 1.5; x.fillRect(ox, fy, cw, 196); x.strokeRect(ox, fy, cw, 196);
          x.fillStyle = isAF ? "#64748b" : c; x.font = "700 17px 'Source Sans 3'"; x.fillText(isAF ? "Autofluor." : SP.fluors[r].name, ox + 8, fy + 24);
          x.fillStyle = "#475569"; x.font = "600 15px 'Source Sans 3'"; x.fillText(isAF ? "the cell itself" : SP.fluors[r].marker, ox + 8, fy + 44);
          const cx0 = ox + 6, cwid = cw - 12, cTop = fy + 58, cBase = fy + 120;
          x.strokeStyle = isAF ? "#94a3b8" : c; x.lineWidth = 2.2; x.setLineDash(isAF ? [5, 4] : []); x.beginPath();
          s.forEach((v, k) => { const px = cx0 + (k + 0.5) / nC * cwid, py = cBase - v * (cBase - cTop); k ? x.lineTo(px, py) : x.moveTo(px, py); }); x.stroke(); x.setLineDash([]);
          x.fillStyle = "#cbd5e1"; x.fillRect(cx0, cBase, cwid, 1);
          // the amount: bar relative to the sample (1 = its 98th percentile), the value that becomes this marker's axis
          x.fillStyle = "#64748b"; x.font = "600 14px 'Source Sans 3'"; x.fillText("× amount", ox + 8, fy + 150);
          x.fillStyle = "#e2e8f0"; x.fillRect(ox + 8, fy + 160, cw - 16, 14);
          x.fillStyle = isAF ? "#94a3b8" : c; x.fillRect(ox + 8, fy + 160, (cw - 16) * clamp01(Math.max(0.02, u[r])), 14);
        });
      }
      x.restore();
    },
    // the CD4 × CD8 plot shrinks into the first panel of the matrix; the other panels appear with their marker
    drawDots() {
      const x = ctxOf(this.dp), [W, H] = cssSize(this.dp), pad = { l: 62, r: 16, t: 16, b: 52 };
      x.clearRect(0, 0, W, H);
      const lay = MAT.layout(W, H), [ox, oy] = MAT.at(lay, 0, 1), t = ease(this.gm);
      if (t < 1) {
        const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b, kx = lay.s / pw, ky = lay.s / ph;
        x.save(); x.translate((ox - pad.l * kx) * t, (oy - pad.t * ky) * t); x.scale(1 + (kx - 1) * t, 1 + (ky - 1) * t);
        x.globalAlpha = 1 - t; this.drawPlot(x, W, H, pad, this.xr, this.yr); x.restore();
      }
      if (t > 0) {
        const key = this.gkey(), layers = this.showGate ? [{ key, mask: this.mask[key], color: BLUE }] : [];
        for (let r = 1; r <= lay.n; r++) {
          const a = this.alphaM(r) * t; if (a <= 0) continue;
          for (let q = 0; q < r; q++) {
            const [px, py] = MAT.at(lay, q, r); x.globalAlpha = a; x.drawImage(MAT.panel(q, r, lay.s, layers), px, py, lay.s, lay.s);
            const k0 = q === 0 && r === 1; x.strokeStyle = k0 ? "#2563eb" : "#cbd5e1"; x.lineWidth = k0 ? 3 : 1; x.strokeRect(px, py, lay.s, lay.s);
          }
        }
        x.globalAlpha = t; MAT.labels(x, lay, (r) => this.alphaM(r), Math.max(1, Math.ceil(this.mk - 1 - 1e-6))); x.globalAlpha = 1;
      }
    },
    drawPlot(x, W, H, pad, xr, yr) {
      const A = x.globalAlpha; axes(x, W, H, pad, xr, yr, "CD4", "CD8", "lgc");
      const sx = (v) => pad.l + (v - xr[0]) / (xr[1] - xr[0]) * (W - pad.l - pad.r), sy = (v) => H - pad.b - (v - yr[0]) / (yr[1] - yr[0]) * (H - pad.t - pad.b);
      x.fillStyle = "#334155"; x.globalAlpha = A * (this.dots > 400 ? 0.42 : 0.8);
      const r = this.dots > 400 ? 1.5 : 3;
      for (let k = 0; k < this.dots; k++) { const i = this.order[k]; x.fillRect(sx(val(i, "CD4")) - r, sy(val(i, "CD8")) - r, r * 2, r * 2); }
      if (this.ga > 0) { // with only two markers, the gate takes every cell in the box
        x.fillStyle = "#1d4ed8"; x.globalAlpha = A * this.ga * 0.55;
        for (let k = 0; k < this.dots; k++) { const i = this.order[k]; if (GSET.g2[i]) x.fillRect(sx(val(i, "CD4")) - r, sy(val(i, "CD8")) - r, r * 2, r * 2); }
      }
      x.globalAlpha = A;
      if (this.hi >= 0 && this.hiT > 0 && !this.fast) {
        const px = sx(val(this.hi, "CD4")), py = sy(val(this.hi, "CD8"));
        x.strokeStyle = "#0284c7"; x.lineWidth = 3; x.globalAlpha = A * Math.min(1, this.hiT * 1.5); x.beginPath(); x.arc(px, py, 11, 0, 7); x.stroke(); x.globalAlpha = A;
      }
      if (this.me != null && this.dots > 0 && this.order.indexOf(this.me) < this.dots) { // the cell we follow
        const px = sx(val(this.me, "CD4")), py = sy(val(this.me, "CD8"));
        x.globalAlpha = A; x.fillStyle = "#f59e0b"; x.beginPath(); x.arc(px, py, 6, 0, 7); x.fill();
        x.strokeStyle = "#b45309"; x.lineWidth = 3.5; x.beginPath(); x.arc(px, py, 15, 0, 7); x.stroke();
        x.font = "800 22px 'Source Sans 3'"; x.textAlign = "left"; x.lineJoin = "round"; x.strokeStyle = "rgba(255,255,255,.95)"; x.lineWidth = 6;
        const t = tr("esta célula", "this cell"); x.textAlign = "right"; x.strokeText(t, px - 20, py + 40); x.fillStyle = "#b45309"; x.fillText(t, px - 20, py + 40); x.textAlign = "left";
      }
      if (this.la > 0) { // the three groups, before any gate is drawn
        x.font = "700 21px 'Source Sans 3'"; x.textAlign = "center"; x.lineJoin = "round";
        for (const g of this.groups) { const px = sx(g.p[0]), py = sy(g.p[1]) - 62; x.globalAlpha = A * this.la; x.strokeStyle = "rgba(255,255,255,.92)"; x.lineWidth = 6; x.strokeText(g.t, px, py); x.fillStyle = "#0f172a"; x.fillText(g.t, px, py); }
        x.globalAlpha = A;
      }
      if (this.showGate) {
        const G = GATE_CD4, g = [Math.max(G[0], xr[0]), Math.max(G[1], yr[0]), Math.min(G[2], xr[1]), Math.min(G[3], yr[1])], gx = sx(g[0]), gy = sy(g[3]), gw = sx(g[2]) - gx, gh = sy(g[1]) - gy;
        x.globalAlpha = A * this.ga; x.fillStyle = "rgba(37,99,235,.08)"; x.fillRect(gx, gy, gw, gh); x.strokeStyle = "#2563eb"; x.lineWidth = 3; x.strokeRect(gx, gy, gw, gh);
        x.fillStyle = "#1d4ed8"; x.font = "700 22px 'Source Sans 3'"; x.textAlign = "right";
        x.fillText(`CD4+ CD8− · ${pct(GSET.n2 / N)}`, gx + gw - 8, gy - 10); x.globalAlpha = A;
      }
    },
  };

  // ---------- 2b · spectral flow cytometry: one real tumor cell (spectral-rcc.js, tools/build_spectral_rcc.py) ----------
  // Step 0: the cell stops in the laser and its light sweeps across the 64 detectors. Step 1: the 18 reference
  // fingerprints (single-stain controls). Step 2: unmixing — the spectrum as stacked contributions and one value per marker.
  FIGS["s-spec"] = {
    ORDER: ["CD3", "CD4", "CD8", "CD69", "CD103", "PD-1", "TIM-3", "CD39", "CCR7", "CD45RO", "TCF-1", "GZMB", "GNLY", "FOXP3", "CD25", "Ki-67", "CX3CR1", "Viability"],
    init(el) {
      this.D = window.DECK_SPECTRAL_RCC; this.cv = el.querySelector("#spec"); this.am = el.querySelector("#spec-amt"); this.vs = el.querySelector(".vs");
      if (!this.D) return;
      const D = this.D, F = D.fluors;
      this.rows = this.ORDER.map((m) => F.findIndex((f) => f.marker === m));
      this.reset();
    },
    reset() { this.y = 40; this.sw = 0; this.ra = 0; this.da = 0; this.n = 0; },
    enter() { if (!this.D) return; this.reset(); this.active = true; this.last = performance.now(); const loop = (t) => { if (!this.active) return; this.tick(Math.max(0, Math.min(0.05, (t - this.last) / 1000))); this.last = t; requestAnimationFrame(loop); }; requestAnimationFrame(loop); },
    leave() { this.active = false; },
    step(n) {
      this.n = n; if (this.vs) this.vs.classList.toggle("gone", n >= 4);
      if (STATE.printing || !this.active) { this.y = 250; this.sw = 1; this.ra = +(n >= 1); this.da = +(n >= 2); }
      if (this.D) this.draw();
    },
    tick(dt) {
      const P = 250; this.y = Math.min(P, this.y + 260 * dt);
      if (this.y >= P) this.sw = Math.min(1, this.sw + dt / 3.2);
      const toward = (v, on, k) => (on ? Math.min(1, v + dt * k) : Math.max(0, v - dt * k));
      this.ra = toward(this.ra, this.n >= 1, 1.6); this.da = toward(this.da, this.n >= 2, 0.8);
      this.draw();
    },
    draw() { this.drawSpectrum(); this.drawAmounts(); },
    drawSpectrum() {
      const x = ctxOf(this.cv), [W, H] = cssSize(this.cv), D = this.D, F = D.fluors, ex = D.example, ch = D.channels, nC = ch.length;
      const PX = 104, PY = 250, grp = (c) => c.replace(/\d+$/, ""), GN = { UV: "UV", V: "violet", B: "blue", YG: "yellow-green", R: "red" };
      x.clearRect(0, 0, W, H);
      // stream, laser and the cell
      x.font = "600 18px 'Source Sans 3'"; x.fillStyle = "#64748b"; x.textAlign = "center"; x.fillText("one cell at a time", PX, 24);
      x.fillStyle = "#e0f2fe"; x.strokeStyle = "#7dd3fc"; x.lineWidth = 1.5;
      x.beginPath(); x.moveTo(PX - 56, 36); x.lineTo(PX + 56, 36); x.lineTo(PX + 10, 84); x.lineTo(PX - 10, 84); x.closePath(); x.fill(); x.stroke(); x.fillRect(PX - 10, 84, 20, H - 84);
      x.strokeStyle = "#0284c7"; x.lineWidth = 7; x.lineCap = "round"; x.beginPath(); x.moveTo(14, PY); x.lineTo(PX, PY); x.stroke();
      x.fillStyle = "#0369a1"; x.textAlign = "left"; x.font = "700 20px 'Source Sans 3'"; x.fillText("laser", 14, PY - 16);
      const X0 = 250, X1 = W - 22, gG = 9, bw = (X1 - X0 - gG * 4) / nC, xs = [];
      for (let k = 0, cx = X0; k < nC; k++) { if (k && grp(ch[k]) !== grp(ch[k - 1])) cx += gG; xs.push(cx); cx += bw; }
      const top = 64, base = 262, sw = this.sw, d = this.da, ra = this.ra;
      const y = ex.y, cf = ex.coef, S = D.sig, nS = S.length;
      const parts = y.map((_, k) => S.map((s, r) => Math.max(0, cf[r] * s[k])));
      const mx = Math.max(...y, ...parts.map((p) => p.reduce((u, v) => u + v, 0))) || 1, hY = (v) => (v / mx) * (base - top);
      const colOf = (r) => (r < F.length ? F[r].color : "#a8b4c4");
      // light from the cell into the detector array
      if (this.y >= PY) {
        const g = x.createLinearGradient(PX, 0, X0, 0); g.addColorStop(0, "rgba(56,189,248,.5)"); g.addColorStop(1, "rgba(56,189,248,.05)");
        x.globalAlpha = Math.min(1, sw * 6); x.fillStyle = g; x.beginPath(); x.moveTo(PX + 18, PY - 6); x.lineTo(X0 - 8, top); x.lineTo(X0 - 8, base); x.lineTo(PX + 18, PY + 6); x.closePath(); x.fill(); x.globalAlpha = 1;
      }
      x.fillStyle = "#fae8ff"; x.strokeStyle = "#86198f"; x.lineWidth = 3.5; x.beginPath(); x.arc(PX, this.y, 16, 0, 7); x.fill(); x.stroke();
      if (this.y >= PY) { x.fillStyle = "rgba(14,165,233,.22)"; x.beginPath(); x.arc(PX, PY, 30, 0, 7); x.fill(); }
      x.fillStyle = "#86198f"; x.font = "700 17px 'Source Sans 3'"; x.textAlign = "center"; x.fillText("tumor T cell", PX, PY + 52); x.textAlign = "left";
      // title of the panel
      x.fillStyle = "#334155"; x.font = "700 21px 'Source Sans 3'";
      x.fillText(d > 0.5 ? "The same light, split into its colors" : "The light of this cell, read by 64 detectors", X0, 34);
      // bars: grey while measured; stacked by marker function after unmixing
      for (let k = 0; k < nC; k++) {
        const show = clamp01(sw * nC * 1.15 - k * 0.9); if (show <= 0) continue;
        const h = Math.max(1.5, hY(y[k]));
        x.globalAlpha = show * (1 - d); x.fillStyle = "#475569"; x.fillRect(xs[k] + 0.5, base - h, bw - 1, h);
        if (d > 0) {
          let yy = base; x.globalAlpha = d;
          const ord = [nS - 1, ...this.rows]; // autofluorescence at the bottom, then the panel order
          for (const r of ord) { const h2 = hY(parts[k][r]); if (h2 < 0.3) continue; x.fillStyle = colOf(r); x.fillRect(xs[k] + 0.5, yy - h2, bw - 1, h2); yy -= h2; }
        }
      }
      if (d > 0) {
        x.globalAlpha = d; x.strokeStyle = "#0f172a"; x.lineWidth = 2; x.beginPath();
        for (let k = 0; k < nC; k++) { const yy = base - hY(y[k]); x.moveTo(xs[k] - 0.5, yy); x.lineTo(xs[k] + bw + 0.5, yy); } x.stroke();
        const t = `measured · the mix explains ${(ex.r2 * 100).toFixed(2)}%`; x.font = "600 15px 'Source Sans 3'"; x.textAlign = "right"; x.fillStyle = "#0f172a"; x.fillText(t, X1, 34);
        x.fillRect(X1 - x.measureText(t).width - 26, 28, 18, 2.5); x.textAlign = "left";
      }
      x.globalAlpha = 1; x.fillStyle = "#cbd5e1"; x.fillRect(X0, base, X1 - X0, 1.5);
      x.font = "600 15px 'Source Sans 3'"; x.textAlign = "center"; x.fillStyle = "#94a3b8";
      for (const g of ["UV", "V", "B", "YG", "R"]) { const ks = ch.map((c, k) => (grp(c) === g ? k : -1)).filter((k) => k >= 0); x.fillText(GN[g], (xs[ks[0]] + xs[ks[ks.length - 1]] + bw) / 2, base + 20); }
      x.textAlign = "left";
      // step 1: the 18 reference fingerprints, two rows; after unmixing the markers this cell carries stay bright
      if (ra > 0) {
        const fy = 316, cols = 9, cg = 8, cw = (X1 - X0 - cg * (cols - 1)) / cols, chh = 84;
        x.globalAlpha = ra; x.fillStyle = "#64748b"; x.font = "600 16px 'Source Sans 3'"; x.fillText("reference fingerprints: each antibody measured alone (single-stain controls)", X0, fy - 10);
        this.rows.forEach((r, k) => {
          const ox = X0 + (k % cols) * (cw + cg), oy = fy + Math.floor(k / cols) * (chh + 8), f = F[r], on = ex.pos[r];
          x.globalAlpha = ra * (d > 0 && !on ? 1 - 0.7 * d : 1);
          x.fillStyle = "#f8fafc"; x.strokeStyle = d > 0 && on ? f.color : "#e2e8f0"; x.lineWidth = d > 0 && on ? 2.5 : 1.2; x.fillRect(ox, oy, cw, chh); x.strokeRect(ox, oy, cw, chh);
          x.fillStyle = f.color; x.font = "700 15px 'Source Sans 3'"; x.fillText(f.marker, ox + 7, oy + 19);
          const c0 = ox + 6, cwid = cw - 12, cT = oy + 28, cB = oy + chh - 8;
          x.strokeStyle = f.color; x.lineWidth = 1.8; x.beginPath();
          S[r].forEach((v, k2) => { const px = c0 + (k2 + 0.5) / nC * cwid, py = cB - v * (cB - cT); k2 ? x.lineTo(px, py) : x.moveTo(px, py); }); x.stroke();
        });
        x.globalAlpha = 1;
      }
    },
    drawAmounts() {
      const x = ctxOf(this.am), [W, H] = cssSize(this.am), D = this.D, F = D.fluors, ex = D.example, d = this.da;
      x.clearRect(0, 0, W, H);
      x.fillStyle = "#334155"; x.font = "700 22px 'Source Sans 3'"; x.textAlign = "left";
      x.fillText(d > 0.5 ? "This cell: one value per marker" : "The panel: 17 markers + viability", 6, 28);
      x.fillStyle = "#64748b"; x.font = "600 15px 'Source Sans 3'";
      x.fillText(d > 0.5 ? "amount relative to an unstained cell (×)" : "kidney-cancer study, 18 colors", 6, 50);
      const top = 72, rh = 28 + Math.max(0, H - 670) / this.rows.length, B0 = 236, B1 = W - 18, lo = -1, hi = 3, X = (r) => B0 + (Math.log10(Math.max(10 ** lo, r)) - lo) / (hi - lo) * (B1 - B0);
      let prevG = null;
      this.rows.forEach((r, k) => {
        const f = F[r], yy = top + k * rh, on = ex.pos[r];
        if (f.group !== prevG && k) { x.globalAlpha = 1; x.fillStyle = "#eef2f7"; x.fillRect(6, yy - 3, W - 12, 1); } prevG = f.group;
        const rowA = d > 0 && !on ? 1 - 0.75 * d : 1; x.globalAlpha = rowA; // markers this cell does not carry fade out once unmixed
        x.fillStyle = f.color; x.beginPath(); x.arc(14, yy + 12, 5.5, 0, 7); x.fill();
        x.fillStyle = d > 0.5 && on ? "#0f172a" : "#334155"; x.font = `${d > 0.5 && on ? 800 : 600} 19px 'Source Sans 3'`; x.fillText(f.marker + (d > 0.5 && on ? "⁺" : ""), 28, yy + 18);
        x.fillStyle = "#94a3b8"; x.font = "14px 'Source Sans 3'"; x.fillText(f.name, 120, yy + 17);
        if (d > 0) {
          const v = ex.ratio[r], w = (X(v) - B0) * ease(d);
          x.globalAlpha = rowA; x.fillStyle = "#f1f5f9"; x.fillRect(B0, yy + 5, B1 - B0, 15);
          x.fillStyle = on ? f.color : "#cbd5e1"; x.fillRect(B0, yy + 5, Math.max(2, w), 15);
        }
      });
      x.globalAlpha = 1;
      const yb = top + this.rows.length * rh;
      if (d > 0) {
        x.globalAlpha = d; x.strokeStyle = "#0f172a"; x.setLineDash([4, 4]); x.lineWidth = 1.5; const t1 = X(1); x.beginPath(); x.moveTo(t1, top); x.lineTo(t1, yb); x.stroke(); x.setLineDash([]);
        x.fillStyle = "#64748b"; x.font = "14px 'Source Sans 3'"; x.textAlign = "center";
        for (const e of [-1, 0, 1, 2, 3]) x.fillText(e === -1 ? "0.1" : nf(10 ** e), X(10 ** e), yb + 16);
        x.fillText("unstained", t1, top - 6); x.textAlign = "left";
        // the phenotype read from the values (markers clearly above the unstained cell: ≥ 3×)
        const by = yb + 34; x.fillStyle = "#fdf4ff"; x.strokeStyle = "#e9d5ff"; x.lineWidth = 1.5; x.fillRect(6, by, W - 12, 62); x.strokeRect(6, by, W - 12, 62);
        x.fillStyle = "#0f172a"; x.font = "700 18px 'Source Sans 3'"; x.fillText("CD3⁺ CD8⁺ · CD69⁺ CD103⁻ · PD-1⁺ TIM-3⁺ CD39⁺", 18, by + 25);
        x.fillStyle = "#86198f"; x.font = "800 19px 'Source Sans 3'"; x.fillText("→ phenotype: resident, exhausted CD8 T cell", 18, by + 50);
        x.globalAlpha = 1;
      }
    },
  };

  // ---------- 6 · FlowCV at a glance: the real recording, one chapter per click ----------
  // data-chapters="start,end;…" (seconds). Stepping forward plays the next chapter and stops at its end; any other
  // jump (back, or arriving from a later slide) shows the last frame of that chapter. The video bar still works.
  const chapterVideo = () => ({
    init(el) {
      this.box = el.querySelector(".vid[data-chapters]"); this.v = this.box && this.box.querySelector("video");
      this.ch = this.box ? this.box.dataset.chapters.split(";").map((c) => c.split(",").map(Number)) : [];
      this.items = [...el.querySelectorAll(".chap")]; this.n = -1; this.stopAt = null;
    },
    enter() {
      this.n = -1; this.active = true;
      const loop = () => { if (!this.active) return; const v = this.v; if (v && this.stopAt != null && !v.paused && v.currentTime >= this.stopAt) { v.pause(); v.currentTime = this.stopAt; this.stopAt = null; } requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    },
    leave() { this.active = false; this.stopAt = null; },
    when(f) { const v = this.v; if (v.readyState >= 1) f(); else v.addEventListener("loadedmetadata", f, { once: true }); },
    step(n) {
      const v = this.v; if (!v) return;
      this.items.forEach((e, k) => { e.classList.toggle("on", k === n - 1); e.classList.toggle("done", k < n - 1); });
      this.box.querySelectorAll(".vid-fix[data-only]").forEach((e) => e.classList.toggle("off", +e.dataset.only !== n)); // caption fixes that belong to one chapter
      const forward = n >= 1 && n <= this.ch.length && n === this.n + 1 && this.active && !STATE.printing; this.n = n;
      this.box.classList.add("playing");
      if (n === 0) { v.pause(); this.stopAt = null; this.when(() => { v.currentTime = +(this.box.dataset.start || 0); }); return; }
      const [a, b] = this.ch[Math.min(n, this.ch.length) - 1];
      if (forward) { this.stopAt = b; this.when(() => { v.currentTime = a; v.play().catch(() => {}); }); }
      else { v.pause(); this.stopAt = null; this.when(() => { v.currentTime = b; }); }
    },
  });
  // slides 6-8: real recordings of FlowCV, one chapter per click (data-chapters="start,end;..." in seconds). Stepping
  // forward plays the next chapter and stops at its end; any other jump shows that chapter's last frame. Steps past the
  // last chapter (slide 8's deck-computed card) keep the last frame.
  for (const id of ["s-flowcv", "s-prep-app", "s-gate-app"]) FIGS[id] = chapterVideo();

  // The spectral talk introduces the journey before the real Studio recordings.
  // Other deck variants retain their existing chapter-video introduction.
  if (document.querySelector("#s-flowcv[data-workflow-story]")) {
    FIGS["s-flowcv"] = {
      init(el) {
        this.nodes = [...el.querySelectorAll("[data-story-stage]")];
        this.label = el.querySelector("#story-step-label");
        this.caption = el.querySelector("#story-explain");
      },
      step(n) {
        const stages = [
          ["The input", "Start with the same public lymphocyte panel introduced earlier."],
          ["Preparation", "Keep the marker identities, signal scale and controls with the analysis."],
          ["Populations", "Define known populations, then explore the full marker panel and review the names."],
          ["The figure", "Reuse those saved results. Every panel keeps its source."],
        ];
        const k = Math.min(n, stages.length - 1);
        this.nodes.forEach((node) => node.classList.toggle("is-current", +node.dataset.storyStage === k));
        [this.label.textContent, this.caption.textContent] = stages[k];
      },
    };
  }

  // ---------- 3 · problem 1: a gating strategy finds what it was built to find ----------
  const MS = [{ y: "1970s", n: 2 }, { y: "2004", n: 17 }, { y: "2011", n: 34 }, { y: "2020", n: 40 }, { y: "2024", n: 50 }];
  // Kidney thesis dataset (rcc-dims.js): 6,000 T cells, 7 of the 17 markers -> 21 plots.
  // Strategy: ① CD4 × CD8 -> CD8 T, ② CCR7 × CD45RO -> naive / memory. Hidden: exhausted CD8 (PD-1⁺ TIM-3⁺), in a plot it never opens.
  const DM = window.DECK_DIMS && (() => {
    const D = window.DECK_DIMS, raw = atob(D.v), fr = atob(D.f), n = D.n, k = D.markers.length;
    const v = new Uint8Array(n * k), f = new Uint8Array(n);
    for (let i = 0; i < n * k; i++) v[i] = raw.charCodeAt(i);
    for (let i = 0; i < n; i++) f[i] = fr.charCodeAt(i);
    // slide 5: CD4 and CD8 of the same cells on an unclipped range (rcc-dims.js "wide"), so no cell piles up on the frame
    const W = D.wide && (() => { const r = atob(D.wide.v), a = new Uint8Array(r.length); for (let i = 0; i < r.length; i++) a[i] = r.charCodeAt(i); return Object.assign({}, D.wide, { V: a, k: 2, tag: "wide" }); })();
    return Object.assign({}, D, { V: v, F: f, k, W });
  })();
  const DCOL = ["#0e7490", "#be185d", "#a16207", "#15803d", "#c2410c", "#7c3aed", "#475569"];
  FIGS["s-dims"] = {
    STRAT: [[0, 1, "1"], [2, 3, "2"]], // CD4 × CD8, then CCR7 × CD45RO (q, r in marker order)
    HID: [4, 5], // PD-1 × TIM-3, a plot the strategy never opens
    SUB: [{ name: "naive", ccr7: true, ro: false, color: "#0284c7" }, { name: "Tcm", ccr7: true, ro: true, color: "#d97706" },
          { name: "Tem", ccr7: false, ro: true, color: "#db2777" }, { name: "Temra", ccr7: false, ro: false, color: "#0d9488" }],
    init(el) {
      this.c = el.querySelector("#dims-mat");
      const C = DM.counts, set = (id, t) => { const e = el.querySelector(id); if (e) e.textContent = t; };
      set("#dims-n-ex", nf(C.exh)); set("#dims-p-ex", pct(C.exh / C.cd8, 0)); set("#dims-ex-tem", nf(C.exh_tem)); set("#dims-p-tem", pct(C.exh_tem / C.exh, 0));
      el.querySelector("#dims-bars").innerHTML = MS.map((m) => { const p = m.n * (m.n - 1) / 2; return `<div class="pb${m.me ? " me" : ""}"><span>${m.y}</span><span>${m.n === 2 ? "1–2" : m.n}</span><span class="pt"><i style="--w:${Math.max(0.8, p / 1225 * 100).toFixed(1)}%"></i></span><b>${nf(p)}</b></div>`; }).join("");
      this.cache = new Map(); this.st = { s: 0, gd: 0 }; this.tg = { s: 0, gd: 0 }; this.draw();
    },
    enter() {
      this.active = true; let last = performance.now();
      const loop = (t) => {
        if (!this.active) return; const dt = Math.min(0.05, (t - last) / 1000); last = t;
        for (const k of ["s", "gd"]) this.st[k] = this.tg[k] > this.st[k] ? Math.min(this.tg[k], this.st[k] + dt * 2) : Math.max(this.tg[k], this.st[k] - dt * 2);
        this.draw(); requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    },
    leave() { this.active = false; },
    step(n) { this.tg = { s: n >= 1 ? 1 : 0, gd: n >= 2 ? 1 : 0 }; if (STATE.printing || !this.active) this.st = { ...this.tg }; this.draw(); },
    lay(W, H) { const n = DM.k - 1, gap = 5, s = Math.min((W - 96) / n, (H - 52) / n) - gap; return { n, gap, s, L0: 88 + (W - 96 - n * (s + gap)) / 2, T0: 20 }; },
    at(L, q, r) { return [L.L0 + q * (L.s + L.gap), L.T0 + (r - 1) * (L.s + L.gap)]; },
    // grey density (darker = more cells), then each layer in its colour. only: draw just the cells with that bit (a gated view).
    // layer bits: 1 CD4 T, 2 CD8 T, 4 exhausted CD8
    panel(q, r, s, layers, only = 0, src = null) { // src: another value matrix of the same cells (slide 5: DM.W)
      const key = `${q},${r},${Math.round(s)},${only},${src ? src.tag : ""},${layers.map((l) => l.key || l.bit).join("+")}`;
      if (this.cache.has(key)) return this.cache.get(key);
      const c = document.createElement("canvas"); c.width = c.height = Math.ceil(s * 2); const x = c.getContext("2d"); x.scale(2, 2);
      const k = src ? src.k : DM.k, V = src ? src.V : DM.V, F = DM.F, n = DM.n, B = 40, u = (i, j) => V[i * k + j] / 255;
      const keep = (i) => !only || F[i] & only, bin = (v) => Math.min(B - 1, Math.floor(v * B));
      const h = new Float32Array(B * B); let mx = 0;
      for (let i = 0; i < n; i++) if (keep(i)) h[bin(u(i, r)) * B + bin(u(i, q))]++;
      for (let i = 0; i < B * B; i++) mx = Math.max(mx, h[i]);
      const px = (i) => 2 + u(i, q) * (s - 4), py = (i) => s - 2 - u(i, r) * (s - 4), ds = Math.max(1.1, s / 190); // dot size grows with the panel
      x.fillStyle = "#fff"; x.fillRect(0, 0, s, s);
      for (let i = 0; i < n; i++) {
        if (!keep(i)) continue;
        const d = Math.log1p(h[bin(u(i, r)) * B + bin(u(i, q))]) / Math.log1p(mx), g = Math.round(203 - 150 * d);
        x.fillStyle = `rgb(${g},${g + 6},${g + 16})`; x.fillRect(px(i) - ds / 2, py(i) - ds / 2, ds, ds);
      }
      for (const l of layers) { x.fillStyle = l.color; for (let i = 0; i < n; i++) if (keep(i) && (l.test ? l.test(i) : F[i] & l.bit)) x.fillRect(px(i) - ds * 0.65, py(i) - ds * 0.65, ds * 1.3, ds * 1.3); }
      this.cache.set(key, c); return c;
    },
    // threshold lines (Otsu) of a plot, in panel coordinates
    cross(x, L, q, r) {
      const [ox, oy] = this.at(L, q, r), s = L.s, tx = ox + 2 + DM.thr[q] * (s - 4), ty = oy + s - 2 - DM.thr[r] * (s - 4);
      x.beginPath(); x.moveTo(tx, oy); x.lineTo(tx, oy + s); x.moveTo(ox, ty); x.lineTo(ox + s, ty); x.stroke(); return [tx, ty];
    },
    draw() {
      const x = ctxOf(this.c), [W, H] = cssSize(this.c), L = this.lay(W, H), s = L.s, { s: S, gd: G } = this.st;
      x.clearRect(0, 0, W, H);
      const L4 = { bit: 1, color: BLUE }, L8 = { bit: 2, color: PINK }, LX = { bit: 4, color: PURPLE };
      // ② coloured by the four subsets its own gates define (same Otsu thresholds as the dashed lines): CCR7 = marker 2, CD45RO = 3.
      // 11 Nov 2026: one colour per quadrant instead of all-pink; in step 2 they fade to grey so the exhausted cells (purple) stand out.
      const u = (i, j) => DM.V[i * DM.k + j] / 255, hi = (i, j) => u(i, j) > DM.thr[j], cd8 = (i) => DM.F[i] & 2;
      const SUB = this.SUB, LS = SUB.map((t) => ({ key: "s" + t.name, color: t.color, test: (i) => cd8(i) && hi(i, 2) === t.ccr7 && hi(i, 3) === t.ro }));
      const LG = { key: "g8", color: "#d6d9e0", test: cd8 };
      const isStrat = (q, r) => this.STRAT.some(([a, b]) => a === q && b === r), isHid = (q, r) => q === this.HID[0] && r === this.HID[1];
      for (let r = 1; r <= L.n; r++) for (let q = 0; q < r; q++) {
        const [ox, oy] = this.at(L, q, r);
        // colour only where the story is: ① all cells (CD4 / CD8), ② and the hidden plot show the gated CD8 T cells
        const a = isStrat(q, r) ? 1 : isHid(q, r) ? 1 - 0.7 * S + 0.7 * G : 1 - 0.7 * S;
        const only = (q === 2 && r === 3) || isHid(q, r) ? 2 : 0;
        const gated = only && ((isStrat(q, r) && S > 0) || (isHid(q, r) && G > 0)); // once shown, ② and the hidden plot are gated views
        x.globalAlpha = a; x.drawImage(this.panel(q, r, s, [], gated ? only : 0), ox, oy, s, s);
        if (isStrat(q, r) && S > 0) { x.globalAlpha = S; x.drawImage(this.panel(q, r, s, only ? LS : [L4, L8], only), ox, oy, s, s); }
        if ((isStrat(q, r) || isHid(q, r)) && G > 0) { x.globalAlpha = G; x.drawImage(this.panel(q, r, s, only ? (isStrat(q, r) ? [LG, LX] : [L8, LX]) : [L4, L8], only), ox, oy, s, s); }
        x.globalAlpha = a; x.strokeStyle = "#cbd5e1"; x.lineWidth = 1; x.strokeRect(ox, oy, s, s);
      }
      // marker labels
      x.globalAlpha = 1; x.font = "700 17px 'Source Sans 3'";
      for (let r = 1; r <= L.n; r++) { const [ox, oy] = this.at(L, 0, r); x.fillStyle = DCOL[r]; x.textAlign = "right"; x.fillText(DM.markers[r], ox - 8, oy + s / 2 + 6); }
      for (let q = 0; q < L.n; q++) { const [ox, oy] = this.at(L, q, L.n); x.fillStyle = DCOL[q]; x.textAlign = "center"; x.fillText(DM.markers[q], ox + s / 2, oy + s + 22); }
      if (S > 0) { // the strategy: its two plots, its gates and the order they are used in
        x.globalAlpha = S;
        for (const [q, r, no] of this.STRAT) {
          const [ox, oy] = this.at(L, q, r); x.strokeStyle = "#1d4ed8"; x.lineWidth = 3.5; x.strokeRect(ox - 1, oy - 1, s + 2, s + 2);
          x.strokeStyle = "#0f172a"; x.lineWidth = 1.6; x.setLineDash([5, 4]); const [tx, ty] = this.cross(x, L, q, r); x.setLineDash([]);
          if (q === 0) { x.lineWidth = 2.2; x.strokeRect(ox + 3, oy + 3, tx - ox - 6, ty - oy - 6); } // CD8 T: CD8⁺ CD4⁻
          else { // subset names in their own colours, with a white halo; they grey out with the subsets in step 2
            x.font = "800 14px 'Source Sans 3'"; x.lineJoin = "round";
            const lab = (t, X, Y, al) => { x.textAlign = al; x.lineWidth = 4; x.strokeStyle = "rgba(255,255,255,.95)"; x.strokeText(t.name, X, Y); x.fillStyle = G > 0.5 ? "#94a3b8" : t.color; x.fillText(t.name, X, Y); };
            const T = Object.fromEntries(this.SUB.map((t) => [t.name, t]));
            lab(T.Tem, ox + 6, oy + 18, "left"); lab(T.Tcm, ox + s - 6, oy + 18, "right"); lab(T.naive, ox + s - 6, oy + s - 8, "right"); lab(T.Temra, ox + 6, oy + s - 8, "left"); x.strokeStyle = "#0f172a"; }
          x.fillStyle = "#1d4ed8"; x.beginPath(); x.arc(ox, oy, 15, 0, 7); x.fill(); x.fillStyle = "#fff"; x.font = "800 18px 'Source Sans 3'"; x.textAlign = "center"; x.fillText(no, ox, oy + 6);
        }
        x.textAlign = "left"; x.globalAlpha = 1;
      }
      if (G > 0) { // exhausted CD8 T cells, in a plot the strategy never opens
        const [ox, oy] = this.at(L, ...this.HID); x.globalAlpha = G;
        x.strokeStyle = "#7c3aed"; x.lineWidth = 3.5; x.strokeRect(ox - 1, oy - 1, s + 2, s + 2);
        x.strokeStyle = "#6d28d9"; x.lineWidth = 1.6; x.setLineDash([5, 4]); this.cross(x, L, ...this.HID); x.setLineDash([]);
        const tx = ox + 8, ty = oy - 74, txt = `exhausted CD8 · ${nf(DM.counts.exh)}`, OUT = "within effector memory"; // in the empty cell above the plot
        x.font = "600 16px 'Source Sans 3'"; const sw = x.measureText(OUT).width; x.font = "800 22px 'Source Sans 3'"; const tw = Math.max(x.measureText(txt).width, sw);
        x.fillStyle = "rgba(255,255,255,.95)"; x.fillRect(tx - 8, ty - 4, tw + 16, 58); x.strokeStyle = "#7c3aed"; x.lineWidth = 2; x.strokeRect(tx - 8, ty - 4, tw + 16, 58);
        x.fillStyle = "#6d28d9"; x.textAlign = "left"; x.fillText(txt, tx, ty + 20); x.font = "600 16px 'Source Sans 3'"; x.fillText(OUT, tx, ty + 44);
        x.globalAlpha = 1;
      }
    },
  };

  // ---------- 4 · problem 2: the file is kept, the analysis is not ----------
  const EV = [10000, 50000, 100000, 300000, 500000, 1000000, 5000000];
  FIGS["s-gold"] = {
    init(el) {
      const g = (id) => el.querySelector("#" + id);
      const upd = () => {
        const y = +g("e-years").value, e = +g("e-exp").value, s = +g("e-smp").value, ev = EV[+g("e-ev").value];
        g("o-years").textContent = y; g("o-exp").textContent = e; g("o-smp").textContent = s; g("o-ev").textContent = ev >= 1e6 ? nf(ev / 1e6) + " M" : nf(ev / 1000) + tr(" mil", "k");
        const files = y * 48 * e * s, cells = files * ev; STATE.files = files;
        g("o-files").textContent = nf(files);
        g("o-cells").textContent = cells >= 1e12 ? nf(cells / 1e12, 1) + tr(" billones", " trillion") : cells >= 1e9 ? nf(cells / 1e9, 1) + tr(" mil millones", " billion") : nf(cells / 1e6, 0) + tr(" millones", " million");
        const c = document.getElementById("close-files"); if (c) c.textContent = nf(files);
      };
      el.querySelectorAll("input[type=range]").forEach((r) => r.addEventListener("input", upd)); upd();
      this.upd = upd; this.years = el.querySelector("#e-years"); this.target = +this.years.value;
      this.c = g("gold-plots"); this.cap = g("gold-cap"); this.a = 0; this.t = 0; this.step(0);
    },
    enter() {
      // count the years up so the total grows in front of the audience
      const t0 = performance.now(), to = this.target, tick = (t) => {
        const f = Math.min(1, (t - t0) / 1800); this.years.value = Math.max(1, Math.round(1 + (to - 1) * (1 - Math.pow(1 - f, 2)))); this.upd();
        if (f < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      this.active = true; let last = performance.now();
      const loop = (t) => { if (!this.active) return; const dt = Math.min(0.05, (t - last) / 1000); last = t; const a = this.a; this.a = this.t > a ? Math.min(1, a + dt * (window.DECK_DIMS ? 0.45 : 1.6)) : Math.max(0, a - dt * 3); if (a !== this.a) this.draw(); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    },
    leave() { this.active = false; },
    step(n) {
      this.t = n >= 1 ? 1 : 0; if (STATE.printing || !this.active) this.a = this.t;
      const KG = window.DECK_DIMS;
      if (KG) this.cap.innerHTML = n >= 1
        ? "Interpretation also requires <b>the analytical context</b>: transformations, gates and annotations."
        : "The kidney study <b>as stored</b>: the 6,000 T cells of the previous slide. Only numbers.";
      else this.cap.innerHTML = n >= 1
        ? tr("Entre uno y otro hay <b>decisiones que el archivo no guarda</b>: quedan en otro programa o en la cabeza de quien analizó.", "Between the two lie <b>decisions the file does not keep</b>: they stay in another program, or in the analyst's head.")
        : tr("Las mismas 6.000 células de la lámina 2, <b>tal como quedan en el archivo</b>: dos canales del citómetro, señal cruda, escala lineal.", "The same 6,000 cells from slide 2, <b>as stored in the file</b>: two cytometer channels, raw signal, linear scale.");
      this.draw();
    },
    draw() {
      if (window.DECK_DIMS) return this.drawKidney();
      const x = ctxOf(this.c), [W, H] = cssSize(this.c), PW = 420, MX = 430, RX = W - PW, a = ease(this.a);
      x.clearRect(0, 0, W, H);
      const head = (t, cx, col) => { x.font = "700 22px 'Source Sans 3'"; x.fillStyle = col; x.textAlign = "center"; x.fillText(t, cx, 24); };
      // left: the stored file, raw values on a linear axis
      const pad = { l: 78, r: 14, t: 44, b: 58 }, xr = [-6000, 262144], yr = [-6000, 262144];
      head(tr("En el disco: el archivo FCS", "On disk: the FCS file"), PW / 2 + 30, "#334155");
      const sx = (v) => pad.l + (v - xr[0]) / (xr[1] - xr[0]) * (PW - pad.l - pad.r), sy = (v) => H - pad.b - (v - yr[0]) / (yr[1] - yr[0]) * (H - pad.t - pad.b);
      x.fillStyle = "#334155"; x.globalAlpha = 0.4; for (let i = 0; i < N; i++) x.fillRect(sx(L.rawCD4[i]) - 1.2, sy(L.rawCD8[i]) - 1.2, 2.4, 2.4);
      x.globalAlpha = 1; axes(x, PW, H, pad, xr, yr, "PE-Texas Red-A (CD4)", "Pacific Blue-A (CD8)", true);
      // middle: what the file does not keep
      x.globalAlpha = a; const mc = (MX + RX) / 2 + 4;
      x.font = "700 18px 'Source Sans 3'"; x.fillStyle = "#b91c1c"; x.textAlign = "center"; x.fillText(tr("no está en el archivo", "not in the file"), mc, 92);
      let cy = 112;
      for (const t of EN ? [["scale"], ["compensation", "used"], ["gates"], ["population", "names"]] : [["escala"], ["compensación", "usada"], ["gates"], ["nombres de", "poblaciones"]]) {
        const h = 18 + 24 * t.length; x.fillStyle = "#fef2f2"; x.strokeStyle = "#fca5a5"; x.lineWidth = 1.5; x.beginPath(); x.roundRect(mc - 86, cy, 172, h, 10); x.fill(); x.stroke();
        x.font = "600 19px 'Source Sans 3'"; x.fillStyle = "#7f1d1d"; t.forEach((ln, k) => x.fillText(ln, mc, cy + 30 + 24 * k)); cy += h + 14;
      }
      x.strokeStyle = "#b91c1c"; x.lineWidth = 3; x.beginPath(); x.moveTo(mc - 70, 430); x.lineTo(mc + 62, 430); x.stroke();
      x.fillStyle = "#b91c1c"; x.beginPath(); x.moveTo(mc + 76, 430); x.lineTo(mc + 58, 420); x.lineTo(mc + 58, 440); x.closePath(); x.fill();
      // right: what the analysis saw (compensated, logicle, gated, named)
      x.save(); x.translate(RX, 0);
      head(tr("Lo que vio el análisis", "What the analysis saw"), PW / 2 + 30, "#1d4ed8");
      const p2 = { l: 62, r: 14, t: 44, b: 58 }, r2 = [HLO, HHI];
      const tx = (v) => p2.l + (v - r2[0]) / (r2[1] - r2[0]) * (PW - p2.l - p2.r), ty = (v) => H - p2.b - (v - r2[0]) / (r2[1] - r2[0]) * (H - p2.t - p2.b);
      for (let i = 0; i < N; i++) { const c4 = GSET.cd4[i], c8 = GSET.cd8[i]; x.fillStyle = c4 ? "#1d4ed8" : c8 ? "#be185d" : "#64748b"; x.globalAlpha = a * (c4 || c8 ? 0.5 : 0.28); x.fillRect(tx(val(i, "CD4")) - 1.1, ty(val(i, "CD8")) - 1.1, 2.2, 2.2); }
      x.globalAlpha = a; axes(x, PW, H, p2, r2, r2, "CD4", "CD8", "lgc");
      for (const [G, col, t, n] of [[GATE_CD4, "#1d4ed8", tn("T CD4+"), GSET.n4], [GATE_CD8, "#be185d", tn("T CD8+"), GSET.n8]]) {
        const gx = tx(Math.max(G[0], r2[0])), gy = ty(Math.min(G[3], r2[1])), gw = tx(Math.min(G[2], r2[1])) - gx, gh = ty(Math.max(G[1], r2[0])) - gy;
        x.strokeStyle = col; x.lineWidth = 2.5; x.strokeRect(gx, gy, gw, gh);
        x.fillStyle = col; x.font = "700 19px 'Source Sans 3'"; x.textAlign = G === GATE_CD4 ? "right" : "left";
        x.fillText(`${t} · ${pct(n / N)}`, G === GATE_CD4 ? gx + gw - 6 : gx + 8, G === GATE_CD4 ? gy - 8 : gy + 24);
      }
      x.restore(); x.globalAlpha = 1; x.textAlign = "left";
    },
  };

  // slide 5 with the kidney thesis: the processed files as stored (numbers per cell) vs what the analysis saw.
  // Same 6,000 T cells as slide 4 (rcc-dims.js), PD-1 × TIM-3. The decisions the file does not keep appear one by one.
  FIGS["s-gold"].drawKidney = function () {
    const D = FIGS["s-dims"], x = ctxOf(this.c), [W, H] = cssSize(this.c), a = this.a, S = Math.min(450, H - 150, (W - 290) / 2), Q = 0, R = 1, WD = DM.W; // CD4 x CD8 on the unclipped range // CD4 × CD8: the simplest split everyone knows
    D.cache = D.cache || new Map(); x.clearRect(0, 0, W, H);
    const LX0 = 70, RX0 = W - S - 24, Y0 = 66, mc = (LX0 + S + RX0) / 2 - 22, part = (k, n) => ease(Math.max(0, Math.min(1, a * n - k))); // k-th of n beats
    const head = (t, cx, col) => { x.font = "700 24px 'Source Sans 3'"; x.fillStyle = col; x.textAlign = "center"; x.fillText(t, cx, 34); };
    // axis values in decades, same display convention as slides 10 and 12: arcsinh(x / 150) (assumed cofactor; display only)
    const DEC = [[0, "0"], [100, "10²"], [1000, "10³"], [10000, "10⁴"], [100000, "10⁵"]], KD = WD;
    const ticks = (m) => { const j = KD && KD.lo ? KD.markers.indexOf(m) : -1; if (j < 0) return [];
      return DEC.map(([v, t]) => [(Math.asinh(v / 150) - KD.lo[j]) / (KD.hi[j] - KD.lo[j]), t]).filter(([u]) => u >= 0.02 && u <= 0.98); };
    const frame = (x0, xl, yl, yTitle = true) => {
      x.strokeStyle = "#94a3b8"; x.lineWidth = 1.4; x.strokeRect(x0, Y0, S, S);
      x.fillStyle = "#64748b"; x.font = "500 19px 'Source Sans 3'"; x.lineWidth = 1.2;
      x.textAlign = "center"; for (const [u, t] of ticks(xl)) { const tx = x0 + 2 + u * (S - 4); x.beginPath(); x.moveTo(tx, Y0 + S); x.lineTo(tx, Y0 + S + 5); x.stroke(); x.fillText(t, tx, Y0 + S + 24); }
      x.textAlign = "right"; for (const [u, t] of ticks(yl)) { const ty = Y0 + S - 2 - u * (S - 4); x.beginPath(); x.moveTo(x0, ty); x.lineTo(x0 - 5, ty); x.stroke(); x.fillText(t, x0 - 8, ty + 6); }
      x.fillStyle = "#475569"; x.font = "600 19px 'Source Sans 3'"; x.textAlign = "center"; x.fillText(xl, x0 + S / 2, Y0 + S + 50);
      if (yTitle) { x.save(); x.translate(x0 - 50, Y0 + S / 2); x.rotate(-Math.PI / 2); x.fillText(yl, 0, 0); x.restore(); }
    };
    // left: what is on disk — one number per marker and cell, no gates, no names
    head("On disk: 12 FCS files", LX0 + S / 2, "#334155");
    x.globalAlpha = 1; x.drawImage(D.panel(Q, R, S, [], 0, WD), LX0, Y0, S, S); frame(LX0, "CD4", "CD8");
    x.fillStyle = "#64748b"; x.font = "17px 'Source Sans 3'"; x.textAlign = "center"; x.fillText("marker measurements before population annotation", LX0 + S / 2, Y0 + S + 72);
    // middle: the decisions, one by one
    x.globalAlpha = part(0, 5); x.font = "700 20px 'Source Sans 3'"; x.fillStyle = "#b91c1c"; x.textAlign = "center"; x.fillText("analysis context", mc, Y0 + 26);
    ["scale", "gates", "names"].forEach((t, k) => {
      const p = part(k + 1, 5), cy = Y0 + 48 + k * 66; x.globalAlpha = p;
      x.fillStyle = "#fef2f2"; x.strokeStyle = "#fca5a5"; x.lineWidth = 1.5; x.beginPath(); x.roundRect(mc - 64, cy + (1 - p) * 10, 128, 50, 12); x.fill(); x.stroke();
      x.font = "600 22px 'Source Sans 3'"; x.fillStyle = "#7f1d1d"; x.fillText(t, mc, cy + 32 + (1 - p) * 10);
    });
    const pr = part(4, 5); x.globalAlpha = pr; const ay = Y0 + S - 40;
    x.strokeStyle = "#b91c1c"; x.lineWidth = 3; x.beginPath(); x.moveTo(mc - 60, ay); x.lineTo(mc - 60 + 106 * pr, ay); x.stroke();
    x.fillStyle = "#b91c1c"; x.beginPath(); x.moveTo(mc + 62, ay); x.lineTo(mc + 44, ay - 10); x.lineTo(mc + 44, ay + 10); x.closePath(); x.fill();
    // right: what the analysis saw — CD8 T cells only, exhausted cells named
    head("After population annotation", RX0 + S / 2, "#1d4ed8");
    x.globalAlpha = 0.25 + 0.75 * pr; x.strokeStyle = "#cbd5e1"; x.lineWidth = 1.4; x.strokeRect(RX0, Y0, S, S);
    x.globalAlpha = pr;
    x.drawImage(D.panel(Q, R, S, [{ bit: 1, color: BLUE }, { bit: 2, color: PINK }], 0, WD), RX0, Y0, S, S); frame(RX0, "CD4", "CD8", false);
    const tx = RX0 + 2 + WD.thr[Q] * (S - 4), ty = Y0 + S - 2 - WD.thr[R] * (S - 4);
    // two gates, drawn as the analyst would: CD8⁺CD4⁻ (top left) and CD4⁺CD8⁻ (bottom right)
    x.lineWidth = 2.5; x.strokeStyle = "#be185d"; x.strokeRect(RX0 + 4, Y0 + 4, tx - RX0 - 8, ty - Y0 - 8);
    x.strokeStyle = "#1d4ed8"; x.strokeRect(tx + 4, ty + 4, RX0 + S - tx - 8, Y0 + S - ty - 8);
    x.font = "800 23px 'Source Sans 3'"; x.lineJoin = "round"; x.lineWidth = 6; x.strokeStyle = "rgba(255,255,255,.95)";
    const lab = (t, px, py, col, al) => { x.textAlign = al; x.strokeText(t, px, py); x.fillStyle = col; x.fillText(t, px, py); };
    lab(`CD8 T · ${nf(DM.counts.cd8)}`, tx + 12, Y0 + 34, "#be185d", "left"); // labels sit in the empty quadrants, next to their gate
    lab(`CD4 T · ${nf(DM.counts.cd4)}`, tx - 12, Y0 + S - 16, "#1d4ed8", "right");
    x.fillStyle = "#64748b"; x.font = "17px 'Source Sans 3'"; x.textAlign = "center"; x.fillText(`the same ${nf(DM.n)} T cells · gated and named`, RX0 + S / 2, Y0 + S + 72);
    x.globalAlpha = 1; x.textAlign = "left";
  };

  // ---------- 4 · gap ----------
  FIGS["s-gap"] = {
    init(el) { this.el = el; this.n = 0; document.fonts?.addEventListener?.("loadingdone", () => this.layout()); },
    // measure again after fonts settle: a header that wraps in the fallback font shifts every row
    enter() { this.layout(); requestAnimationFrame(() => this.layout()); document.fonts?.ready.then(() => this.layout()); },
    layout() {
      const lanes = this.el.querySelector("#lanes"), hops = this.el.querySelector("#hops");
      if (!lanes || !lanes.offsetWidth) return; // the spectral deck draws two routes in plain HTML (no #lanes)
      const k = lanes.getBoundingClientRect().width / lanes.offsetWidth || 1, c = lanes.getBoundingClientRect();
      const box = (e) => { const r = e.getBoundingClientRect(); return { l: (r.left - c.left) / k, r: (r.right - c.left) / k, t: (r.top - c.top) / k, b: (r.bottom - c.top) / k }; };
      const rows = [...lanes.querySelectorAll(".lane:not(.fc)")], hdr = [...lanes.querySelectorAll(".hdr div")];
      const span = (i) => box(rows[i].querySelector(".span")), mid = (b) => (b.t + b.b) / 2, cx = (b) => (b.l + b.r) / 2;
      // example route: ① Honeychrome (gating) → ② CAFE (clustering) → ③ R script (statistics) → ④ another program (figure)
      const A = span(0), B = span(1), bio = span(4), c6 = box(hdr[5]), c7 = box(hdr[6]), fk = box(rows[3]);
      const C = { l: c6.l + 12, r: c6.r - 12, t: bio.t, b: bio.b }, D = { l: c7.l + 18, r: c7.r, t: mid(fk) - 20, b: mid(fk) + 20 };
      const R = 14, x1 = A.r + 46;
      const legs = [ // [start, corner, end] — one horizontal run, then one vertical run
        [[A.r + 3, mid(A)], [x1, mid(A)], [x1, B.t - 3]],
        [[B.r + 3, mid(B)], [cx(C), mid(B)], [cx(C), C.t - 3]],
        [[C.r + 3, mid(C)], [cx(D), mid(C)], [cx(D), D.b + 3]],
      ];
      const W = lanes.offsetWidth, H = lanes.offsetHeight;
      let svg = `<svg width="${W}" height="${H}" style="position:absolute;left:0;top:0;overflow:visible">`;
      for (const [p, q, e] of legs) {
        const dy = Math.sign(e[1] - q[1]);
        svg += `<path d="M${p[0]},${p[1]} H${q[0] - R} Q${q[0]},${q[1]} ${q[0]},${q[1] + dy * R} V${e[1]}" fill="none" stroke="#b91c1c" stroke-width="4" stroke-dasharray="10 7" stroke-linecap="round"/>`;
      }
      for (const b of [A, B]) svg += `<rect x="${b.l - 4}" y="${b.t - 4}" width="${b.r - b.l + 8}" height="${b.b - b.t + 8}" rx="11" fill="none" stroke="#b91c1c" stroke-width="3"/>`;
      svg += `</svg>`;
      const place = (b) => `left:${b.l}px;top:${b.t}px;width:${b.r - b.l}px;height:${b.b - b.t}px`;
      svg += `<div class="hop-box" style="${place(C)}">${tr("script en R", "R script")}</div><div class="hop-box" style="${place(D)}">${tr("otro programa", "another program")}</div>`;
      legs.forEach(([, q, e]) => { svg += `<div class="hop" style="left:${q[0]}px;top:${(q[1] + e[1]) / 2}px"></div>`; });
      [A, B, C, D].forEach((b, i) => { svg += `<div class="hop-n" style="left:${b.l - 26}px;top:${mid(b)}px">${i + 1}</div>`; });
      hops.innerHTML = svg; hops.style.cssText = "position:absolute;inset:0;pointer-events:none";
    },
    step(n) {
      this.n = n;
      const rows = [...this.el.querySelectorAll("#lanes .lane:not(.fc)")];
      if (rows.length) [2, 3, 5, 6].forEach((i) => rows[i].classList.toggle("dimmed", n >= 1));
      this.layout();
    },
  };

  // ---------- 7 · scale / cofactor ----------
  FIGS["s-prep"] = {
    init(el) {
      this.el = el; this.h = el.querySelector("#prep-hist"); this.s = el.querySelector("#prep-sc");
      this.slider = el.querySelector("#cof"); this.pre = [...el.querySelectorAll("#cof-pre button")];
      this.slider.addEventListener("input", () => this.set(Math.pow(10, this.slider.value / 1000 * 4), false));
      this.pre.forEach((b) => (b.onclick = () => this.set(+b.dataset.c, true)));
      this.set(150, true);
    },
    set(c, moveSlider) {
      c = Math.max(1, c); this.c = c;
      if (moveSlider) this.slider.value = Math.round(Math.log10(c) / 4 * 1000);
      this.pre.forEach((b) => b.classList.toggle("on", Math.abs(+b.dataset.c - c) / c < 0.02));
      document.getElementById("cof-v").textContent = nf(c, c < 10 ? 1 : 0);
      this.draw();
    },
    draw() {
      const c = this.c, a4 = L.rawCD4.map((v) => Math.asinh(v / c)), a8 = L.rawCD8.map((v) => Math.asinh(v / c));
      const q = (arr, p) => { const s = [...arr].sort((x, y) => x - y); return s[Math.floor(p * (s.length - 1))]; };
      const xr = [q(a4, 0.001), q(a4, 0.999)], yr = [q(a8, 0.001), q(a8, 0.999)];
      const padx = (xr[1] - xr[0]) * 0.04, pady = (yr[1] - yr[0]) * 0.04; xr[0] -= padx; xr[1] += padx; yr[0] -= pady; yr[1] += pady;
      // histogram
      let x = ctxOf(this.h), [W, H] = cssSize(this.h), pad = { l: 58, r: 16, t: 20, b: 52 };
      x.clearRect(0, 0, W, H); const B = 90, cnt = new Array(B).fill(0), cntT = new Array(B).fill(0);
      a4.forEach((v, i) => { const b = Math.floor((v - xr[0]) / (xr[1] - xr[0]) * B); if (b >= 0 && b < B) { cnt[b]++; if (L.lab[i] === 0) cntT[b]++; } });
      const mx = Math.max(...cnt), bw = (W - pad.l - pad.r) / B, hh = H - pad.t - pad.b;
      for (let b = 0; b < B; b++) {
        x.fillStyle = "#cbd5e1"; x.fillRect(pad.l + b * bw, H - pad.b - cnt[b] / mx * hh, bw - 0.5, cnt[b] / mx * hh);
        x.fillStyle = popColor[0]; x.fillRect(pad.l + b * bw, H - pad.b - cntT[b] / mx * hh, bw - 0.5, cntT[b] / mx * hh);
      }
      axes(x, W, H, pad, xr, [0, mx], "arcsinh(CD4 / cofactor)", tr("células", "cells"), true);
      x.textAlign = "left"; x.font = "600 17px 'Source Sans 3'"; x.fillStyle = popColor[0]; x.fillText(tr("■ T CD4⁺ (FlowSOM)", "■ CD4⁺ T (FlowSOM)"), pad.l + 10, pad.t + 8); x.fillStyle = "#94a3b8"; x.fillText(tr("■ resto", "■ other"), pad.l + 180, pad.t + 8);
      // scatter
      x = ctxOf(this.s); [W, H] = cssSize(this.s); pad = { l: 58, r: 14, t: 14, b: 52 }; x.clearRect(0, 0, W, H);
      const sx = (v) => pad.l + (v - xr[0]) / (xr[1] - xr[0]) * (W - pad.l - pad.r), sy = (v) => H - pad.b - (v - yr[0]) / (yr[1] - yr[0]) * (H - pad.t - pad.b);
      x.globalAlpha = 0.45;
      for (let i = 0; i < N; i++) { x.fillStyle = popColor[L.lab[i]]; x.fillRect(sx(a4[i]) - 1.1, sy(a8[i]) - 1.1, 2.2, 2.2); }
      x.globalAlpha = 1; axes(x, W, H, pad, xr, yr, "arcsinh(CD4 / c)", "arcsinh(CD8 / c)", true);
    },
    step(n) { this.set([150, 5, 6000, 150][Math.min(3, n)], true); },
  };

  // ---------- 8 · gating ----------
  FIGS["s-gate"] = {
    init(el) {
      this.cd3 = new Float32Array(N); this.tcrb = new Float32Array(N); this.cd4 = new Float32Array(N); this.cd8 = new Float32Array(N);
      for (let i = 0; i < N; i++) { this.cd3[i] = val(i, "CD3"); this.tcrb[i] = val(i, "TCRb"); this.cd4[i] = val(i, "CD4"); this.cd8[i] = val(i, "CD8"); }
      this.range = [-1, 4.2];
      this.g1 = { c: el.querySelector("#g1"), gate: GATE_TAB.slice(), x: this.cd3, y: this.tcrb, xl: "CD3", yl: "TCRβ" };
      this.g2 = { c: el.querySelector("#g2"), gate: GATE_CD4.slice(), x: this.cd4, y: this.cd8, xl: "CD4", yl: "CD8" };
      this.default = [this.g1.gate.slice(), this.g2.gate.slice()];
      for (const g of [this.g1, this.g2]) this.bindDrag(g);
      this.update();
    },
    pad: { l: 56, r: 14, t: 14, b: 50 },
    sx(g, v) { const [W] = cssSize(g.c); return this.pad.l + (v - this.range[0]) / (this.range[1] - this.range[0]) * (W - this.pad.l - this.pad.r); },
    sy(g, v) { const [, H] = cssSize(g.c); return H - this.pad.b - (v - this.range[0]) / (this.range[1] - this.range[0]) * (H - this.pad.t - this.pad.b); },
    inv(g, px, py) { const [W, H] = cssSize(g.c); return [this.range[0] + (px - this.pad.l) / (W - this.pad.l - this.pad.r) * (this.range[1] - this.range[0]), this.range[0] + (H - this.pad.b - py) / (H - this.pad.t - this.pad.b) * (this.range[1] - this.range[0])]; },
    bindDrag(g) {
      let mode = null, start = null, orig = null;
      g.c.style.cursor = "move";
      g.c.addEventListener("pointerdown", (e) => {
        const [px, py] = pointer(g.c, e), [x0, y0, x1, y1] = g.gate;
        const corners = [[x0, y0, "ll"], [x1, y0, "rl"], [x0, y1, "lu"], [x1, y1, "ru"]];
        mode = null;
        for (const [cx, cy, name] of corners) if (Math.hypot(this.sx(g, cx) - px, this.sy(g, cy) - py) < 18) mode = name;
        if (!mode && px > this.sx(g, x0) && px < this.sx(g, x1) && py < this.sy(g, y0) && py > this.sy(g, y1)) mode = "move";
        if (!mode) return; start = this.inv(g, px, py); orig = g.gate.slice(); g.c.setPointerCapture(e.pointerId);
      });
      g.c.addEventListener("pointermove", (e) => {
        if (!mode) return; const [vx, vy] = this.inv(g, ...pointer(g.c, e)), dx = vx - start[0], dy = vy - start[1]; const G = orig.slice();
        if (mode === "move") { G[0] += dx; G[2] += dx; G[1] += dy; G[3] += dy; }
        else { if (mode[0] === "l") G[0] += dx; else G[2] += dx; if (mode[1] === "l") G[1] += dy; else G[3] += dy; }
        if (G[2] - G[0] > 0.2 && G[3] - G[1] > 0.2) { g.gate = G; this.update(); }
      });
      g.c.addEventListener("pointerup", () => (mode = null));
    },
    inside(g, i) { const [x0, y0, x1, y1] = g.gate; return g.x[i] >= x0 && g.x[i] <= x1 && g.y[i] >= y0 && g.y[i] <= y1; },
    drawPlot(g, mask, color) {
      const x = ctxOf(g.c), [W, H] = cssSize(g.c); x.clearRect(0, 0, W, H);
      for (let i = 0; i < N; i++) {
        if (mask && !mask[i]) continue; const inG = this.inside(g, i);
        x.fillStyle = inG ? color : "#64748b"; x.globalAlpha = inG ? 0.55 : 0.28; x.fillRect(this.sx(g, g.x[i]) - 1.1, this.sy(g, g.y[i]) - 1.1, 2.2, 2.2);
      }
      x.globalAlpha = 1; axes(x, W, H, this.pad, this.range, this.range, g.xl, g.yl, "lgc");
      const [x0, y0, x1, y1] = g.gate, X0 = this.sx(g, x0), X1 = this.sx(g, x1), Y0 = this.sy(g, y0), Y1 = this.sy(g, y1);
      x.save(); x.beginPath(); x.rect(this.pad.l, this.pad.t, W - this.pad.l - this.pad.r, H - this.pad.t - this.pad.b); x.clip();
      x.fillStyle = "rgba(37,99,235,.08)"; x.fillRect(X0, Y1, X1 - X0, Y0 - Y1); x.strokeStyle = "#2563eb"; x.lineWidth = 2.5; x.strokeRect(X0, Y1, X1 - X0, Y0 - Y1);
      x.fillStyle = "#2563eb"; for (const [a, b] of [[X0, Y0], [X1, Y0], [X0, Y1], [X1, Y1]]) { x.beginPath(); x.arc(a, b, 6, 0, 7); x.fill(); }
      x.restore();
    },
    update() {
      const par = new Uint8Array(N); let np = 0, nc = 0;
      for (let i = 0; i < N; i++) if (this.inside(this.g1, i)) { par[i] = 1; np++; if (this.inside(this.g2, i)) nc++; }
      this.drawPlot(this.g1, null, "#0f766e"); this.drawPlot(this.g2, par, popColor[0]);
      document.getElementById("g-par").textContent = np ? pct(nc / np) : "–";
      document.getElementById("g-tot").textContent = pct(nc / N);
      document.getElementById("g-n").textContent = tr(`${nf(nc)} células · padre ${nf(np)} · total ${nf(N)}`, `${nf(nc)} cells · parent ${nf(np)} · total ${nf(N)}`);
    },
    tween(g, to) {
      const from = g.gate.slice(), t0 = performance.now(), id = (this.tid = (this.tid || 0) + 1);
      const tick = (t) => { if (id !== this.tid) return; const f = Math.min(1, (t - t0) / 700), e = f * f * (3 - 2 * f);
        g.gate = from.map((v, k) => v + (to[k] - v) * e); this.update(); if (f < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    },
    step(n) {
      this.g2.gate = this.default[1].slice();
      if (n === 1) this.tween(this.g1, [-0.98, -0.98, 4.18, 4.18]); // parent = all cells
      else this.tween(this.g1, this.default[0]);
    },
  };

  // ---------- 9 · explore ----------
  FIGS["s-explore"] = {
    init(el) {
      el.querySelector("#ex-agree").textContent = nf(L.agreement * 100, 1) + PC;
      const c3 = el.querySelector("#ex3d"), [w3, h3] = cssSize(c3); // centred on the canvas, whatever its size (700 × 610 in the older decks)
      this.v = make3D(c3, { cx: w3 / 2, cy: h3 / 2, scale: 280 * Math.min(w3 / 700, h3 / 610), radius: 1.5, color: byPop, alpha: 0.9, auto: 0.001, bg: "#fff" });
      const seg = el.querySelector("#ex-color"); const opts = [["pop", tr("Población", "Population")], ...["CD3", "CD4", "CD8", "CD19", "TCRyd", "TCRb", "NK1.1"].map((m) => [m, mlabel(m)])];
      seg.innerHTML = opts.map(([k, l]) => `<button data-k="${k}">${l}</button>`).join("");
      this.btns = [...seg.querySelectorAll("button")]; this.btns.forEach((b) => (b.onclick = () => this.color(b.dataset.k)));
      this.heat = el.querySelector("#ex-heat"); this.sel = -1; this.color("pop");
      this.heat.addEventListener("click", (e) => {
        const [px, py] = pointer(this.heat, e), g = this.geom;
        if (py < g.top) { const j = Math.floor((px - g.left) / g.cw); if (j >= 0 && j < NM) this.color(MK[j]); return; }
        const r = Math.floor((py - g.top) / g.rh); if (r >= 0 && r < L.pops.length) this.pick(this.sel === r ? -1 : r);
      });
    },
    color(k) { this.mode = k; this.btns.forEach((b) => b.classList.toggle("on", b.dataset.k === k)); this.v.setColor(k === "pop" ? byPop : byMarker(k)); this.drawHeat(); },
    pick(r) { this.sel = r; this.v.setHighlight(r); this.drawHeat(); },
    drawHeat() {
      const c = this.heat, x = ctxOf(c), [W, H] = cssSize(c); x.clearRect(0, 0, W, H);
      const left = 190, top = 46, cw = (W - left - 10) / NM, rh = (H - top - 8) / L.pops.length; this.geom = { left, top, cw, rh };
      x.font = "600 20px 'Source Sans 3'"; x.textAlign = "center";
      MK.forEach((m, j) => { x.fillStyle = this.mode === m ? "#2563eb" : "#475569"; x.fillText(mlabel(m), left + j * cw + cw / 2, top - 16); });
      L.pops.forEach((p, r) => {
        const y = top + r * rh, dim = this.sel >= 0 && this.sel !== r;
        x.globalAlpha = dim ? 0.3 : 1;
        x.fillStyle = p.color; x.beginPath(); x.arc(14, y + rh / 2, 8, 0, 7); x.fill();
        x.fillStyle = "#0f172a"; x.textAlign = "left"; x.font = (this.sel === r ? "700 " : "600 ") + "22px 'Source Sans 3'"; x.fillText(tn(p.name), 30, y + rh / 2 + 7);
        L.median[r].forEach((v, j) => {
          const t = (v + 0.3) / 3.8; x.fillStyle = viridis(t); x.fillRect(left + j * cw + 2, y + 2, cw - 4, rh - 4);
          x.fillStyle = t > 0.62 ? "#0f172a" : "#fff"; x.textAlign = "center"; x.font = "600 19px 'Source Sans 3'"; x.fillText(nf(v, 1), left + j * cw + cw / 2, y + rh / 2 + 7);
        });
        x.globalAlpha = 1;
      });
    },
    enter() { this.v.start(); }, leave() { this.v.stop(); },
    step(n) { const k = ["pop", "CD19", "CD4", "pop"][Math.min(3, n)]; this.color(k); this.pick(n >= 3 ? 4 : -1); },
  };

  // ---------- 10 · review ----------
  FIGS["s-review"] = { init(el) { el.querySelector("#agree").textContent = nf(L.agreement * 100, 1) + PC; } };

  // ---------- 11 · paired comparison ----------
  FIGS["s-compare"] = {
    init(el) {
      this.c = el.querySelector("#cmp"); this.mode = "unpaired"; this.sel = 0;
      this.mb = [...el.querySelectorAll("#cmp-mode button")]; this.mb.forEach((b) => (b.onclick = () => this.setMode(b.dataset.m)));
      const list = el.querySelector("#cmp-list"); const G = D.gvhd;
      list.innerHTML = G.rows.map((r, k) => {
        const sig = r.padj != null && r.padj < G.fdr, est = r.logFC != null;
        const badge = !est ? `<span class="tag">${tr("sin estimación · muy pocas células", "not estimated · too few cells")}</span>` : sig ? `<span class="tag ok">${tr("significativo", "significant")}</span>` : '<span class="tag">n.s.</span>';
        const stats = est ? `logFC ${nf(r.logFC, 2)} · ${tr("p aj.", "adj. p")} ${r.padj < 0.01 ? nf(r.padj, 4) : nf(r.padj, 2)}` : "";
        return `<button class="cmp-row" data-k="${k}" style="display:grid;grid-template-columns:22px 1fr auto;gap:14px;align-items:center;text-align:left;border:1px solid var(--line);background:#fff;border-radius:10px;padding:10px 16px;cursor:pointer">
          <span style="width:16px;height:16px;border-radius:50%;background:${r.color}"></span>
          <span><b style="font-size:22px">${r.name.replace("Metacluster", "MC")}</b> <span style="font-size:20px;color:#475569">${r.markers.replace(/ (FITC|PerCP|APC|PE)/g, "")}</span><br><span class="mono" style="font-size:16px;color:#64748b">${stats}</span></span>${badge}</button>`;
      }).join("");
      this.rows = [...list.querySelectorAll("button")]; this.rows.forEach((b) => (b.onclick = () => this.pick(+b.dataset.k)));
      this.pick(0); this.setMode("unpaired");
    },
    setMode(m) { this.mode = m; this.mb.forEach((b) => b.classList.toggle("on", b.dataset.m === m)); this.draw(); },
    pick(k) { this.sel = k; this.rows.forEach((b, i) => { b.style.borderColor = i === k ? "#2563eb" : ""; b.style.boxShadow = i === k ? "0 0 0 3px #e8efff" : ""; }); this.draw(); },
    draw() {
      const G = D.gvhd, r = G.rows[this.sel], x = ctxOf(this.c), [W, H] = cssSize(this.c), pad = { l: 70, r: 120, t: 26, b: 56 };
      x.clearRect(0, 0, W, H);
      const ymax = Math.max(5, ...r.v1, ...r.v7) * 1.12, sy = (v) => H - pad.b - v / ymax * (H - pad.t - pad.b);
      const X1 = pad.l + 110, X7 = W - pad.r - 110;
      axes(x, W, H, pad, [0, 1], [0, ymax], "", tr("% de células del análisis", "% of analyzed cells"), false);
      x.textAlign = "right"; x.font = "15px 'Source Sans 3'"; x.fillStyle = "#64748b";
      for (const v of niceTicks(0, ymax)) { x.fillText(nf(v), pad.l - 8, sy(v) + 5); x.strokeStyle = "#eef2f7"; x.beginPath(); x.moveTo(pad.l + 1, sy(v)); x.lineTo(W - pad.r, sy(v)); x.stroke(); }
      x.textAlign = "center"; x.font = "600 22px 'Source Sans 3'"; x.fillStyle = "#0f172a"; x.fillText(tr("Visita 1", "Visit 1"), X1, H - 20); x.fillText(tr("Visita 7", "Visit 7"), X7, H - 20);
      const paired = this.mode === "paired", jit = [-28, -14, 0, 14, 28];
      const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
      if (!paired) {
        x.strokeStyle = "#0f172a"; x.lineWidth = 3;
        for (const [X, a] of [[X1, r.v1], [X7, r.v7]]) { x.beginPath(); x.moveTo(X - 46, sy(mean(a))); x.lineTo(X + 46, sy(mean(a))); x.stroke(); }
      }
      const labY = r.v7.map((v, i) => [sy(v), i]).sort((a, b) => a[0] - b[0]);
      for (let k = 1; k < labY.length; k++) if (labY[k][0] - labY[k - 1][0] < 20) labY[k][0] = labY[k - 1][0] + 20;
      const ly = {}; labY.forEach(([y, i]) => (ly[i] = y));
      r.v1.forEach((v, i) => {
        const a = [paired ? X1 : X1 + jit[i], sy(v)], b = [paired ? X7 : X7 + jit[(i + 2) % 5], sy(r.v7[i])];
        if (paired) { x.strokeStyle = r.color; x.globalAlpha = 0.75; x.lineWidth = 3; x.beginPath(); x.moveTo(...a); x.lineTo(...b); x.stroke(); x.globalAlpha = 1; }
        for (const p of [a, b]) { x.fillStyle = r.color; x.beginPath(); x.arc(p[0], p[1], 9, 0, 7); x.fill(); x.strokeStyle = "#fff"; x.lineWidth = 2; x.stroke(); }
        if (paired) { x.fillStyle = "#475569"; x.font = "600 17px 'Source Sans 3'"; x.textAlign = "left"; x.fillText(G.patients[i], b[0] + 16, ly[i] + 6); }
      });
      x.textAlign = "left"; x.font = "600 19px 'Source Sans 3'"; x.fillStyle = "#475569";
      x.fillText(`${tr("media", "mean")} ${nf(mean(r.v1), 1)}${PC} → ${nf(mean(r.v7), 1)}${PC}`, pad.l + 14, pad.t + 6);
    },
    step(n) { this.pick(n === 2 ? 2 : 0); /* MC3 (CD14/CD33): goes up in some patients and down in others */ this.setMode(n === 0 ? "unpaired" : "paired"); },
  };

  // ---------- 12 · figure provenance ----------
  FIGS["s-figure"] = {
    init(el) {
      const map = el.querySelector("#fig-map"), out = el.querySelector("#fig-src");
      const zones = EN ? [
        [0, 0, 50, 50, "3D UMAP of 6,000 events, colored by the FlowSOM Review populations"],
        [50, 0, 50, 50, "Gating · the “Analyzed cells” population on CD4 versus CD8"],
        [0, 50, 50, 50, "FlowSOM Review · median of each marker per population"],
        [50, 50, 50, 50, "Abundance · percentage of each population in the analysis input"],
      ] : [
        [0, 0, 50, 50, "UMAP 3D de 6.000 eventos, coloreado por las poblaciones de FlowSOM Review"],
        [50, 0, 50, 50, "Gating · población «Analyzed cells» en CD4 frente a CD8"],
        [0, 50, 50, 50, "FlowSOM Review · mediana de cada marcador por población"],
        [50, 50, 50, 50, "Abundancia · porcentaje de cada población en la entrada del análisis"],
      ];
      this.out = out; this.def = out.innerHTML;
      this.zones = zones.map(([l, t, w, h, txt], k) => {
        const z = document.createElement("div");
        z.style.cssText = `position:absolute;left:${l}%;top:${t}%;width:${w}%;height:${h}%;border-radius:10px;border:4px solid transparent;transition:border-color .2s,background .2s`;
        z.onmouseenter = () => this.show(k); z.onmouseleave = () => this.show(this.stepZone ?? -1);
        z.txt = txt; map.appendChild(z); return z;
      });
    },
    show(k) {
      this.zones.forEach((z, i) => { z.style.borderColor = i === k ? "#2563eb" : "transparent"; z.style.background = i === k ? "rgba(37,99,235,.07)" : ""; });
      this.out.innerHTML = k >= 0 ? tr("<b>Viene de:</b> ", "<b>Comes from:</b> ") + this.zones[k].txt : this.def;
    },
    step(n) { this.stepZone = n >= 1 && n <= 4 ? n - 1 : -1; this.show(this.stepZone); },
  };

  if (document.querySelector("#s-figure[data-guided-figure]")) {
    FIGS["s-figure"] = {
      init(el) {
        this.rows = [...el.querySelectorAll(".figure-sources li")];
        this.out = el.querySelector("#fig-src");
        this.focus = el.querySelector(".figure-focus");
        const map = el.querySelector("#fig-map"), image = map.querySelector("img");
        // Coordinates use the SVG's viewBox, with space outside rotated axis labels.
        // Convert to percentages only after the complete panel bounds are known.
        const figureWidth = +image.getAttribute("width"), figureHeight = +image.getAttribute("height");
        this.bounds = JSON.parse(map.dataset.panelBounds).map(([x, y, w, h]) =>
          [100 * x / figureWidth, 100 * y / figureHeight, 100 * w / figureWidth, 100 * h / figureHeight]);
        if (el.hasAttribute("data-assistant-demo")) {
          this.demo = new window.FlowCVFigureAssistantDemo(el, () => window.DECK.go(window.DECK.slides.indexOf(el), 6));
        }
      },
      step(n) {
        const captions = [
          "Kidney study: the same 6,000 T cells as slide 4.",
          "A two-dimensional view of the UMAP. All 6,000 cells are included.",
          "PD-1 and TIM-3 for every cell, with the same population colors: the exhausted CD8 sit top right.",
          "Each value is the median signal of one marker in one population.",
          "Counts become percentages of the same 6,000 input cells.",
          "Three appearance edits, requested and reviewed in the Figure assistant.",
          "Every cell, marker value and population count comes from the same saved analysis.",
        ];
        const k = n >= 1 && n <= 4 ? n - 1 : -1;
        this.rows.forEach((row, i) => row.classList.toggle("is-current", i === k));
        this.focus.hidden = k < 0;
        if (k >= 0) {
          const [left, top, width, height] = this.bounds[k];
          Object.assign(this.focus.style, { left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` });
        }
        this.out.textContent = captions[Math.min(n, captions.length - 1)];
        this.demo?.step(n);
      },
      leave() { this.demo?.close(); },
    };
  }

  // ---------- 13 · dependencies ----------
  FIGS["s-deps"] = {
    init(el) {
      this.el = el; this.nodes = Object.fromEntries([...el.querySelectorAll(".dag .node")].map((n) => [n.dataset.id, n]));
      this.msg = el.querySelector("#dag-msg p");
      el.querySelector("#dag-change").onclick = () => this.set(1);
      el.querySelector("#dag-reuse").onclick = () => this.set(2);
      el.querySelector("#dag-run").onclick = () => this.set(3);
      el.querySelector("#dag-reset").onclick = () => this.set(0);
      this.set(0);
    },
    enter() { this.edges(); },
    edges() {
      const E = [["in", "sc"], ["sc", "pca"], ["sc", "som"], ["pca", "out"], ["som", "out"]], svg = this.el.querySelector("#dag-svg");
      const pos = (n) => ({ x: n.offsetLeft, y: n.offsetTop, w: n.offsetWidth, h: n.offsetHeight });
      svg.innerHTML = `<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,0L10,5L0,10z" fill="#94a3b8"/></marker></defs>` +
        E.map(([a, b]) => { const A = pos(this.nodes[a]), B = pos(this.nodes[b]); const x1 = A.x + A.w, y1 = A.y + A.h / 2, x2 = B.x - 4, y2 = B.y + B.h / 2, m = (x1 + x2) / 2;
          return `<path d="M${x1},${y1} C${m},${y1} ${m},${y2} ${x2},${y2}" fill="none" stroke="#94a3b8" stroke-width="3" marker-end="url(#ah)"/>`; }).join("");
    },
    set(s) {
      const S = D.deps, n = this.nodes; this.s = s;
      Object.values(n).forEach((e) => e.classList.remove("stale", "changed"));
      document.getElementById("dag-cof").textContent = s >= 1 ? "arcsinh · cofactor 5" : "arcsinh · cofactor 150";
      if (s === 1 || s === 2) { n.sc.classList.add("changed"); ["pca", "som", "out"].forEach((k) => n[k].classList.add("stale")); }
      const b = (id, on) => (this.el.querySelector(id).disabled = !on);
      b("#dag-change", s === 0); b("#dag-reuse", s === 1); b("#dag-run", s === 2 || s === 1);
      this.msg.innerHTML = (EN ? [
        `Starting point: the ${nf(S.events)} cells of slide 2 as raw values, everything computed with cofactor 150.`,
        "<b>The scaling changed.</b> PCA, FlowSOM and the export depend on it: they are now <b style='color:var(--warn)'>out of date</b>.",
        `<b style="color:var(--bad)">Reuse rejected (HTTP ${S.status}).</b> “No compatible complete run offers a reusable input for FlowSOM. Run the whole workflow once after changing upstream modules.”`,
        `<b style="color:var(--ok)">Recomputed.</b> The decision mattered: with cofactor 5, <b>${nf(Math.round(100 * S.changing))}%</b> of cells change FlowSOM group. Partial versus full run: <b>${S.labelMismatch}</b> labels differ · exported CSV ${S.csvEqual ? "<b>identical</b>" : "different"}.`,
      ] : [
        `Estado inicial: las ${nf(S.events)} células de la lámina 7, todo calculado con cofactor 150.`,
        "<b>El escalado cambió.</b> PCA, FlowSOM y la exportación dependen de él: quedan <b style='color:var(--warn)'>desactualizados</b>.",
        `<b style="color:var(--bad)">Reutilización rechazada (HTTP ${S.status}).</b> «Ninguna ejecución completa compatible ofrece una entrada reutilizable para FlowSOM. Ejecute el workflow completo una vez tras cambiar módulos previos.»`,
        `<b style="color:var(--ok)">Recalculado.</b> La decisión importaba: con cofactor 5, <b>${nf(Math.round(100 * S.changing))} %</b> de las células cambia de grupo en FlowSOM. Ejecución parcial frente a completa: <b>${S.labelMismatch}</b> etiquetas distintas · CSV exportado ${S.csvEqual ? "<b>idéntico</b>" : "distinto"}.`,
      ])[s];
    },
    step(n) { this.set(Math.min(3, n)); },
  };

  // ---------- 17 · close ----------
  // ---------- ccRCC results (Catalina's reviewed populations, P1–P6) ----------
  const RCC = window.DECK_RCC;
  const RCC_TISSUE = ["#dc2626", "#d4a017"]; // blood, tumour
  const RCC_GROUP = ["#7c3aed", "#0891b2", "#db2777"];
  const RCC_LINEAGE = ["#2563eb", "#16a34a"]; // CD4, CD8
  FIGS["s-rccres"] = {
    init(el) { this.map = el.querySelector("#rcc-map"); this.pair = el.querySelector("#rcc-pair"); this.leg = el.querySelector("#rcc-leg"); this.n = 0; },
    enter() { this.draw(); },
    step(n) { this.n = n; this.draw(); },
    draw() {
      if (!RCC) return;
      const g = Math.min(this.n, 3); // 0 = tissue, 1..3 = highlighted group
      // map
      let x = ctxOf(this.map), [W, H] = cssSize(this.map), pad = 18;
      x.clearRect(0, 0, W, H);
      const sx = (v) => pad + ((v - RCC.xr[0]) / (RCC.xr[1] - RCC.xr[0])) * (W - 2 * pad);
      const sy = (v) => H - pad - ((v - RCC.yr[0]) / (RCC.yr[1] - RCC.yr[0])) * (H - 2 * pad);
      const draw = (sel, color, a, r) => {
        x.fillStyle = color; x.globalAlpha = a;
        for (let i = 0; i < RCC.x.length; i++) if (sel(i)) x.fillRect(sx(RCC.x[i]) - r, sy(RCC.y[i]) - r, 2 * r, 2 * r);
      };
      if (g === 0) { // lineage from Catalina's population names: CD4 left, CD8 right
        draw((i) => RCC.l[i] === 2, "#cbd5e1", 0.5, 1.2);
        draw((i) => RCC.l[i] === 0, RCC_LINEAGE[0], 0.55, 1.4);
        draw((i) => RCC.l[i] === 1, RCC_LINEAGE[1], 0.55, 1.4);
        x.globalAlpha = 1; x.font = "700 34px 'Source Sans 3', system-ui, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.lineJoin = "round";
        [0, 1].forEach((l) => {
          const xs = [], ys = []; for (let i = 0; i < RCC.x.length; i++) if (RCC.l[i] === l) { xs.push(RCC.x[i]); ys.push(RCC.y[i]); }
          const md = (a) => a.sort((u, v) => u - v)[a.length >> 1];
          const px = sx(md(xs)), py = sy(md(ys)), t = EN ? (l ? "CD8 T" : "CD4 T") : (l ? "T CD8" : "T CD4");
          x.lineWidth = 7; x.strokeStyle = "rgba(255,255,255,.92)"; x.strokeText(t, px, py); x.fillStyle = RCC_LINEAGE[l]; x.fillText(t, px, py);
        });
        x.textBaseline = "alphabetic";
        this.leg.innerHTML = EN ? `<span style="color:${RCC_LINEAGE[0]}">●</span> CD4 T &nbsp; <span style="color:${RCC_LINEAGE[1]}">●</span> CD8 T &nbsp; <span style="color:#94a3b8">●</span> unnamed &nbsp;·&nbsp; UMAP of 12,000 cells (of ${nf(RCC.n_events)})` : `<span style="color:${RCC_LINEAGE[0]}">●</span> T CD4 &nbsp; <span style="color:${RCC_LINEAGE[1]}">●</span> T CD8 &nbsp; <span style="color:#94a3b8">●</span> sin nombre &nbsp;·&nbsp; UMAP de 12.000 células (de ${nf(RCC.n_events)})`;
      } else {
        draw((i) => RCC.g[i] !== g, "#cbd5e1", 0.45, 1.2);
        draw((i) => RCC.g[i] === g, RCC_GROUP[g - 1], 0.85, 1.6);
        this.leg.innerHTML = `<span style="color:${RCC_GROUP[g - 1]}">●</span> ${tn(RCC.paired[g - 1].name)} &nbsp;·&nbsp; ${tr("nombres de Catalina", "Catalina's names")}: ${RCC.paired[g - 1].members.join(", ")}`;
      }
      x.globalAlpha = 1;
      // paired panels
      x = ctxOf(this.pair); [W, H] = cssSize(this.pair); x.clearRect(0, 0, W, H);
      const pw = (W - 40) / 3, top = 74, bot = H - 78;
      const yv = (v) => bot - (v / 100) * (bot - top);
      RCC.paired.forEach((p, k) => {
        const ox = k * (pw + 20), on = this.n >= k + 1, col = RCC_GROUP[k];
        x.globalAlpha = on ? 1 : 0.25;
        x.fillStyle = "#0f172a"; x.font = "600 22px 'Source Sans 3', system-ui, sans-serif"; x.textAlign = "left"; x.textBaseline = "alphabetic";
        x.fillText(tn(p.name), ox + 4, 26);
        x.fillStyle = "#64748b"; x.font = "18px 'Source Sans 3', system-ui, sans-serif"; x.fillText(`% ${tn(p.unit)}`, ox + 4, 50);
        // axis
        x.strokeStyle = "#e2e8f0"; x.lineWidth = 1;
        [0, 50, 100].forEach((t) => { x.beginPath(); x.moveTo(ox + 40, yv(t)); x.lineTo(ox + pw - 10, yv(t)); x.stroke(); x.fillStyle = "#94a3b8"; x.textAlign = "right"; x.fillText(String(t), ox + 32, yv(t) + 6); });
        const xa = ox + 90, xb = ox + pw - 60;
        x.textAlign = "center"; x.fillStyle = RCC_TISSUE[0]; x.font = "600 19px 'Source Sans 3', system-ui, sans-serif"; x.fillText(tr("sangre", "blood"), xa, bot + 30);
        x.fillStyle = "#a16207"; x.fillText("tumor", xb, bot + 30);
        if (on) {
          p.vals.forEach(([a, b]) => {
            x.strokeStyle = col; x.lineWidth = 2.5; x.globalAlpha = 0.85;
            x.beginPath(); x.moveTo(xa, yv(a)); x.lineTo(xb, yv(b)); x.stroke();
            x.fillStyle = col; [[xa, a], [xb, b]].forEach(([px, v]) => { x.beginPath(); x.arc(px, yv(v), 5.5, 0, 2 * Math.PI); x.fill(); });
          });
          x.globalAlpha = 1;
          const med = (arr) => { const s = arr.slice().sort((u, v) => u - v); return (s[2] + s[3]) / 2; };
          const ma = med(p.vals.map((v) => v[0])), mb = med(p.vals.map((v) => v[1]));
          const up = p.vals.filter(([a, b]) => b > a).length;
          x.fillStyle = "#0f172a"; x.font = "600 19px 'Source Sans 3', system-ui, sans-serif"; x.textAlign = "left";
          x.fillText(`${tr("mediana", "median")} ${nf(ma, 1)}${PC} → ${nf(mb, 1)}${PC}`, ox + 4, H - 6);
          x.fillStyle = col; x.textAlign = "right";
          x.fillText(EN ? (up === 6 ? "up in 6 of 6" : up === 0 ? "down in 6 of 6" : `up in ${up} of 6`) : (up === 6 ? "sube en 6 de 6" : up === 0 ? "baja en 6 de 6" : `sube en ${up} de 6`), ox + pw - 4, 50);
        }
        x.globalAlpha = 1;
      });
    },
  };

  // Same map as the title slide, now with each population's name following its cluster as it turns.
  function popLabels(x, proj) {
    const K = L.pops.length, xs = [], ys = [], zs = [];
    for (let k = 0; k < K; k++) { xs.push([]); ys.push([]); zs.push(0); }
    for (let i = 0; i < N; i++) { const k = L.lab[i]; xs[k].push(proj[3 * i]); ys[k].push(proj[3 * i + 1]); zs[k] += proj[3 * i + 2]; }
    const q = (a, f) => a[Math.floor(f * (a.length - 1))];
    x.font = "600 26px 'Source Sans 3', system-ui, sans-serif"; x.textBaseline = "middle"; x.lineJoin = "round";
    L.pops.forEach((p, k) => {
      if (!xs[k].length) return;
      xs[k].sort((u, v) => u - v); ys[k].sort((u, v) => u - v);
      const px = q(xs[k], 0.9) + 16, py = q(ys[k], 0.5); // just right of the cluster's bulk, ignoring stray cells
      x.globalAlpha = 0.7 + 0.3 * (zs[k] / xs[k].length + 1) / 2;
      x.beginPath(); x.arc(px + 6, py, 6, 0, 2 * Math.PI); x.fillStyle = p.color; x.fill();
      x.lineWidth = 6; x.strokeStyle = "rgba(11,18,32,.85)"; x.strokeText(tn(p.name), px + 20, py);
      x.fillStyle = "#fff"; x.fillText(tn(p.name), px + 20, py);
    });
    x.globalAlpha = 1;
  }
  FIGS["s-ctend"] = {
    init(el) {
      this.v = cd8Map(el.querySelector("#ctend3d"), { cx: 1330, cy: 580, scale: 420, radius: 2.1, alpha: 0.9, auto: 0.0012, yaw: 0.9, pitch: -0.3 });
      const leg = el.querySelector(".ct-leg"), ORDER = [0, 1, 2, 3, 5, 4, 6, 7, 8, 9];
      leg.innerHTML = ORDER.map((k) => `<li data-k="${k}"><i style="background:${CT_COL[k]}"></i>${CT_SHORT[k]}</li>`).join("");
      // hover previews a cell type; a click pins it; a click anywhere else on the slide shows all again
      this.leg = leg; this.pin = -1;
      const show = (k) => this.v.setHighlight(k);
      leg.querySelectorAll("li").forEach((li) => {
        li.addEventListener("pointerenter", () => show(+li.dataset.k));
        li.addEventListener("pointerleave", () => show(this.pin));
        li.addEventListener("click", (e) => { e.stopPropagation(); this.setPin(this.pin === +li.dataset.k ? -1 : +li.dataset.k); });
      });
      let down = null;
      el.addEventListener("pointerdown", (e) => { down = [e.clientX, e.clientY]; });
      el.addEventListener("click", (e) => {
        if (this.pin < 0 || e.button !== 0 || e.target.closest(".ct-leg li")) return;
        if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return; // rotating the map keeps the selection
        e.stopPropagation(); this.setPin(-1); // this click only clears the selection; the next one advances
      });
    },
    setPin(k) {
      this.pin = k; this.v.setHighlight(k);
      this.leg.classList.toggle("pinned", k >= 0);
      this.leg.querySelectorAll("li").forEach((li) => li.classList.toggle("on", +li.dataset.k === k));
    },
    enter() { this.v.start(); }, leave() { this.v.stop(); this.setPin(-1); },
  };
  FIGS["s-close"] = {
    init(el) {
      this.v = make3D(el.querySelector("#close3d"), { cx: 1430, cy: 500, scale: 330, radius: 2.0, color: byPop, alpha: 0.85, auto: 0.0016, yaw: 0.9, pitch: -0.3, overlay: popLabels });
    },
    enter() {
      if (STATE.files) document.getElementById("close-files").textContent = nf(STATE.files);
      this.v.start();
    },
    leave() { this.v.stop(); },
  };
})();
