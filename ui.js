// ui.js

// ---------- Screen navigation (Home / Rules / Play) ----------
function showScreen(name) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const el = document.getElementById(`screen-${name}`);
  if (el) el.classList.add("active");
}

function bindNavigation() {
  
  if (navBound) return;
  navBound = true;

  // Top nav buttons
  document.querySelectorAll(".navbtn").forEach(btn => {
    btn.addEventListener("click", () => showScreen(btn.dataset.screen));
  });

  // Brand click -> Home
  document.getElementById("brandBtn")?.addEventListener("click", () => showScreen("home"));

  // Home / Rules buttons (exist only in your new layout)
  const modeSingleBtn = document.getElementById("modeSingleBtn");
  const modeH2HBtn = document.getElementById("modeH2HBtn");
  const startBtn = document.getElementById("startBtn");
  const rulesBtn = document.getElementById("rulesBtn");
  const backHomeBtn = document.getElementById("backHomeBtn");
  const playFromRulesBtn = document.getElementById("playFromRulesBtn");

  function setMode(mode) {
    selectedMode = mode;
    modeSingleBtn?.classList.toggle("selected", mode === "single");
    modeH2HBtn?.classList.toggle("selected", mode === "h2h");
  }

  startBtn?.addEventListener("click", () => {
    showScreen("play");
    startNewGameForMode(selectedMode);
  });

  modeSingleBtn?.addEventListener("click", () => setMode("single"));
  modeH2HBtn?.addEventListener("click", () => {
    if (!modeH2HBtn.disabled) setMode("h2h");
  });
  setMode("single");

  document.querySelector('[data-screen="play"]')?.addEventListener("click", () => {
    startNewGameForMode(selectedMode);
  });

  rulesBtn?.addEventListener("click", () => showScreen("rules"));
  backHomeBtn?.addEventListener("click", () => showScreen("home"));
  playFromRulesBtn?.addEventListener("click", () => {
    showScreen("play");
    startNewGameForMode(selectedMode);
  });

  // Show Home on initial load
  showScreen("home");
}
// ------------------------------------------------------------

function probabilityRatioToFormFaces(ratio) {
  const formCount = Number(String(ratio).split(":")[0]);
  const safeCount = Number.isInteger(formCount) && formCount >= 1 && formCount <= 5
    ? formCount
    : 3;
  return new Set(Array.from({ length: safeCount }, (_v, i) => i + 1));
}

function buildFormFacesFromSettings() {
  const next = {};
  for (const c of COLORS) {
    const select = document.querySelector(`[data-color="${c}"]`);
    const ratio = RATIO_OPTIONS.includes(select?.value) ? select.value : DEFAULT_RATIOS[c];
    next[c] = probabilityRatioToFormFaces(ratio);
  }
  return next;
}

function applySettingsToParams() {
  formFaces = buildFormFacesFromSettings();
  params.formFaces = formFaces;

  const frustrationToggle = document.getElementById("frustrationToggle");
  const frustrationThreshold = document.getElementById("frustrationThreshold");
  const threshold = Number(frustrationThreshold?.value);

  params.frustrationEnabled = frustrationToggle?.checked ?? true;
  params.frustrationJ = Number.isInteger(threshold) && threshold >= 2 && threshold <= COLORS.length
    ? threshold
    : 2;
}

