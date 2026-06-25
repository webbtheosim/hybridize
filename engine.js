// engine.js
// Pure game logic: no DOM.

function mulberry32(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class GameEngine {
  constructor(params, seed = 12345) {
    this.p = params;
    this.rng = mulberry32(seed);
    this.reset();
  }

  reset(seed = null) {
    if (Number.isInteger(seed)) {
      this.rng = mulberry32(seed >>> 0);
    }

    const { N, alphabetA, complement, K_init } = this.p;
    this.A = Array.from({ length: N }, () => alphabetA[Math.floor(this.rng() * alphabetA.length)]);
    this.B = this.A.map(x => complement[x]);

    this.pairedA = Array.from({ length: N }, () => null);
    this.pairedB = Array.from({ length: N }, () => null);

    this.round = 0;
    this.lastRolls = null;
    this.lastOutcomes = null;

    this.randomInitialPairs(K_init);
  }

  // ----- constraints -----
  isComplement(i, j) {
    return this.B[j] === this.p.complement[this.A[i]];
  }

  wouldCross(iNew, jNew) {
    if (this.p.crossingAllowed) return false;
    for (let i = 0; i < this.p.N; i++) {
      const j = this.pairedA[i];
      if (j === null) continue;
      if ((i < iNew && j > jNew) || (i > iNew && j < jNew)) return true;
    }
    return false;
  }

  // ----- setup -----
  randomInitialPairs(K) {
    const trials = this.p.initialSetupTrials ?? 80;
    const target = Math.min(K, this.p.N);
    const baselineIndices = Array.from({ length: this.p.N }, (_value, i) => i);

    for (let i = baselineIndices.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [baselineIndices[i], baselineIndices[j]] = [baselineIndices[j], baselineIndices[i]];
    }

    this.pairedA.fill(null);
    this.pairedB.fill(null);
    for (const i of baselineIndices.slice(0, target)) {
      this.formPair(i, i);
    }

    let best = {
      pairedA: [...this.pairedA],
      pairedB: [...this.pairedB],
      formed: target,
      mispairs: 0,
      displacement: 0,
    };

    for (let trial = 0; trial < trials; trial++) {
      this.pairedA.fill(null);
      this.pairedB.fill(null);

      // A setup tends left or right, with the direction randomized per trial.
      // Keeping one direction within a trial makes noncrossing offsets easier
      // to build while allowing either orientation across new games.
      const preferredDirection = this.rng() < 0.5 ? -1 : 1;
      let formed = 0;

      while (formed < target) {
        const candidates = [];
        for (let i = 0; i < this.p.N; i++) {
          if (this.pairedA[i] !== null) continue;

          for (let j = 0; j < this.p.N; j++) {
            if (this.pairedB[j] !== null) continue;
            if (!this.isComplement(i, j)) continue;
            if (this.wouldCross(i, j)) continue;
            candidates.push([i, j]);
          }
        }

        if (!candidates.length) break;

        const misaligned = candidates.filter(([i, j]) => i !== j);
        const directed = misaligned.filter(([i, j]) =>
          Math.sign(j - i) === preferredDirection
        );
        const pool = directed.length ? directed : (misaligned.length ? misaligned : candidates);
        const [i, j] = pool[Math.floor(this.rng() * pool.length)];

        this.formPair(i, j);
        formed++;
      }

      let mispairs = 0;
      let displacement = 0;
      for (let i = 0; i < this.p.N; i++) {
        const j = this.pairedA[i];
        if (j === null || i === j) continue;
        mispairs++;
        displacement += Math.abs(j - i);
      }

      const candidate = {
        pairedA: [...this.pairedA],
        pairedB: [...this.pairedB],
        formed,
        mispairs,
        displacement,
      };

      const isBetter = !best
        || candidate.formed > best.formed
        || (candidate.formed === best.formed && candidate.mispairs > best.mispairs)
        || (candidate.formed === best.formed
          && candidate.mispairs === best.mispairs
          && candidate.displacement > best.displacement);
      const isTied = best
        && candidate.formed === best.formed
        && candidate.mispairs === best.mispairs
        && candidate.displacement === best.displacement;

      if (isBetter || (isTied && this.rng() < 0.5)) {
        best = candidate;
      }
    }

    this.pairedA = best?.pairedA ?? Array.from({ length: this.p.N }, () => null);
    this.pairedB = best?.pairedB ?? Array.from({ length: this.p.N }, () => null);
  }

  // ----- move generation -----
  colorOfLabel(label) {
    // Map any label to its "class key" (lowercase key in colors)
    // Example: "r" or "R" -> "r"
    const lower = label.toLowerCase();
    return this.p.colors.includes(lower) ? lower : null;
  }

  legalFormMoves(colorKey) {
    const moves = [];
    const N = this.p.N;
    for (let i = 0; i < N; i++) {
      if (this.pairedA[i] !== null) continue;
      if (this.colorOfLabel(this.A[i]) !== colorKey) continue;

      const needed = this.p.complement[this.A[i]];
      for (let j = 0; j < N; j++) {
        if (this.pairedB[j] !== null) continue;
        if (this.B[j] !== needed) continue;
        if (!this.wouldCross(i, j)) moves.push([i, j]);
      }
    }
    return moves;
  }

  legalUnpairMoves(colorKey) {
    const moves = [];
    const N = this.p.N;
    for (let i = 0; i < N; i++) {
      const j = this.pairedA[i];
      if (j === null) continue;
      if (this.colorOfLabel(this.A[i]) === colorKey) moves.push([i, j]);
    }
    return moves;
  }

  legalMisalignmentMoves() {
    const all = [];
    for (const c of this.p.colors) {
      for (const [i, j] of this.legalFormMoves(c)) {
        if (i !== j) all.push([i, j]);
      }
    }
    return all;
  }

  // ----- apply moves -----
  formPair(i, j) {
    if (this.pairedA[i] !== null || this.pairedB[j] !== null) throw new Error("Not unpaired.");
    if (!this.isComplement(i, j)) throw new Error("Not complementary.");
    if (this.wouldCross(i, j)) throw new Error("Would cross.");
    this.pairedA[i] = j;
    this.pairedB[j] = i;
  }

  unpair(i, j) {
    if (this.pairedA[i] !== j || this.pairedB[j] !== i) throw new Error("Not paired.");
    this.pairedA[i] = null;
    this.pairedB[j] = null;
  }

  // ----- energy -----
  counts() {
    const N = this.p.N;
    let Np = 0;
    let Nstack = 0;
    for (let i = 0; i < N; i++) if (this.pairedA[i] !== null) Np++;
    for (let i = 0; i < N - 1; i++) {
      if (this.pairedA[i] === i && this.pairedA[i + 1] === i + 1) Nstack++;
    }
    return { Np, Nstack };
  }

  energy() {
    const { Np, Nstack } = this.counts();
    return -(Np + Nstack);
  }

  isPerfect() {
    for (let i = 0; i < this.p.N; i++) if (this.pairedA[i] !== i) return false;
    return true;
  }

  // ----- dice -----
  rollDice() {
    const rolls = {};
    for (const c of this.p.colors) {
      const face = 1 + Math.floor(this.rng() * this.p.diceSides);
      rolls[c] = face;
    }
    this.lastRolls = rolls;

    const outcomes = {};
    for (const c of this.p.colors) {
      outcomes[c] = this.p.formFaces[c].has(rolls[c]) ? "FORM" : "UNPAIR";
    }
    this.lastOutcomes = outcomes;
    return { rolls, outcomes };
  }

  frustrationTriggers() {
    if (!this.p.frustrationEnabled) return false;
    const faces = Object.values(this.lastRolls ?? {});
    const counts = new Map();
    for (const f of faces) counts.set(f, (counts.get(f) ?? 0) + 1);
    for (const v of counts.values()) if (v >= this.p.frustrationJ) return true;
    return false;
  }

  startNextRound() {
    this.round += 1;
    return this.rollDice();
  }
}

// Export to window for ui.js
window.GameEngine = GameEngine;
