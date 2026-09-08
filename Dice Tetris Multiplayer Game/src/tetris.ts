export const W = 10;
export const H = 20;

export type PieceType = "I" | "O" | "T" | "S" | "Z" | "J" | "L";
export const PIECE_TYPES: PieceType[] = ["I", "O", "T", "S", "Z", "J", "L"];

// Board stores 1-7 (piece id), 0=empty. Negative = ghost.
export const PIECE_ID: Record<PieceType, number> = {
  I: 1, O: 2, T: 3, S: 4, Z: 5, J: 6, L: 7,
};

// Dice face shown (1-6 pips) for each piece type
export const DICE_FACE: Record<number, number> = {
  1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 6,
};

// Dice body color per piece id
export const DICE_COLOR: Record<number, string> = {
  1: "#f0f8ff", // I - alice blue
  2: "#ffe666", // O - gold
  3: "#ecdeff", // T - lavender
  4: "#d4f7d4", // S - mint
  5: "#ff9090", // Z - red
  6: "#c8deff", // J - sky blue
  7: "#ffba80", // L - peach
};

// Pip color per piece id
export const PIP_COLOR: Record<number, string> = {
  1: "#1a3a5c",
  2: "#7a4a00",
  3: "#3a006a",
  4: "#003a00",
  5: "#6a0000",
  6: "#001a6a",
  7: "#5a1e00",
};

const SHAPES: Record<PieceType, number[][]> = {
  I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  O: [[1,1],[1,1]],
  T: [[0,1,0],[1,1,1],[0,0,0]],
  S: [[0,1,1],[1,1,0],[0,0,0]],
  Z: [[1,1,0],[0,1,1],[0,0,0]],
  J: [[1,0,0],[1,1,1],[0,0,0]],
  L: [[0,0,1],[1,1,1],[0,0,0]],
};

export interface Piece {
  type: PieceType;
  cells: number[][];
  x: number;
  y: number;
}

export function emptyBoard(): number[][] {
  return Array.from({ length: H }, () => new Array(W).fill(0));
}

export function randomType(): PieceType {
  return PIECE_TYPES[Math.floor(Math.random() * PIECE_TYPES.length)];
}

export function spawnPiece(type: PieceType): Piece {
  const cells = SHAPES[type].map(r => [...r]);
  const x = Math.floor(W / 2) - Math.floor(cells[0].length / 2);
  return { type, cells, x, y: -2 };
}

export function rotateCW(cells: number[][]): number[][] {
  const rows = cells.length, cols = cells[0].length;
  const out: number[][] = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      out[c][rows - 1 - r] = cells[r][c];
  return out;
}

export function isValid(board: number[][], cells: number[][], x: number, y: number): boolean {
  for (let r = 0; r < cells.length; r++)
    for (let c = 0; c < cells[r].length; c++) {
      if (!cells[r][c]) continue;
      const nx = x + c, ny = y + r;
      if (nx < 0 || nx >= W || ny >= H) return false;
      if (ny >= 0 && board[ny][nx] !== 0) return false;
    }
  return true;
}

export function lockPiece(board: number[][], piece: Piece): number[][] {
  const b = board.map(r => [...r]);
  const id = PIECE_ID[piece.type];
  for (let r = 0; r < piece.cells.length; r++)
    for (let c = 0; c < piece.cells[r].length; c++)
      if (piece.cells[r][c]) {
        const ny = piece.y + r, nx = piece.x + c;
        if (ny >= 0 && ny < H) b[ny][nx] = id;
      }
  return b;
}

export function clearLines(board: number[][]): { board: number[][], cleared: number } {
  const kept = board.filter(row => row.some(c => c === 0));
  const cleared = H - kept.length;
  const empties = Array.from({ length: cleared }, () => new Array(W).fill(0));
  return { board: [...empties, ...kept], cleared };
}

export function ghostY(board: number[][], piece: Piece): number {
  let y = piece.y;
  while (isValid(board, piece.cells, piece.x, y + 1)) y++;
  return y;
}

export function displayBoard(board: number[][], piece: Piece | null): number[][] {
  const d = board.map(r => [...r]);
  if (!piece) return d;
  const gy = ghostY(board, piece);
  const id = PIECE_ID[piece.type];

  // Ghost cells (negative)
  if (gy !== piece.y) {
    for (let r = 0; r < piece.cells.length; r++)
      for (let c = 0; c < piece.cells[r].length; c++)
        if (piece.cells[r][c]) {
          const ny = gy + r, nx = piece.x + c;
          if (ny >= 0 && ny < H && !d[ny][nx]) d[ny][nx] = -id;
        }
  }

  // Active piece
  for (let r = 0; r < piece.cells.length; r++)
    for (let c = 0; c < piece.cells[r].length; c++)
      if (piece.cells[r][c]) {
        const ny = piece.y + r, nx = piece.x + c;
        if (ny >= 0 && ny < H) d[ny][nx] = id;
      }

  return d;
}

export function lineScore(lines: number, level: number): number {
  return ([0, 100, 300, 500, 800][lines] ?? 0) * (level + 1);
}

export function dropMs(level: number): number {
  return Math.max(80, 1000 - level * 85);
}
