import { create } from 'zustand';
import { Chess, Square } from 'chess.js';
import { GameDifficulty } from '../types';

export interface PlayerEconomy {
  influence: number;
}

export interface GameState {
  // Player Settings
  isPaused: boolean;
  isGlobalPaused: boolean;
  whitePlayerType: 'human' | 'ai';
  blackPlayerType: 'human' | 'ai';
  difficulty: GameDifficulty;
  audioEnabled: boolean;

  // Hitbox Tracking
  lastMove: { from: Square, to: Square } | null;
  lastAction: { type: 'kill' | 'bribe' | 'bait' | 'protect' | 'bunker', square: Square } | null;

  // Economy & Powers
  white: PlayerEconomy;
  black: PlayerEconomy;
  whiteTime: number;
  blackTime: number;
  lastTickTime: number;
  decrementTime: () => void;
  activePower: 'bribe' | 'assassinate' | 'protect' | 'bounty' | 'bait' | 'bunker' | null;
  protectedPieces: Square[];
  bountiedPieces: Square[];
  baitedPieces: Square[];
  superPawnSquare: string | null;
  ticTacToeClaimed: boolean;
  redZone: Square[];
  redZoneWarning: Square[];
  bunkeredPieces: { square: Square; plysLeft: number }[];
  powerPrices: { bribe: number, assassinate: number, protect: number, bounty: number, bait: number, bunker: number };

  // Commentary
  aiCommentary: string;
  activeRoast: string | null;
  setActiveRoast: (roast: string | null) => void;
  actionLog: {title: string, message: string}[];
  isTilted: boolean;

  // Chess Logic
  chess: Chess;
  fen: string;
  selectedSquare: Square | null;
  validMoves: Square[];
  
  isClassicMode: boolean;
  isTutorial: boolean;
  tutorialStep: number;
  
  // Profile
  userProfile: { name: string; wins: number; losses: number; elo: number };
  updateProfile: (updates: Partial<{ name: string; wins: number; losses: number; elo: number }>) => void;

  // Multiplayer
  isMultiplayer: boolean;
  roomId: string | null;
  playerColor: 'w' | 'b' | 'spectator' | null;
  opponentProfile: { name: string, bounty: number, isGhostBot?: boolean } | null;

  // Game Status
  isAiThinking: boolean;
  showStory: boolean;
  showOnboarding: boolean;
  boardTampered: boolean;

  currentView: 'attract' | 'menu' | 'story' | 'playing' | 'about' | 'multiplayer_lobby';
  gameEndState: { over: boolean, reason?: string, winner?: 'w' | 'b' | 'draw' } | null;

  // Actions
  setCurrentView: (view: 'attract' | 'menu' | 'story' | 'playing' | 'about' | 'multiplayer_lobby') => void;
  setGameEndState: (state: { over: boolean, reason?: string, winner?: 'w' | 'b' | 'draw' } | null) => void;
  setShowStory: (show: boolean) => void;
  setIsPaused: (paused: boolean) => void;
  setIsGlobalPaused: (paused: boolean) => void;
  setLastMove: (move: { from: Square, to: Square } | null) => void;
  setLastAction: (action: { type: 'kill' | 'bribe' | 'bait' | 'protect' | 'bunker', square: Square } | null) => void;
  setPlayerType: (color: 'w' | 'b', type: 'human' | 'ai') => void;
  setBoardTampered: (tampered: boolean) => void;
  setDifficulty: (diff: GameDifficulty) => void;
  toggleAudio: () => void;
  setAiCommentary: (msg: string) => void;
  addActionLog: (title: string, message: string) => void;
  setIsTilted: (tilted: boolean) => void;
  setIsAiThinking: (thinking: boolean) => void;
  setActivePower: (power: 'bribe' | 'assassinate' | 'protect' | 'bounty' | 'bait' | 'bunker' | null) => void;
  setBountiedPieces: (sqs: Square[]) => void;
  setBaitedPieces: (sqs: Square[]) => void;
  setProtectedPieces: (sqs: Square[]) => void;
  setSuperPawnSquare: (square: string | null) => void;
  setTicTacToeClaimed: (claimed: boolean) => void;
  setRedZone: (squares: Square[]) => void;
  setRedZoneWarning: (squares: Square[]) => void;
  setBunkeredPieces: (pieces: { square: Square; plysLeft: number }[]) => void;
  updatePowerPrices: () => void;
  setSelectedSquare: (sq: Square | null) => void;
  setValidMoves: (moves: Square[]) => void;
  updateEconomy: (color: 'w' | 'b', change: number, overwrite?: boolean) => void;
  syncBoard: () => void;
  resetGame: (preserveMultiplayer?: boolean) => void;
  setShowOnboarding: (show: boolean) => void;
  setIsClassicMode: (isClassic: boolean) => void;
  setIsTutorial: (isTutorial: boolean) => void;
  setTutorialStep: (step: number) => void;
  setIsMultiplayer: (isMultiplayer: boolean) => void;
  setRoomId: (roomId: string | null) => void;
  setPlayerColor: (color: 'w' | 'b' | 'spectator' | null) => void;
  setOpponentProfile: (profile: { name: string, bounty: number, isGhostBot?: boolean } | null) => void;
}

