import { DICE_COLOR, DICE_FACE, PIP_COLOR } from "./tetris";

// pip x,y positions as percentages
const PIPS: Record<number, Array<[number, number]>> = {
  1: [[50, 50]],
  2: [[72, 28], [28, 72]],
  3: [[72, 28], [50, 50], [28, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 22], [72, 22], [28, 50], [72, 50], [28, 78], [72, 78]],
};

interface Props {
  cellId: number;
  size: number;
}

export default function DiceBlock({ cellId, size }: Props) {
  if (cellId === 0) {
    return (
      <div
        style={{
          width: size,
          height: size,
          border: "1px solid rgba(255,255,255,0.04)",
          boxSizing: "border-box",
        }}
      />
    );
  }

  const id = Math.abs(cellId);
  const ghost = cellId < 0;
  const faceColor = DICE_COLOR[id] ?? "#eee";
  const pipColor = PIP_COLOR[id] ?? "#222";
  const face = DICE_FACE[id] ?? 1;
  const pips = PIPS[face] ?? [];
  const r = Math.max(2, size * 0.12);
  const pipR = Math.max(1, size * 0.1);

  return (
    <div
      style={{
        width: size,
        height: size,
        boxSizing: "border-box",
        backgroundColor: ghost ? "transparent" : faceColor,
        border: ghost
          ? `${Math.max(1, size * 0.07)}px solid ${faceColor}60`
          : "1px solid rgba(0,0,0,0.25)",
        borderRadius: r,
        position: "relative",
        boxShadow: ghost
          ? "none"
          : `inset 0 1px 3px rgba(255,255,255,0.55), 0 2px 5px rgba(0,0,0,0.5)`,
        opacity: ghost ? 0.35 : 1,
        flexShrink: 0,
      }}
    >
      {!ghost &&
        pips.map(([px, py], i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              width: pipR * 2,
              height: pipR * 2,
              borderRadius: "50%",
              backgroundColor: pipColor,
              left: `${px}%`,
              top: `${py}%`,
              transform: "translate(-50%, -50%)",
              boxShadow: "0 1px 2px rgba(0,0,0,0.4)",
            }}
          />
        ))}
    </div>
  );
}
