/* Scripted Figure Studio scene for the talk. No model or network request is made.
   Four edits: three on one panel of the linked figure, then one request applied to a page of 21 density plots.
   After each edit the Studio canvas zooms on the affected plots: first the current state, then the applied change.
   The 21-plot page uses the same 6,000 saved CD8 cells and seven markers as the linked figure. */
(function () {
  const INTRO = .6;
  // Single-panel edits: [compose, preparing, review, applying, zoom] in seconds from the start of the edit.
  const S = { send: 3.8, prep: 4.3, review: 5.0, apply: 6.5, zoom: 6.9, swap: 7.9, out: 9.0, end: 9.6, typeFrom: .4, typeTo: 3.6 };
  // The page of 21 plots: a short page switch, the same request flow, a longer zoom and a final full-page hold.
  const G = { page: .5, send: 6.4, prep: 6.9, review: 7.6, apply: 10.0, zoom: 10.4, swap: 11.6, out: 14.4, end: 16.6, typeFrom: 1.1, typeTo: 5.7 };
  const CASES = [
    { panel: 0, target: "A · Cell map", heading: "Simplify the axes", request: "On the active plot, hide axis values.", change: "Axis values", before: "Visible", after: "Hidden", affected: "1 affected plot", result: "Axis values hidden on both UMAP facets." },
    { panel: 2, target: "C · Marker expression", heading: "Change the heatmap palette", request: "On the active heatmap, use the magma colormap.", change: "Color palette", before: "Viridis", after: "Magma", affected: "1 affected plot", result: "Magma palette applied to panel C." },
    { panel: 2, target: "C · Marker expression", heading: "Simplify the colorbar", request: "Use Min and Max labels on the colorbar.", change: "Colorbar labels", before: "Values", after: "Min / Max", affected: "1 affected plot", result: "Min and Max labels applied to the colorbar." },
    { grid: true, target: "All plots (21)", heading: "Edit every plot at once", request: "On all plots: hide titles, bigger points and larger axis titles.", rows: [["Titles", "Shown", "Hidden"], ["Point size", "0.5", "1.5"], ["Axis titles", "13 pt", "18 pt"]], affected: "21 affected plots · 3 changes", result: "21 plots updated in one request." },
  ];
  const LEN = CASES.map((c) => (c.grid ? G.end : S.end));
  const START = LEN.reduce((a, l, i) => (a.push(a[i] + l), a), [INTRO]);
  const DURATION = START[CASES.length];
  const timeLabel = (seconds) => `0:${String(Math.floor(seconds)).padStart(2, "0")}`;
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const ease = (t) => (t = clamp(t), t * t * (3 - 2 * t));
  const FIG_W = 1300, FIG_H = 748;
  // ---------- 21 plots: each pair of the seven CD8 markers ----------
  const CD8 = window.DECK_FIGURE_CD8;
  const COLS = 7, ROWS = 3, MARGIN = 16, CELL_W = (FIG_W - 2 * MARGIN) / COLS, CELL_H = (FIG_H - 2 * MARGIN) / ROWS, SIDE = 118;
  const cellBox = (k) => { const c = k % COLS, r = Math.floor(k / COLS), x = MARGIN + c * CELL_W, y = MARGIN + r * CELL_H; return { x, y, px: x + 50, py: y + 40 }; };
  // Left of each plot: y tick values (to px − 6) and the rotated y title (centred at px − 38), ~18 px clear of the plot to its left.
  // The SVG and canvas use the same decades on the saved arcsinh coordinates.
  const ticksOf = (marker) => {
    const j = CD8.markers.indexOf(marker);
    const lo = CD8.lo[j], hi = CD8.hi[j];
    return CD8.ticks[j].map(([v, label]) => [(v - lo) / (hi - lo), label]);
  };
  // Rainbow density palette from FlowCV's featureDensityColor.ts.
  const STOPS = [[0, [2, 12, 76]], [.2, [0, 54, 188]], [.4, [0, 210, 255]], [.58, [0, 196, 96]], [.76, [255, 225, 0]], [.9, [255, 128, 0]], [1, [224, 0, 0]]];
  const densityColor = (t) => {
    t = clamp(t);
    let i = 0;
    while (i < STOPS.length - 2 && t > STOPS[i + 1][0]) i++;
    const [s0, a] = STOPS[i], [s1, b] = STOPS[i + 1], f = (t - s0) / (s1 - s0);
    return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * f)).join(",")})`;
  };
  let pagePlots = null;
  function pageData() {
    if (pagePlots) return pagePlots;
    const { markers, lo, hi, n: N, v } = CD8, B = 56;
    const bytes = Uint8Array.from(atob(v), c => c.charCodeAt(0));
    const values = new DataView(bytes.buffer);
    const NM = markers.length;
    const position = (i, j) => (values.getFloat32(4 * (i * NM + j), true) - lo[j]) / (hi[j] - lo[j]);
    pagePlots = [];
    for (let jy = 1; jy < NM; jy++) for (let jx = 0; jx < jy; jx++) {
      const h = new Float32Array(B * B), pts = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) { const a = position(i, jx), b = position(i, jy); pts[3 * i] = a; pts[3 * i + 1] = b; h[Math.min(B - 1, Math.floor(b * B)) * B + Math.min(B - 1, Math.floor(a * B))]++; }
      const sm = new Float32Array(B * B); let mx = 0;
      for (let y = 0; y < B; y++) for (let x = 0; x < B; x++) { let s = 0, w = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const yy = y + dy, xx = x + dx; if (yy < 0 || xx < 0 || yy >= B || xx >= B) continue; const k = dx || dy ? 1 : 2; s += k * h[yy * B + xx]; w += k; } sm[y * B + x] = s / w; mx = Math.max(mx, sm[y * B + x]); }
      for (let i = 0; i < N; i++) { const c = sm[Math.min(B - 1, Math.floor(pts[3 * i + 1] * B)) * B + Math.min(B - 1, Math.floor(pts[3 * i] * B))]; pts[3 * i + 2] = Math.log1p(c) / Math.log1p(mx); }
      const order = Array.from({ length: N }, (_, i) => i).sort((a, b) => pts[3 * a + 2] - pts[3 * b + 2]);
      pagePlots.push({ x: markers[jx], y: markers[jy], pts, order });
    }
    return pagePlots;
  }
  // Draws the page on a canvas whose width maps to the 1300 x 748 figure space.
  // after = titles hidden, point size 0.5 -> 1.5, axis titles 13 -> 18 pt; same rainbow palette (points stay circles, as in FlowCV's density layer).
  function drawPage(canvas, after) {
    const plots = pageData(), x = canvas.getContext("2d"), k = canvas.width / FIG_W;
    x.setTransform(k, 0, 0, k, 0, 0); x.fillStyle = "#fff"; x.fillRect(0, 0, FIG_W, FIG_H);
    plots.forEach((p, n) => {
      const { px, py } = cellBox(n);
      if (!after) { x.fillStyle = "#0f172a"; x.font = "700 14px 'Source Sans 3', sans-serif"; x.textAlign = "center"; x.fillText(`${p.y} vs ${p.x}`, px + SIDE / 2, py - 10); }
      x.strokeStyle = "#94a3b8"; x.lineWidth = 1; x.strokeRect(px, py, SIDE, SIDE);
      const r = after ? 1.22 : .57;
      x.save(); x.beginPath(); x.rect(px + .5, py + .5, SIDE - 1, SIDE - 1); x.clip();
      for (const i of p.order) { x.fillStyle = densityColor(p.pts[3 * i + 2]); x.beginPath(); x.arc(px + 1.5 + p.pts[3 * i] * (SIDE - 3), py + SIDE - 1.5 - p.pts[3 * i + 1] * (SIDE - 3), r, 0, 2 * Math.PI); x.fill(); }
      x.restore();
      const fs = after ? 18 : 13, ts = after ? 12 : 11, X0 = px + 1.5, W0 = SIDE - 3, Y0 = py + SIDE - 1.5;
      x.strokeStyle = "#64748b"; x.fillStyle = "#475569"; x.lineWidth = 1; x.font = `500 ${ts}px 'Source Sans 3', sans-serif`;
      x.textAlign = "center"; let lastR = -1e9; for (const [u, t] of ticksOf(p.x)) { const tx = X0 + u * W0, hw = x.measureText(t).width / 2; x.beginPath(); x.moveTo(tx, py + SIDE); x.lineTo(tx, py + SIDE + 4); x.stroke(); if (tx - hw > lastR + 3) { x.fillText(t, tx, py + SIDE + 6 + ts); lastR = tx + hw; } }
      x.textAlign = "right"; for (const [u, t] of ticksOf(p.y)) { const ty = Y0 - u * W0; x.beginPath(); x.moveTo(px, ty); x.lineTo(px - 4, ty); x.stroke(); x.fillText(t, px - 6, ty + ts * .35); }
      x.fillStyle = after ? "#0f172a" : "#475569"; x.font = `600 ${fs}px 'Source Sans 3', sans-serif`; x.textAlign = "center"; x.fillText(p.x, px + SIDE / 2, py + SIDE + 9 + ts + fs);
      x.save(); x.translate(px - 38, py + SIDE / 2); x.rotate(-Math.PI / 2); x.fillText(p.y, 0, 0); x.restore();
    });
  }
  window.FlowCVFigurePage = { draw: drawPage };

  window.FlowCVFigureAssistantDemo = class {
    constructor(slide, onComplete) {
      this.slide = slide;
      this.onComplete = onComplete;
      this.root = slide.querySelector(".figure-ai-demo");
      this.window = this.root.querySelector(".figure-ai-window");
      this.main = slide.querySelector("#fig-map > img");
      this.mainPage = slide.querySelector("#fig-map .figure-page-final");
      this.preview = this.root.querySelector(".figure-ai-preview");
      this.zoomBox = this.root.querySelector(".figure-ai-zoom");
      this.canvasBox = this.root.querySelector(".figure-ai-canvas");
      this.pageBefore = this.root.querySelector(".figure-ai-page-before");
      this.pageAfter = this.root.querySelector(".figure-ai-page-after");
      this.panels = JSON.parse(this.main.parentElement.dataset.panelBounds);
      const revision = new URL(this.main.src).search;
      this.paths = [this.main.getAttribute("src"), ...["1", "2", "final"].map(stage => `assets/img/cd8-linked-figure-ai-${stage}.svg${revision}`)];
      this.paths.forEach((path) => { const image = new Image(); image.src = path; });
      this.nodes = Object.fromEntries([...this.root.querySelectorAll("[data-ai-field]")].map((node) => [node.dataset.aiField, node]));
      this.pauseButton = this.root.querySelector("[data-ai-pause]");
      this.progress = this.root.querySelector(".figure-ai-progress");
      this.progress.setAttribute("aria-valuemax", String(Math.round(DURATION)));
      this.progressFill = this.progress.firstElementChild;
      this.pointer = this.root.querySelector(".figure-ai-pointer");
      this.review = this.root.querySelector(".figure-ai-review");
      this.reviewRows = this.root.querySelector("[data-ai-rows]");
      this.preparing = this.root.querySelector(".figure-ai-preparing");
      this.success = this.root.querySelector(".figure-ai-success");
      this.instructions = this.root.querySelector(".figure-ai-instructions");
      this.reviewButton = this.root.querySelector("[data-ai-review]");
      this.applyButton = this.root.querySelector("[data-ai-apply]");
      this.stages = [...this.root.querySelectorAll(".figure-ai-stages li")];
      this.reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
      this.elapsed = 0;
      this.running = false;
      this.isOpen = false;
      this.stepNumber = 0;
      this.pagesDrawn = false;
      this.pauseButton.addEventListener("click", () => this.toggle());
      this.root.querySelectorAll("[data-ai-finish]").forEach((button) => button.addEventListener("click", () => this.finish()));
      slide.querySelector("[data-ai-replay]").addEventListener("click", () => window.DECK.go(window.DECK.slides.indexOf(slide), 5));
      // Review by edit: the four requests are sections. Clicking a section label, → / PgDn / Space / left click on the
      // page jump to the next edit (after the last one: the edited figure); ← / PgUp / right click replay the current
      // edit, or go to the previous one in its first 1.5 s. Captured on window so the deck never sees these keys while
      // the scene is open, wherever the focus is (the deck blurs buttons after a click).
      this.stageButtons = [...this.root.querySelectorAll("[data-ai-stage]")];
      this.stageButtons.forEach((button) => button.addEventListener("click", () => { this.goSection(+button.dataset.aiStage); this.root.focus({ preventScroll: true }); }));
      this.pauseButton.addEventListener("click", () => this.root.focus({ preventScroll: true }));
      START.slice(1, CASES.length).forEach((t) => { const tick = document.createElement("b"); tick.style.left = `${100 * t / DURATION}%`; this.progress.appendChild(tick); });
      this.root.querySelector(".figure-ai-workspace").addEventListener("click", () => this.nextSection());
      addEventListener("contextmenu", (event) => {
        if (!this.isOpen) return;
        event.preventDefault(); event.stopPropagation(); this.prevSection();
      }, true);
      addEventListener("keydown", (event) => {
        if (!this.isOpen) return;
        const onButton = event.target.closest && event.target.closest("button");
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); this.finish(); }
        else if (event.key.toLowerCase() === "k") { event.preventDefault(); event.stopPropagation(); this.toggle(); }
        else if (["Enter", " "].includes(event.key) && onButton && this.root.contains(onButton)) {
          event.preventDefault(); event.stopPropagation(); onButton.click();
        } else if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(event.key)) {
          event.preventDefault(); event.stopPropagation(); this.nextSection();
        } else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(event.key)) {
          event.preventDefault(); event.stopPropagation(); this.prevSection();
        } else if (event.key === "Tab") {
          const buttons = [...this.root.querySelectorAll("button:not(:disabled)")];
          const current = buttons.indexOf(document.activeElement);
          const next = event.shiftKey ? (current <= 0 ? buttons.length - 1 : current - 1) : (current + 1) % buttons.length;
          event.preventDefault(); event.stopPropagation(); buttons[next].focus();
        }
      }, true);
      document.addEventListener("visibilitychange", () => {
        if (!this.isOpen) return;
        if (document.hidden && this.running) { this.pause(); this.autoPaused = true; }
        else if (!document.hidden && this.autoPaused) { this.autoPaused = false; this.play(); }
      });
    }

    drawPages() {
      if (this.pagesDrawn) return;
      this.pagesDrawn = true;
      drawPage(this.pageBefore, false);
      drawPage(this.pageAfter, true);
      this.mainPage.getContext("2d").drawImage(this.pageAfter, 0, 0);
    }

    text(field, value) {
      if (this.nodes[field] && this.nodes[field].textContent !== value) this.nodes[field].textContent = value;
    }

    image(node, path) {
      if (node.getAttribute("src") !== path) node.setAttribute("src", path);
    }

    step(number) {
      this.stepNumber = number;
      const final = number >= 6;
      if (final) this.drawPages();
      this.slide.classList.toggle("figure-ai-result-shown", final);
      this.slide.querySelector(".figure-context").textContent = final ? "Four requests. The last edited all 21 scatterplots." : "Combine saved results on one page for an article.";
      if (number === 5 && !window.DECK_STATE?.printing && !document.body.classList.contains("presenter")) this.start();
      else this.close();
    }

    start() {
      this.pause();
      clearTimeout(this.closeTimer);
      this.drawPages();
      this.elapsed = 0;
      this.lastSignature = "";
      this.autoPaused = false;
      this.isOpen = true;
      this.root.hidden = false;
      this.root.inert = false;
      this.root.setAttribute("aria-hidden", "false");
      this.slide.querySelector(".linked-figure-body").inert = true;
      this.render();
      // Establish the starting pose before the short, interruptible entrance.
      this.root.offsetWidth;
      this.root.classList.add("is-open");
      this.root.focus({ preventScroll: true });
      this.play();
    }

    play() {
      if (!this.isOpen || this.running) return;
      this.running = true;
      this.pauseButton.textContent = "Pause";
      this.pauseButton.setAttribute("aria-label", "Pause demo (K)");
      this.lastFrame = performance.now();
      const tick = (now) => {
        if (!this.running) return;
        this.elapsed = Math.min(DURATION, this.elapsed + (now - this.lastFrame) / 1000);
        this.lastFrame = now;
        this.render();
        if (this.elapsed >= DURATION) this.finish();
        else this.frame = requestAnimationFrame(tick);
      };
      this.frame = requestAnimationFrame(tick);
    }

    pause() {
      this.running = false;
      cancelAnimationFrame(this.frame);
      this.pauseButton.textContent = "Resume";
      this.pauseButton.setAttribute("aria-label", "Resume demo (K)");
    }

    toggle() {
      this.autoPaused = false;
      if (this.running) this.pause(); else this.play();
    }

    // Useful for rehearsal, frame review and deterministic export; remains local.
    seek(seconds) {
      this.elapsed = Math.max(0, Math.min(DURATION, seconds));
      this.lastFrame = performance.now();
      this.lastSignature = "";
      this.render();
    }

    section() {
      for (let i = 0; i < CASES.length; i++) if (this.elapsed < START[i + 1]) return i;
      return CASES.length - 1;
    }

    // Play edit i from its start (edit 0 from the very beginning); past the last edit, show the edited figure.
    goSection(i) {
      if (i >= CASES.length) { this.finish(); return; }
      i = Math.max(0, i);
      this.seek(i === 0 ? 0 : START[i]);
      this.play();
    }

    nextSection() { this.goSection(this.section() + 1); }

    // ← replays the current edit; early in an edit it goes to the previous one; early in the first edit it leaves the
    // scene to the previous slide step, like ← everywhere else in the deck (it never gets stuck replaying edit 1).
    prevSection() {
      const i = this.section(), early = this.elapsed - (i === 0 ? 0 : START[i]) <= 1.5;
      if (i === 0 && early) { this.close(); window.DECK.go(window.DECK.slides.indexOf(this.slide), 4); return; }
      this.goSection(early ? i - 1 : i);
    }

    finish() {
      this.pause();
      if (this.stepNumber === 5 && this.slide.classList.contains("active")) this.onComplete();
      else this.close();
    }

    close() {
      this.pause();
      this.autoPaused = false;
      this.slide.querySelector(".linked-figure-body").inert = false;
      if (!this.isOpen) return;
      this.isOpen = false;
      this.root.inert = true;
      this.root.setAttribute("aria-hidden", "true");
      this.root.classList.remove("is-open");
      clearTimeout(this.closeTimer);
      this.closeTimer = setTimeout(() => { this.root.hidden = true; }, this.reducedMotion.matches ? 0 : 160);
      if (this.slide.classList.contains("active") && this.stepNumber >= 6) this.slide.querySelector(".figure-ai-result").focus({ preventScroll: true });
    }

    movePointer(target, pressed) {
      if (this.reducedMotion.matches) return;
      const box = this.window.getBoundingClientRect(), node = target.getBoundingClientRect();
      const scale = this.window.offsetWidth / box.width;
      this.pointer.style.transform = `translate3d(${(node.left - box.left + node.width * .73) * scale}px,${(node.top - box.top + node.height * .58) * scale}px,0)`;
      this.pointer.classList.toggle("is-pressed", pressed);
    }

    // Zoom the Studio canvas on a rectangle given in figure units (1300 x 748); e = 0 (whole page) … 1 (zoomed).
    zoomTo(rect, e) {
      const W = this.canvasBox.clientWidth, H = this.canvasBox.clientHeight;
      if (!W || !H) return 1;
      const f = Math.min(W / FIG_W, H / FIG_H), ox = (W - FIG_W * f) / 2, oy = (H - FIG_H * f) / 2;
      const [x, y, w, h] = rect, px = ox + x * f, py = oy + y * f, pw = w * f, ph = h * f;
      const s = Math.min(W / pw, H / ph) * .94, tx = W / 2 - (px + pw / 2) * s, ty = H / 2 - (py + ph / 2) * s;
      const k = ease(e), sc = 1 + (s - 1) * k;
      this.zoomBox.style.transform = `translate(${tx * k}px,${ty * k}px) scale(${sc})`;
      return sc;
    }

    render() {
      let index = CASES.length - 1;
      for (let i = 0; i < CASES.length; i++) if (this.elapsed < START[i + 1]) { index = i; break; }
      const item = CASES[index], T = item.grid ? G : S;
      const local = Math.max(0, this.elapsed - START[index]);
      const phase = local < T.send ? "compose" : local < T.prep ? "sending" : local < T.review ? "preparing" : local < T.apply ? "review" : local < T.zoom ? "applying" : "complete";
      const swapped = local >= T.swap;
      const applied = index + (swapped ? 1 : 0);
      const typed = this.reducedMotion.matches ? item.request.length : Math.floor(item.request.length * clamp((local - T.typeFrom) / (T.typeTo - T.typeFrom)));
      this.text("request", item.request.slice(0, typed));
      this.text("time", `${timeLabel(this.elapsed)} / ${timeLabel(DURATION)}`);
      this.progressFill.style.transform = `scaleX(${this.elapsed / DURATION})`;
      const elapsedSecond = String(Math.floor(this.elapsed));
      if (this.progress.getAttribute("aria-valuenow") !== elapsedSecond) this.progress.setAttribute("aria-valuenow", elapsedSecond);

      // Canvas: the linked figure for edits 1–3, the 21-plot page for edit 4; zoom on the affected plots after Apply.
      const zoomIn = clamp((local - T.zoom) / .7), zoomOut = clamp((local - T.out) / .6), e = this.reducedMotion.matches ? 0 : zoomIn * (1 - zoomOut);
      const pageOn = item.grid ? clamp(local / T.page) : 0;
      this.root.dataset.page = item.grid ? "grid" : "figure";
      this.root.dataset.zoom = e > .3 ? (swapped ? "after" : "before") : "none";
      this.preview.style.opacity = String(1 - pageOn);
      this.pageBefore.style.opacity = String(pageOn * (swapped ? 0 : 1));
      this.pageAfter.style.opacity = String(pageOn * (swapped ? 1 : 0));
      const rect = item.grid ? [MARGIN, MARGIN, 2 * CELL_W, CELL_H] : this.panels[item.panel];
      const sc = this.zoomTo(rect, e);
      this.text("zoom", item.grid ? `Zoom ${Math.round(20 * sc)}%` : `Zoom ${Math.round(100 * sc)}%`);
      if (!item.grid) this.image(this.preview, this.paths[applied]);

      const composePose = local < T.typeFrom ? "target" : local < T.send - .2 ? "type" : "send";
      const signature = `${index}:${phase}:${phase === "compose" ? composePose : ""}:${swapped}`;
      if (signature === this.lastSignature) return;
      this.lastSignature = signature;
      this.root.dataset.phase = phase === "sending" ? "compose" : phase;
      this.root.dataset.edit = String(index + 1);
      this.text("heading", `${index + 1} / ${CASES.length} · ${item.heading}`);
      this.text("target", item.target);
      this.text("scope", item.grid ? "All plots" : "Active plot");
      this.text("workspaceTarget", item.target);
      this.text("pageTitle", item.grid ? "Page 2 · all 21 marker pairs" : "Page 1 · CD8 publication figure");
      this.text("pageCount", item.grid ? "6,000 plotted CD8 cells · 21 scatterplots" : "6,000 plotted CD8 cells · 12 FCS files");
      const rows = item.rows || [[item.change, item.before, item.after]];
      this.reviewRows.innerHTML = rows.map(([c, b, a]) => `<div><strong>${c}</strong><span>${b}</span><strong>${a}</strong></div>`).join("");
      this.root.dataset.rows = String(rows.length);
      this.text("affected", item.affected);
      this.text("result", item.result);
      this.text("applied", `${applied} of ${CASES.length} changes applied`);
      this.text("status", phase === "complete" ? item.result : phase === "review" || phase === "applying" ? "Review the proposed change before applying it." : "Describe one change to the selected plots.");
      const reviewing = ["review", "applying"].includes(phase);
      this.review.hidden = !reviewing;
      this.preparing.hidden = phase !== "preparing";
      this.success.hidden = phase !== "complete";
      this.instructions.hidden = !["compose", "sending"].includes(phase);
      this.reviewButton.hidden = !["compose", "sending"].includes(phase);
      this.applyButton.hidden = !reviewing;
      this.applyButton.textContent = phase === "applying" ? "Applying…" : "Apply changes";
      this.stages.forEach((node, i) => { node.classList.toggle("is-current", i === index); node.classList.toggle("is-done", i < applied); });
      const target = reviewing ? this.applyButton : phase === "compose" || phase === "sending" ? (composePose === "target" ? this.nodes.target : composePose === "type" ? this.nodes.request : this.reviewButton) : null;
      if (target) this.movePointer(target, phase === "applying" || phase === "sending");
      else this.pointer.classList.remove("is-pressed");
    }
  };
})();
