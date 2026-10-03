import { Chess, Move, Square } from "chess.js";
import { GameState, WINNING_COMBINATIONS, SYNDICATE_SQUARES } from "../types";

// --- Piece Values & Piece-Square Tables ---
const PIECE_VALUES: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

const pawnEvalWhite = [
    [0,  0,  0,  0,  0,  0,  0,  0],
    [50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 20, 10, 10],
    [5,  5, 10, 25, 25, 10,  5,  5],
    [0,  0,  0, 20, 20,  0,  0,  0],
    [5, -5,-10,  0,  0,-10, -5,  5],
    [5, 10, 10,-20,-20, 10, 10,  5],
    [0,  0,  0,  0,  0,  0,  0,  0]
];

const knightEval = [
    [-50,-40,-30,-30,-30,-30,-40,-50],
    [-40,-20,  0,  0,  0,  0,-20,-40],
    [-30,  0, 10, 15, 15, 10,  0,-30],
    [-30,  5, 15, 20, 20, 15,  5,-30],
    [-30,  0, 15, 20, 20, 15,  0,-30],
    [-30,  5, 10, 15, 15, 10,  5,-30],
    [-40,-20,  0,  5,  5,  0,-20,-40],
    [-50,-40,-30,-30,-30,-30,-40,-50]
];

const bishopEvalWhite = [
    [-20,-10,-10,-10,-10,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5, 10, 10,  5,  0,-10],
    [-10,  5,  5, 10, 10,  5,  5,-10],
    [-10,  0, 10, 10, 10, 10,  0,-10],
    [-10, 10, 10, 10, 10, 10, 10,-10],
    [-10,  5,  0,  0,  0,  0,  5,-10],
    [-20,-10,-10,-10,-10,-10,-10,-20]
];

const rookEvalWhite = [
    [ 0,  0,  0,  0,  0,  0,  0,  0],
    [ 5, 10, 10, 10, 10, 10, 10,  5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [ 0,  0,  0,  5,  5,  0,  0,  0]
];

const evalQueen = [
    [-20,-10,-10, -5, -5,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5,  5,  5,  5,  0,-10],
    [ -5,  0,  5,  5,  5,  5,  0, -5],
    [  0,  0,  5,  5,  5,  5,  0, -5],
    [-10,  5,  5,  5,  5,  5,  0,-10],
    [-10,  0,  5,  0,  0,  0,  0,-10],
    [-20,-10,-10, -5, -5,-10,-10,-20]
];

const kingEvalWhite = [
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-20,-30,-30,-40,-40,-30,-30,-20],
    [-10,-20,-20,-20,-20,-20,-20,-10],
    [ 20, 20,  0,  0,  0,  0, 20, 20],
    [ 20, 30, 10,  0,  0, 10, 30, 20]
];

function reverseArray(arr: number[][]) {
    return arr.slice().reverse();
}

const pawnEvalBlack = reverseArray(pawnEvalWhite);
const bishopEvalBlack = reverseArray(bishopEvalWhite);
const rookEvalBlack = reverseArray(rookEvalWhite);
const kingEvalBlack = reverseArray(kingEvalWhite);

function getPieceSquareValue(piece: {type: string, color: string}, r: number, c: number) {
    switch (piece.type) {
        case 'p': return piece.color === 'w' ? pawnEvalWhite[r][c] : pawnEvalBlack[r][c];
        case 'n': return knightEval[r][c];
        case 'b': return piece.color === 'w' ? bishopEvalWhite[r][c] : bishopEvalBlack[r][c];
        case 'r': return piece.color === 'w' ? rookEvalWhite[r][c] : rookEvalBlack[r][c];
        case 'q': return evalQueen[r][c];
        case 'k': return piece.color === 'w' ? kingEvalWhite[r][c] : kingEvalBlack[r][c];
        default: return 0;
    }
}

// ----------------------------------------------------

