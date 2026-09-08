import { useRef, useState } from "react";
import GameScreen from "./GameScreen";

function generateRoomCode(): string {
  return Array.from({ length: 4 }, () =>
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]
  ).join("");
}

function generatePlayerId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

type Screen = "home" | "game";

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [nameInput, setNameInput] = useState("");
  const [joinInput, setJoinInput] = useState("");
  const [error, setError] = useState("");
  const playerIdRef = useRef(generatePlayerId());
  const gameParamsRef = useRef<{ roomCode: string; isHost: boolean } | null>(null);

  const handleCreate = () => {
    const n = nameInput.trim();
    if (!n) { setError("Enter your name first"); return; }
    gameParamsRef.current = { roomCode: generateRoomCode(), isHost: true };
    setScreen("game");
  };

  const handleJoin = () => {
    const n = nameInput.trim();
    const code = joinInput.trim().toUpperCase();
    if (!n) { setError("Enter your name first"); return; }
    if (code.length < 4) { setError("Enter a valid 4-character room code"); return; }
    gameParamsRef.current = { roomCode: code, isHost: false };
    setScreen("game");
  };

  if (screen === "game" && gameParamsRef.current) {
    return (
      <GameScreen
        playerId={playerIdRef.current}
        name={nameInput.trim() || "Player"}
        roomCode={gameParamsRef.current.roomCode}
        isHost={gameParamsRef.current.isHost}
        onLeave={() => setScreen("home")}
      />
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{ background: "linear-gradient(160deg, #0b1d0d 0%, #0d2210 50%, #071408 100%)" }}
    >
      {/* Felt texture overlay */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage:
            "radial-gradient(circle at 20% 80%, rgba(30,60,30,0.3) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(20,50,20,0.3) 0%, transparent 60%)",
          pointerEvents: "none",
        }}
      />

      {/* Card */}
      <div
        style={{
          position: "relative",
          background: "#0f2410",
          border: "1px solid #2a4a2a",
          borderRadius: 16,
          padding: "48px 56px",
          width: "min(440px, 92vw)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(212,175,55,0.08)",
        }}
      >
        {/* Title */}
        <div className="text-center mb-8">
          {/* Decorative dice row */}
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 16 }}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <DiceFace key={n} value={n} />
            ))}
          </div>
          <h1
            style={{
              fontFamily: "'Fraunces', serif",
              fontSize: "2.8rem",
              fontStyle: "italic",
              color: "#d4af37",
              lineHeight: 1,
              marginBottom: 6,
            }}
          >
            Dice Tetris
          </h1>
          <p style={{ color: "#4a7a4a", fontSize: "0.85rem" }}>
            Multiplayer · Dice-faced blocks · Real-time
          </p>
        </div>

        {/* Form */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ display: "block", color: "#4a7a4a", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
              Your Name
            </label>
            <input
              type="text"
              placeholder="Enter your name"
              value={nameInput}
              onChange={(e) => { setNameInput(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              maxLength={20}
              style={{
                width: "100%",
                padding: "10px 14px",
                background: "#071408",
                border: "1px solid #2a4a2a",
                borderRadius: 6,
                color: "#e0d8c0",
                fontFamily: "'Outfit', sans-serif",
                fontSize: "1rem",
                outline: "none",
              }}
            />
          </div>

          <button
            onClick={handleCreate}
            style={{
              padding: "13px",
              background: "linear-gradient(135deg, #c8a020, #d4af37, #c8a020)",
              color: "#0b1a0c",
              border: "none",
              borderRadius: 6,
              fontFamily: "'Outfit', sans-serif",
              fontWeight: 700,
              fontSize: "1rem",
              cursor: "pointer",
              letterSpacing: "0.04em",
              boxShadow: "0 4px 20px rgba(212,175,55,0.25)",
              transition: "opacity 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            Create Room
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, height: 1, background: "#1e3a20" }} />
            <span style={{ color: "#2e5a2e", fontSize: "0.78rem" }}>or join</span>
            <div style={{ flex: 1, height: 1, background: "#1e3a20" }} />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              placeholder="Room code"
              value={joinInput}
              onChange={(e) => { setJoinInput(e.target.value.toUpperCase().slice(0, 4)); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              maxLength={4}
              style={{
                flex: 1,
                padding: "10px 14px",
                background: "#071408",
                border: "1px solid #2a4a2a",
                borderRadius: 6,
                color: "#d4af37",
                fontFamily: "'Outfit', monospace",
                fontSize: "1.1rem",
                fontWeight: 700,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                outline: "none",
              }}
            />
            <button
              onClick={handleJoin}
              style={{
                padding: "10px 20px",
                background: "#1a3a1a",
                color: "#7aaa7a",
                border: "1px solid #2a5a2a",
                borderRadius: 6,
                fontFamily: "'Outfit', sans-serif",
                fontWeight: 600,
                fontSize: "0.9rem",
                cursor: "pointer",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#1e4a1e")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#1a3a1a")}
            >
              Join
            </button>
          </div>

          {error && (
            <div style={{ color: "#ff8080", fontSize: "0.8rem", textAlign: "center" }}>{error}</div>
          )}
        </div>

        {/* Legend */}
        <div style={{ marginTop: 28, borderTop: "1px solid #1e3a20", paddingTop: 20 }}>
          <div style={{ color: "#2e5a2e", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
            Piece legend
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {[
              { label: "I — pip 1", id: 1 },
              { label: "O — pip 2", id: 2 },
              { label: "T — pip 3", id: 3 },
              { label: "S — pip 4", id: 4 },
              { label: "Z — pip 5", id: 5 },
              { label: "J/L — pip 6", id: 6 },
            ].map(({ label, id }) => (
              <div key={id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <DiceBlockMini id={id} />
                <span style={{ color: "#3a6a3a", fontSize: "0.72rem" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p style={{ marginTop: 20, color: "#2a4a2a", fontSize: "0.72rem" }}>
        Open in multiple tabs to play multiplayer
      </p>
    </div>
  );
}

// Decorative dice face for the header
function DiceFace({ value }: { value: number }) {
  const colors = ["#f0f8ff","#ffe666","#ecdeff","#d4f7d4","#ff9090","#c8deff"];
  const pips: Record<number, Array<[number, number]>> = {
    1: [[50,50]],
    2: [[72,28],[28,72]],
    3: [[72,28],[50,50],[28,72]],
    4: [[28,28],[72,28],[28,72],[72,72]],
    5: [[28,28],[72,28],[50,50],[28,72],[72,72]],
    6: [[28,22],[72,22],[28,50],[72,50],[28,78],[72,78]],
  };
  const size = 28;
  const faceColor = colors[value - 1];
  return (
    <div
      style={{
        width: size,
        height: size,
        backgroundColor: faceColor,
        borderRadius: 5,
        position: "relative",
        boxShadow: "inset 0 1px 2px rgba(255,255,255,0.5), 0 2px 4px rgba(0,0,0,0.5)",
        border: "1px solid rgba(0,0,0,0.2)",
        flexShrink: 0,
      }}
    >
      {(pips[value] || []).map(([px, py], i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: 5,
            height: 5,
            borderRadius: "50%",
            backgroundColor: "rgba(0,0,0,0.65)",
            left: `${px}%`,
            top: `${py}%`,
            transform: "translate(-50%, -50%)",
          }}
        />
      ))}
    </div>
  );
}

function DiceBlockMini({ id }: { id: number }) {
  const colors: Record<number, string> = { 1:"#f0f8ff",2:"#ffe666",3:"#ecdeff",4:"#d4f7d4",5:"#ff9090",6:"#c8deff" };
  const size = 20;
  return (
    <div
      style={{
        width: size,
        height: size,
        backgroundColor: colors[id] ?? "#eee",
        borderRadius: 3,
        border: "1px solid rgba(0,0,0,0.2)",
        boxShadow: "inset 0 1px 2px rgba(255,255,255,0.4)",
        flexShrink: 0,
      }}
    />
  );
}
