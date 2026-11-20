/* FlowCV tours built from application captures (1600×1000 CSS px). Coordinates are application pixels. */
(function () {
  const FIGS = (window.FIGS = window.FIGS || {});
  const AW = 1600, AH = 1000, DIR = "assets/app/";
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  function tour(cfg) {
    return {
      init(el) {
        this.el = el; this.scr = el.querySelector(".tour-screen"); this.world = el.querySelector(".tour-world");
        this.imgs = [...el.querySelectorAll(".tour-img")]; this.top = 0; this.cur = el.querySelector(".tour-cur");
        this.cap = el.querySelector(".tour-cap"); this.items = [...el.querySelectorAll(".chap")]; this.token = 0; this.n = -1;
        cfg.chapters.flat().forEach((f) => { if (f.img || f.type) new Image().src = DIR + (f.img || f.type.sprite); }); // preload
        this.roi = this.world.querySelector(".tour-roi");
        this.entry = this.world.querySelector(".tour-entry");
      },
      enter() { this.active = true; this.n = -1; },
      leave() { this.active = false; this.token++; const st = this.el.querySelector(".run-stage"); if (st) { cancelAnimationFrame(this.runRaf); st.querySelector("video").pause(); } },
      cam(c, instant) {
        const W = this.scr.clientWidth, H = this.scr.clientHeight, s = (W / AW) * c[2];
        const x = Math.min(0, Math.max(W - AW * s, W / 2 - c[0] * s)), y = Math.min(0, Math.max(H - AH * s, H / 2 - c[1] * s));
        this.world.style.transition = instant ? "none" : ""; this.world.style.transform = `translate(${x}px,${y}px) scale(${s})`;
      },
      show(img, instant, fade) {
        const a = this.imgs[this.top], b = this.imgs[1 - this.top];
        if (a.dataset.img === img) return;
        b.style.transition = a.style.transition = instant ? "none" : fade != null ? `opacity ${fade}ms linear` : ""; b.src = DIR + img; b.dataset.img = img;
        b.classList.add("on"); a.classList.remove("on"); this.top = 1 - this.top;
      },
      async cut(img, my) {
        const a = this.imgs[this.top], b = this.imgs[1 - this.top];
        if (a.dataset.img === img) return true;
        b.src = DIR + img;
        try { await b.decode(); } catch { return false; }
        if (my !== this.token) return false;
        b.dataset.img = img;
        b.classList.add("on"); a.classList.remove("on"); this.top = 1 - this.top;
        return true;
      },
      rings(list) {
        this.world.querySelectorAll(".tour-ring").forEach((r) => r.remove());
        (list || []).forEach((b) => { const r = document.createElement("i"); r.className = "tour-ring"; r.style.cssText = `left:${b[0]}px;top:${b[1]}px;width:${b[2]}px;height:${b[3]}px`; this.world.appendChild(r); });
      },
      apply(f, instant) {
        if (cfg.cut && f.img && !matchMedia("print").matches) {
          const my = this.token;
          return this.cut(f.img, my).then((shown) => { if (shown && my === this.token) this.applyState(f, instant); });
        }
        if (f.img) this.show(f.img, instant, f.fade);
        this.applyState(f, instant);
      },
      applyState(f, instant) {
        if (f.img) { if (this.roi) this.roi.hidden = true; if (this.entry) this.entry.hidden = true; }
        if (f.cam) this.cam(f.cam, instant);
        if ("ring" in f) this.rings(f.ring);
        if ("cap" in f) this.cap.innerHTML = f.cap;
        if ("run" in f) this.runVideo(f.run, instant);
        if ("ghost" in f) { let g = this.el.querySelector(".tour-ghost"); if (!g && f.ghost) { g = document.createElement("span"); g.className = "tour-ghost"; this.world.appendChild(g); } if (g) { if (f.ghost) g.textContent = f.ghost; g.classList.toggle("on", !!f.ghost); } }
        if ("clock" in f) { const k = this.el.querySelector(".tour-clock"); if (k) { k.textContent = f.clock || ""; k.classList.toggle("on", !!f.clock); } }
        if ("out" in f) { const o = this.el.querySelector(".ex-stage"); if (o) o.classList.toggle("on", !!f.out); }
        if ("cur" in f && f.cur) this.cur.style.transitionDuration = f.curT ? `${f.curT}ms, ${f.curT}ms, .25s` : "";
        if (f.cur) { const g = this.el.querySelector(".tour-ghost"); if (g) { g.style.transitionDuration = this.cur.style.transitionDuration; g.style.left = (f.cur[0] + 16) + "px"; g.style.top = (f.cur[1] + 18) + "px"; } }
        if (f.cur) { this.cur.classList.add("on"); this.cur.style.left = f.cur[0] + "px"; this.cur.style.top = f.cur[1] + "px"; } else if (f.cur === null) this.cur.classList.remove("on");
        if (f.tap && !instant) { this.cur.classList.remove("tap"); void this.cur.offsetWidth; this.cur.classList.add("tap"); }
      },
      // Slide 13: the real run as video; the stopwatch reads real seconds = video time x 1.5 (11 Nov 2026).
      runVideo(on, instant) {
        const st = this.el.querySelector(".run-stage"); if (!st) return;
        const v = st.querySelector("video"), SPEED = 1.5, steps = [...st.querySelectorAll(".run-steps li")];
        const hand = st.querySelector(".hand"), sweep = st.querySelector(".sweep"), out = st.querySelector(".run-time");
        const draw = () => {
          const t = (v.currentTime || 0) * SPEED;
          out.textContent = t.toFixed(1) + " s";
          hand.style.transform = `rotate(${(t % 30) * 12}deg)`; sweep.style.strokeDasharray = `${Math.min(100, (t / 30) * 100)} 100`;
          let cur = 0; steps.forEach((li, i) => { if (t >= +li.dataset.t) cur = i; });
          steps.forEach((li, i) => { li.classList.toggle("done", i < cur || (i === cur && i === steps.length - 1)); li.classList.toggle("now", i === cur && i < steps.length - 1); });
        };
        cancelAnimationFrame(this.runRaf);
        st.classList.toggle("on", !!on);
        if (!on) { v.pause(); return; }
        if (instant) { const end = () => { v.pause(); v.currentTime = Math.max(0, (v.duration || 16) - 0.05); draw(); }; if (v.readyState >= 1) end(); else v.addEventListener("loadedmetadata", end, { once: true }); return; }
        v.currentTime = 0; draw(); const p = v.play(); if (p && p.catch) p.catch(() => {});
        const loop = () => { draw(); if (!v.ended && st.classList.contains("on")) this.runRaf = requestAnimationFrame(loop); };
        this.runRaf = requestAnimationFrame(loop);
      },
      final(k) { // last state of chapter k, with no motion
        const merged = {}; cfg.chapters.slice(0, k + 1).forEach((ch) => ch.forEach((f) => Object.assign(merged, f)));
        delete merged.tap; delete merged.hold; merged.cur = null; return this.apply(merged, true);
      },
      drawRoi(d, my) {
        const roi = this.roi, cursor = this.cur;
        const [startX, startY] = d.from, [endX, endY] = d.to;
        const [plotLeft, plotTop] = d.clip;
        cursor.style.transition = "none";
        roi.style.clipPath = `inset(${plotTop}px 0 0 ${plotLeft}px)`;
        return new Promise((done) => {
          const start = performance.now();
          const draw = (now) => {
            if (my !== this.token) return done();
            const t = Math.min(1, (now - start) / d.ms);
            const progress = t * t * (3 - 2 * t);
            const x = startX + (endX - startX) * progress;
            const y = startY + (endY - startY) * progress;
            cursor.style.left = `${x}px`;
            cursor.style.top = `${y}px`;
            roi.style.setProperty("--x", `${Math.max(startX, plotLeft)}px`);
            roi.style.setProperty("--y", `${Math.max(y, plotTop)}px`);
            roi.style.setProperty("--w", `${Math.max(0, x - Math.max(startX, plotLeft))}px`);
            roi.style.setProperty("--h", `${startY - Math.max(y, plotTop)}px`);
            roi.hidden = false;
            if (t < 1) requestAnimationFrame(draw);
            else { cursor.style.transition = ""; done(); }
          };
          requestAnimationFrame(draw);
        });
      },
      async typeEntry({ sprite, box: [x, y, w, h], beats }, my) {
        const entry = this.entry, img = new Image();
        img.src = DIR + sprite;
        try { await img.decode(); } catch { return; }
        if (my !== this.token) return;
        Object.assign(entry.style, {
          left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px`,
          backgroundImage: `url(${img.src})`, backgroundSize: `${w}px ${h * beats.length}px`,
        });
        entry.hidden = false;
        for (const [i, ms] of beats.entries()) {
          if (my !== this.token) return;
          entry.style.backgroundPosition = `0 ${-i * h}px`;
          await wait(ms);
        }
      },
      // One continuous, human-paced drag (11 Nov 2026): pointer and ghost follow a smooth quadratic curve at 60 fps
      // (slow start, faster middle, slow arrival, a short hover on the target); the real screen shown at each moment is
      // the recorded frame nearest to the pointer, so FlowCV's own feedback (target, preview) appears where it happened.
      animDrag(d, my) {
        return new Promise((done) => {
          const g = this.el.querySelector(".tour-ghost"), t0 = performance.now();
          const ez = (t) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
          const at = (u) => { const a = 1 - u; return [a * a * d.from[0] + 2 * a * u * d.via[0] + u * u * d.to[0], a * a * d.from[1] + 2 * a * u * d.via[1] + u * u * d.to[1]]; };
          this.cur.style.transition = "none"; if (g) g.style.transition = "opacity .2s";
          let shown = "";
          const tick = (now) => {
            if (my !== this.token) { this.cur.style.transition = ""; if (g) g.style.transition = ""; return done(); }
            const t = Math.min(1, (now - t0) / d.ms), p = at(ez(t));
            this.cur.style.left = p[0] + "px"; this.cur.style.top = p[1] + "px";
            if (g) { g.style.left = (p[0] + 16) + "px"; g.style.top = (p[1] + 18) + "px"; }
            let best = null, bd = 1e9; for (const [img, q] of d.frames) { const dd = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2; if (dd < bd) { bd = dd; best = img; } }
            if (best && best !== shown) { shown = best; this.show(best, false, 110); }
            if (t < 1) requestAnimationFrame(tick); else { this.cur.style.transition = ""; if (g) g.style.transition = ""; done(); }
          };
          requestAnimationFrame(tick);
        });
      },
      async play(k, my) {
        if (k > 0) await this.final(k - 1);
        for (const f of cfg.chapters[k]) {
          if (my !== this.token) return;
          await this.apply(f, false);
          if (my !== this.token) return;
          if (f.drag) await this.animDrag(f.drag, my);
          if (f.roi) await this.drawRoi(f.roi, my);
          if (f.type) await this.typeEntry(f.type, my);
          await wait(f.hold || 0);
        }
        if (my === this.token) this.cur.classList.remove("on");
      },
      step(n) {
        const k = Math.min(n, cfg.chapters.length - 1), on = cfg.on[Math.min(n, cfg.on.length - 1)];
        this.items.forEach((e, i) => { e.classList.toggle("on", i === on); e.classList.toggle("done", i < on); });
        const printing = document.documentElement.classList.contains("printing") || matchMedia("print").matches;
        const reducedMotion = cfg.cut && matchMedia("(prefers-reduced-motion: reduce)").matches;
        const forward = this.active && !printing && !reducedMotion && n === this.n + 1 && n < cfg.chapters.length;
        this.n = n;
        const my = ++this.token;
        if (this.roi) {
          this.roi.hidden = true;
          this.cur.style.transition = "";
        }
        if (this.entry) this.entry.hidden = true;
        if (forward) this.play(k, my); else this.final(k);
      },
    };
  }

  // ---------- slide 11 · what a colleague sees at sign-in, then the export ----------
  const FULL = [800, 500, 1], MODAL = [800, 500, 1.36];
  FIGS["s-share"] = tour({
    on: [0, 1, 1, 2],
    chapters: [
      [ { img: "sh-0-page.jpg", cam: FULL, ring: null, cur: null, out: false, cap: "Sergio signs in to FlowCV with his institutional account.", hold: 1300 },
        { img: "sh-1-dataset.jpg", hold: 900 },
        { cam: MODAL, ring: [[455, 176, 690, 96]], cap: "A notice is waiting: <b>Catalina Bustamante shared a dataset</b>, with a preview and the access level.", hold: 400 } ],
      [ { img: "sh-3-analysis.jpg", cam: MODAL, ring: [[476, 408, 648, 322]], cur: null, cap: "Second notice: <b>the whole analysis</b>, with its graph of modules.", hold: 400 } ],
      [ { ring: null, cur: [1068, 800], cap: "Open it…", hold: 900 }, { tap: true, hold: 450 },
        { img: "sh-4-workflow.jpg", cam: FULL, cur: null, hold: 1100 },
        { cam: [640, 330, 1.3], ring: [[35, 142, 760, 132]], cap: "The same workflow, with <b>editor</b> access: modules, parameters and results as Catalina left them.", hold: 2600 },
        { cam: [1000, 620, 1.18], ring: null, hold: 300 } ],
      // chapter 3 (11 Nov 2026): the redesigned Export Studio (local build of the current source, isolated API; shots in
      // output/talk-app-slides-2026-11-09/shots-v2, geometry in geo.json). Ends on the real package it downloaded.
      [ { img: "ex2-00-canvas.jpg", cam: FULL, ring: null, out: false, cur: [1479, 575], cap: "To take results out: open <b>Export Studio</b> on the last module.", hold: 1100 }, { tap: true, hold: 400 },
        { img: "ex2-01-studio.jpg", cur: null, ring: [[6, 70, 946, 924], [964, 71, 629, 924]], cap: "Left: <b>what goes in the package</b>. Right: a <b>preview</b> of the files, before downloading.", hold: 2800 },
        { cam: [480, 250, 1.6], ring: null, cur: [38, 197], cap: "Tick the figure…", hold: 900 }, { tap: true, img: "ex2-02-figure.jpg", hold: 600 },
        { cur: [121, 257], hold: 550 }, { tap: true, img: "ex2-03-fmt-svg.jpg", hold: 400 },
        { cur: [189, 257], hold: 500 }, { tap: true, img: "ex2-04-fmt-pdf.jpg", hold: 400 },
        { cur: [292, 257], cap: "…and its formats, up to <b>PowerPoint 16:9</b>.", hold: 600 }, { tap: true, img: "ex2-05-fmt-powerpoint.jpg", hold: 900 },
        { cam: [1180, 250, 1.7], ring: [[972, 156, 614, 200]], cur: null, cap: "The preview updates: <b>one file per format</b>, named before anything is written.", hold: 2600 },
        // 19 Nov 2026 (live frontend): cell data starts off; choosing the source ticks every file and marker by default.
        { cam: [480, 430, 1.45], ring: [[19, 381, 919, 44]], cur: [360, 403], cap: "Cell data comes too: <b>one CSV per sample</b>. Choose its source…", hold: 1300 }, { tap: true, img: "ex2-06-data.jpg", ring: null, cur: null, hold: 700 },
        { cam: [480, 600, 1.3], ring: [[19, 494, 919, 240]], cap: "…and <b>every file and marker</b> is ticked by default.", hold: 2200 },
        { cam: FULL, ring: [[972, 156, 614, 280]], cur: [1495, 962], cap: "Every requirement is ticked: <b>Download package</b>.", hold: 1400 }, { tap: true, hold: 400 },
        { img: "ex2-08-downloaded.jpg", cur: null, ring: [[6, 70, 242, 28]], cap: "Downloaded.", hold: 1300 },
        { out: true, ring: null, cap: "What arrived: the <b>real PowerPoint slide</b> FlowCV wrote, and the six files the preview listed." } ],
    ],
  });


  // ---------- new slide after slide 8 · a chain of decisions (11 Nov 2026) ----------
  // Real screens of the thesis analysis growing module by module, with real drag-and-drop onto the previous module
  // (output/thesis-capture-2026-11-11/rec_chain2.mjs, shots-chain2/). The ghost label stands in for the browser drag image.
  const PANEL = [260, 380, 1.8];
  FIGS["s-chain"] = tour({
    on: [0, 1, 2],
    chapters: [
      [{"img": "chain/c00-start.jpg", "cam": [924, 575, 1.75], "ring": null, "cur": null, "ghost": null, "cap": "The analysis from slide 8: for now, only its dataset.", "hold": 1500}, {"cam": [260, 380, 1.8], "cur": [132, 288], "hold": 1000}, {"tap": true, "hold": 300}, {"img": "chain/c-scaling-result.jpg", "cap": "Search a module: <b>Scaling</b>.", "hold": 1300}, {"cur": [132, 372], "hold": 700}, {"tap": true, "hold": 300}, {"img": "chain/c-scaling-fit.jpg", "cam": [918, 574, 1.75], "cur": null, "cap": "It connects after the selected step: <b>one decision</b>, with its parameters.", "hold": 300}],
      [{"img": "chain/c-batch-result.jpg", "cam": [260, 380, 1.8], "ring": null, "cur": [132, 288], "cap": "<b>Batch correction</b>: MNN, CyCombine, Harmony… also a choice. Drag it…", "hold": 1300}, {"cam": [719, 470, 1.08], "cur": [132, 372], "hold": 1150}, {"tap": true, "ghost": "Batch Correction", "hold": 260}, {"drag": {"from": [132, 372], "via": [718, 747], "to": [1065, 534], "ms": 1900, "frames": [["chain/c-batch-drag1.jpg", [164, 383]], ["chain/c-batch-drag2.jpg", [260, 416]], ["chain/c-batch-drag3.jpg", [420, 471]], ["chain/c-batch-drag4.jpg", [644, 548]], ["chain/c-batch-drag5.jpg", [916, 641]], ["chain/c-batch-drag6.jpg", [1065, 660]], ["chain/c-batch-drag7.jpg", [1065, 590]], ["chain/c-batch-drag8.jpg", [1065, 548]], ["chain/c-batch-drag9.jpg", [1065, 535]]]}, "hold": 0}, {"cur": [1065, 534], "hold": 550}, {"img": "chain/c-batch-dropped.jpg", "ghost": null, "fade": 120, "cap": "…and drop it on <b>Scaling</b>: it connects after it.", "hold": 900}, {"img": "chain/c-batch-fit.jpg", "cam": [925, 574, 1.53], "cur": null, "hold": 1100}, {"img": "chain/c-umap-result.jpg", "cam": [260, 380, 1.8], "ring": null, "cur": [132, 288], "cap": "A map of the cells: <b>UMAP</b>.", "hold": 1300}, {"cam": [790, 470, 0.99], "cur": [132, 372], "hold": 1150}, {"tap": true, "ghost": "Embedding", "hold": 260}, {"drag": {"from": [132, 372], "via": [789, 747], "to": [1206, 534], "ms": 1900, "frames": [["chain/c-umap-drag1.jpg", [169, 383]], ["chain/c-umap-drag2.jpg", [279, 416]], ["chain/c-umap-drag3.jpg", [463, 471]], ["chain/c-umap-drag4.jpg", [721, 548]], ["chain/c-umap-drag5.jpg", [1034, 641]], ["chain/c-umap-drag6.jpg", [1206, 660]], ["chain/c-umap-drag7.jpg", [1206, 590]], ["chain/c-umap-drag8.jpg", [1206, 548]], ["chain/c-umap-drag9.jpg", [1206, 535]]]}, "hold": 0}, {"cur": [1206, 534], "hold": 550}, {"img": "chain/c-umap-dropped.jpg", "ghost": null, "fade": 120, "cap": "Dropped on <b>Batch Correction</b>: the chain grows.", "hold": 900}, {"img": "chain/c-umap-fit.jpg", "cam": [926, 574, 1.21], "cur": null, "hold": 300}],
      [{"img": "chain/c-cluster-result.jpg", "cam": [260, 380, 1.8], "ring": null, "cur": [132, 288], "cap": "Groups: <b>Clustering</b> with FlowSOM.", "hold": 1300}, {"cam": [860, 470, 0.91], "cur": [132, 372], "hold": 1150}, {"tap": true, "ghost": "Clustering", "hold": 260}, {"drag": {"from": [132, 372], "via": [860, 747], "to": [1347, 534], "ms": 1900, "frames": [["chain/c-cluster-drag1.jpg", [174, 383]], ["chain/c-cluster-drag2.jpg", [299, 416]], ["chain/c-cluster-drag3.jpg", [507, 471]], ["chain/c-cluster-drag4.jpg", [799, 548]], ["chain/c-cluster-drag5.jpg", [1153, 641]], ["chain/c-cluster-drag6.jpg", [1347, 660]], ["chain/c-cluster-drag7.jpg", [1347, 590]], ["chain/c-cluster-drag8.jpg", [1347, 548]], ["chain/c-cluster-drag9.jpg", [1347, 535]]]}, "hold": 0}, {"cur": [1347, 534], "hold": 550}, {"img": "chain/c-cluster-dropped.jpg", "ghost": null, "fade": 120, "cap": "Connected after <b>Embedding</b>.", "hold": 900}, {"img": "chain/c-cluster-fit.jpg", "cam": [930, 575, 1.14], "cur": null, "hold": 1100}, {"img": "chain/c-review-fit.jpg", "cam": [925, 574, 1.15], "cap": "Then a review to name the groups, and the figure.", "hold": 1000}, {"img": "chain/c-figure-fit.jpg", "cam": [640, 560, 2.0], "ring": null, "cap": "Scaling, batch correction, map, groups…", "hold": 1700}, {"cam": [1210, 560, 2.0], "cap": "…their review and the figure.", "hold": 1700}, {"cam": [925, 575, 1.15], "ring": [[349, 490, 1152, 90]], "cap": "Seven modules, one chain: <b>the analysis is the chain of decisions</b>, saved and rerunnable.", "hold": 300}],
    ],
  });
  // ---------- slide 13 · change one decision, re-run only that module ----------
  // Re-recorded 11 Nov 2026 (output/talk-app-slides-2026-11-09/rec_deps2.mjs, local build with the "all markers ticked by
  // default" fix): real worker, frames through the whole partial run, played at 1.5x real time with an elapsed clock.
  // Re-recorded 19 Nov 2026 with the live frontend and backend (output/deck-rerecord-2026-11-19/rec-lymph).
  const CHAIN = [925, 562, 1.3];
  FIGS["s-deps"] = tour({
    on: [-1, 0, 1, 2],
    chapters: [
      [ { img: "dp3-0-canvas.jpg", cam: FULL, ring: null, cur: null, clock: null, run: false, cap: "The finished analysis of the 6,000 lymphocytes: every module is complete.", hold: 900 },
        { cam: CHAIN, ring: [[349, 526, 1151, 70]], hold: 300 } ],
      [ { ring: null, cur: [1003, 576], cap: "A colleague asks: what if FlowSOM looks for 8 groups instead of 6?", hold: 900 }, { tap: true, img: "dp3-1-selected.jpg", hold: 700 },
        { cur: [347, 937], hold: 700 }, { tap: true, hold: 300 },
        { img: "dp3-2-studio.jpg", cam: FULL, cur: null, ring: [[344, 245, 873, 180]], cap: "Clustering Studio: the <b>7 markers</b> that went into the run are ticked.", hold: 2200 },
        { cam: [1340, 700, 1.75], ring: [[1236, 744, 356, 82]], cap: "One parameter of one module: <b>Fixed Metaclusters</b>.", hold: 1300 },
        { img: "dp3-3-cleared.jpg", hold: 450 }, { img: "dp3-4-typed.jpg", hold: 500 },
        { img: "dp3-5-set.jpg", cap: "In the Clustering Studio: <b>Fixed Metaclusters 6 → 8</b>. One parameter of one module.", hold: 300 } ],
      // 19 Nov 2026 (output/deck-rerecord-2026-11-19): the live frontend confirms a re-run and lists what depends on it.
      [ { img: "dp3-6-back.jpg", cam: [800, 640, 1.2], ring: null, cur: [593, 937], cap: "Back in the workspace: <b>Run</b> on that module only.", hold: 1300 }, { tap: true, hold: 500 },
        { img: "dp3-7a-confirm.jpg", cam: [800, 500, 1.45], ring: [[570, 281, 460, 439]], cur: null, cap: "FlowCV says what the change touches: <b>only this module runs</b>; the figure that depends on it is listed.", hold: 2600 },
        { cur: [917, 682], hold: 900 }, { tap: true, hold: 400 },
        { img: "dp3-6-back.jpg", cam: [800, 640, 1.2], ring: null, cur: null, run: true, cap: "The real run, shown at 1.5×: the stopwatch counts its <b>real seconds</b>; FlowSOM's own counter runs in the panel.", hold: 14600 } ],
      [ { run: false, img: "dp3-8-done.jpg", cam: [1000, 562, 2.2], ring: [[933, 530, 127, 65]], cur: null, clock: null, cap: "Done: <b>FlowSOM · 8 clusters</b>.", hold: 2400 },
        { cam: [590, 330, 1.36], ring: [[16, 90, 400, 38], [933, 530, 127, 65]], cap: "<b>Latest partial run: completed · clustering.</b> 8 groups; the UMAP was not recomputed." } ],
    ],
  });

  // ---------- slide 8 · Gating Studio: the gates are drawn live (real app, recorded 9 Nov 2026) ----------
  const TP = [640, 440, 1.25], TOOL = [600, 330, 1.75], PLOT = [760, 450, 1.5], NAME = [800, 480, 1.7];
  FIGS["s-gate-app"] = tour({
    on: [-1, 0, 0, 1, 1, 2],
    chapters: [
      [ { img: "gt-00-canvas.jpg", cam: FULL, ring: null, cur: null, cap: "The workflow: Compensation and Scaling (arcsinh) come before the Gating module.", hold: 1600 },
        { cam: [1217, 543, 1.7], ring: [[1137, 507, 160, 76]], cur: [1279, 562], hold: 1500 }, { tap: true, hold: 500 },
        { img: "gt-01-studio.jpg", cam: FULL, ring: null, cur: null, hold: 1300 },
        { cam: TP, ring: [[14, 326, 284, 60]], cap: "Gating Studio opens on the <b>6,000 lymphocytes</b>. No gate yet." } ],
      [ { cam: TOOL, ring: null, cur: [382, 153], cap: "First, choose what to look at. <b>X axis</b>…", hold: 1300 }, { tap: true, hold: 400 },
        { img: "gt-02-x1-menu.jpg", cur: [510, 268], ring: [[376, 254, 268, 30]], hold: 1500 }, { tap: true, hold: 400 },
        { img: "gt-03-x1-set.jpg", ring: null, cur: [417, 153], cap: "X axis = <b>CD3</b>. Now the <b>Y axis</b>…", hold: 1500 }, { tap: true, hold: 400 },
        { img: "gt-04-y1-menu.jpg", cur: [545, 409], ring: [[376, 395, 268, 30]], hold: 1500 }, { tap: true, hold: 400 },
        { img: "gt-05-y1-set.jpg", cam: PLOT, ring: null, cur: null, cap: "<b>CD3 × TCRβ</b>: the αβ T cells are the cloud in the upper right." } ],
      [ { cam: PLOT, ring: null, cur: [347, 153], cap: "<b>Add ROI</b>, then drag a rectangle around that cloud.", hold: 1400 }, { tap: true, hold: 400 },
        { img: "gt-06-add1.jpg", cur: [844, 426], hold: 1300 },
        { img: "gt-07-g1-drag0.35.jpg", cur: [918, 344], hold: 650 }, { img: "gt-08-g1-drag0.7.jpg", cur: [992, 263], hold: 650 }, { img: "gt-09-g1-drag1.jpg", cur: [1056, 193], hold: 900 },
        { img: "gt-10-g1-prompt.jpg", cam: NAME, cur: null, cap: "FlowCV asks for a name…", hold: 1500 },
        { img: "gt-11-g1-typed.jpg", cur: [941, 567], hold: 1500 }, { tap: true, hold: 400 },
        { img: "gt-12-g1-saved.jpg", cam: TP, cur: null, ring: [[40, 360, 258, 32]], cap: "<b>αβ T cells: 4,148 cells, 69.13%</b> of the 6,000 lymphocytes." } ],
      [ { cam: [420, 520, 1.6], ring: null, cur: [140, 375], cap: "A gate <b>inside</b> that one: right-click the parent…", hold: 1400 }, { tap: true, hold: 400 },
        { img: "gt-13-ctx.jpg", cur: [286, 558], hold: 1400 }, { tap: true, hold: 400 },
        { img: "gt-14-ctx-create.jpg", cur: [307, 595], ring: [[150, 580, 270, 46]], cap: "…Create → <b>Add Child Gate</b>.", hold: 1700 }, { tap: true, hold: 400 },
        { img: "gt-15-child-added.jpg", cam: TP, ring: [[56, 393, 242, 32]], cur: null, cap: "The child appears under αβ T cells. It only sees the parent's 4,148 cells.", hold: 2400 },
        { cam: TOOL, ring: null, cur: [382, 153], cap: "New axes for the child: X…", hold: 1200 }, { tap: true, hold: 400 },
        { img: "gt-16-x2-menu.jpg", cur: [510, 302], ring: [[376, 288, 268, 30]], hold: 1300 }, { tap: true, hold: 400 },
        { img: "gt-17-x2-set.jpg", ring: null, cur: [417, 153], cap: "X = <b>CD4</b>, and Y…", hold: 1200 }, { tap: true, hold: 400 },
        { img: "gt-18-y2-menu.jpg", cur: [545, 370], ring: [[376, 356, 268, 30]], hold: 1300 }, { tap: true, hold: 400 },
        { img: "gt-19-y2-set.jpg", cam: PLOT, ring: null, cur: null, cap: "<b>CD4 × CD8</b>, inside the αβ T cells only." } ],
      [ { cam: PLOT, ring: null, cur: [636, 153], cap: "Rectangle tool, then drag around the CD4⁺ CD8⁻ cells.", hold: 1300 }, { tap: true, hold: 400 },
        { img: "gt-20-rect-tool.jpg", cur: [851, 495], hold: 1300 },
        { img: "gt-21-g2-drag0.35.jpg", cur: [923, 568], hold: 650 }, { img: "gt-22-g2-drag0.7.jpg", cur: [995, 641], hold: 650 }, { img: "gt-23-g2-drag1.jpg", cur: [1056, 703], hold: 900 },
        { img: "gt-24-g2-prompt.jpg", cam: NAME, cur: null, cap: "Name it…", hold: 1300 },
        { img: "gt-25-g2-typed.jpg", cur: [941, 567], hold: 1400 }, { tap: true, hold: 400 },
        { img: "gt-26-g2-saved.jpg", cam: TP, cur: null, ring: [[56, 393, 242, 32]], cap: "<b>CD4⁺ T cells: 3,242 cells, 78.16%</b> of their parent." } ],
      [ { cam: [560, 200, 1.6], ring: null, cur: [416, 91], cap: "The numbers, as a table: the <b>Statistics</b> tab.", hold: 1500 }, { tap: true, hold: 400 },
        { img: "gt-27-stats.jpg", cur: null, hold: 1200 },
        { cam: [1130, 270, 1.6], ring: [[700, 226, 876, 96]], cap: "Same 3,242 cells: <b>78.16% of αβ T cells</b>, <b>54.03% of the analysis input</b>." } ],
    ],
  });

  // RCC19 phase 2 (10 Nov 2026): real isolated UI capture; other editions retain their original tour.
  // Re-recorded 19 Nov 2026 with the live frontend (output/deck-rerecord-2026-11-19): same gates, 5,751 / 4,234 (73.62 %).
  const mouseGatingTour = FIGS["s-gate-app"];
  // Kidney study: animate the region and input field over stable application captures.
  const NAME_FIELD = [911 / 1.5, 494, 386, 42]; // Name ROI gate input, captured at 1.5×
  const FILE_GRID = [740, 460, 1.12];
  const rcc19GatingTour = tour({
    cut: true,
    on: [-1, 0, 0, 1, 1, 2, 2, 3, 3],
    chapters: [
      [
        { img: "thesis/gt-00-canvas.jpg", cam: [800, 500, 1], ring: null, cur: null, cap: "<b>Patient 5 tumor</b>: 11,502 T cells from the processed kidney-study files.", hold: 1600 },
        { cam: [1160, 590, 1.5], cur: [1212, 623], hold: 1200 },
        { tap: true, hold: 400 },
        { img: "thesis/gt-01-studio.jpg", cam: [800, 500, 1], cur: null, hold: 1200 },
        { cam: [640, 440, 1.25], cap: "<b>11,502 cells = 100%</b> of this analysis." },
      ],
      [
        { cur: [382, 153], hold: 1100, cam: [600, 330, 1.75], ring: null, cap: "Choose the markers. <b>X = CD4</b>…" },
        { tap: true, hold: 400 },
        { img: "thesis/gt-02-x1-menu.jpg", cur: [510, 405], ring: [[376, 390, 268, 30]], hold: 1300 },
        { tap: true, hold: 400 },
        { img: "thesis/gt-03-x1-set.jpg", ring: null, cur: [417, 153], cap: "…and <b>CD8</b> on Y.", hold: 1200 },
        { tap: true, hold: 400 },
        { img: "thesis/gt-04-y1-menu.jpg", cur: [545, 338], ring: [[411, 323, 268, 30]], hold: 1300 },
        { tap: true, hold: 400 },
        { img: "thesis/gt-05-y1-set.jpg", cam: [760, 450, 1.5], ring: null, cur: null, cap: "<b>CD4 × CD8</b>: two clear groups." },
      ],
      [
        { cur: [347, 153], hold: 1100, cam: [760, 450, 1.5], ring: null, cap: "<b>Add ROI</b>, then draw around the CD8 cells." },
        { tap: true, hold: 400 },
        { img: "thesis/gt-06-add1.jpg" },
        { cur: [557, 492], hold: 900, curT: null },
        { roi: { from: [556.6, 492.4], to: [778, 183.4], clip: [559.6, 196.3], ms: 1450 }, hold: 260 },
        { img: "thesis/gt-21-g1-prompt.jpg", cam: [800, 480, 1.7], cur: null, cap: "Give it a name.", hold: 850 },
        { type: { sprite: "thesis/gt-g1-keys.png", box: NAME_FIELD, beats: [110, 88, 150, 110, 120, 145, 76, 118, 110, 106, 200] } },
        { img: "thesis/gt-22-g1-typed.jpg", cur: [941, 567], hold: 720 },
        { tap: true, hold: 400 },
        { img: "thesis/gt-23-g1-saved.jpg", cam: [640, 440, 1.25], cur: null, ring: [[44, 318, 262, 26]], cap: "<b>CD8 T cells · 5,751</b>: half of the input." },
      ],
      [
        { cur: [143, 331], hold: 1100, cam: [420, 520, 1.6], ring: null, cap: "Now a gate <b>inside</b> it: right-click its name…" },
        { tap: true, hold: 400 },
        { img: "thesis/gt-24-ctx.jpg", cur: [290, 515], hold: 1100 },
        { tap: true, hold: 400 },
        { img: "thesis/gt-25-ctx-create.jpg", cur: [311, 552], cap: "Create → <b>Add Child Gate</b>.", hold: 1200 },
        { tap: true, hold: 400 },
        { img: "thesis/gt-26-child-added.jpg", cam: [640, 440, 1.25], cur: null, cap: "The child only sees the <b>5,751 CD8 T cells</b>.", hold: 1800 },
        { cur: [382, 153], hold: 1100, cam: [600, 330, 1.75], ring: null, cap: "Switch to <b>PD-1 × TIM-3</b>." },
        { tap: true, hold: 400 },
        { img: "thesis/gt-27-x2-menu.jpg", cur: [510, 338], ring: [[376, 323, 268, 30]], hold: 1300 },
        { tap: true, hold: 400 },
        { img: "thesis/gt-28-x2-set.jpg", ring: null, cur: [417, 153], hold: 900 },
        { tap: true, hold: 400 },
        { img: "thesis/gt-29-y2-menu.jpg", cur: [545, 375], ring: [[411, 360, 268, 30]], hold: 1300 },
        { tap: true, hold: 400 },
        { img: "thesis/gt-30-y2-set.jpg", cam: [760, 450, 1.5], ring: null, cur: null, cap: "CD8 T cells only: the <b>exhausted cells</b> sit top right." },
      ],
      [
        { cur: [636, 153], hold: 1100, cam: [760, 450, 1.5], ring: null, cap: "Draw the <b>PD-1⁺ TIM-3⁺</b> window." },
        { tap: true, hold: 400 },
        { img: "thesis/gt-31-rect-tool.jpg" },
        { cur: [788, 545], hold: 900 },
        { roi: { from: [787.5, 544.9], to: [1045, 183], clip: [559.6, 196.3], ms: 1450 }, hold: 260 },
        { img: "thesis/gt-46-g2-prompt.jpg", cam: [800, 480, 1.7], cur: null, cap: "Save its name…", hold: 850 },
        { type: { sprite: "thesis/gt-g2-keys.png", box: NAME_FIELD, beats: [108, 90, 118, 90, 160, 140, 115, 92, 114, 118, 104, 200] } },
        { img: "thesis/gt-47-g2-typed.jpg", cur: [941, 567], hold: 720 },
        { tap: true, hold: 400 },
        { img: "thesis/gt-48-g2-saved.jpg", cam: [760, 450, 1.5], cur: null, ring: null, cap: "<b>4,234 cells</b> are PD-1⁺ and TIM-3⁺." },
      ],
      [
        { img: "thesis/gt-multi-source.jpg", cur: [1384, 256], cam: [1030, 420, 1.13], cap: "With all 12 files selected, switch to <b>By FCS</b> to review the shared gates.", hold: 1150 },
        { tap: true, hold: 350 },
        { img: "thesis/gt-by-fcs.jpg", cam: FILE_GRID, cur: null, hold: 1050 },
        { cur: [143, 331], hold: 850 },
        { tap: true, hold: 350 },
        { img: "thesis/gt-by-fcs-parent.jpg", cur: null, cap: "The same <b>CD8 gate</b> appears on each FCS file. Cell distributions vary by sample." },
      ],
      [
        { cur: [151, 365], cap: "Select the nested gate in the shared tree.", hold: 950 },
        { tap: true, hold: 350 },
        { img: "thesis/gt-by-fcs.jpg", cam: FILE_GRID, cur: null, cap: "Each file also inherits the <b>PD-1⁺ TIM-3⁺ gate</b> within its CD8 T cells." },
      ],
      [
        { cur: [416, 91], cam: [550, 235, 1.17], cap: "Open <b>Statistics</b> to compare counts and percentages file by file.", hold: 1050 },
        { tap: true, hold: 350 },
        { img: "thesis/gt-by-fcs-statistics.jpg", cam: [952, 416, 1.18], cur: null, ring: [[332, 685, 1243, 42]], cap: "<b>One row per FCS.</b> In P5 tumor the same 4,234 cells are 73.62% of CD8 T cells and 36.81% of the input." },
      ],
      [
        { cur: [348, 91], cam: [615, 350, 1.16], ring: null, cap: "Return to <b>Plots</b>.", hold: 950 },
        { tap: true, hold: 350 },
        { img: "thesis/gt-by-fcs.jpg", cam: FULL, cur: [1490, 198], cap: "Choose <b>Combined</b> to pool the 12 samples.", hold: 1150 },
        { tap: true, hold: 350 },
        { img: "thesis/gt-combined.jpg", cam: FULL, cur: null, ring: [[16, 280, 280, 102]], cap: "<b>All 12 FCS files.</b> The pooled percentages use summed cell counts for each denominator." },
      ],
    ],
  });
  FIGS["s-gate-app"] = {
    init(el) { this.current = el.hasAttribute("data-rcc19-gating") ? rcc19GatingTour : mouseGatingTour; this.current.init(el); },
    enter() { this.current.enter(); }, leave() { this.current.leave(); }, step(n) { this.current.step(n); }
  };
})();
