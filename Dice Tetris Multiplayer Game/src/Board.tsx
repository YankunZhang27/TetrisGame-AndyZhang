import DiceBlock from "./DiceBlock";
import { W, H } from "./tetris";

interface Props {
  board: number[][];
  cellSize?: number;
  dim?: boolean;
}

export default function Board({ board, cellSize = 28, dim = false }: Props) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${W}, ${cellSize}px)`,
        gridTemplateRows: `repeat(${H}, ${cellSize}px)`,
        gap: 1,
        backgroundColor: "#071409",
        padding: 3,
        border: "2px solid #1e3a20",
        borderRadius: 6,
        boxShadow: "0 0 24px rgba(0,0,0,0.6), inset 0 0 40px rgba(0,0,0,0.4)",
        opacity: dim ? 0.6 : 1,
        transition: "opacity 0.3s",
      }}
    >
      {board.flat().map((cell, i) => (
        <DiceBlock key={i} cellId={cell} size={cellSize} />
      ))}
    </div>
  );
}