const getPowerCost = (powerType: 'bribe' | 'assassinate', pieceType: string, isProtected: boolean, powerPrices: { bribe: number, assassinate: number, protect: number }) => {
  const basePrice = powerPrices[powerType];
  
  let pieceMultiplier = 1;
  switch (pieceType) {
    case 'p': pieceMultiplier = 0.5; break;
    case 'n': pieceMultiplier = 1.0; break;
    case 'b': pieceMultiplier = 1.0; break;
    case 'r': pieceMultiplier = 1.5; break;
    case 'q': pieceMultiplier = 3.0; break;
    default: return Infinity;
  }
  const cost = Math.floor(basePrice * pieceMultiplier);
  return isProtected ? Math.ceil(cost * 1.5) : cost;
};

export interface BotDecision {
  power?: { action: "bribe" | "assassinate", target: Square };
  from: Square;
  to: Square;
  promotion?: string;
  error?: string;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function computeBestMove(
  chess: Chess, 
  botInfluence: number = 0, 
  botColor: 'w' | 'b' = 'b',
  difficulty: "easy" | "medium" | "hard" = "medium", 
  protectedPieces: Square[] = [], 
  superPawnSquare: string | null = null, 
  powerPrices: { bribe: number, assassinate: number, protect: number, bounty?: number, bait?: number, bunker?: number } = { bribe: 50, assassinate: 40, protect: 20, bounty: 25, bait: 35, bunker: 80 }, 
  bountiedPieces: Square[] = [], 
  baitedPieces: Square[] = [],
  redZone: Square[] = [],
  redZoneWarning: Square[] = [],
  isTilted: boolean = false,
  isClassicMode: boolean = false
): Promise<BotDecision | null> {
  const safeProtected = protectedPieces || [];
  const safeBountied = bountiedPieces || [];
  const safeBaited = baitedPieces || [];
  const safeRedZone = redZone || [];
  const safeRedZoneWarning = redZoneWarning || [];
  const safePrices = powerPrices || { bribe: 50, assassinate: 40, protect: 20 };

  let powerToExecute: { action: "bribe" | "assassinate", target: Square } | undefined = undefined;

  // 1. In Sovereign Mode, evaluate high-value powers (Bribe / Assassinate)
  if (!isClassicMode && botInfluence >= 20) {
    const board = chess.board();
    let bestAssassinateTarget: Square | null = null;
    let maxAssassinateScore = -1;
    let bestAssassinateCost = Infinity;

    let bestBribeTarget: Square | null = null;
    let maxBribeScore = -1;
    let bestBribeCost = Infinity;
    
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        const opponentColor = botColor === 'w' ? 'b' : 'w';
        if (piece && piece.color === opponentColor && piece.type !== 'k') {
          const val = PIECE_VALUES[piece.type] || 0;
          const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
          const ranks = ["8", "7", "6", "5", "4", "3", "2", "1"];
          const sq = (files[c] + ranks[r]) as Square;
          
          const isProtected = safeProtected.includes(sq);
          const assassinateCost = getPowerCost("assassinate", piece.type, isProtected, safePrices);
          const bribeCost = getPowerCost("bribe", piece.type, isProtected, safePrices);

          const aScore = val / Math.max(1, assassinateCost);
          const bScore = val / Math.max(1, bribeCost);

          if (botInfluence >= Math.min(assassinateCost, bribeCost)) {
             if (botInfluence >= assassinateCost && aScore > maxAssassinateScore && val >= PIECE_VALUES["n"]) {
               maxAssassinateScore = aScore;
               bestAssassinateTarget = sq;
               bestAssassinateCost = assassinateCost;
             }
             if (piece.type !== 'q' && botInfluence >= bribeCost && bScore > maxBribeScore && val >= PIECE_VALUES["b"]) {
               maxBribeScore = bScore;
               bestBribeTarget = sq;
               bestBribeCost = bribeCost;
             }
          }
        }
      }
    }
    
    const powerChance = difficulty === "hard" ? 0.75 : (difficulty === "medium" ? 0.45 : 0.2);