function formatElapsed(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function renderTimer() {
  timerValEl.textContent = formatElapsed(elapsedMs);
}

function resetTimer() {
  stopTimer();
  elapsedMs = 0;
  timerStartedAt = null;
  renderTimer();
}

function startTimerIfNeeded() {
  if (timerId || state === UIState.WON) return;
  timerStartedAt = Date.now() - elapsedMs;
  timerId = window.setInterval(() => {
    elapsedMs = Date.now() - timerStartedAt;
    renderTimer();
  }, 250);
  renderTimer();
}

function stopTimer() {
  if (!timerId) return;
  window.clearInterval(timerId);
  timerId = null;
  if (timerStartedAt !== null) elapsedMs = Date.now() - timerStartedAt;
  renderTimer();
}


// ---------- DOM refs for Play screen ----------
const svg = document.getElementById("svg");
const diceRow = document.getElementById("diceRow");
const promptEl = document.getElementById("prompt");
const nextRoundBtn = document.getElementById("nextRoundBtn");
const resetBtn = document.getElementById("resetBtn");
const roundNumEl = document.getElementById("roundNum");
const energyValEl = document.getElementById("energyVal");
const timerValEl = document.getElementById("timerVal");
const energyFill = document.getElementById("energybar-fill");
const frustrationBannerEl = document.getElementById("frustrationBanner");


// ---- parameters (M=4 default) ----
const COLORS = ["r", "y", "p", "b"];
const LABELS = {
  r: { color: "var(--red)", shapeA: "circle", shapeB: "circle" },
  y: { color: "var(--yellow)", shapeA: "triangle", shapeB: "triangle" },
  p: { color: "var(--purple)", shapeA: "diamond", shapeB: "diamond" },
  b: { color: "var(--blue)", shapeA: "square", shapeB: "square" },
};

// Uppercase are complements
const complement = { r: "R", R: "r", y: "Y", Y: "y", p: "P", P: "p", b: "B", B: "b" };

const DEFAULT_RATIOS = {
  r: "2:4",
  y: "5:1",
  p: "3:3",
  b: "4:2",
};

const RATIO_OPTIONS = ["1:5", "2:4", "3:3", "4:2", "5:1"];

// Dice rules
let formFaces = {
  r: new Set([1, 2]),           // red: 1-2 form
  y: new Set([1, 2, 3, 4, 5]),  // yellow: 1-5 form
  p: new Set([1, 2, 3]),        // purple: 1-3 form
  b: new Set([1, 2, 3, 4]),     // blue: 1-4 form
};

// Engine config
const params = {
  N: 12,
  colors: COLORS,
  alphabetA: ["r", "R", "y", "Y", "p", "P", "b", "B"],
  complement,
  crossingAllowed: false,
  K_init: Math.floor(12 / 3),
  setupMaxAttempts: 20000,

  diceSides: 6,
  formFaces,

  frustrationEnabled: true,
  frustrationJ: 2, // doubles across 4 dice
};

const engine = new window.GameEngine(params, 12345);

// ---- UI state machine ----
const UIState = {
  IDLE: "IDLE",
  CHOOSE_ON_BOARD: "CHOOSE_ON_BOARD",
  FORM_PICK_FIRST: "FORM_PICK_FIRST",
  FORM_PICK_SECOND: "FORM_PICK_SECOND",
  UNPAIR_PICK: "UNPAIR_PICK",
  FRUSTRATION: "FRUSTRATION",
  WON: "WON",
};

let state = UIState.IDLE;

// Per-round tracking
let agg = null;                 // { highlight, baseToColorsA, baseToColorsB, bondToColors }
let roundPlan = null;           // { rolls, outcomes }
let dieStatus = {};             // { r: "PENDING"|"DONE"|"PASS", ... }
let activeClass = null;         // current class key
let activeOutcome = null;       // "FORM" | "UNPAIR"
let legalMoves = [];            // current legal moves for active class (pairs [i,j])

// Selection state
let pickedA = null;             // used in FRUSTRATION
let tempCandidatesB = [];       // used in FRUSTRATION
let pickedSide = null;          // "A" or "B"
let pickedIdx = null;           // index on pickedSide
let partnerSide = null;         // "A" or "B"
let partnerCandidates = [];     // indices on partnerSide that are legal
let partnerBlocked = [];        // complementary-but-blocked (crossing) candidates

// Frustration tracking
let frustrationMoves = null;
let frustrationPending = false;
let frustrationBannerShown = false;

// Global game stuff
let selectedMode = "single";
let navBound = false;

// Timer state
let timerStartedAt = null;
let elapsedMs = 0;
let timerId = null;

function showFrustrationBanner() {
  
  if (!frustrationBannerEl) {
    console.warn("frustrationBannerEl is null (banner not found in DOM)");
    return;
  }

  // Ensure it can render
  frustrationBannerEl.classList.remove("hidden");

  // Restart animation reliably
  frustrationBannerEl.classList.remove("show");
  void frustrationBannerEl.offsetWidth; // force reflow

  // Show it
  frustrationBannerEl.classList.add("show");

  // Hide after a moment
  setTimeout(() => {
    frustrationBannerEl.classList.remove("show");
    setTimeout(() => {
      frustrationBannerEl.classList.add("hidden");
    }, 260);
  }, 1200);
}

// ---- geometry for drawing ----
function layoutPoints(N) {
  const leftPad = 60;
  const rightPad = 60;
  const width = 1000 - leftPad - rightPad;
  const dx = width / Math.max(1, (N - 1));
  const yA = 150;
  const yB = 380;
  const xs = Array.from({ length: N }, (_, i) => leftPad + i * dx);
  return { xs, yA, yB };
}

function clearSVG() {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
}

function svgEl(name, attrs = {}) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

function appendHalo(group, x, y, clsKey, haloColor, kind="legal") {
  const haloOpacity = kind === "blocked" ? 0.75 : 0.55;
  const strokeWidth = kind === "blocked" ? 7 : 6;

  let halo;
  if (clsKey === "r") { // circle
    halo = svgEl("circle", {
      cx: x, cy: y, r: 24,
      fill: "none", stroke: haloColor,
      "stroke-width": strokeWidth,
      "stroke-opacity": haloOpacity,
      "pointer-events": "none"
    });
  } else if (clsKey === "b") { // square
    halo = svgEl("rect", {
      x: x - 24, y: y - 24, width: 48, height: 48, rx: 10,
      fill: "none", stroke: haloColor,
      "stroke-width": strokeWidth,
      "stroke-opacity": haloOpacity,
      "pointer-events": "none"
    });
  } else if (clsKey === "p") { // diamond
    halo = svgEl("polygon", {
      points: `${x},${y-26} ${x+26},${y} ${x},${y+26} ${x-26},${y}`,
      fill: "none", stroke: haloColor,
      "stroke-width": strokeWidth,
      "stroke-opacity": haloOpacity,
      "pointer-events": "none"
    });
  } else if (clsKey === "y") { // triangle
    halo = svgEl("polygon", {
      points: `${x},${y-28} ${x+28},${y+24} ${x-28},${y+24}`,
      fill: "none", stroke: haloColor,
      "stroke-width": strokeWidth,
      "stroke-opacity": haloOpacity,
      "pointer-events": "none"
    });
  }

  group.appendChild(halo);
}

function appendBlockedMarker(group, x, y) {
  const lineAttrs = {
    stroke: "rgba(255,255,255,0.95)",
    "stroke-width": 5,
    "stroke-linecap": "round",
    "pointer-events": "none"
  };

  group.appendChild(svgEl("line", {
    x1: x - 13, y1: y - 13, x2: x + 13, y2: y + 13,
    ...lineAttrs
  }));
  group.appendChild(svgEl("line", {
    x1: x + 13, y1: y - 13, x2: x - 13, y2: y + 13,
    ...lineAttrs
  }));
}

function drawBase(x, y, clsKey, isTop, idx, rawLabel, isHighlighted=false, isBlocked=false) {

  const baseColor = LABELS[clsKey].color;
  const isUpper = (rawLabel === rawLabel.toUpperCase());

  // White interior acceptor (upper), colored fill donor (lower)
  const fill = isUpper ? "rgba(225,225,225,1.0)" : baseColor;

  // Keep the outline always in class color for readability
  const stroke = baseColor;

  // Slight thickness bump if highlighted, bigger bump if blocked
  const strokeWidth = isBlocked ? 3.2 : (isHighlighted ? 2.8 : (isUpper ? 2.6 : 2.2));

  const group = svgEl("g", { "data-kind": isTop ? "A" : "B", "data-idx": idx });
  if (isHighlighted) group.style.cursor = "pointer";

  // Mobile-friendly hit target. Only legal highlighted bases receive clicks.
  const hit = svgEl("circle", {
    cx: x,
    cy: y,
    r: 36,
    fill: "transparent",
    stroke: "transparent",
    "data-kind": isTop ? "A" : "B",
    "data-idx": idx,
    "pointer-events": isHighlighted ? "all" : "none"
  });
  group.appendChild(hit);


  // Halo ring behind base for highlight / blocked states
  if (isHighlighted || isBlocked) {
    const haloColor = isBlocked ? "rgba(246,173,85,0.95)" : "rgba(255,255,255,0.9)";
    appendHalo(group, x, y, clsKey, haloColor, isBlocked ? "blocked" : "legal");
  }


  let shape;
  // Pick the geometry by class (not by strand)
  if (clsKey === "r") { // circle
    shape = svgEl("circle", { cx:x, cy:y, r:16, fill, stroke, "stroke-width":strokeWidth, "pointer-events":"none" });
  } else if (clsKey === "b") { // square
    shape = svgEl("rect", { x:x-16, y:y-16, width:32, height:32, rx:6, fill, stroke, "stroke-width":strokeWidth, "pointer-events":"none" });
  } else if (clsKey === "p") { // diamond
    shape = svgEl("polygon", {
      points: `${x},${y-18} ${x+18},${y} ${x},${y+18} ${x-18},${y}`,
      fill, stroke, "stroke-width": strokeWidth, "pointer-events": "none"
    });
  } else if (clsKey === "y") {
    shape = svgEl("polygon", {
      points: `${x},${y-18} ${x+18},${y+18} ${x-18},${y+18}`,
      fill, stroke, "stroke-width": strokeWidth, "pointer-events": "none"
    });
  }

  group.appendChild(shape);

  if (isBlocked) appendBlockedMarker(group, x, y);

  // index label
const labelY = isTop ? (y - 26) : (y + 40);

  const t = svgEl("text", {
    x: x,
    y: labelY,
    "text-anchor": "middle",
    "font-size": 18,
    fill: "rgba(255,255,255,0.55)",
    "pointer-events": "none"
  });
  t.textContent = String(idx + 1);
  group.appendChild(t);
  svg.appendChild(group);
}

function bondPath(x1, y1, x2, y2) {
  // Smooth curve
  const midY = (y1 + y2) / 2;
  const c1y = midY - 80;
  const c2y = midY + 80;
  return `M ${x1} ${y1} C ${x1} ${c1y}, ${x2} ${c2y}, ${x2} ${y2}`;
}

function drawBond(xA, yA, xB, yB, clsKey, correct, stacked, i, j, isHighlighted = false) {
  const stroke = LABELS[clsKey].color;
  const width = correct ? 4 : 3;
  const opacity = correct ? 0.9 : 0.55;
  const glow = stacked ? 1.0 : (correct ? 0.8 : 0.0);

  // Invisible mobile-friendly hitbox
  const hit = svgEl("path", {
    d: bondPath(xA, yA, xB, yB),
    fill: "none",
    stroke: "transparent",
    "stroke-width": 28,
    "stroke-linecap": "round",
    "data-kind": "BOND",
    "data-i": i,
    "data-j": j,
    "pointer-events": isHighlighted ? "stroke" : "none",
    "cursor": isHighlighted ? "pointer" : "default",
  });

  // Visible bond
  const path = svgEl("path", {
    d: bondPath(xA, yA, xB, yB),
    fill: "none",
    stroke,
    "stroke-width": isHighlighted ? (width + 10) : width + 4,
    "stroke-linecap": "round",
    "stroke-opacity": opacity,
    "data-kind": "BOND",
    "data-i": i,
    "data-j": j,
    "pointer-events": "none",
  });

  if (glow > 0) {
    // crude glow via duplicate path behind
    const back = svgEl("path", {
      d: bondPath(xA, yA, xB, yB),
      fill: "none",
      stroke,
      "stroke-width": isHighlighted ? (width + 20) : (width + 15),
      "stroke-linecap": "round",
      "stroke-opacity": 0.35 * glow,
      "pointer-events": "none",
    });
    svg.appendChild(back);
  }

  svg.appendChild(path);
  svg.appendChild(hit);
}

function render(highlight = {}) {
  clearSVG();
  const N = params.N;
  const { xs, yA, yB } = layoutPoints(N);


  // strand lines
  svg.appendChild(svgEl("line", {
    x1: 40, y1: yA-8, x2: 960, y2: yA-8,
    stroke: "rgba(255,255,255,0.10)",
    "stroke-width": 20,
    "stroke-linecap": "round"
  }));
  svg.appendChild(svgEl("line", {
    x1: 40, y1: yB+8, x2: 960, y2: yB+8,
    stroke: "rgba(255,255,255,0.10)",
    "stroke-width": 20,
    "stroke-linecap": "round"
  }));

  // Strand labels
  const labelStyle = {
    "font-size": 42,
    "font-weight": 800,
    fill: "rgba(255,255,255,0.75)",
    "text-anchor": "end"
  };

  const textA = svgEl("text", { x: 35, y: yA - 30, ...labelStyle });
  textA.textContent = "A";
  svg.appendChild(textA);

  const textB = svgEl("text", { x: 35, y: yB + 60, ...labelStyle });
  textB.textContent = "B";
  svg.appendChild(textB);


  // Compute stacks for rendering
  const stackedIdx = new Set();
  for (let i = 0; i < N - 1; i++) {
    if (engine.pairedA[i] === i && engine.pairedA[i + 1] === i + 1) {
      stackedIdx.add(i);
      stackedIdx.add(i + 1);
    }
  }

  // Draw bonds first (behind bases)
  for (let i = 0; i < N; i++) {
    const j = engine.pairedA[i];
    if (j === null) continue;
    const clsKey = engine.A[i].toLowerCase();
    const correct = (i === j);
    const stacked = correct && stackedIdx.has(i);
    const isHL = (highlight.bonds ?? []).some(([hi, hj]) => hi === i && hj === j);
    drawBond(xs[i], yA, xs[j], yB, clsKey, correct, stacked, i, j, isHL);
  }

  // Draw bases
  for (let i = 0; i < N; i++) {
    const labelA = engine.A[i];
    const labelB = engine.B[i];

    const clsA = labelA.toLowerCase();
    const clsB = labelB.toLowerCase();

    const hlA = (highlight.A ?? new Set()).has(i);
    const hlB = (highlight.B ?? new Set()).has(i);
    const blkA = (highlight.Ablocked ?? new Set()).has(i);
    const blkB = (highlight.Bblocked ?? new Set()).has(i);

    drawBase(xs[i], yA, clsA, true, i, labelA, hlA, blkA);
    drawBase(xs[i], yB, clsB, false, i, labelB, hlB, blkB);

  }

}


function updateTopBar() {
  roundNumEl.textContent = String(engine.round);
  const E = engine.energy();
  energyValEl.textContent = String(E);

  // Map energy to bar fraction: 0..(2N-1) magnitude
  const denom = (2 * params.N - 1);
  const frac = Math.min(1, Math.max(0, (-E) / denom));
  energyFill.style.width = `${Math.round(frac * 100)}%`;
}

function renderDice(rolls, outcomes, statusMap = {}, active = null) {
  diceRow.innerHTML = "";

  for (const c of COLORS) {
    const face = rolls?.[c] ?? "-";
    const out = outcomes?.[c] ?? "-";

    const die = document.createElement("div");
    die.className = "die";

    const status = statusMap[c] ?? "PENDING";
    const isPass = (status === "PASS");
    const isDone = (status === "DONE");
    const isPending = (status === "PENDING");

    // Apply visual state classes (this is what enables glow/dim)
    if (isPending) die.classList.add("pending");
    if (isDone) die.classList.add("done");
    if (isPass) die.classList.add("pass");
    if (active === c) die.classList.add("active");

    // Tooltip (only if PASS)
    const passReason = isPass
      ? (out === "FORM"
          ? "PASS: no legal complementary unpaired pair is available right now."
          : "PASS: no paired bond of this class is available to break right now.")
      : "";

    const outText = isPass ? `PASS ${out}` : out;
    const tagClass = isPass ? "pass" : (out === "FORM" ? "form" : "unpair");

    die.innerHTML = `
      <div class="row">
        <div class="label">${c.toUpperCase()}</div>
        <div class="face" style="color:${LABELS[c].color}">${face}</div>
      </div>
      <div class="outcome">
        <span class="tag ${tagClass}">${outText}</span>
      </div>
    `;

    if (isPass) {
      // Put tooltip on parent + inner nodes (some browsers behave better this way)
      die.title = passReason;
      die.querySelector(".tag")?.setAttribute("title", passReason);
      die.querySelector(".face")?.setAttribute("title", passReason);
      die.querySelector(".label")?.setAttribute("title", passReason);

    }

    diceRow.appendChild(die);
  }
}

// ----- round progression -----
function beginRound() {
  if (state === UIState.WON) return;

  applySettingsToParams();
  startTimerIfNeeded();
  promptEl.classList.remove("win");
  clearPickState();
  clearFrustrationSelection();

  roundPlan = engine.startNextRound();

  // Initialize die status for this round
  dieStatus = {};
  for (const c of COLORS) {
    const out = roundPlan.outcomes[c];
    const isPass = (out === "FORM")
      ? (engine.legalFormMoves(c).length === 0)
      : (engine.legalUnpairMoves(c).length === 0);

    dieStatus[c] = isPass ? "PASS" : "PENDING";
  }

  frustrationPending = engine.frustrationTriggers();
  frustrationMoves = null;
  frustrationBannerShown = false;
  nextRoundBtn.disabled = true;
  chooseOnBoard();
}


function buildAggregated() {
  const A = new Set();
  const B = new Set();
  const bonds = [];

  const baseToColorsA = new Map(); // i -> Set(colors)
  const baseToColorsB = new Map(); // j -> Set(colors)
  const bondToColors = new Map();  // "i,j" -> Set(colors)

  for (const c of COLORS) {
    if (dieStatus[c] !== "PENDING") continue;

    const out = roundPlan.outcomes[c];

    if (out === "FORM") {
      const moves = engine.legalFormMoves(c);
      for (const [i, j] of moves) {
        A.add(i);
        B.add(j);

        if (!baseToColorsA.has(i)) baseToColorsA.set(i, new Set());
        baseToColorsA.get(i).add(c);

        if (!baseToColorsB.has(j)) baseToColorsB.set(j, new Set());
        baseToColorsB.get(j).add(c);
      }
    } else {
      const moves = engine.legalUnpairMoves(c);
      for (const [i, j] of moves) {
        bonds.push([i, j]);
        const key = `${i},${j}`;
        if (!bondToColors.has(key)) bondToColors.set(key, new Set());
        bondToColors.get(key).add(c);
      }
    }
  }

  return {
    highlight: { A, B, bonds },
    baseToColorsA,
    baseToColorsB,
    bondToColors
  };
}

// pick next action
function chooseOnBoard() {
  if (maybeWinNow()) return;
  if (state === UIState.FRUSTRATION) return;

  refreshDieStatus();
  const pending = COLORS.filter(c => dieStatus[c] === "PENDING");

  if (pending.length === 0) {
    // End-of-round logic
    if (frustrationPending) {
      frustrationMoves = engine.legalMisalignmentMoves();
      if (frustrationMoves.length) {
        state = UIState.FRUSTRATION;
        clearFrustrationSelection();

        if (!frustrationBannerShown) {
          showFrustrationBanner();
          frustrationBannerShown = true;
        }

        promptEl.textContent = "Frustration Event: select a glowing Strand A base to force one misaligned bond.";
        render(highlightFrustrationFirstPicks(frustrationMoves));
        return;
      }
      frustrationPending = false;
    }

    updateTopBar();
    render();
    if (engine.isPerfect()) {
      maybeWinNow();
    } else {
      state = UIState.IDLE;
      promptEl.textContent = "Round complete. Press “Next Roll!”/Space Bar/Enter to roll again.";
      nextRoundBtn.disabled = false;
    }
    return;
  }

  agg = buildAggregated();

  state = UIState.CHOOSE_ON_BOARD;
  promptEl.textContent = "Make any glowing move on the strands (in any order).";
  render(agg.highlight);
  renderDice(roundPlan.rolls, roundPlan.outcomes, dieStatus);
}

// Refresh helper
function refreshDieStatus() {
  for (const c of COLORS) {
    if (dieStatus[c] === "DONE") continue; // never change DONE within a round

    const out = roundPlan.outcomes[c];
    const hasMoves = (out === "FORM")
      ? (engine.legalFormMoves(c).length > 0)
      : (engine.legalUnpairMoves(c).length > 0);

    dieStatus[c] = hasMoves ? "PENDING" : "PASS";
  }
}

// win now helper
function maybeWinNow() {
  if (!engine.isPerfect()) return false;

  stopTimer();
  state = UIState.WON;
  promptEl.textContent = `🎉 Perfect duplex achieved in ${engine.round} rounds and ${formatElapsed(elapsedMs)}!`;
  nextRoundBtn.disabled = true;
  promptEl.classList.add("win");

  // Optional: clear highlights / render clean final state
  render();
  return true;
}

function clearPickState() {
  activeClass = null;
  activeOutcome = null;
  legalMoves = [];
  pickedSide = null;
  pickedIdx = null;
  partnerSide = null;
  partnerCandidates = [];
  partnerBlocked = [];
}

function clearFrustrationSelection() {
  pickedA = null;
  tempCandidatesB = [];
}


// ----- highlighting helpers -----
function highlightFormMoves(moves) {
  const Aset = new Set();
  const Bset = new Set();
  for (const [i, j] of moves) { Aset.add(i); Bset.add(j); }
  return { A: Aset, B: Bset, bonds: [] };
}

function highlightUnpairMoves(moves) {
  return { A: new Set(), B: new Set(), bonds: moves };
}

function highlightFrustrationFirstPicks(moves) {
  const Aset = new Set();
  for (const [i] of moves) Aset.add(i);
  return { A: Aset, B: new Set(), bonds: [] };
}

function highlightFirstPicksFromLegalMoves(moves) {
  const Aset = new Set();
  const Bset = new Set();
  for (const [i, j] of moves) { Aset.add(i); Bset.add(j); }
  return { A: Aset, B: Bset, bonds: [] };
}

function handleFormFirstPick(kind, idx) {
  // kind is "A" or "B" and we are in FORM_PICK_FIRST
  const possibleLegal = (kind === "A")
    ? legalMoves.filter(([i, _j]) => i === idx)
    : legalMoves.filter(([_i, j]) => j === idx);

  if (!possibleLegal.length) return false;

  pickedSide = kind;
  pickedIdx = idx;

  partnerSide = (pickedSide === "A") ? "B" : "A";
  partnerCandidates = (pickedSide === "A")
    ? possibleLegal.map(([_, j]) => j)
    : possibleLegal.map(([i, _]) => i);

  const allComplement = [];
  if (pickedSide === "A") {
    const needed = params.complement[engine.A[pickedIdx]];
    for (let j = 0; j < params.N; j++) {
      if (engine.pairedB[j] !== null) continue;
      if (engine.B[j] !== needed) continue;
      allComplement.push(j);
    }
  } else {
    const needed = params.complement[engine.B[pickedIdx]];
    for (let i = 0; i < params.N; i++) {
      if (engine.pairedA[i] !== null) continue;
      if (engine.A[i] !== needed) continue;
      allComplement.push(i);
    }
  }

  const legalSet = new Set(partnerCandidates);
  partnerBlocked = allComplement.filter(k => !legalSet.has(k));

  state = UIState.FORM_PICK_SECOND;

  const partnerName = (partnerSide === "A") ? "Strand A" : "Strand B";
  promptEl.textContent = `${activeClass.toUpperCase()}: FORM — select a partner on ${partnerName}. (Orange = blocked by crossing)`;

  const hl = { A: new Set(), B: new Set(), bonds: [] };

  if (pickedSide === "A") hl.A.add(pickedIdx);
  else hl.B.add(pickedIdx);

  if (partnerSide === "A") {
    hl.A = new Set([...hl.A, ...partnerCandidates]);
    hl.Ablocked = new Set(partnerBlocked);
  } else {
    hl.B = new Set([...hl.B, ...partnerCandidates]);
    hl.Bblocked = new Set(partnerBlocked);
  }

  render(hl);
  return true;
}

// ----- click handling -----
svg.addEventListener("click", (ev) => {
  const target = ev.target.closest?.("[data-kind]");
  if (!target) return;

  const kind = target.getAttribute("data-kind");

  // Any-order mode: infer the active color/action from what the user clicked
  if (state === UIState.CHOOSE_ON_BOARD) {

    // Clicking a base implies FORM (only)
    if (kind === "A" || kind === "B") {
      const idx = Number(target.getAttribute("data-idx"));

      const set = (kind === "A")
        ? agg?.baseToColorsA.get(idx)
        : agg?.baseToColorsB.get(idx);

      if (!set || set.size === 0) return;

      const candidates = [...set].filter(c =>
        dieStatus[c] === "PENDING" && roundPlan.outcomes[c] === "FORM"
      );
      if (candidates.length === 0) return;

      // Choose a color (v1: pick first; later we can prompt if multiple)
      activeClass = candidates[0];
      activeOutcome = "FORM";
      renderDice(roundPlan.rolls, roundPlan.outcomes, dieStatus, activeClass);

      // Recompute legal moves *now* (board may have changed)
      legalMoves = engine.legalFormMoves(activeClass);
      if (!legalMoves.length) {
        // This can happen if legality changed since agg was built
        refreshDieStatus();
        renderDice(roundPlan.rolls, roundPlan.outcomes, dieStatus);
        setTimeout(chooseOnBoard, 0);
        return;
      }

      // Immediately consume this click as the first pick
      state = UIState.FORM_PICK_FIRST;
      const ok = handleFormFirstPick(kind, idx);
      if (!ok) {
        // If the click isn't a valid first pick anymore, rebuild highlights
        clearPickState();
        refreshDieStatus();
        setTimeout(chooseOnBoard, 0);
      }
      return;
    }

    // Clicking a bond implies UNPAIR (only) — do it in ONE click
    if (kind === "BOND") {
      const i = Number(target.getAttribute("data-i"));
      const j = Number(target.getAttribute("data-j"));
      const key = `${i},${j}`;

      const set = agg?.bondToColors.get(key);
      if (!set || set.size === 0) return;

      const candidates = [...set].filter(c =>
        dieStatus[c] === "PENDING" && roundPlan.outcomes[c] === "UNPAIR"
      );
      if (candidates.length === 0) return;

      activeClass = candidates[0];
      activeOutcome = "UNPAIR";

      // Must still be legal right now
      legalMoves = engine.legalUnpairMoves(activeClass);
      const ok = legalMoves.some(([li, lj]) => li === i && lj === j);
      if (!ok) {
        refreshDieStatus();
        setTimeout(chooseOnBoard, 0);
        return;
      }

      // Apply immediately
      engine.unpair(i, j);

      // Mark this die resolved for the round
      if (dieStatus[activeClass] === "PENDING") dieStatus[activeClass] = "DONE";

      // Recompute which remaining dice are now possible/impossible
      refreshDieStatus();
      renderDice(roundPlan.rolls, roundPlan.outcomes, dieStatus);

      updateTopBar();
      render();
      if (maybeWinNow()) return;

      setTimeout(chooseOnBoard, 100);
      return;
    }

    return;
  }

  if (state === UIState.FORM_PICK_FIRST && (kind === "A" || kind === "B")) {
    const idx = Number(target.getAttribute("data-idx"));
    handleFormFirstPick(kind, idx);
    return;
  }

  if (state === UIState.FORM_PICK_SECOND && (kind === "A" || kind === "B")) {
    if (kind !== partnerSide) return;

    const idx2 = Number(target.getAttribute("data-idx"));
    if (!partnerCandidates.includes(idx2)) return;

    // Determine i and j for engine.formPair(i, j)
    let i, j;
    if (pickedSide === "A") {
      i = pickedIdx;
      j = idx2;          // partner is B
    } else {
      i = idx2;          // partner is A
      j = pickedIdx;
    }

    engine.formPair(i, j);

    if (dieStatus[activeClass] === "PENDING") dieStatus[activeClass] = "DONE";
    refreshDieStatus();

    renderDice(roundPlan.rolls, roundPlan.outcomes, dieStatus);

    updateTopBar();
    render();

    clearPickState();
    if (maybeWinNow()) return;

    setTimeout(chooseOnBoard, 100);
    return;
  }

  if (state === UIState.UNPAIR_PICK && kind === "BOND") {
    const i = Number(target.getAttribute("data-i"));
    const j = Number(target.getAttribute("data-j"));
    // must be legal for active class
    const ok = legalMoves.some(([li, lj]) => li === i && lj === j);
    if (!ok) return;

    engine.unpair(i, j);
    if (dieStatus[activeClass] === "PENDING") dieStatus[activeClass] = "DONE";
    refreshDieStatus();

    renderDice(roundPlan.rolls, roundPlan.outcomes, dieStatus);

    updateTopBar();
    render();
    clearPickState();
    if (maybeWinNow()) return;

    setTimeout(chooseOnBoard, 100);
    return;
  }

  if (state === UIState.FRUSTRATION) {
    // In frustration, we force a misaligned FORM
    if (kind === "A") {
      const idx = Number(target.getAttribute("data-idx"));
      if (!frustrationMoves) return;

      const possible = frustrationMoves.filter(([i, _j]) => i === idx);

      if (!possible.length) return;

      pickedA = idx;
      tempCandidatesB = possible.map(([_, j]) => j);
      promptEl.textContent = "⚠ Frustration: select a misaligned partner on Strand B.";
      render({ A: new Set([pickedA]), B: new Set(tempCandidatesB), bonds: [] });
      // stay in FRUSTRATION but now awaiting B click
      return;
    }

    if (kind === "B" && pickedA !== null) {
      const j = Number(target.getAttribute("data-idx"));
      if (!tempCandidatesB.includes(j)) return;

      engine.formPair(pickedA, j);

      frustrationPending = false;
      frustrationMoves = null;
      frustrationBannerShown = false;

      clearFrustrationSelection();
      clearPickState();
      updateTopBar();
      render();
      if (maybeWinNow()) return;

      state = UIState.IDLE;
      promptEl.textContent = "Frustration bond formed. Round complete. Press “Next Roll!” to roll again.";
      nextRoundBtn.disabled = false;
      renderDice(roundPlan.rolls, roundPlan.outcomes, dieStatus);
      return;
    }

  
  }
});

function hardResetUIState() {
  resetTimer();
  state = UIState.IDLE;
  roundPlan = null;
  agg = null;

  clearPickState();
  clearFrustrationSelection();

  // frustration
  frustrationPending = false;
  frustrationMoves = null;
  frustrationBannerShown = false;

  // dice state
  dieStatus = {};
}

function startNewGameForMode(mode = "single") {
  // For now, modes share the same core game.
  // Later: mode can alter params, create CPU opponent, etc.
  selectedMode = mode;
  applySettingsToParams();
  engine.reset(params);

  hardResetUIState();

  renderDice({}, {}, {});
  updateTopBar();
  render();

  promptEl.classList.remove("win");
  promptEl.textContent = "Press “Next Roll!” to roll dice.";
  nextRoundBtn.disabled = false;
}


document.addEventListener("DOMContentLoaded", () => {
  try {
    // 1) Wire navigation first (Home/Rules/Play buttons + Start/Mode)
    bindNavigation();

    // 2) Now initialize the game (so Play is ready when you navigate there)
    startNewGameForMode("single");

    // 3) Bind Play-screen controls
    resetBtn.addEventListener("click", () => {
      startNewGameForMode(selectedMode ?? "single");
    });

    nextRoundBtn.addEventListener("click", () => {
      if (state !== UIState.IDLE) return;
      beginRound();
    });

    document.addEventListener("keydown", (e) => {
      if (state !== UIState.IDLE) return;
      if (nextRoundBtn.disabled) return;

      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        nextRoundBtn.click();
      }
    });

  } catch (e) {
    console.error("Boot failed:", e);
  }
});