const initialChess = new Chess();


const loadProfile = () => {
  try {
    const saved = localStorage.getItem('sovereign_profile');
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return { name: '', wins: 0, losses: 0, elo: 500 };
};

export const useGameStore = create<GameState>((set) => ({
  userProfile: loadProfile(),
  isPaused: false,
  isGlobalPaused: false,
  whitePlayerType: 'human',
  blackPlayerType: 'ai',
  difficulty: 'medium',
  audioEnabled: true,
  
  lastMove: null,
  lastAction: null,

  white: { influence: 0 },
  black: { influence: 0 },
  whiteTime: 300,
  blackTime: 300,
  lastTickTime: performance.now(),
  activePower: null,
  protectedPieces: [],
  bountiedPieces: [],
  baitedPieces: [],
  superPawnSquare: null,
  ticTacToeClaimed: false,
  redZone: [],
  redZoneWarning: [],
  bunkeredPieces: [],
  powerPrices: { bribe: 50, assassinate: 40, protect: 20, bounty: 25, bait: 35, bunker: 80 },

  aiCommentary: "Welcome to the Grid, Fixer. Make your move.",
  activeRoast: null,
  setActiveRoast: (roast) => set({ activeRoast: roast }),
  actionLog: [],
  isTilted: false,
  
  chess: initialChess,
  fen: initialChess.fen(),
  selectedSquare: null,
  validMoves: [],
  
  isClassicMode: false,
  isTutorial: false,
  tutorialStep: 0,
  
  isMultiplayer: false,
  roomId: null,
  playerColor: null,
  opponentProfile: null,
  
  isAiThinking: false,
  showStory: false, // Legacy, can be ignored mostly
  showOnboarding: false,
  boardTampered: false,
  gameEndState: null,
  currentView: 'menu',

  setCurrentView: (view) => set({ currentView: view }),
  setIsClassicMode: (isClassic) => set({ isClassicMode: isClassic }),
  setIsTutorial: (isTutorial) => set({ isTutorial }),
  setTutorialStep: (step) => set({ tutorialStep: step }),
  setIsMultiplayer: (isMultiplayer) => set({ isMultiplayer }),
  setRoomId: (roomId) => set({ roomId }),
  setPlayerColor: (playerColor) => set({ playerColor }),
  setOpponentProfile: (opponentProfile) => set({ opponentProfile }),
  updateProfile: (updates) => set((state) => {
    const newProfile = { ...state.userProfile, ...updates };
    localStorage.setItem('sovereign_profile', JSON.stringify(newProfile));
    return { userProfile: newProfile };
  }),
  setGameEndState: (state) => set({ gameEndState: state }),
  decrementTime: () => set((state) => {
    const now = performance.now();
    if (state.currentView !== 'playing') {
      return { lastTickTime: now };
    }
    const delta = Math.max(0, Math.floor((now - state.lastTickTime) / 1000));
    
    // If delta is 0 (interval called too quickly), just return. 
    // We only decrement if at least 1 second passed.
    if (delta < 1) return {};

    if (state.gameEndState || state.isPaused || state.isGlobalPaused) {
       return { lastTickTime: now };
    }

    const isWhiteTurn = state.chess.turn() === "w";
    if (isWhiteTurn) {
      if (state.whiteTime <= delta) return { whiteTime: 0, lastTickTime: now, gameEndState: { over: true, reason: "timeout", winner: "b" } };
      return { whiteTime: state.whiteTime - delta, lastTickTime: now };
    } else {
      if (state.blackTime <= delta) return { blackTime: 0, lastTickTime: now, gameEndState: { over: true, reason: "timeout", winner: "w" } };
      return { blackTime: state.blackTime - delta, lastTickTime: now };
    }
  }),
  setShowStory: (show) => set({ showStory: show }),
  setIsPaused: (paused) => set({ isPaused: paused }),
  setIsGlobalPaused: (paused) => set({ isGlobalPaused: paused }),
  setLastMove: (move) => set({ lastMove: move }),
  setLastAction: (action) => set({ lastAction: action }),
  setPlayerType: (color, type) => set({ 
    ...(color === 'w' ? { whitePlayerType: type } : { blackPlayerType: type }) 
  }),
  setBoardTampered: (tampered) => set({ boardTampered: tampered }),
  setDifficulty: (diff) => set({ difficulty: diff }),
  toggleAudio: () => set((state) => ({ audioEnabled: !state.audioEnabled })),
  setAiCommentary: (msg) => set({ aiCommentary: msg }),
  addActionLog: (title, message) => set((state) => ({ actionLog: [{title, message}, ...state.actionLog].slice(0, 50) })),
  setIsTilted: (tilted) => set({ isTilted: tilted }),
  setIsAiThinking: (thinking) => set({ isAiThinking: thinking }),
  setActivePower: (power) => set({ activePower: power }),
  setProtectedPieces: (sqs) => set({ protectedPieces: sqs }),
  setBountiedPieces: (sqs) => set({ bountiedPieces: sqs }),
  setBaitedPieces: (sqs) => set({ baitedPieces: sqs }),
  setSuperPawnSquare: (square) => set({ superPawnSquare: square }),
  setTicTacToeClaimed: (claimed) => set({ ticTacToeClaimed: claimed }),
  setRedZone: (squares) => set({ redZone: squares }),
  setRedZoneWarning: (squares) => set({ redZoneWarning: squares }),
  setBunkeredPieces: (pieces) => set({ bunkeredPieces: pieces }),
  updatePowerPrices: () => set((state) => {
    const totalEconomy = state.white.influence + state.black.influence;
    const inflation = 1 + (totalEconomy / 1000); // Gradual inflation based on economy size
    
    // Random market volatility between -15% and +15%
    const volatile = () => 0.85 + (Math.random() * 0.30);
    
    return {
      powerPrices: {
        bribe: Math.max(30, Math.floor(50 * inflation * volatile())),
        assassinate: Math.max(25, Math.floor(40 * inflation * volatile())),
        protect: Math.max(10, Math.floor(20 * inflation * volatile())),
        bounty: Math.max(15, Math.floor(25 * inflation * volatile())),
        bait: Math.max(20, Math.floor(35 * inflation * volatile())),
        bunker: Math.max(60, Math.floor(80 * inflation * volatile()))
      }
    };
  }),
  setSelectedSquare: (sq) => set({ selectedSquare: sq }),
  setValidMoves: (moves) => set({ validMoves: moves }),
  updateEconomy: (color, change, overwrite) => set((state) => {
    const player = color === 'w' ? 'white' : 'black';
    return {
      [player]: { influence: overwrite ? change : Math.max(0, state[player].influence + change) }
    };
  }),
  syncBoard: () => set((state) => {
    const totalEconomy = state.white.influence + state.black.influence;
    const inflation = 1 + (totalEconomy / 1000); 
    const volatile = () => 0.85 + (Math.random() * 0.30);
    return {
      fen: state.chess.fen(),
      powerPrices: {
        bribe: Math.max(30, Math.floor(50 * inflation * volatile())),
        assassinate: Math.max(25, Math.floor(40 * inflation * volatile())),
        protect: Math.max(10, Math.floor(20 * inflation * volatile())),
        bounty: Math.max(15, Math.floor(25 * inflation * volatile())),
        bait: Math.max(20, Math.floor(35 * inflation * volatile())),
        bunker: Math.max(60, Math.floor(80 * inflation * volatile()))
      }
    };
  }),
  resetGame: (preserveMultiplayer = false) => {
    const newChess = new Chess();
    set((state) => ({
      white: { influence: 0 },
      black: { influence: 0 },
      whiteTime: 300,
      blackTime: 300,
      lastTickTime: performance.now(),
      activePower: null,
      protectedPieces: [],
      bountiedPieces: [],
      baitedPieces: [],
      superPawnSquare: null,
      ticTacToeClaimed: false,
      redZone: [],
      redZoneWarning: [],
      bunkeredPieces: [],
      powerPrices: { bribe: 50, assassinate: 40, protect: 20, bounty: 25, bait: 35, bunker: 80 },
      aiCommentary: "Reset.",
      actionLog: [],
      isTilted: false,
      isPaused: false,
      isGlobalPaused: false,
      isMultiplayer: preserveMultiplayer ? state.isMultiplayer : false,
      roomId: preserveMultiplayer ? state.roomId : null,
      playerColor: preserveMultiplayer ? state.playerColor : null,
      opponentProfile: preserveMultiplayer ? state.opponentProfile : null,
      lastMove: null,
      lastAction: null,
      chess: newChess,
      fen: newChess.fen(),
      selectedSquare: null,
      validMoves: [],
      showStory: false,
      boardTampered: false,
      gameEndState: null
    }));
  },
  setShowOnboarding: (show) => set({ showOnboarding: show })
}));
