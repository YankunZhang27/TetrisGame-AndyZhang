import { useCallback, useEffect, useRef, useState } from "react";
import Board from "./Board";
import DiceBlock from "./DiceBlock";
import {
  W,
  clearLines,
  displayBoard,
  dropMs,
  emptyBoard,
  ghostY,
  isValid,
  lineScore,
  lockPiece,
  randomType,
  rotateCW,
  spawnPiece,
  PIECE_TYPES,
  PIECE_ID,
  DICE_COLOR,
  type Piece,
  type PieceType,
} from "./tetris";

interface RemotePlayer {
  playerId: string;
  name: string;
  board: number[][];
  score: number;
  lines: number;
  level: number;
  dead: boolean;
  ts: number;
}

type Phase = "lobby" | "countdown" | "playing" | "dead" | "done";

interface Props {
  playerId: string;
  name: string;
  roomCode: string;
  isHost: boolean;
  onLeave: () => void;
}

// 4x4 preview board for next piece
function NextPiece({ type }: { type: PieceType }) {
  const preview = Array.from({ length: 4 }, () => new Array(4).fill(0));
  const piece = spawnPiece(type);
  const id = PIECE_ID[type];
  for (let r = 0; r < piece.cells.length; r++)
    for (let c = 0; c < piece.cells[r].length; c++)
      if (piece.cells[r][c]) {
        const nr = r + (type === "I" ? 0 : 1);
        const nc = c + (type === "O" ? 1 : type === "I" ? 0 : 0);
        if (nr < 4 && nc < 4) preview[nr][nc] = id;
      }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 18px)",
        gridTemplateRows: "repeat(4, 18px)",
        gap: 1,
        backgroundColor: "#071409",
        padding: 4,
        border: "1px solid #1e3a20",
        borderRadius: 4,
      }}
    >
      {preview.flat().map((cell, i) => (
        <DiceBlock key={i} cellId={cell} size={18} />
      ))}
    </div>
  );
}

