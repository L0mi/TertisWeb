"use strict";

window.TertisEngine = (() => {
  const WIDTH = 10, VISIBLE = 20, HEIGHT = 40;
  const COLORS = { I: "#1fd1f0", O: "#fcd12e", T: "#ab5ce6", S: "#40cc6e", Z: "#f04752", J: "#3d6eeb", L: "#f58c33", G: "#616161" };
  const SHAPES = {
    I: [[[0,1],[1,1],[2,1],[3,1]],[[2,0],[2,1],[2,2],[2,3]]],
    O: [[[1,0],[2,0],[1,1],[2,1]]],
    T: [[[0,1],[1,1],[2,1],[1,0]],[[1,0],[1,1],[2,1],[1,2]],[[1,2],[0,1],[1,1],[2,1]],[[1,0],[0,1],[1,1],[1,2]]],
    S: [[[1,0],[2,0],[0,1],[1,1]],[[1,0],[1,1],[2,1],[2,2]]],
    Z: [[[0,0],[1,0],[1,1],[2,1]],[[2,0],[1,1],[2,1],[1,2]]],
    J: [[[0,0],[0,1],[1,1],[2,1]],[[1,0],[2,0],[1,1],[1,2]],[[0,1],[1,1],[2,1],[2,2]],[[1,0],[1,1],[0,2],[1,2]]],
    L: [[[2,0],[0,1],[1,1],[2,1]],[[1,0],[1,1],[1,2],[2,2]],[[0,1],[1,1],[2,1],[0,2]],[[0,0],[1,0],[1,1],[1,2]]]
  };
  const KINDS = Object.keys(SHAPES);

  class RNG {
    constructor(seed = Date.now()) { this.seed = seed >>> 0 || 1; }
    next() { this.seed = (Math.imul(1664525, this.seed) + 1013904223) >>> 0; return this.seed / 4294967296; }
    int(max) { return Math.floor(this.next() * max); }
  }

  class Board {
    constructor(seed) { this.rng = new RNG(seed); this.reset(); }
    reset(seed) {
      if (seed != null) this.rng = new RNG(seed);
      this.cells = Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(null));
      this.piece = null; this.hold = null; this.next = this.randomKind(); this.canHold = true;
      this.gameOver = false; this.score = 0; this.lines = 0; this.pieceId = 0; this.spawn();
    }
    randomKind() { return KINDS[this.rng.int(KINDS.length)]; }
    spawn(requested = null) {
      this.pieceId++;
      const kind = requested || this.next;
      if (!requested) this.next = this.randomKind();
      const candidate = { kind, rotation: 0, x: 3, y: 19 };
      if (this.valid(candidate)) this.piece = candidate;
      else { this.piece = null; this.gameOver = true; }
    }
    clonePiece(piece = this.piece) { return piece ? { ...piece } : null; }
    blocks(piece = this.piece) {
      if (!piece) return [];
      return SHAPES[piece.kind][piece.rotation].map(([x,y]) => [piece.x + x, piece.y + y]);
    }
    valid(piece) {
      return this.blocks(piece).every(([x,y]) => x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT && !this.cells[y][x]);
    }
    move(dx, dy) {
      if (!this.piece || this.gameOver) return false;
      const candidate = { ...this.piece, x: this.piece.x + dx, y: this.piece.y + dy };
      if (!this.valid(candidate)) return false;
      this.piece = candidate; return true;
    }
    rotate() {
      if (!this.piece || this.gameOver) return false;
      for (const kick of [0,-1,1,-2,2]) {
        const candidate = { ...this.piece, rotation: (this.piece.rotation + 1) % SHAPES[this.piece.kind].length, x: this.piece.x + kick };
        if (this.valid(candidate)) { this.piece = candidate; return true; }
      }
      return false;
    }
    ghost() {
      let result = this.clonePiece();
      if (!result) return null;
      while (this.valid({ ...result, y: result.y - 1 })) result.y--;
      return result;
    }
    hardDrop() {
      let distance = 0;
      while (this.move(0, -1)) distance++;
      this.score += distance * 2;
      return this.lock();
    }
    tick() { return this.move(0, -1) ? null : this.lock(); }
    useHold() {
      if (!this.canHold || !this.piece || this.gameOver) return false;
      const previous = this.hold; this.hold = this.piece.kind; this.piece = null; this.canHold = false;
      this.spawn(previous); return true;
    }
    revealIfHidden() {
      if (!this.piece) return;
      while (this.blocks().every(([,y]) => y >= VISIBLE)) {
        const candidate = { ...this.piece, y: this.piece.y - 1 };
        if (!this.valid(candidate)) break;
        this.piece = candidate;
      }
    }
    lock() {
      if (!this.piece) return 0;
      const kind = this.piece.kind;
      for (const [x,y] of this.blocks()) if (y >= 0 && y < HEIGHT) this.cells[y][x] = kind;
      this.piece = null;
      const cleared = this.clearLines(); this.canHold = true;
      if (this.hiddenOccupied()) { this.gameOver = true; return cleared; }
      this.spawn(); return cleared;
    }
    clearLines() {
      const kept = this.cells.filter(row => row.some(cell => !cell));
      const count = HEIGHT - kept.length;
      while (kept.length < HEIGHT) kept.push(Array(WIDTH).fill(null));
      this.cells = kept;
      if (count) {
        this.lines += count;
        const level = Math.max(1, Math.floor(this.lines / 10) + 1);
        this.score += [0,100,300,500,800][Math.min(count,4)] * level;
      }
      return count;
    }
    addGarbage(count) {
      for (let n = 0; n < count && !this.gameOver; n++) {
        this.cells.pop();
        const hole = this.rng.int(WIDTH);
        this.cells.unshift(Array.from({length: WIDTH}, (_, x) => x === hole ? null : "G"));
        if (this.piece) {
          const raised = { ...this.piece, y: this.piece.y + 1 };
          if (this.valid(raised)) this.piece = raised;
          else { this.gameOver = true; this.piece = null; }
        }
        if (this.hiddenOccupied()) { this.gameOver = true; this.piece = null; }
      }
    }
    hiddenOccupied() { return this.cells.slice(VISIBLE).some(row => row.some(Boolean)); }
    visibleState() {
      const cells = Array.from({ length: VISIBLE }, (_, y) => this.cells[y].map(Boolean));
      for (const [x,y] of this.blocks()) if (y >= 0 && y < VISIBLE && x >= 0 && x < WIDTH) cells[y][x] = true;
      return { cells, score: this.score, lines: this.lines, gameOver: this.gameOver };
    }
  }
  return { Board, SHAPES, COLORS, WIDTH, VISIBLE, HEIGHT, RNG };
})();
