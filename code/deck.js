/* Presentation engine: navigation, step reveals, notes, presenter view, overview, videos. */
(function () {
  // Language: index-en.html sets <html lang="en">; the Spanish deck is the default.
  const EN = document.documentElement.lang === "en", tr = (es, en) => (EN ? en : es);
  const slides = [...document.querySelectorAll(".slide")];
  const stage = document.getElementById("stage");
  const FIGS = window.FIGS || {};
  const isPresenter = new URLSearchParams(location.search).has("presenter");
  const chan = "BroadcastChannel" in window ? new BroadcastChannel("flowcv-deck") : null;
  const mainCount = slides.filter((s) => +s.dataset.time > 0).length;
  const maxStep = slides.map((s) => Math.max(0, ...[...s.querySelectorAll("[data-step]")].map((e) => +e.dataset.step)));
  const planStart = []; slides.reduce((acc, s, i) => ((planStart[i] = acc), acc + (+s.dataset.time || 0)), 0);
  const inited = new Set();
  let cur = -1, step = 0;

  const fig = (s) => FIGS[s.id];
  function ensureInit(s) { if (!inited.has(s.id)) { inited.add(s.id); fig(s)?.init?.(s); } }

  // numbering
  slides.forEach((s, i) => { const n = s.querySelector(".num"); if (n) n.textContent = i < mainCount ? `${i + 1} / ${mainCount}` : `R${i - mainCount + 1}`; });

  function fit() { const k = Math.min(innerWidth / 1920, innerHeight / 1080); stage.style.transform = `scale(${k})`; }
  addEventListener("resize", fit); fit();

  function applySteps(s, n) {
    s.querySelectorAll("[data-step]").forEach((e) => e.classList.toggle("shown", n >= +e.dataset.step));
    // .say: show the sentence of the current click (the last span whose data-at is <= n)
    s.querySelectorAll(".say").forEach((p) => { const sp = [...p.querySelectorAll("span[data-at]")]; const c = sp.filter((e) => +e.dataset.at <= n).pop() || sp[0]; sp.forEach((e) => e.classList.toggle("cur", e === c)); });
    fig(s)?.step?.(n);
  }

  function go(i, st = 0, opts = {}) {
    i = Math.max(0, Math.min(slides.length - 1, i));
    const prev = slides[cur];
    if (i !== cur || opts.force) {
      if (prev && i !== cur) { prev.classList.remove("active"); if (inited.has(prev.id)) fig(prev)?.leave?.(); prev.querySelectorAll("video").forEach((v) => { v.pause(); v.closest(".vid")?.classList.remove("playing"); }); }
      cur = i; const s = slides[cur]; ensureInit(s); s.classList.add("active", "entering"); fig(s)?.enter?.(s);
      s.querySelectorAll(".vid[data-video]:not([data-chapters])").forEach((v) => playVid(v, true)); // chapter videos follow the clicks (figs.js)
    }
    step = Math.max(0, Math.min(maxStep[cur], st));
    applySteps(slides[cur], step);
    // a slide revisited keeps last visit's classes: apply the new state without fading in front of the audience
    if (slides[cur].classList.contains("entering")) { const s = slides[cur]; s.offsetWidth; requestAnimationFrame(() => requestAnimationFrame(() => s.classList.remove("entering"))); }
    history.replaceState(null, "", `#${cur + 1}${step ? "." + step : ""}${isPresenter ? "" : ""}`);
    document.getElementById("progress").style.width = `${(Math.min(cur, mainCount - 1) + 1) / mainCount * 100}%`;
    if (document.getElementById("notes").classList.contains("on")) renderNotes();
    if (!opts.remote) chan?.postMessage({ type: "state", cur, step });
    if (isPresenter) renderPresenter();
  }
  function next() { if (step < maxStep[cur]) go(cur, step + 1); else if (cur < slides.length - 1) go(cur + 1, 0); }
  function prev() { if (step > 0) go(cur, step - 1); else if (cur > 0) go(cur - 1, maxStep[cur - 1]); }

  // videos
  function playVid(box, fromStart) {
    const v = box.querySelector("video"); if (!v) return;
    if (fromStart) v.currentTime = 0;
    v.play().then(() => box.classList.add("playing")).catch(() => box.classList.remove("playing"));
    v.onended = () => box.classList.remove("playing");
  }
  // every .vid[data-video] gets a control bar: −5 s, pause, +5 s and a draggable timeline (keys J / K / L)
  const fmtT = (s) => { s = Math.max(0, Math.floor(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
  function seekVid(v, d) { if (!v || !isFinite(v.duration)) return; v.currentTime = Math.max(0, Math.min(v.duration - 0.05, v.currentTime + d)); v.closest(".vid")?.classList.add("playing"); }
  function toggleVid(v) { if (!v) return; const box = v.closest(".vid"); if (v.paused || v.ended) { if (box) playVid(box, v.ended); else v.play(); } else v.pause(); }
  function addVidBar(box) {
    const v = box.querySelector("video"), bar = document.createElement("div");
    bar.className = "vbar"; bar.dataset.clickable = "";
    bar.innerHTML = `<button data-d="-5" title="${tr("Retroceder", "Back")} 5 s (J)">−5 s</button><button class="pp" title="${tr("Pausa / reproducir", "Pause / play")} (K)"></button><button data-d="5" title="${tr("Adelantar", "Forward")} 5 s (L)">+5 s</button><div class="vtrack"><i></i></div><span class="vtime">0:00</span>`;
    box.appendChild(bar);
    const fill = bar.querySelector(".vtrack i"), time = bar.querySelector(".vtime"), track = bar.querySelector(".vtrack");
    const sync = () => { const p = v.duration ? v.currentTime / v.duration : 0; fill.style.width = `${p * 100}%`; time.textContent = `${fmtT(v.currentTime)} / ${fmtT(v.duration)}`; box.classList.toggle("paused", v.paused); };
    ["timeupdate", "loadedmetadata", "play", "pause", "seeked", "ended"].forEach((ev) => v.addEventListener(ev, sync));
    bar.querySelectorAll("[data-d]").forEach((b) => b.addEventListener("click", () => seekVid(v, +b.dataset.d)));
    bar.querySelector(".pp").addEventListener("click", () => toggleVid(v));
    const seekTo = (e) => { const r = track.getBoundingClientRect(); if (isFinite(v.duration)) { v.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * v.duration; box.classList.add("playing"); } };
    track.addEventListener("pointerdown", (e) => { track.setPointerCapture(e.pointerId); seekTo(e); track.onpointermove = seekTo; });
    track.addEventListener("pointerup", () => { track.onpointermove = null; });
    let t; box.addEventListener("pointermove", () => { box.classList.add("vshow"); clearTimeout(t); t = setTimeout(() => box.classList.remove("vshow"), 2500); });
    sync();
  }
  function activeVideo() { return modal?.querySelector("video") || slides[cur].querySelector(".vid[data-video] video"); }
  document.querySelectorAll(".vid[data-video]").forEach((box) => {
    // optional data-rate="0.65" slows (or speeds) a recording; browsers reset playbackRate on load, so reapply it
    const rate = parseFloat(box.dataset.rate);
    if (rate > 0 && rate !== 1) {
      const v = box.querySelector("video"), apply = () => { v.defaultPlaybackRate = rate; if (v.playbackRate !== rate) v.playbackRate = rate; };
      ["loadedmetadata", "play"].forEach((ev) => v.addEventListener(ev, apply)); apply();
    }
    box.querySelector(".play").addEventListener("click", () => playVid(box, box.querySelector("video").ended));
    box.querySelector("video").addEventListener("ended", () => box.classList.remove("playing"));
    addVidBar(box);
  });
  // modal videos
  let modal = null;
  function closeModal() { if (modal) { modal.remove(); modal = null; } }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-open-video]"); if (!b) return;
    closeModal(); modal = document.createElement("div"); modal.id = "vmodal";
    modal.style.cssText = "position:fixed;inset:0;z-index:70;background:rgba(5,7,12,.86);display:grid;place-items:center;cursor:zoom-out";
    modal.innerHTML = `<video src="${b.dataset.openVideo}" autoplay muted playsinline controls style="max-width:88vw;max-height:86vh;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.5)"></video>`;
    modal.addEventListener("click", (ev) => { if (ev.target === modal) closeModal(); });
    document.body.appendChild(modal);
  });
  // Remote control with a mouse: left click = next, right click = previous.
  // Touch: the left half of the screen goes back; the right half advances.
  // Clicks on real controls (buttons, sliders, heatmap, play overlay) keep their own action; a drag never advances.
  let down = null;
  addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY, type: e.pointerType }; }, true);
  addEventListener("click", (e) => {
    if (isPresenter || e.button !== 0) return;
    if (e.target.closest("#vmodal")) return;
    const moved = down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6;
    if (moved || e.target.closest("button, input, select, a, .play, [data-clickable], #overview, #notes, #help")) return;
    const touch = (e.pointerType || down?.type) === "touch";
    if (touch && e.clientX < innerWidth / 2) prev();
    else next();
  });
  addEventListener("contextmenu", (e) => { if (isPresenter) return; e.preventDefault(); if (modal) closeModal(); else prev(); });
  // hide the cursor when the mouse is idle
  let idle; addEventListener("pointermove", () => { document.body.style.cursor = ""; clearTimeout(idle); idle = setTimeout(() => (document.body.style.cursor = "none"), 2500); });

  // keep focus off buttons/sliders so Space and arrows keep driving the deck
  document.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) b.blur(); });
  document.addEventListener("change", (e) => { if (e.target.matches("input[type=range]")) e.target.blur(); });

  // notes overlay
  function notesOf(i) { return (slides[i].querySelector("aside.notes")?.textContent || "").trim(); }
  function renderNotes() {
    const s = slides[cur];
    document.getElementById("notes").innerHTML = `<div class="meta">${cur + 1}. ${s.dataset.title} · ${tr("paso", "step")} ${step}/${maxStep[cur]} · ${tr("objetivo", "target")} ${fmt(+s.dataset.time || 0)} · ${tr("inicia en", "starts at")} ${fmt(planStart[cur])}</div>${esc(notesOf(cur)).replace(/\n/g, "<br>")}`;
  }
  const esc = (t) => t.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const fmt = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

  // overview
  function toggleOverview() {
    const o = document.getElementById("overview");
    if (o.classList.toggle("on")) {
      o.innerHTML = slides.map((s, i) => `<div class="t ${i === cur ? "cur" : ""}" data-i="${i}"><b>${i < mainCount ? i + 1 : "R" + (i - mainCount + 1)} · ${fmt(planStart[i])}</b>${s.dataset.title}</div>`).join("");
      o.querySelectorAll(".t").forEach((t) => (t.onclick = () => { o.classList.remove("on"); go(+t.dataset.i, 0); }));
    }
  }

  // presenter view
  let t0 = null;
  function renderPresenter() {
    const p = document.getElementById("presenter"), s = slides[cur], el = t0 ? (Date.now() - t0) / 1000 : 0, plan = planStart[cur], d = el - plan;
    p.innerHTML = `<div>
        <div class="clock">${fmt(el)}</div>
        <div class="plan">${tr("Plan para esta lámina", "Plan for this slide")}: ${fmt(plan)} → ${fmt(plan + (+s.dataset.time || 0))} · <span class="${d > 20 ? "late" : "ok"}">${t0 ? (d >= 0 ? "+" : "−") + fmt(Math.abs(d)) : tr("pulse Iniciar", "press Start")}</span></div>
        <div class="now">${cur + 1}. ${s.dataset.title}</div><div class="step">${tr("Paso", "Step")} ${step} ${tr("de", "of")} ${maxStep[cur]}</div>
        <div class="txt">${esc(notesOf(cur))}</div>
      </div><div>
        <div class="ctl"><button id="pp">◀</button><button id="pn">▶</button><button id="pt">${t0 ? tr("Reiniciar reloj", "Restart clock") : tr("Iniciar", "Start")}</button></div>
        <div class="next">${tr("Siguiente", "Next")}: ${cur + 1 < slides.length ? slides[cur + 1].dataset.title : "—"}</div>
        <div class="next" style="margin-top:30px">${tr("Plan completo", "Full plan")}: ${slides.filter((x) => +x.dataset.time).map((x, i) => `${i + 1}. ${x.dataset.title} (${fmt(+x.dataset.time)})`).join("<br>")}</div>
      </div>`;
    p.querySelector("#pp").onclick = () => send("prev"); p.querySelector("#pn").onclick = () => send("next");
    p.querySelector("#pt").onclick = () => { t0 = Date.now(); renderPresenter(); };
  }
  function send(cmd) { if (cmd === "next") next(); else prev(); }
  if (isPresenter) { document.body.classList.add("presenter"); setInterval(() => renderPresenter(), 1000); }
  chan && (chan.onmessage = (e) => { const m = e.data; if (m.type === "state" && (m.cur !== cur || m.step !== step)) go(m.cur, m.step, { remote: true }); });

  // keyboard
  addEventListener("keydown", (e) => {
    if (e.target.matches("input,textarea")) { if (["PageDown", "PageUp"].includes(e.key)) e.target.blur(); else return; }
    const k = e.key;
    if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(k)) { e.preventDefault(); closeModal(); next(); }
    else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(k)) { e.preventDefault(); prev(); }
    else if (k === "F5") { e.preventDefault(); if (!document.fullscreenElement) document.documentElement.requestFullscreen(); } // presenter remotes send F5 / Shift+F5 for "start"

    else if ((k === "j" || k === "J" || k === "l" || k === "L") && activeVideo()) { seekVid(activeVideo(), k.toLowerCase() === "j" ? -5 : 5); activeVideo().closest(".vid")?.classList.add("vshow"); }
    else if ((k === "k" || k === "K") && activeVideo()) toggleVid(activeVideo());
    else if (k === "Home") go(0); else if (k === "End") go(mainCount - 1);
    else if (k === "n" || k === "N") { const n = document.getElementById("notes"); if (n.classList.toggle("on")) renderNotes(); }
    else if (k === "o" || k === "O") toggleOverview();
    else if (k === "p" || k === "P") window.open(location.pathname + "?presenter" + location.hash, "flowcv-presenter", "width=1280,height=800");
    else if (k === "f" || k === "F") { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); }
    else if (k === "b" || k === "B" || k === ".") document.getElementById("blackout").classList.toggle("on");
    else if (k === "?" || k === "h") document.getElementById("help").classList.toggle("on");
    else if (k === "Escape") { closeModal(); ["overview", "help", "blackout", "notes"].forEach((id) => document.getElementById(id).classList.remove("on")); }
  });

  // print: show every slide in its final state
  addEventListener("beforeprint", () => slides.forEach((s, i) => { ensureInit(s); s.querySelectorAll("[data-step]").forEach((e) => e.classList.add("shown")); fig(s)?.enter?.(s); fig(s)?.step?.(maxStep[i]); }));
  addEventListener("afterprint", () => go(cur, step, { force: true }));

  addEventListener("hashchange", () => { const q = location.hash.slice(1).split("."); const i = (+q[0] || 1) - 1, st = +q[1] || 0; if (i !== cur || st !== step) go(i, st); });
  const h = location.hash.slice(1).split(".");
  document.fonts.ready.then(() => go((+h[0] || 1) - 1, +h[1] || 0, { force: true }));
  window.DECK = { go, next, prev, slides, maxStep };
})();