    if (bestBribeTarget && Math.random() < powerChance) {
      const piece = chess.get(bestBribeTarget);
      if (piece) {
        powerToExecute = { action: "bribe", target: bestBribeTarget };
        chess.remove(bestBribeTarget);
        chess.put({ type: piece.type, color: botColor }, bestBribeTarget);
        botInfluence -= bestBribeCost;
      }
    } else if (bestAssassinateTarget && Math.random() < powerChance) {
      powerToExecute = { action: "assassinate", target: bestAssassinateTarget };
      chess.remove(bestAssassinateTarget);
      botInfluence -= bestAssassinateCost;
    }
  }

  // 2. Generate moves on the board
  let moves = chess.moves({ verbose: true }) as Move[];

  // Include Super Pawn (Centaur) knight moves if applicable
  if (superPawnSquare) {
    const p = chess.get(superPawnSquare as Square);
    if (p && p.color === botColor && p.type === 'p') {
      chess.remove(superPawnSquare as Square);
      chess.put({ type: 'n', color: botColor }, superPawnSquare as Square);
      const kmoves = chess.moves({ square: superPawnSquare as Square, verbose: true }) as Move[];
      chess.remove(superPawnSquare as Square);
      chess.put({ type: 'p', color: botColor }, superPawnSquare as Square);
      
      for (const km of kmoves) {
        if (!moves.some(m => m.from === km.from && m.to === km.to)) {
          moves.push(km);
        }
      }
    }
  }

  if (moves.length === 0) {
    if (powerToExecute) {
      return { power: powerToExecute, from: null as any, to: null as any };
    }
    return null;
  }

  // Fast path for easy mode blunder
  if (difficulty === "easy" && Math.random() < 0.2) {
    const randomMove = moves[Math.floor(Math.random() * moves.length)];
    return { 
      power: powerToExecute,
      from: randomMove.from, 
      to: randomMove.to, 
      promotion: randomMove.promotion 
    };
  }

  const depth = difficulty === "hard" ? 3 : (difficulty === "medium" ? 2 : 1);

  // Move ordering: captures first, then regular moves
  moves.sort((a, b) => {
    let scoreA = a.captured ? 10 * (PIECE_VALUES[a.captured] || 0) - (PIECE_VALUES[a.piece] || 0) : 0;
    let scoreB = b.captured ? 10 * (PIECE_VALUES[b.captured] || 0) - (PIECE_VALUES[b.piece] || 0) : 0;
    
    // Bonus for moving into syndicate squares
    if (!isClassicMode) {
      if (SYNDICATE_SQUARES.includes(a.to as Square)) scoreA += 50;
      if (SYNDICATE_SQUARES.includes(b.to as Square)) scoreB += 50;
    }

    return scoreB - scoreA;
  });

  const scoredMoves: { move: Move; score: number }[] = [];
  const startTime = Date.now();
  const TIME_LIMIT_MS = 3500; // 3.5 seconds max per move search

  for (let i = 0; i < moves.length; i++) {
    if (Date.now() - startTime > TIME_LIMIT_MS && scoredMoves.length > 0) {
       break;
    }

    const move = moves[i];
    
    // Test move with super pawn support
    let testSuccess = false;
    try {
      chess.move(move);
      testSuccess = true;
    } catch {
      // If centaur move, simulate safely
      if (superPawnSquare === move.from) {
        chess.remove(move.from);
        chess.put({ type: 'n', color: botColor }, move.from);
        try {
          chess.move(move);
          testSuccess = true;
        } catch {
          chess.remove(move.from);
          chess.put({ type: 'p', color: botColor }, move.from);
        }
      }
    }

    if (!testSuccess) continue;

    const isNextMaximizing = botColor === 'w';
    const score = minimax(chess, depth - 1, -Infinity, Infinity, isNextMaximizing, startTime, TIME_LIMIT_MS, safeRedZone, safeRedZoneWarning, isClassicMode);
    
    const ticTacToeWon = !isClassicMode && checkTicTacToeWin(chess, botColor);

    chess.undo();
    if (superPawnSquare === move.from && chess.get(move.from)?.type === 'n') {
      chess.remove(move.from);
      chess.put({ type: 'p', color: botColor }, move.from);
    }

    let hybridScore = botColor === 'b' ? score : -score;
    
    if (safeRedZone.includes(move.to as Square)) {
      if (move.captured !== 'k') {
        hybridScore -= 20000;
      }
    }
    if (safeRedZoneWarning.includes(move.to as Square)) {
      hybridScore -= 500;
    }
    
    if (!isClassicMode) {
      if (ticTacToeWon) hybridScore += 100000;
      if (SYNDICATE_SQUARES.includes(move.to as Square)) hybridScore += 50;
      if (move.captured) {
        if (safeBaited.includes(move.to as Square)) hybridScore -= 5000;
        if (safeBountied.includes(move.to as Square)) hybridScore += 500;
      }
    }
    
    if (isTilted) {
      if (move.captured) hybridScore += 2500;
      hybridScore += (Math.random() * 500 - 250); 
    }

    if (difficulty === "easy") hybridScore += (Math.random() * 400 - 200);
    else if (difficulty === "medium") hybridScore += (Math.random() * 80 - 40);
    else hybridScore += (Math.random() * 20 - 10);

    scoredMoves.push({ move, score: hybridScore });
    
    if (i % 4 === 0) {
      await sleep(1);
    }
  }

  if (scoredMoves.length === 0) {
    const fallbackMove = moves[0];
    return {
      power: powerToExecute,
      from: fallbackMove.from,
      to: fallbackMove.to,
      promotion: fallbackMove.promotion
    };
  }

  scoredMoves.sort((a, b) => b.score - a.score);

  let bestMove = scoredMoves[0].move;

  if (difficulty === "medium" && scoredMoves.length > 1) {
    const rand = Math.random();
    if (rand > 0.8) {
      bestMove = scoredMoves[1].move;
    }
  } else if (difficulty === "easy" && scoredMoves.length > 1) {
    const rand = Math.random();
    if (rand > 0.5) {
      const index = Math.floor(Math.random() * Math.min(scoredMoves.length, 5));
      bestMove = scoredMoves[index].move;
    }
  }
  
  return { 
    power: powerToExecute,
    from: bestMove.from, 
    to: bestMove.to, 
    promotion: bestMove.promotion 
  };
}

