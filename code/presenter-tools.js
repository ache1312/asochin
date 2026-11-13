/* Presenter tools for the audience view (load after deck.js):
   Ctrl+L  laser pointer: the mouse cursor becomes a red dot (press again to restore the cursor).
   Ctrl+M  rectangular 2× magnifier that follows the mouse and shows the live slide, charts and video included.
   The lens holds a clone of the active slide inside a shadow root (so its ids never collide with the deck's);
   every animation frame it copies the pixels of the slide's canvases and videos into the clone. */
(() => {
  if (new URLSearchParams(location.search).has("presenter")) return; // presenter window: no tools
  const stage = document.getElementById("stage");
  if (!stage) return;

  const LENS_W = 560, LENS_H = 340, BORDER = 4, ZOOM = 2; // keep in sync with .pt-lens in presenter-tools.css
  let mx = innerWidth / 2, my = innerHeight / 2;

  // ---------- laser pointer ----------
  const dot = document.createElement("div");
  dot.className = "pt-laser";
  dot.setAttribute("aria-hidden", "true");
  document.body.append(dot);
  let laser = false;
  function placeDot() { dot.style.transform = `translate(${mx}px, ${my}px)`; }
  function setLaser(on) { laser = on; document.body.classList.toggle("pt-laser-on", on); placeDot(); }

  // ---------- magnifier ----------
  const host = document.createElement("div");
  host.className = "pt-lens";
  host.setAttribute("aria-hidden", "true");
  document.body.append(host);
  const root = host.attachShadow({ mode: "open" });
  let lens = false, raf = 0, dirty = true, slideSrc = null, pairs = [], inner = null, frame = null, lastClone = 0;

  // the deck's own stylesheets, so the clone looks exactly like the slide
  function buildShell() {
    root.innerHTML = "";
    document.querySelectorAll('link[rel="stylesheet"], style').forEach((s) => {
      if (s.tagName === "LINK") { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = s.href; root.append(l); }
      else root.append(s.cloneNode(true));
    });
    const st = document.createElement("style");
    st.textContent = ":host{all:initial} .pt-frame{position:absolute;inset:0;overflow:hidden;background:var(--bg,#fafaf9)}" +
      ".pt-stage{position:absolute;left:0;top:0;width:1920px;height:1080px;transform-origin:0 0}" +
      ".pt-stage .slide{display:flex}";
    root.append(st);
    frame = document.createElement("div");
    frame.className = "pt-frame " + document.body.className; // keeps body-scoped rules (e.g. .deck-spectral #s-gap …)
    inner = document.createElement("div");
    inner.className = "pt-stage";
    frame.append(inner);
    root.append(frame);
  }

  function activeSlide() { return stage.querySelector("section.slide.active"); }

  // clone the active slide; canvases and videos are paired with drawing surfaces in the clone (same order)
  function reclone() {
    dirty = false; lastClone = performance.now();
    const src = activeSlide();
    slideSrc = src; pairs = [];
    if (!inner) buildShell();
    inner.textContent = "";
    if (!src) return;
    const c = src.cloneNode(true);
    c.querySelectorAll("aside.notes").forEach((n) => n.remove());
    // inputs keep their live value, not the attribute
    const si = src.querySelectorAll("input, select, textarea"), ci = c.querySelectorAll("input, select, textarea");
    si.forEach((e, i) => { if (ci[i]) { ci[i].value = e.value; if ("checked" in e) ci[i].checked = e.checked; } });
    // iframes would load a second copy of their page: leave an empty box of the same size instead
    const sf = src.querySelectorAll("iframe"), cf = c.querySelectorAll("iframe");
    cf.forEach((f, i) => { const b = document.createElement("div"); b.className = f.className; b.style.cssText = f.style.cssText;
      if (sf[i]) { b.style.width = sf[i].offsetWidth + "px"; b.style.height = sf[i].offsetHeight + "px"; } b.style.background = "#fff"; f.replaceWith(b); });
    // videos become canvases sized like the original element (the video frame is drawn each tick)
    const sv = src.querySelectorAll("video"), cv = c.querySelectorAll("video");
    cv.forEach((v, i) => {
      const o = sv[i], k = document.createElement("canvas");
      k.className = v.className; k.style.cssText = v.style.cssText;
      if (o) { k.style.width = o.offsetWidth + "px"; k.style.height = o.offsetHeight + "px"; k.style.display = getComputedStyle(o).display; k.style.objectFit = getComputedStyle(o).objectFit; }
      v.replaceWith(k);
      if (o) pairs.push({ src: o, dst: k, video: true });
    });
    const sc = src.querySelectorAll("canvas"), cc = [...c.querySelectorAll("canvas")].filter((k) => !pairs.some((p) => p.dst === k));
    sc.forEach((o, i) => { if (cc[i]) pairs.push({ src: o, dst: cc[i], video: false }); });
    inner.append(c);
    copyPixels();
  }

  function copyPixels() {
    for (const p of pairs) {
      const o = p.src, d = p.dst;
      try {
        if (p.video) {
          const w = o.videoWidth, h = o.videoHeight; if (!w || !h) continue;
          if (d.width !== w || d.height !== h) { d.width = w; d.height = h; }
          d.getContext("2d").drawImage(o, 0, 0, w, h);
        } else {
          if (!o.width || !o.height) continue;
          if (d.width !== o.width || d.height !== o.height) { d.width = o.width; d.height = o.height; }
          const x = d.getContext("2d"); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, d.width, d.height); x.drawImage(o, 0, 0);
        }
      } catch (_) { /* a tainted or detached source: skip this frame */ }
    }
  }

  function placeLens() {
    const r = stage.getBoundingClientRect(), k = r.width / 1920, S = k * ZOOM;
    const sx = (mx - r.left) / k, sy = (my - r.top) / k; // cursor in stage coordinates
    host.style.transform = `translate(${mx - LENS_W / 2}px, ${my - LENS_H / 2}px)`;
    const cw = LENS_W / 2 - BORDER, ch = LENS_H / 2 - BORDER; // centre of the lens content box
    if (inner) inner.style.transform = `translate(${cw - sx * S}px, ${ch - sy * S}px) scale(${S})`;
  }

  function tick() {
    if (!lens) return;
    if (activeSlide() !== slideSrc || (dirty && performance.now() - lastClone > 150)) reclone();
    copyPixels(); placeLens();
    raf = requestAnimationFrame(tick);
  }

  // re-clone when the deck changes slide or reveals a step (class / text changes inside the stage)
  new MutationObserver(() => { if (lens) dirty = true; })
    .observe(stage, { subtree: true, attributes: true, attributeFilter: ["class"], childList: true, characterData: true });

  function setLens(on) {
    lens = on; host.classList.toggle("on", on);
    cancelAnimationFrame(raf);
    if (on) { dirty = true; slideSrc = null; tick(); } else { pairs = []; if (inner) inner.textContent = ""; }
  }

  // ---------- input ----------
  addEventListener("pointermove", (e) => { mx = e.clientX; my = e.clientY; if (laser) placeDot(); if (lens) placeLens(); }, { passive: true, capture: true });
  addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const k = (e.key || "").toLowerCase();
    if (k !== "l" && k !== "m") return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.repeat) return;
    if (k === "l") setLaser(!laser); else setLens(!lens);
  }, true);
  addEventListener("resize", () => { if (lens) placeLens(); });
})();
