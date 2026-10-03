import { Chess } from 'chess.js';
import { computeBestMove } from './bot';

self.onmessage = async (e) => {
  try {
    const { 
      fen, 
      botInfluence = 0, 
      botColor = 'b', 
      difficulty = 'medium', 
      protectedPieces = [], 
      superPawnSquare = null, 
      powerPrices = { bribe: 50, assassinate: 40, protect: 20 }, 
      bountiedPieces = [], 
      baitedPieces = [], 
      redZone = [], 
      redZoneWarning = [], 
      isTilted = false, 
      isClassicMode = false 
    } = e.data || {};

    const chess = new Chess(fen);
    
    const result = await computeBestMove(
      chess, 
      botInfluence, 
      botColor, 
      difficulty, 
      protectedPieces, 
      superPawnSquare, 
      powerPrices, 
      bountiedPieces, 
      baitedPieces, 
      redZone, 
      redZoneWarning, 
      isTilted, 
      isClassicMode
    );
    
    self.postMessage(result);
  } catch (error: any) {
    self.postMessage({ error: error?.message || "Worker error" });
  }
};
