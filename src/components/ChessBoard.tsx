import React from "react";
import { Chess, Square, Color, PieceSymbol } from "chess.js";
import { SYNDICATE_SQUARES } from "../types";
import { cn } from "../lib/utils";
import { Shield, Target, AlertTriangle, Flame } from "lucide-react";

const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
const ranks = ["8", "7", "6", "5", "4", "3", "2", "1"];

interface ChessBoardProps {
  chess: Chess;
  selectedSquare: Square | null;
  onSquareClick: (square: Square) => void;
  validMoves: Square[];
  protectedPieces: Square[];
  bountiedPieces: Square[];
  baitedPieces: Square[];
  superPawnSquare: string | null;
  redZone: Square[];
  redZoneWarning: Square[];
  bunkeredPieces: { square: Square; plysLeft: number }[];
  lastMove: { from: Square, to: Square } | null;
  lastAction: { type: 'kill' | 'bribe' | 'bait' | 'protect' | 'bunker', square: Square } | null;
  activePower: 'bribe' | 'assassinate' | 'protect' | 'bounty' | 'bait' | 'bunker' | null;
}

export const ChessBoardBase: React.FC<ChessBoardProps> = ({
  chess,
  bountiedPieces,
  baitedPieces,
  selectedSquare,
  onSquareClick,
  validMoves,
  protectedPieces,
  superPawnSquare,
  redZone,
  redZoneWarning,
  bunkeredPieces,
  lastMove,
  lastAction,
  activePower,
}) => {
  const board = chess.board();

  return (
    <div className="@container grid grid-cols-8 grid-rows-8 gap-0 border-[6px] border-amber-600/60 shadow-[0_0_50px_rgba(20,0,40,0.8),inset_0_0_20px_rgba(0,0,0,1)] w-full h-full max-w-[800px] max-h-[800px] aspect-square relative z-10 bg-black/60 backdrop-blur-md rounded-xl overflow-hidden ring-1 ring-amber-400/20">
      {board.map((row, i) =>
        row.map((piece, j) => {
          const square = (files[j] + ranks[i]) as Square;
          const isDark = (i + j) % 2 === 1;
          const isSyndicate = SYNDICATE_SQUARES.includes(square);
          const isSelected = selectedSquare === square;
          const isValidMove = validMoves.includes(square);
          const isRedZone = redZone.includes(square);
          const isRedZoneWarning = redZoneWarning.includes(square);
          const isLastMove = lastMove?.from === square || lastMove?.to === square;
          const isLastAction = lastAction?.square === square;

          return (
            <div
              key={square}
              onClick={() => onSquareClick(square)}
              className={cn(
                "relative flex items-center justify-center w-full h-full cursor-pointer transition-all duration-300",
                isDark ? "bg-stone-300" : "bg-stone-100",
                isLastMove && !isSelected && "bg-sky-500/20 shadow-[inset_0_0_15px_rgba(14,165,233,0.3)]",
                isSelected && "bg-amber-100 shadow-[inset_0_0_15px_rgba(245,158,11,0.3)] border border-amber-400",
                isSyndicate && !isSelected && "bg-emerald-900/10 shadow-[inset_0_0_30px_rgba(16,185,129,0.25)] ring-1 ring-emerald-500/40 hover:bg-emerald-900/30",
                isRedZone && !isSelected && "bg-rose-900/40 shadow-[inset_0_0_30px_rgba(225,29,72,0.4)] ring-1 ring-rose-500/50",
                isRedZoneWarning && !isSelected && "bg-red-900/40 shadow-[inset_0_0_20px_rgba(239,68,68,0.5)] ring-1 ring-red-500/50",
                isValidMove && "after:content-[''] after:absolute after:w-4 after:h-4 after:bg-emerald-400/70 after:shadow-[0_0_10px_rgba(52,211,153,0.8)] after:rounded-full after:z-20"
              )}
            >
              {isLastAction && (
                <div className={cn(
                  "absolute inset-0 border-2 m-[2px] pointer-events-none rounded-[1px] shadow-[inset_0_0_15px_rgba(0,0,0,0.5)] animate-pulse",
                  lastAction.type === 'kill' ? "border-red-500/80 shadow-[0_0_10px_rgba(239,68,68,0.5)]" : 
                  lastAction.type === 'bribe' ? "border-amber-400/80 shadow-[0_0_10px_rgba(251,191,36,0.5)]" :
                  lastAction.type === 'bait' ? "border-fuchsia-500/80 shadow-[0_0_10px_rgba(217,70,239,0.5)]" :
                  lastAction.type === 'bunker' ? "border-orange-500/80 shadow-[0_0_10px_rgba(249,115,22,0.5)]" :
                  "border-blue-500/80 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                )} />
              )}
              {isRedZone && (
                 <div className="absolute inset-0 border border-rose-500/30 m-[2px] pointer-events-none rounded-[1px] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-rose-600/10 to-transparent animate-pulse" />
              )}
              {isRedZoneWarning && (
                 <div className="absolute inset-0 border border-red-500/50 m-[2px] pointer-events-none rounded-[1px] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-500/20 to-transparent animate-[pulse_1s_ease-in-out_infinite]" />
              )}
              {isSyndicate && (
                 <div className="absolute inset-0 border border-emerald-400/30 m-[2px] pointer-events-none rounded-[1px] flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-emerald-500/50 rounded-full shadow-[0_0_8px_rgba(16,185,129,1)]" />
                 </div>
              )}
              {bountiedPieces.includes(square) && (
                <div className="absolute top-1 left-1 sm:top-2 sm:left-2 z-30 pointer-events-none animate-pulse">
                   <Target className="w-3 h-3 sm:w-4 sm:h-4 text-green-400 drop-shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
                </div>
              )}
              {baitedPieces.includes(square) && (
                <div className="absolute bottom-1 right-1 sm:bottom-2 sm:right-2 z-30 pointer-events-none">
                   <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4 text-fuchsia-400 drop-shadow-[0_0_8px_rgba(217,70,239,0.8)]" />
                </div>
              )}
              {protectedPieces.includes(square) && (
                <div className="absolute top-1 right-1 sm:top-2 sm:right-2 z-30 pointer-events-none">
                   <Shield className="w-3 h-3 sm:w-4 sm:h-4 text-blue-400 drop-shadow-[0_0_5px_rgba(59,130,246,0.8)]" />
                </div>
              )}
              {bunkeredPieces.some(bp => bp.square === square) && (
                <div className="absolute bottom-1 left-1 sm:bottom-2 sm:left-2 z-30 pointer-events-none animate-bounce">
                   <Flame className="w-3 h-3 sm:w-4 sm:h-4 text-orange-400 drop-shadow-[0_0_5px_rgba(249,115,22,0.8)]" />
                </div>
              )}
              {piece && (
                <div
                  className={cn(
                    "w-full h-full flex items-center justify-center select-none transition-transform duration-300 relative",
                    piece.color === "w" ? "text-amber-50 drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]" : "text-black drop-shadow-[0_2px_5px_rgba(255,255,255,0.2)]"
                  )}
                  style={{
                    textShadow: piece.color === "b" ? "0 0 1px rgba(255,255,255,0.3), 0 0 10px rgba(0,0,0,0.8)" : "0 0 15px rgba(245,158,11,0.5)"
                  }}
                >
                  {superPawnSquare === square && piece.type === 'p' && (
                     <div className="absolute -inset-2 bg-purple-500/40 blur-md rounded-full animate-pulse z-[-1]" />
                  )}
                  <PieceIcon type={piece.type} color={piece.color} />
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

const PieceIcon = ({ type, color }: { type: PieceSymbol; color: Color }) => {
  const symbol = {
    w: { p: "\u2659", n: "\u2658", b: "\u2657", r: "\u2656", q: "\u2655", k: "\u2654" },
    b: { p: "\u265F", n: "\u265E", b: "\u265D", r: "\u265C", q: "\u265B", k: "\u265A" },
  }[color][type];
  
  return <span className="font-serif leading-none tracking-tighter cursor-grab active:cursor-grabbing hover:scale-110 transition-transform block" style={{ fontSize: "clamp(1.5rem, 8vmin, 4.5rem)" }}>{symbol}</span>;
};

export const ChessBoard = React.memo(ChessBoardBase, (prev, next) => {
  return (
    prev.chess.fen() === next.chess.fen() &&
    prev.selectedSquare === next.selectedSquare &&
    prev.activePower === next.activePower &&
    prev.superPawnSquare === next.superPawnSquare &&
    JSON.stringify(prev.validMoves) === JSON.stringify(next.validMoves) &&
    JSON.stringify(prev.protectedPieces) === JSON.stringify(next.protectedPieces) &&
    JSON.stringify(prev.bountiedPieces) === JSON.stringify(next.bountiedPieces) &&
    JSON.stringify(prev.baitedPieces) === JSON.stringify(next.baitedPieces) &&
    JSON.stringify(prev.redZone) === JSON.stringify(next.redZone) &&
    JSON.stringify(prev.redZoneWarning) === JSON.stringify(next.redZoneWarning) &&
    JSON.stringify(prev.bunkeredPieces) === JSON.stringify(next.bunkeredPieces) &&
    JSON.stringify(prev.lastMove) === JSON.stringify(next.lastMove) &&
    JSON.stringify(prev.lastAction) === JSON.stringify(next.lastAction)
  );
});