export default function GameScreen({ playerId, name, roomCode, isHost, onLeave }: Props) {
  // ── game state kept in refs (mutated in RAF loop) ──
  const boardRef = useRef(emptyBoard());
  const pieceRef = useRef<Piece | null>(null);
  const nextRef = useRef<PieceType>(randomType());
  const scoreRef = useRef(0);
  const linesRef = useRef(0);
  const levelRef = useRef(0);
  const deadRef = useRef(false);
  const phaseRef = useRef<Phase>("lobby");
  const lastDropRef = useRef(0);

  // ── display state (triggers renders) ──
  const [visBoard, setVisBoard] = useState<number[][]>(emptyBoard());
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(0);
  const [next, setNext] = useState<PieceType>("I");
  const [phase, setPhase] = useState<Phase>("lobby");
  const [countdown, setCountdown] = useState(3);
  const [remotes, setRemotes] = useState<Map<string, RemotePlayer>>(new Map());

  const chRef = useRef<BroadcastChannel | null>(null);
  const rafRef = useRef(0);
  const keysRef = useRef(new Set<string>());
  const dasTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dasIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── sync refs → display ──
  const syncVis = useCallback(() => {
    setVisBoard(displayBoard(boardRef.current, pieceRef.current));
    setScore(scoreRef.current);
    setLines(linesRef.current);
    setLevel(levelRef.current);
    setNext(nextRef.current);
  }, []);

  // ── broadcast our state ──
  const broadcast = useCallback(() => {
    chRef.current?.postMessage({
      type: "state",
      playerId,
      name,
      board: displayBoard(boardRef.current, pieceRef.current),
      score: scoreRef.current,
      lines: linesRef.current,
      level: levelRef.current,
      dead: deadRef.current,
    });
  }, [playerId, name]);

  // ── spawn next piece, returns false if game over ──
  const spawnNext = useCallback((): boolean => {
    const type = nextRef.current;
    nextRef.current = randomType();
    const piece = spawnPiece(type);
    if (!isValid(boardRef.current, piece.cells, piece.x, piece.y + 2)) {
      deadRef.current = true;
      phaseRef.current = "dead";
      setPhase("dead");
      broadcast();
      return false;
    }
    pieceRef.current = piece;
    return true;
  }, [broadcast]);

  // ── lock active piece ──
  const lockActive = useCallback(() => {
    const p = pieceRef.current;
    if (!p) return;
    const locked = lockPiece(boardRef.current, p);
    const { board: cleared, cleared: n } = clearLines(locked);
    boardRef.current = cleared;
    scoreRef.current += lineScore(n, levelRef.current);
    linesRef.current += n;
    levelRef.current = Math.floor(linesRef.current / 10);
    pieceRef.current = null;
    spawnNext();
    syncVis();
    broadcast();
  }, [spawnNext, syncVis, broadcast]);

  // ── move ──
  const move = useCallback(
    (dx: number, dy: number) => {
      if (phaseRef.current !== "playing" || !pieceRef.current) return false;
      const p = pieceRef.current;
      if (isValid(boardRef.current, p.cells, p.x + dx, p.y + dy)) {
        p.x += dx;
        p.y += dy;
        syncVis();
        return true;
      }
      if (dy > 0) lockActive();
      return false;
    },
    [syncVis, lockActive]
  );

  // ── rotate ──
  const rotate = useCallback(() => {
    if (phaseRef.current !== "playing" || !pieceRef.current) return;
    const p = pieceRef.current;
    const rotated = rotateCW(p.cells);
    for (const kick of [0, 1, -1, 2, -2]) {
      if (isValid(boardRef.current, rotated, p.x + kick, p.y)) {
        p.cells = rotated;
        p.x += kick;
        syncVis();
        return;
      }
    }
  }, [syncVis]);

  // ── hard drop ──
  const hardDrop = useCallback(() => {
    if (phaseRef.current !== "playing" || !pieceRef.current) return;
    const p = pieceRef.current;
    const gy = ghostY(boardRef.current, p);
    scoreRef.current += (gy - p.y) * 2;
    p.y = gy;
    lockActive();
  }, [lockActive]);

  // ── keyboard ──
  useEffect(() => {
    const clearDas = () => {
      if (dasTimerRef.current) clearTimeout(dasTimerRef.current);
      if (dasIntervalRef.current) clearInterval(dasIntervalRef.current);
      dasTimerRef.current = null;
      dasIntervalRef.current = null;
    };

    const startDas = (fn: () => void) => {
      clearDas();
      dasTimerRef.current = setTimeout(() => {
        dasIntervalRef.current = setInterval(fn, 40);
      }, 160);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (["ArrowLeft","ArrowRight","ArrowDown","ArrowUp"," ","z","Z"].includes(e.key))
        e.preventDefault();
      if (keysRef.current.has(e.key)) return;
      keysRef.current.add(e.key);
      switch (e.key) {
        case "ArrowLeft":  move(-1, 0); startDas(() => move(-1, 0)); break;
        case "ArrowRight": move(1, 0);  startDas(() => move(1, 0));  break;
        case "ArrowDown":  move(0, 1);  startDas(() => move(0, 1));  break;
        case "ArrowUp": case "z": case "Z": rotate(); break;
        case " ": hardDrop(); break;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key);
      if (["ArrowLeft","ArrowRight","ArrowDown"].includes(e.key)) {
        if (dasTimerRef.current) clearTimeout(dasTimerRef.current);
        if (dasIntervalRef.current) clearInterval(dasIntervalRef.current);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      clearDas();
    };
  }, [move, rotate, hardDrop]);

  // ── RAF game loop ──
  const gameLoop = useCallback(
    (ts: number) => {
      if (phaseRef.current === "playing" && !deadRef.current) {
        if (ts - lastDropRef.current > dropMs(levelRef.current)) {
          lastDropRef.current = ts;
          move(0, 1);
        }
      }
      rafRef.current = requestAnimationFrame(gameLoop);
    },
    [move]
  );

  useEffect(() => {
    rafRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [gameLoop]);

  // ── periodic broadcast ──
  useEffect(() => {
    const t = setInterval(broadcast, 200);
    return () => clearInterval(t);
  }, [broadcast]);

  // ── start countdown ──
  const beginCountdown = useCallback(() => {
    phaseRef.current = "countdown";
    setPhase("countdown");
    let c = 3;
    setCountdown(c);
    const t = setInterval(() => {
      c--;
      setCountdown(c);
      if (c <= 0) {
        clearInterval(t);
        boardRef.current = emptyBoard();
        scoreRef.current = 0;
        linesRef.current = 0;
        levelRef.current = 0;
        deadRef.current = false;
        nextRef.current = randomType();
        pieceRef.current = null;
        const ok = spawnNext();
        if (ok) {
          phaseRef.current = "playing";
          setPhase("playing");
          lastDropRef.current = performance.now();
          syncVis();
        }
      }
    }, 1000);
  }, [spawnNext, syncVis]);

  // ── BroadcastChannel ──
  useEffect(() => {
    const ch = new BroadcastChannel(`dice-tetris-${roomCode}`);
    chRef.current = ch;

    ch.onmessage = ({ data: msg }) => {
      if (msg.playerId === playerId) return;

      if (msg.type === "join") {
        // reply with our state so new joiner sees us
        ch.postMessage({
          type: "state",
          playerId,
          name,
          board: displayBoard(boardRef.current, pieceRef.current),
          score: scoreRef.current,
          lines: linesRef.current,
          level: levelRef.current,
          dead: deadRef.current,
        });
      }

      if (msg.type === "state") {
        setRemotes((prev) => {
          const next = new Map(prev);
          next.set(msg.playerId, {
            playerId: msg.playerId,
            name: msg.name,
            board: msg.board,
            score: msg.score,
            lines: msg.lines,
            level: msg.level,
            dead: msg.dead,
            ts: Date.now(),
          });
          return next;
        });
      }

      if (msg.type === "start" && phaseRef.current === "lobby") {
        beginCountdown();
      }

      if (msg.type === "leave") {
        setRemotes((prev) => {
          const next = new Map(prev);
          next.delete(msg.playerId);
          return next;
        });
      }
    };

    ch.postMessage({ type: "join", playerId, name });

    return () => {
      ch.postMessage({ type: "leave", playerId });
      ch.close();
    };
  }, [playerId, name, roomCode, beginCountdown]);

  // Prune stale remote players
  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      setRemotes((prev) => {
        let changed = false;
        const next = new Map(prev);
        for (const [id, p] of prev) {
          if (now - p.ts > 5000) { next.delete(id); changed = true; }
        }
        return changed ? next : prev;
      });
    }, 2000);
    return () => clearInterval(t);
  }, []);

  const remotePlayers = Array.from(remotes.values());
  const totalPlayers = 1 + remotePlayers.length;

  const handleStart = () => {
    chRef.current?.postMessage({ type: "start" });
    beginCountdown();
  };

  const handleLeave = () => {
    chRef.current?.postMessage({ type: "leave", playerId });
    onLeave();
  };

  // Leaderboard sorted by score
  const allPlayers = [
    { playerId, name, score: scoreRef.current, dead: deadRef.current, isMe: true },
    ...remotePlayers.map((r) => ({ ...r, isMe: false })),
  ].sort((a, b) => b.score - a.score);

  return (
    <div
      className="min-h-screen flex flex-col items-center"
      style={{ background: "linear-gradient(160deg, #0b1d0d 0%, #0d2210 50%, #071408 100%)" }}
    >
      {/* Header */}
      <header className="w-full flex items-center justify-between px-8 py-4" style={{ borderBottom: "1px solid #1e3a20" }}>
        <div className="flex items-center gap-3">
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: "1.5rem", color: "#d4af37", fontStyle: "italic" }}>
            ⚃ Dice Tetris
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span style={{ fontSize: "0.8rem", color: "#4a7a4a" }}>Room</span>
          <span
            style={{
              fontFamily: "'Outfit', monospace",
              fontSize: "1.1rem",
              fontWeight: 700,
              color: "#d4af37",
              letterSpacing: "0.18em",
              padding: "2px 10px",
              background: "#1a2e1a",
              border: "1px solid #2e5a2e",
              borderRadius: 4,
            }}
          >
            {roomCode}
          </span>
          <button
            onClick={handleLeave}
            style={{
              padding: "4px 12px",
              background: "transparent",
              color: "#4a6a4a",
              border: "1px solid #2a4a2a",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: "0.78rem",
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            Leave
          </button>
        </div>
      </header>

      {/* Lobby overlay */}
      {phase === "lobby" && (
        <div
          className="flex flex-col items-center justify-center gap-6"
          style={{ flex: 1, padding: "48px 32px" }}
        >
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: "2rem", color: "#d4af37", fontStyle: "italic" }}>
            Waiting Room
          </div>
          <div
            style={{
              background: "#0f2410",
              border: "1px solid #2a4a2a",
              borderRadius: 8,
              padding: "24px 40px",
              textAlign: "center",
              minWidth: 280,
            }}
          >
            <div style={{ color: "#9a9a80", fontSize: "0.8rem", marginBottom: 8 }}>
              Players connected
            </div>
            <div style={{ color: "#d4af37", fontSize: "2.5rem", fontWeight: 700, fontFamily: "'Outfit', sans-serif" }}>
              {totalPlayers}
            </div>
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              {[{ name, isMe: true }, ...remotePlayers].map((p, i) => (
                <div key={i} style={{ fontSize: "0.9rem", color: "isMe" in p && p.isMe ? "#d4af37" : "#b0a880" }}>
                  {"isMe" in p && p.isMe ? "▸ " : "  "}{p.name}
                </div>
              ))}
            </div>
          </div>
          <div style={{ color: "#4a7a4a", fontSize: "0.8rem", textAlign: "center", maxWidth: 260 }}>
            Open this app in another browser tab and enter room code <strong style={{ color: "#7aaa7a" }}>{roomCode}</strong> to add players.
          </div>
          {isHost ? (
            <button
              onClick={handleStart}
              style={{
                padding: "12px 48px",
                background: "linear-gradient(135deg, #c8a020, #d4af37)",
                color: "#0d1f0f",
                border: "none",
                borderRadius: 6,
                fontFamily: "'Outfit', sans-serif",
                fontWeight: 700,
                fontSize: "1rem",
                cursor: "pointer",
                boxShadow: "0 4px 16px rgba(212,175,55,0.3)",
                letterSpacing: "0.05em",
              }}
            >
              {totalPlayers === 1 ? "Play Solo" : "Start Game"}
            </button>
          ) : (
            <div style={{ color: "#4a6a4a", fontSize: "0.85rem" }}>
              Waiting for host to start…
            </div>
          )}
        </div>
      )}

      {/* Countdown */}
      {phase === "countdown" && (
        <div
          className="flex flex-col items-center justify-center"
          style={{ flex: 1 }}
        >
          <div
            style={{
              fontFamily: "'Fraunces', serif",
              fontSize: "8rem",
              color: "#d4af37",
              fontStyle: "italic",
              lineHeight: 1,
              textShadow: "0 0 60px rgba(212,175,55,0.4)",
              transition: "all 0.3s",
            }}
          >
            {countdown}
          </div>
          <div style={{ color: "#4a7a4a", marginTop: 8, fontFamily: "'Outfit', sans-serif" }}>
            Get ready…
          </div>
        </div>
      )}

      {/* Game layout */}
      {(phase === "playing" || phase === "dead" || phase === "done") && (
        <div className="flex items-start justify-center gap-6 flex-wrap" style={{ padding: "24px 16px", flex: 1 }}>
          {/* My panel */}
          <div className="flex flex-col items-center gap-3">
            <div style={{ fontSize: "0.85rem", color: "#d4af37", fontWeight: 600, fontFamily: "'Outfit', sans-serif" }}>
              {name} <span style={{ color: "#4a7a4a", fontSize: "0.75rem" }}>(you)</span>
            </div>

            <div style={{ position: "relative" }}>
              <Board board={visBoard} cellSize={28} dim={phase === "dead"} />
              {phase === "dead" && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 6,
                    backgroundColor: "rgba(0,0,0,0.65)",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'Fraunces', serif",
                      fontSize: "1.6rem",
                      color: "#ff6060",
                      fontStyle: "italic",
                      textShadow: "0 0 20px rgba(255,80,80,0.5)",
                    }}
                  >
                    Game Over
                  </div>
                </div>
              )}
            </div>

            {/* Stats + next */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                width: "100%",
              }}
            >
              {/* Score panel */}
              <div
                style={{
                  background: "#0f2410",
                  border: "1px solid #1e3a20",
                  borderRadius: 6,
                  padding: "8px 12px",
                  gridColumn: "1 / -1",
                }}
              >
                <div style={{ color: "#4a7a4a", fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>Score</div>
                <div style={{ color: "#d4af37", fontSize: "1.4rem", fontWeight: 700, fontFamily: "'Outfit', sans-serif" }}>
                  {score.toLocaleString()}
                </div>
                <div style={{ display: "flex", gap: 16, marginTop: 2 }}>
                  <span style={{ color: "#4a7a4a", fontSize: "0.72rem" }}>
                    Lines <span style={{ color: "#b0c8a0" }}>{lines}</span>
                  </span>
                  <span style={{ color: "#4a7a4a", fontSize: "0.72rem" }}>
                    Lv <span style={{ color: "#b0c8a0" }}>{level}</span>
                  </span>
                </div>
              </div>

              {/* Next piece */}
              <div
                style={{
                  background: "#0f2410",
                  border: "1px solid #1e3a20",
                  borderRadius: 6,
                  padding: "8px 12px",
                }}
              >
                <div style={{ color: "#4a7a4a", fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Next</div>
                <NextPiece type={next} />
              </div>

              {/* Controls */}
              <div
                style={{
                  background: "#0f2410",
                  border: "1px solid #1e3a20",
                  borderRadius: 6,
                  padding: "8px 10px",
                  fontSize: "0.65rem",
                  color: "#3a5a3a",
                  lineHeight: 1.8,
                }}
              >
                <div>← → Move</div>
                <div>↑ / Z Rotate</div>
                <div>↓ Soft drop</div>
                <div>Space Hard drop</div>
              </div>
            </div>
          </div>

          {/* Opponent panels */}
          {remotePlayers.map((p) => (
            <div key={p.playerId} className="flex flex-col items-center gap-2">
              <div
                style={{
                  fontSize: "0.82rem",
                  color: p.dead ? "#5a4a4a" : "#9a9a80",
                  fontWeight: 600,
                  fontFamily: "'Outfit', sans-serif",
                }}
              >
                {p.name}
              </div>
              <div style={{ position: "relative" }}>
                <Board board={p.board} cellSize={16} dim={p.dead} />
                {p.dead && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 6,
                      backgroundColor: "rgba(0,0,0,0.65)",
                    }}
                  >
                    <div style={{ color: "#ff6060", fontSize: "0.75rem", fontFamily: "'Fraunces', serif" }}>
                      Out
                    </div>
                  </div>
                )}
              </div>
              <div style={{ color: "#d4af37", fontSize: "0.82rem", fontWeight: 700 }}>
                {p.score.toLocaleString()}
              </div>
              <div style={{ color: "#4a7a4a", fontSize: "0.7rem" }}>
                Lv {p.level} · {p.lines} lines
              </div>
            </div>
          ))}

          {/* Leaderboard side panel (3+ players) */}
          {totalPlayers >= 3 && (
            <div
              style={{
                background: "#0b1d0d",
                border: "1px solid #1e3a20",
                borderRadius: 8,
                padding: "16px",
                minWidth: 160,
                alignSelf: "flex-start",
                marginTop: 24,
              }}
            >
              <div
                style={{
                  fontFamily: "'Fraunces', serif",
                  color: "#d4af37",
                  fontSize: "0.9rem",
                  fontStyle: "italic",
                  marginBottom: 12,
                }}
              >
                Standings
              </div>
              {allPlayers.map((p, i) => (
                <div
                  key={p.playerId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "4px 0",
                    borderBottom: "1px solid #1a2e1a",
                    opacity: p.dead ? 0.5 : 1,
                  }}
                >
                  <span style={{ color: i === 0 ? "#d4af37" : "#4a7a4a", fontSize: "0.75rem", width: 16 }}>
                    {i + 1}.
                  </span>
                  <span
                    style={{
                      color: p.isMe ? "#d4af37" : "#9a9a80",
                      fontSize: "0.78rem",
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.name}
                  </span>
                  <span style={{ color: "#b0c8a0", fontSize: "0.72rem", fontFamily: "'Outfit', sans-serif" }}>
                    {p.score.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
