import { Color, PieceSymbol, Square } from "chess.js";

export type Piece = {
  type: PieceSymbol;
  color: Color;
};

export type PlayerState = {
  influence: number;
};

export type GameDifficulty = "easy" | "medium" | "hard";

export type GameState = {
  white: PlayerState;
  black: PlayerState;
  selectedSquare: Square | null;
  activePower: "bribe" | "assassinate" | null;
  aiCommentary: string;
};

export const SYNDICATE_SQUARES: Square[] = [
  "c6", "d6", "e6",
  "c5", "d5", "e5",
  "c4", "d4", "e4"
];

// 3 in a row logic (Tic-Tac-Toe combinations)
export const WINNING_COMBINATIONS = [
  // Rows
  ["c6", "d6", "e6"],
  ["c5", "d5", "e5"],
  ["c4", "d4", "e4"],
  // Cols
  ["c6", "c5", "c4"],
  ["d6", "d5", "d4"],
  ["e6", "e5", "e4"],
  // Diagonals
  ["c6", "d5", "e4"],
  ["e6", "d5", "c4"]
];