function minimax(chess: Chess, depth: number, alpha: number, beta: number, isMaximizingPlayer: boolean, startTime: number = 0, timeLimit: number = Infinity, redZone: Square[] = [], redZoneWarning: Square[] = [], isClassicMode: boolean = false): number {
  if (depth === 0 || (startTime > 0 && Date.now() - startTime > timeLimit)) {
    return quiescenceSearch(chess, alpha, beta, isMaximizingPlayer, 0, startTime, timeLimit, redZone, redZoneWarning, isClassicMode);
  }

  if (chess.isGameOver()) {
    if (chess.isCheckmate()) return isMaximizingPlayer ? -100000 : 100000;
    return 0; // Draw
  }

  const moves = chess.moves({ verbose: true }) as Move[];

  // Move ordering
  moves.sort((a, b) => {
    let scoreA = a.captured ? 10 * (PIECE_VALUES[a.captured] || 0) - (PIECE_VALUES[a.piece] || 0) : 0;
    let scoreB = b.captured ? 10 * (PIECE_VALUES[b.captured] || 0) - (PIECE_VALUES[b.piece] || 0) : 0;
    return scoreB - scoreA;
  });

  if (isMaximizingPlayer) {
    let bestVal = -Infinity;
    for (const move of moves) {
      chess.move(move);
      const value = minimax(chess, depth - 1, alpha, beta, false, startTime, timeLimit, redZone, redZoneWarning, isClassicMode);
      chess.undo();
      bestVal = Math.max(bestVal, value);
      alpha = Math.max(alpha, bestVal);
      if (beta <= alpha) break;
    }
    return bestVal;
  } else {
    let bestVal = Infinity;
    for (const move of moves) {
      chess.move(move);
      const value = minimax(chess, depth - 1, alpha, beta, true, startTime, timeLimit, redZone, redZoneWarning, isClassicMode);
      chess.undo();
      bestVal = Math.min(bestVal, value);
      beta = Math.min(beta, bestVal);
      if (beta <= alpha) break;
    }
    return bestVal;
  }
}

function quiescenceSearch(chess: Chess, alpha: number, beta: number, isMaximizingPlayer: boolean, qDepth: number = 0, startTime: number = 0, timeLimit: number = Infinity, redZone: Square[] = [], redZoneWarning: Square[] = [], isClassicMode: boolean = false): number {
    const evalScore = evaluateBoard(chess, [], [], redZone, redZoneWarning, isClassicMode);

    if (isMaximizingPlayer) {
        if (evalScore >= beta) return beta;
        if (alpha < evalScore) alpha = evalScore;
    } else {
        if (evalScore <= alpha) return alpha;
        if (beta > evalScore) beta = evalScore;
    }

    // Limit quiescence depth to prevent worker freezing / memory leaks in complex positions
    if (qDepth > 4 || (startTime > 0 && Date.now() - startTime > timeLimit)) return evalScore;

    const moves = chess.moves({ verbose: true }) as Move[];
    const captures = moves.filter(m => m.captured).sort((a, b) => {
        return ((PIECE_VALUES[b.captured as string] || 0) - (PIECE_VALUES[b.piece] || 0)) - ((PIECE_VALUES[a.captured as string] || 0) - (PIECE_VALUES[a.piece] || 0));
    });

    if (isMaximizingPlayer) {
        let bestVal = evalScore;
        for (const move of captures) {
            chess.move(move);
            const value = quiescenceSearch(chess, alpha, beta, false, qDepth + 1, startTime, timeLimit, redZone, redZoneWarning, isClassicMode);
            chess.undo();
            bestVal = Math.max(bestVal, value);
            alpha = Math.max(alpha, bestVal);
            if (beta <= alpha) break;
        }
        return bestVal;
    } else {
        let bestVal = evalScore;
        for (const move of captures) {
            chess.move(move);
            const value = quiescenceSearch(chess, alpha, beta, true, qDepth + 1, startTime, timeLimit, redZone, redZoneWarning, isClassicMode);
            chess.undo();
            bestVal = Math.min(bestVal, value);
            beta = Math.min(beta, bestVal);
            if (beta <= alpha) break;
        }
        return bestVal;
    }
}

function evaluateBoard(chess: Chess, baitedPieces: Square[] = [], bountiedPieces: Square[] = [], redZone: Square[] = [], redZoneWarning: Square[] = [], isClassicMode: boolean = false): number {
  let totalEvaluation = 0;
  const board = chess.board();

  let bTicTacToe = false;
  let wTicTacToe = false;

  const sqToPiece: Record<string, { type: string, color: string } | null> = {};
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const ranks = ["8", "7", "6", "5", "4", "3", "2", "1"];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      const sq = (files[c] + ranks[r]) as Square;
      sqToPiece[sq] = piece;

      if (piece) {
        let val = PIECE_VALUES[piece.type] || 0;
        val += getPieceSquareValue(piece, r, c);
        
        if (!isClassicMode && redZone.includes(sq)) {
           val -= 20000;
        }
        
        // Tic-Tac-Toe spatial heuristic
        const synBonus = !isClassicMode && SYNDICATE_SQUARES.includes(sq) ? 100 : 0;

        if (piece.color === 'b') {
          totalEvaluation += val + synBonus;
        } else {
          totalEvaluation -= (val + synBonus);
        }
      }
    }
  }

  if (!isClassicMode) {
    // Check Tic-Tac-Toe Win on the cached array
    for (const combo of WINNING_COMBINATIONS) {
      let bCount = 0;
      let wCount = 0;
      for (const sq of combo) {
        const p = sqToPiece[sq];
        if (p) {
          if (p.color === 'b') bCount++;
          if (p.color === 'w') wCount++;
        }
      }
      if (bCount === 3) bTicTacToe = true;
      if (wCount === 3) wTicTacToe = true;
    }

    if (bTicTacToe) totalEvaluation += 50000;
    if (wTicTacToe) totalEvaluation -= 50000;
  }

  return totalEvaluation;
}

function checkTicTacToeWin(chess: Chess, color: "w" | "b"): boolean {
  const board = chess.board();
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const ranks = ["8", "7", "6", "5", "4", "3", "2", "1"];
  const sqToPiece: Record<string, { type: string, color: string } | null> = {};
  
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
       sqToPiece[files[c] + ranks[r]] = board[r][c];
    }
  }

  for (const combo of WINNING_COMBINATIONS) {
    if (combo.every(sq => {
      const p = sqToPiece[sq];
      return p && p.color === color;
    })) {
      return true;
    }
  }
  return false;
}
