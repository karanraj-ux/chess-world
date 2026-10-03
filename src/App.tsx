import { motion, AnimatePresence } from "framer-motion";
import React, { useEffect, useRef, useCallback, useState } from "react";
import { Square, Move } from "chess.js";
import { ChessBoard } from "./components/ChessBoard";
import { Chess } from "chess.js";
import { WINNING_COMBINATIONS, SYNDICATE_SQUARES } from "./types";
import { Flame, Coins, Skull, RotateCcw, Maximize, Volume2, VolumeX, ShieldAlert, Target, AlertTriangle, Pause, Play, User, Cpu, EyeOff, Menu, MoreVertical, ScrollText, X, LogOut, Home, Crown, Swords, Clapperboard } from "lucide-react";
import { cn } from "./lib/utils";
import { generateBark } from "./lib/commentary";
import { MainMenu } from "./components/MainMenu";
import { MultiplayerLobby } from "./components/MultiplayerLobby";
import { CompanionOverlay } from "./components/CompanionOverlay";
import { audio } from "./lib/audio";
import { socket } from "./lib/socket";
import { useGameStore } from "./store/gameStore";
import { useProfileStore } from "./store/profileStore";
import { computeBestMove, BotDecision } from "./lib/bot";
import confetti from "canvas-confetti";

const getPowerCost = (powerType: 'bribe' | 'assassinate', pieceType: string, isProtected: boolean) => {
  const basePrice = useGameStore.getState().powerPrices[powerType];
  
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

const calculateMaterialScore = (chess: any, color: 'w' | 'b') => {
  let score = 0;
  const values: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.color === color) {
        score += values[piece.type] || 0;
      }
    }
  }
  return score;
};

export default function App() {
  const {
    currentView, setCurrentView, showStory, showOnboarding, isPaused, isGlobalPaused, whitePlayerType, blackPlayerType, difficulty, audioEnabled,
    isClassicMode, isTutorial, tutorialStep,
    white, black, activePower, aiCommentary, boardTampered, isTilted,
    chess, fen, selectedSquare, validMoves, isAiThinking, powerPrices,
    lastMove, lastAction, gameEndState, isMultiplayer, actionLog, whiteTime, blackTime, playerColor, opponentProfile,
    setIsPaused, setIsGlobalPaused, setLastMove, setLastAction, setGameEndState,
    setPlayerType, setDifficulty, toggleAudio, setAiCommentary, addActionLog,
    setIsAiThinking, setActivePower, setSelectedSquare, setBoardTampered, setIsTilted,
    setValidMoves, updateEconomy, syncBoard, resetGame, setShowStory, setShowOnboarding, updatePowerPrices
  } = useGameStore();

  
  const [fenHistory, setFenHistory] = useState<string[]>([]);
  const [isReplaying, setIsReplaying] = useState(false);
  const [replayStep, setReplayStep] = useState(0);
  const currentFen = useGameStore(state => state.fen);

  useEffect(() => {
    if (chess.history().length === 0) {
      setFenHistory([currentFen]);
      setIsReplaying(false);
      setReplayStep(0);
      return;
    }
    setFenHistory(prev => {
      if (prev[prev.length - 1] !== currentFen) {
        return [...prev, currentFen].slice(-10); // Keep last 10 frames
      }
      return prev;
    });
  }, [currentFen, chess]);
  
  // Replay Engine
  useEffect(() => {
    if (isReplaying && fenHistory.length > 0) {
      if (replayStep < fenHistory.length - 1) {
        const timer = setTimeout(() => {
           setReplayStep(prev => prev + 1);
           audio.playImpact();
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [isReplaying, replayStep, fenHistory.length]);

  const containerRef = useRef<HTMLDivElement>(null);
  const botWorker = useRef<Worker | null>(null);
  const aiTurnActive = useRef(false);
  const recordedMatch = useRef(false);
  const [boardShake, setBoardShake] = useState(false);
  const [heavyShake, setHeavyShake] = useState(false);
  const [showActionLog, setShowActionLog] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  
  const [incomingChallenge, setIncomingChallenge] = useState<{challengerName: string, challengerId: string} | null>(null);
  const [challengeSent, setChallengeSent] = useState(false);
  const [sosCopied, setSosCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  
  const roastUser = (msg: string) => {
    const store = useGameStore.getState();
    store.setActiveRoast(msg);
    setTimeout(() => {
      if (useGameStore.getState().activeRoast === msg) {
        useGameStore.getState().setActiveRoast(null);
      }
    }, 4500);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };
  
  const handleSOS = () => {
     const store = useGameStore.getState();
     const url = `${window.location.origin}/?backup=${store.roomId}&side=${store.playerColor}`;
     navigator.clipboard.writeText(url);
     setSosCopied(true);
     setTimeout(() => setSosCopied(false), 3000);
  };
  
  const { username } = useProfileStore();

  const whiteName = opponentProfile ? (playerColor === 'w' || (!isMultiplayer && playerColor !== 'b') ? username : opponentProfile.name) : 'White';
  const blackName = opponentProfile ? (playerColor === 'b' ? username : opponentProfile.name) : 'Black';

  const isGameOver = chess.isGameOver() || !!gameEndState;

  const broadcastState = useCallback(() => {
    const state = useGameStore.getState();
    if (state.isMultiplayer && state.roomId) {
      socket.emit('sync-state', {
        roomId: state.roomId,
        state: {
          fen: state.chess.fen(),
          white: state.white,
          black: state.black,
          powerPrices: state.powerPrices,
          protectedPieces: state.protectedPieces,
          bountiedPieces: state.bountiedPieces,
          baitedPieces: state.baitedPieces,
          bunkeredPieces: state.bunkeredPieces,
          superPawnSquare: state.superPawnSquare,
          ticTacToeClaimed: state.ticTacToeClaimed,
          redZone: state.redZone,
          redZoneWarning: state.redZoneWarning,
          isPaused: state.isPaused,
          isGlobalPaused: state.isGlobalPaused,
          gameEndState: state.gameEndState,
          lastMove: state.lastMove,
          lastAction: state.lastAction,
          isTilted: state.isTilted,
          whiteTime: state.whiteTime,
          blackTime: state.blackTime,
        }
      });
    }
  }, []);

  useEffect(() => {
    const state = useGameStore.getState();
    if (!state.isMultiplayer) return;
    
    const handleStateUpdate = ({ state: newState }: any) => {
      const localState = useGameStore.getState();
      localState.chess.load(newState.fen);
      
      useGameStore.setState({
        fen: newState.fen,
        white: newState.white,
        black: newState.black,
        powerPrices: newState.powerPrices || localState.powerPrices,
        protectedPieces: newState.protectedPieces,
        bountiedPieces: newState.bountiedPieces,
        baitedPieces: newState.baitedPieces,
        bunkeredPieces: newState.bunkeredPieces || [],
        superPawnSquare: newState.superPawnSquare,
        ticTacToeClaimed: newState.ticTacToeClaimed,
        redZone: newState.redZone,
        redZoneWarning: newState.redZoneWarning,
        isPaused: newState.isPaused,
        isGlobalPaused: newState.isGlobalPaused,
        gameEndState: newState.gameEndState,
        lastMove: newState.lastMove,
        lastAction: newState.lastAction,
        isTilted: newState.isTilted,
        whiteTime: newState.whiteTime,
        blackTime: newState.blackTime,
      });
    };

    socket.on('state-updated', handleStateUpdate);
    
    socket.on('opponent-disconnected', () => {
      const state = useGameStore.getState();
      if (state.currentView === 'playing' && !state.gameEndState && state.isMultiplayer && state.playerColor !== 'spectator') {
         setGameEndState({ over: true, reason: 'opponent_disconnected', winner: state.playerColor as 'w' | 'b' });
         showToast("Opponent fled! You win by forfeit.");
      }
    });

    socket.on('challenge-received', (data) => {
      setIncomingChallenge(data);
    });
    socket.on('challenge-accepted', (data) => {
      // If we are the spectator who challenged, we become a player
      const store = useGameStore.getState();
      if (store.playerColor === 'spectator') {
         store.setPlayerColor(data.winnerWasWhite ? 'b' : 'w');
      }
      store.resetGame();
      store.setCurrentView('playing');
      setChallengeSent(false);
      setIncomingChallenge(null);
    });

    socket.on('spectator-taunt', (data) => {
      if (audioEnabled) {
         audio.playAudioTaunt(data.type);
      }
    });

    socket.on('backup-granted', (data) => {
      const store = useGameStore.getState();
      if (store.playerColor === data.side) {
         store.updateEconomy(data.side, 50, false);
         audio.playPowerUp();
         store.addActionLog("SOS ANSWERED", `${data.helperName} joined! +50 Influence.`);
      }
      if (store.playerColor === 'spectator') {
         store.addActionLog("BACKUP", `${data.helperName} joined to help ${data.side === 'w' ? 'White' : 'Black'}!`);
      }
    });

    return () => {
      
      socket.off('opponent-disconnected');
      socket.off('state-updated', handleStateUpdate);

      socket.off('challenge-received');
      socket.off('challenge-accepted');
      socket.off('backup-granted');
      socket.off('spectator-taunt');
    };
  }, [useGameStore.getState().isMultiplayer]);

  // Keyboard Shortcuts (Hardcore Gamer request)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if they are typing in chat
      if (document.activeElement?.tagName === 'INPUT') return;
      
      const store = useGameStore.getState();
      // Only if it's our turn and we are playing
      if (store.currentView !== 'playing' || chess.isGameOver() || store.gameEndState) return;
      if (store.isMultiplayer && store.playerColor === 'spectator') return;
      
      const isWhiteTurn = chess.turn() === "w";
      if (!store.isMultiplayer) {
         if ((isWhiteTurn && store.whitePlayerType === "ai") || (!isWhiteTurn && store.blackPlayerType === "ai")) return;
      } else {
         if ((isWhiteTurn && store.playerColor === 'b') || (!isWhiteTurn && store.playerColor === 'w')) return;
      }

      switch(e.key) {
        case '1':
          handlePowerClick('bribe');
          break;
        case '2':
          handlePowerClick('assassinate');
          break;
        case '3':
          handlePowerClick('protect');
          break;
        case '4':
          handlePowerClick('bunker');
          break;
        case '5':
          handlePowerClick('bounty');
          break;
        case '6':
          handlePowerClick('bait');
          break;
        case 'Escape':
          store.setActivePower(null);
          store.setSelectedSquare(null);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [chess, isGameOver]);

  // Timer Tick Effect
  useEffect(() => {
    const interval = setInterval(() => {
      const store = useGameStore.getState();
      if (store.currentView === "playing" && !store.showOnboarding) {
        store.decrementTime();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // SOS URL Parsing
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const backupRoom = searchParams.get('backup');
    const backupSide = searchParams.get('side');
    
    if (backupRoom && backupSide) {
       const store = useGameStore.getState();
       const pStore = useProfileStore.getState();
       
       // Clean URL
       window.history.replaceState({}, document.title, window.location.pathname);
       
       store.setIsMultiplayer(true);
       store.setRoomId(backupRoom);
       store.setPlayerColor('spectator');
       store.setCurrentView('playing');
       
       socket.emit("join-room", { roomId: backupRoom, userId: pStore.userId, username: pStore.username, roomName: "SOS Table" });
       socket.emit("backup-arrived", { roomId: backupRoom, side: backupSide, helperName: pStore.username });
    }
  }, []);

  // Initialize Worker
  useEffect(() => {
    // Check first-time visit
    const hasCompleted = localStorage.getItem('sovereign_tutorial_completed');
    if (!hasCompleted) {
      const store = useGameStore.getState();
      store.setPlayerType('w', 'human');
      store.setPlayerType('b', 'ai');
      store.setDifficulty('easy');
      store.setIsPaused(false);
      store.setIsClassicMode(false);
      store.setIsTutorial(true);
      store.setTutorialStep(0);
      store.updateEconomy('w', 60, true);
      store.setCurrentView('playing');
      store.setShowOnboarding(false);
    }

    botWorker.current = new Worker(new URL('./lib/bot.worker.ts', import.meta.url), { type: 'module' });
    botWorker.current.onerror = (e) => {
      console.warn("Worker error:", e);
      setIsAiThinking(false);
    };

    return () => {
      botWorker.current?.terminate();
    };
  }, [setIsAiThinking]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.warn("Fullscreen failed", err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const handleToggleAudio = () => {
    audio.toggle();
    toggleAudio();
  };

  const requestCommentary = useCallback((action: string, lastMove: string) => {
    setIsAiThinking(true);
    addActionLog(action, lastMove);
    setTimeout(() => {
      const bark = generateBark(action, lastMove);
      setAiCommentary(bark);
      setIsAiThinking(false);
    }, 400);
  }, [setAiCommentary, setIsAiThinking, addActionLog]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const handleLocalSyncBoard = useCallback(() => {
    syncBoard();
    broadcastState();
  }, [syncBoard, broadcastState]);

  const checkRedZone = useCallback(() => {
    const state = useGameStore.getState();
    const ply = chess.history().length;
    
    // Decrement bunkers
    const newBunkered = state.bunkeredPieces
       .map(bp => ({ ...bp, plysLeft: bp.plysLeft - 1 }))
       .filter(bp => bp.plysLeft > 0);
    state.setBunkeredPieces(newBunkered);

    let activeLayer = -1;
    let warningLayer = -1;

    if (ply >= 62) { activeLayer = 2; }
    else if (ply >= 58) { activeLayer = 1; warningLayer = 2; }
    else if (ply >= 42) { activeLayer = 1; }
    else if (ply >= 38) { activeLayer = 0; warningLayer = 1; }
    else if (ply >= 22) { activeLayer = 0; }
    else if (ply >= 18) { warningLayer = 0; }

    const getSquaresForLayer = (maxLayer: number) => {
      const squares: Square[] = [];
      const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
      const ranks = ['1', '2', '3', '4', '5', '6', '7', '8'];
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const distFromEdge = Math.min(r, 7 - r, c, 7 - c);
          if (distFromEdge <= maxLayer) {
            squares.push(`${files[c]}${ranks[r]}` as Square);
          }
        }
      }
      return squares;
    };

    const activeZones = activeLayer >= 0 ? getSquaresForLayer(activeLayer) : [];
    const warningZones = warningLayer >= 0 ? getSquaresForLayer(warningLayer) : [];

    state.setRedZone(activeZones);
    state.setRedZoneWarning(warningZones.filter(sq => !activeZones.includes(sq)));

    if (ply === 18 || ply === 38 || ply === 58) {
      requestCommentary("Grid Collapse Imminent", "The outer edges are destabilizing. Move to the center!");
    } else if (ply === 22 || ply === 42 || ply === 62) {
      requestCommentary("Grid Collapsed", "The Red Zone has expanded! Any pieces caught inside are vaporized.");
    }

    if (activeZones.length > 0) {
      let wiped = false;
      let deadKings: ('w' | 'b')[] = [];
      
      const bunkeredSquares = state.bunkeredPieces.map(bp => bp.square);

      activeZones.forEach(sq => {
        const p = chess.get(sq);
        if (p) {
          if (bunkeredSquares.includes(sq)) {
            // Piece is bunkered, survives the red zone this turn
          } else if (p.type === 'k') {
             deadKings.push(p.color);
          } else {
             chess.remove(sq);
             wiped = true;
          }
        }
      });
      
      if (deadKings.length === 2) {
        state.setGameEndState({ over: true, reason: 'Mutual Annihilation in the Red Zone', winner: null });
        handleLocalSyncBoard();
      } else if (deadKings.length === 1) {
        state.setGameEndState({ over: true, reason: 'Consumed by the Red Zone', winner: deadKings[0] === 'w' ? 'b' : 'w' });
        handleLocalSyncBoard();
      } else if (wiped) {
        audio.playImpact();
        setHeavyShake(true);
        setTimeout(() => setHeavyShake(false), 600);
        handleLocalSyncBoard();
      }
    }
  }, [chess, requestCommentary, audio]);

  const checkTicTacToe = useCallback((color: "w" | "b") => {
    const state = useGameStore.getState();
    if (state.ticTacToeClaimed) return;

    for (const combo of WINNING_COMBINATIONS) {
      const pieces = combo.map(sq => chess.get(sq as Square));
      if (pieces.every(p => p && p.color === color)) {
        
        state.setTicTacToeClaimed(true);
        const squares = ['a1','b1','c1','d1','e1','f1','g1','h1','a2','b2','c2','d2','e2','f2','g2','h2','a3','b3','c3','d3','e3','f3','g3','h3','a4','b4','c4','d4','e4','f4','g4','h4','a5','b5','c5','d5','e5','f5','g5','h5','a6','b6','c6','d6','e6','f6','g6','h6','a7','b7','c7','d7','e7','f7','g7','h7','a8','b8','c8','d8','e8','f8','g8','h8'];
        const pawns = squares.filter(sq => { const p = chess.get(sq as Square); return p && p.type === 'p' && p.color === color; });
        if (pawns.length > 0) {
           const chosenPawn = pawns[Math.floor(Math.random() * pawns.length)];
           state.setSuperPawnSquare(chosenPawn);
           requestCommentary("Syndicate Edict", `${color === 'w' ? 'White' : 'Black'} completed a Syndicate line! A random pawn at ${chosenPawn} has been granted the Centaur Power (Pawn + Knight).`);
        } else {
           requestCommentary("Syndicate Edict", `${color === 'w' ? 'White' : 'Black'} completed a Syndicate line! But they had no pawns to grant power to.`);
        }

        // Winner heavily taxed: lose 50% of accumulated credits
        const winnerInfluence = color === 'w' ? state.white.influence : state.black.influence;
        state.updateEconomy(color, Math.floor(winnerInfluence / 2), true); 

        // Loser gets pieces wiped off Tic-Tac-Toe squares but keeps their credits
        const loser = color === 'w' ? 'b' : 'w';

        let wiped = false;
        SYNDICATE_SQUARES.forEach(sq => {
           const p = chess.get(sq as Square);
           if (p && p.color === loser && p.type !== 'k') {
              chess.remove(sq as Square);
              wiped = true;
           }
        });
        
        if (wiped) handleLocalSyncBoard();

        audio.playEdict();
        // commentary handled above
        break;
      }
    }
  }, [chess, requestCommentary, syncBoard]);

  // AI Turn Logic
  useEffect(() => {
    if (isGameOver) {
      aiTurnActive.current = false;
      return;
    }
    if (showOnboarding) return;

    const currentTurn = chess.turn();
    const currentPlayerType = currentTurn === 'w' ? whitePlayerType : blackPlayerType;
    const currentInfluence = currentTurn === 'w' ? white.influence : black.influence;

    if (currentPlayerType === 'ai' && !isPaused && !isGlobalPaused) {
      if (aiTurnActive.current) return;
      aiTurnActive.current = true;
      setIsAiThinking(true);
      
      const stateSnapshot = useGameStore.getState();
      const isGhostBot = !!stateSnapshot.opponentProfile?.isGhostBot;
      const initialDelay = isGhostBot ? 400 : 300;

      const aiTimer = setTimeout(async () => {
        const stateNow = useGameStore.getState();
        if (isGameOver || !!stateNow.gameEndState || stateNow.isPaused || stateNow.isGlobalPaused || chess.turn() !== currentTurn) {
          aiTurnActive.current = false;
          setIsAiThinking(false);
          return;
        }

        const executeDecision = (botDecision: BotDecision | null) => {
          aiTurnActive.current = false;
          setIsAiThinking(false);
          const state = useGameStore.getState();
          if (!!state.gameEndState || chess.turn() !== currentTurn) {
             return;
          }
          if (!botDecision) {
             if (chess.isCheckmate()) {
               const winner = chess.turn() === 'w' ? 'b' : 'w';
               setGameEndState({ over: true, reason: 'checkmate', winner });
             } else {
               setGameEndState({ over: true, reason: 'stalemate', winner: null });
             }
             return;
          }

          // 1. If AI used a power (bribe or assassinate)
          if (botDecision.power) {
            const { action, target } = botDecision.power;
            const piece = chess.get(target);
            if (piece) {
              const isProtected = state.protectedPieces.includes(target);
              const cost = getPowerCost(action, piece.type, isProtected);

              if (action === "assassinate") {
                chess.remove(target);
                if (isProtected) {
                  state.setProtectedPieces(state.protectedPieces.filter(sq => sq !== target));
                }
                updateEconomy(currentTurn, -cost);
                audio.playAssassinate();
                setHeavyShake(true);
                setTimeout(() => setHeavyShake(false), 600);
                requestCommentary("Assassination", `${currentTurn} assassinated the piece on ${target}`);
              } else if (action === "bribe") {
                chess.remove(target);
                chess.put({ type: piece.type, color: currentTurn }, target);
                if (isProtected) {
                  state.setProtectedPieces(state.protectedPieces.filter(sq => sq !== target));
                }
                updateEconomy(currentTurn, -cost);
                audio.playBribe();
                confetti({
                  particleCount: 50,
                  spread: 60,
                  origin: { y: 0.5 },
                  colors: ['#f59e0b', '#fbbf24', '#fcd34d']
                });
                requestCommentary("Bribe", `${currentTurn} bribed the piece on ${target}`);
              }
              handleLocalSyncBoard();
            }
          }

          // 2. Make the chess piece move
          if (botDecision.from && botDecision.to) {
            try {
              const moveObj: any = {
                from: botDecision.from,
                to: botDecision.to,
              };
              if (botDecision.promotion) {
                moveObj.promotion = botDecision.promotion;
              }

              let move;
              const p = chess.get(botDecision.from);
              if (state.superPawnSquare === botDecision.from && p && p.type === 'p') {
                const standardMoves = chess.moves({ verbose: true }) as Move[];
                const isStandard = standardMoves.some(m => m.from === botDecision.from && m.to === botDecision.to);
                if (!isStandard) {
                  chess.remove(botDecision.from);
                  chess.put({ type: 'n', color: currentTurn }, botDecision.from);
                  move = chess.move(moveObj);
                  chess.remove(botDecision.to);
                  const isLastRank = currentTurn === 'w' ? botDecision.to.endsWith('8') : botDecision.to.endsWith('1');
                  if (isLastRank) {
                    chess.put({ type: 'q', color: currentTurn }, botDecision.to);
                    state.setSuperPawnSquare(null);
                  } else {
                    chess.put({ type: 'p', color: currentTurn }, botDecision.to);
                    state.setSuperPawnSquare(botDecision.to);
                  }
                } else {
                  move = chess.move(moveObj);
                  if (move) state.setSuperPawnSquare(botDecision.to);
                }
              } else {
                move = chess.move(moveObj);
                if (move && state.superPawnSquare === botDecision.from) {
                  state.setSuperPawnSquare(botDecision.to);
                }
              }
              
              if (move) {
                setLastMove({ from: botDecision.from, to: botDecision.to });
                setLastAction(null);

                const stateLatest = useGameStore.getState();
                const hadBounty = stateLatest.bountiedPieces.includes(botDecision.to as Square);
                const hadBait = stateLatest.baitedPieces.includes(botDecision.to as Square);

                const { protectedPieces, setProtectedPieces } = stateLatest;
                let newProtected = protectedPieces.filter(sq => sq !== botDecision.to);
                if (newProtected.includes(botDecision.from)) {
                   newProtected = newProtected.filter(sq => sq !== botDecision.from);
                   newProtected.push(botDecision.to);
                }
                setProtectedPieces(newProtected);
                let newBountied = stateLatest.bountiedPieces.filter(sq => sq !== botDecision.to);
                if (newBountied.includes(botDecision.from as Square)) {
                   newBountied = newBountied.filter(sq => sq !== botDecision.from);
                   newBountied.push(botDecision.to as Square);
                }
                stateLatest.setBountiedPieces(newBountied);
                let newBaited = stateLatest.baitedPieces.filter(sq => sq !== botDecision.to);
                if (newBaited.includes(botDecision.from as Square)) {
                   newBaited = newBaited.filter(sq => sq !== botDecision.from);
                   newBaited.push(botDecision.to as Square);
                }
                stateLatest.setBaitedPieces(newBaited);
                let newBunkered = stateLatest.bunkeredPieces.filter(bp => bp.square !== botDecision.to);
                const bunkeredPiece = newBunkered.find(bp => bp.square === botDecision.from);
                if (bunkeredPiece) {
                   bunkeredPiece.square = botDecision.to as Square;
                }
                stateLatest.setBunkeredPieces(newBunkered);
                
                let gainedInfluence = 10;
                if (move.captured) {
                  gainedInfluence += 20;
                  
                  // Comeback Mechanic
                  const myMaterial = calculateMaterialScore(chess, currentTurn);
                  const enemyMaterial = calculateMaterialScore(chess, currentTurn === 'w' ? 'b' : 'w');
                  if (myMaterial <= enemyMaterial - 5) {
                    gainedInfluence = Math.floor(gainedInfluence * 1.5);
                    requestCommentary("Underdog Bonus", `${currentTurn} gains 1.5x Influence for capturing while behind on material!`);
                  }

                  audio.playCapture();
                  if (hadBounty) {
                     gainedInfluence += 100;
                     requestCommentary("Bounty Claimed", `${currentTurn} claimed the bounty on ${botDecision.to}! (+100 Influence)`);
                  }
                  if (hadBait) {
                     if (move.piece !== 'k') {
                       chess.remove(botDecision.to as Square);
                       requestCommentary("Trap Sprung!", `The piece on ${botDecision.to} was bait! The capturer has been eliminated.`);
                     } else {
                       requestCommentary("Trap Failed!", `The King sprung the trap on ${botDecision.to}, but Kings are immune!`);
                     }
                  }

                } else {
                  audio.playMove();
                }

                updateEconomy(currentTurn, gainedInfluence);
                setSelectedSquare(null);
                handleLocalSyncBoard();
                checkRedZone();
                checkTicTacToe(currentTurn);
                requestCommentary("Standard Move", `${currentTurn} moved ${move.piece} from ${move.from} to ${move.to}${move.captured ? ' capturing ' + move.captured : ''}`);
              }
            } catch (e) {
              console.warn("AI move execution error:", e);
              handleLocalSyncBoard();
            }
          }
          aiTurnActive.current = false;
          setIsAiThinking(false);
        };

        let handled = false;
        const deliverDecision = (decision: BotDecision | null) => {
          if (handled) return;
          handled = true;

          if (isGhostBot) {
            const legalMoves = chess.moves().length;
            let minDelay = 2000;
            let maxDelay = 3000;
            if (legalMoves >= 35) {
              minDelay = 5000;
              maxDelay = 7000;
            } else if (legalMoves >= 15) {
              minDelay = 3000;
              maxDelay = 5000;
            }
            const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
            setTimeout(() => executeDecision(decision), delay);
          } else {
            setTimeout(() => executeDecision(decision), 400);
          }
        };

        // Fallback local compute timer if worker is slow or unavailable
        const fallbackTimer = setTimeout(async () => {
          if (!handled) {
            try {
              const res = await computeBestMove(
                new Chess(chess.fen()),
                currentInfluence,
                currentTurn,
                difficulty,
                stateNow.protectedPieces,
                stateNow.superPawnSquare,
                stateNow.powerPrices,
                stateNow.bountiedPieces,
                stateNow.baitedPieces,
                stateNow.redZone,
                stateNow.redZoneWarning,
                isTilted,
                stateNow.isClassicMode
              );
              deliverDecision(res);
            } catch (err) {
              console.warn("Fallback compute error:", err);
              aiTurnActive.current = false;
              setIsAiThinking(false);
            }
          }
        }, 4000);

        try {
          if (!botWorker.current) {
            botWorker.current = new Worker(new URL('./lib/bot.worker.ts', import.meta.url), { type: 'module' });
            botWorker.current.onerror = (e) => {
              console.warn("Worker error:", e);
            };
          }

          botWorker.current.onmessage = (e) => {
            clearTimeout(fallbackTimer);
            if (e.data && !e.data.error) {
              deliverDecision(e.data);
            } else {
              computeBestMove(
                new Chess(chess.fen()),
                currentInfluence,
                currentTurn,
                difficulty,
                stateNow.protectedPieces,
                stateNow.superPawnSquare,
                stateNow.powerPrices,
                stateNow.bountiedPieces,
                stateNow.baitedPieces,
                stateNow.redZone,
                stateNow.redZoneWarning,
                isTilted,
                stateNow.isClassicMode
              ).then(deliverDecision).catch(() => {
                aiTurnActive.current = false;
                setIsAiThinking(false);
              });
            }
          };

          botWorker.current.postMessage({
            fen: chess.fen(),
            botInfluence: currentInfluence,
            botColor: currentTurn,
            difficulty,
            powerPrices: stateNow.powerPrices,
            protectedPieces: stateNow.protectedPieces,
            bountiedPieces: stateNow.bountiedPieces,
            baitedPieces: stateNow.baitedPieces,
            superPawnSquare: stateNow.superPawnSquare,
            redZone: stateNow.redZone,
            redZoneWarning: stateNow.redZoneWarning,
            isTilted,
            isClassicMode: stateNow.isClassicMode
          });
        } catch (workerSpawnErr) {
          clearTimeout(fallbackTimer);
          computeBestMove(
            new Chess(chess.fen()),
            currentInfluence,
            currentTurn,
            difficulty,
            stateNow.protectedPieces,
            stateNow.superPawnSquare,
            stateNow.powerPrices,
            stateNow.bountiedPieces,
            stateNow.baitedPieces,
            stateNow.redZone,
            stateNow.redZoneWarning,
            isTilted,
            stateNow.isClassicMode
          ).then(deliverDecision).catch(() => {
            aiTurnActive.current = false;
            setIsAiThinking(false);
          });
        }
      }, initialDelay);

      return () => {
        clearTimeout(aiTimer);
      };
    } else {
      aiTurnActive.current = false;
    }
  }, [fen, isPaused, isGlobalPaused, isTilted, isGameOver, whitePlayerType, blackPlayerType, difficulty, showOnboarding, chess, white.influence, black.influence, syncBoard, requestCommentary, checkTicTacToe, updateEconomy, setSelectedSquare, setIsAiThinking]);

  const handleSquareClick = (square: Square) => {
    if (isGameOver || isGlobalPaused) return;
    
    const turn = chess.turn();
    const currentPlayerType = turn === 'w' ? whitePlayerType : blackPlayerType;
    const { isMultiplayer, playerColor } = useGameStore.getState();
    const activeColor = isMultiplayer ? (playerColor as 'w' | 'b') : turn;
    
    if (isMultiplayer && playerColor === 'spectator') return;
    
    if (isMultiplayer && playerColor !== turn && !isPaused) {
      setBoardShake(true);
      setTimeout(() => setBoardShake(false), 400);
      return;
    }
    
    // Prevent interaction when AI is thinking unpaused
    if (currentPlayerType === 'ai' && !isPaused) {
      setBoardShake(true);
      setTimeout(() => setBoardShake(false), 400);
      return;
    }

    // Prevent manual piece movement when paused (only powers allowed while paused)
    if (isPaused && !activePower) {
      showToast("Grid is frozen. Only dark powers may be used while paused.");
      setBoardShake(true);
      setTimeout(() => setBoardShake(false), 400);
      return;
    }

    const currentPlayerState = activeColor === 'w' ? white : black;
    const piece = chess.get(square);

    // --- HANDLE POWERS ---
    if (activePower === "bunker") {
      if (!piece) return;
      if (piece.color !== turn) {
        showToast("You can only bunker your own pieces.");
        return;
      }
      
      const { bunkeredPieces, setBunkeredPieces } = useGameStore.getState();
      
      if (bunkeredPieces.some(bp => bp.square === square)) {
        showToast("Piece is already bunkered!");
        return;
      }
      
      const bunkerCost = powerPrices.bunker;
      if (currentPlayerState.influence < bunkerCost) {
         showToast(`Not enough influence to bunker! Need ${bunkerCost}.`);
         return;
      }

      setBunkeredPieces([...bunkeredPieces, { square, plysLeft: 4 }]);
      updateEconomy(activeColor, -bunkerCost);
      useProfileStore.getState().recordPowerUse("bunker");
      setActivePower(null);
      setLastAction({ type: 'bunker', square });
      if (isPaused) setBoardTampered(true);
      setSelectedSquare(null);
      setValidMoves([]);
      handleLocalSyncBoard();
      audio.playMove(); // fallback sound for bunker
      requestCommentary("Bunker Activated", `${turn} bunkered the piece on ${square} for 2 turns`);
      return;
    }

    if (activePower === "protect") {
      if (!piece) return;
      if (piece.color !== turn) {
        showToast("You can only protect your own pieces.");
        return;
      }
      if (piece.type === "k") {
        showToast("Kings don't need protection in this way.");
        return;
      }
      
      const { protectedPieces, setProtectedPieces } = useGameStore.getState();
      
      if (protectedPieces.includes(square)) {
        showToast("Piece is already protected!");
        return;
      }
      
      const playerProtected = protectedPieces.filter(sq => {
         const p = chess.get(sq);
         return p && p.color === turn;
      });
      if (playerProtected.length >= 3) {
         showToast("You can only protect up to 3 pieces at a time.");
         return;
      }
      
      const protectCost = powerPrices.protect;
      if (currentPlayerState.influence < protectCost) {
         showToast(`Not enough influence to protect! Need ${protectCost}.`);
         return;
      }

      setProtectedPieces([...protectedPieces, square]);
      updateEconomy(activeColor, -protectCost);
      useProfileStore.getState().recordPowerUse("protect");
      setActivePower(null);
      setLastAction({ type: 'protect', square });
      if (isPaused) setBoardTampered(true);
      setSelectedSquare(null);
      setValidMoves([]);
      handleLocalSyncBoard();
      audio.playMove(); // fallback sound for protect
      requestCommentary("Protection", `${turn} protected the piece on ${square}`);
      return;
    }

    if (activePower === "bounty") {
      if (!piece) return;
      if (piece.color === turn) {
        showToast("You cannot place a bounty on your own piece.");
        return;
      }
      const state = useGameStore.getState();
      if (state.bountiedPieces.includes(square)) {
        showToast("This piece already has a bounty.");
        return;
      }
      state.setBountiedPieces([...state.bountiedPieces, square]);
      updateEconomy(activeColor, -powerPrices.bounty);
      useProfileStore.getState().recordPowerUse("bounty");
      setActivePower(null);
      setLastAction(null);
      if (isPaused) setBoardTampered(true);
      setSelectedSquare(null);
      setValidMoves([]);
      handleLocalSyncBoard();
      audio.playMove();
      requestCommentary("Bounty", `${turn} placed a bounty on ${square}`);
      return;
    }

    if (activePower === "bait") {
      if (!piece) return;
      if (piece.color !== turn) {
        showToast("You can only bait your own piece.");
        return;
      }
      const state = useGameStore.getState();
      if (state.baitedPieces.includes(square)) {
        showToast("This piece is already baited.");
        return;
      }
      state.setBaitedPieces([...state.baitedPieces, square]);
      updateEconomy(activeColor, -powerPrices.bait);
      useProfileStore.getState().recordPowerUse("bait");
      setActivePower(null);
      setLastAction({ type: 'bait', square });
      if (isPaused) setBoardTampered(true);
      setSelectedSquare(null);
      setValidMoves([]);
      handleLocalSyncBoard();
      audio.playMove();
      requestCommentary("Bait", `${turn} baited their piece on ${square}`);
      return;
    }
    if (activePower === "bribe") {
      if (!piece) return;
      if (piece.color === turn) {
        showToast("You cannot bribe your own piece.");
        return;
      }
      if (piece.type === "k" || piece.type === "q") {
        showToast("Kings and Queens cannot be bribed.");
        return;
      }
      
      const state = useGameStore.getState();
      const enemy = turn === 'w' ? 'b' : 'w';
      
      const isProtected = state.protectedPieces.includes(square);
      const cost = getPowerCost('bribe', piece.type, isProtected);
      
      if (state.baitedPieces.includes(square)) {
         roastUser("You really just spent your life savings on a double-agent. Tragic.");
      }

      if (currentPlayerState.influence < cost) {
         showToast(`Not enough influence! Need ${cost} to bribe this piece.`);
         return;
      }
      
      chess.remove(square);
      chess.put({ type: piece.type, color: turn }, square);
      
      if (isProtected) {
         state.setProtectedPieces(state.protectedPieces.filter(sq => sq !== square));
      }
      
      updateEconomy(activeColor, -cost);
      useProfileStore.getState().recordPowerUse("bribe");
      setActivePower(null);
      setLastAction({ type: 'bribe', square });
      if (isPaused) setBoardTampered(true);
      setSelectedSquare(null);
      setValidMoves([]);
      handleLocalSyncBoard();
      audio.playBribe();
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.5 },
        colors: ['#f59e0b', '#fbbf24', '#fcd34d']
      });
      requestCommentary("Bribe", `${turn} bribed the piece on ${square}`);
      return;
    }

    if (activePower === "assassinate") {
      if (!piece) return;
      if (piece.color === turn) {
        showToast("You cannot assassinate your own piece.");
        return;
      }
      if (piece.type === "k") {
        showToast("Kings cannot be assassinated directly.");
        return;
      }
      
      const state = useGameStore.getState();
      const enemy = turn === 'w' ? 'b' : 'w';

      
      const isProtected = state.protectedPieces.includes(square);
      const cost = getPowerCost('assassinate', piece.type, isProtected);
      
      if (state.bunkeredPieces.some(p => p.square === square)) {
         roastUser("Trying to assassinate someone in a bunker? I calculate 0% success rate.");
      } else if (isProtected) {
         roastUser("You just wasted wealth hitting a shield. I expected better.");
      }

      if (currentPlayerState.influence < cost) {
         showToast(`Not enough influence! Need ${cost} to assassinate this piece.`);
         return;
      }
      
      chess.remove(square);
      
      if (isProtected) {
         state.setProtectedPieces(state.protectedPieces.filter(sq => sq !== square));
      }
      
      updateEconomy(activeColor, -cost);
      useProfileStore.getState().recordPowerUse("assassinate");
      setActivePower(null);
      setLastAction({ type: 'kill', square });
      if (isPaused) setBoardTampered(true);
      setSelectedSquare(null);
      setValidMoves([]);
      handleLocalSyncBoard();
      audio.playAssassinate();
      setHeavyShake(true);
      setTimeout(() => setHeavyShake(false), 600);
      requestCommentary("Assassination", `${turn} assassinated the piece on ${square}`);
      return;
    }

    // --- NORMAL MOVEMENT ---
    if (!selectedSquare) {
      if (piece && piece.color === turn) {
        setSelectedSquare(square);
        let moves = chess.moves({ square, verbose: true }) as Move[];
        let toSquares = moves.map(m => m.to as Square);
        
        // Super Pawn Centaur logic
        const state = useGameStore.getState();
        if (state.superPawnSquare === square && piece.type === 'p') {
           chess.remove(square);
           chess.put({ type: 'n', color: turn }, square);
           const knightMoves = chess.moves({ square, verbose: true }) as Move[];
           toSquares = [...new Set([...toSquares, ...knightMoves.map(m => m.to as Square)])];
           chess.remove(square);
           chess.put({ type: 'p', color: turn }, square);
        }
        
        setValidMoves(toSquares);
      }
      return;
    }

    if (selectedSquare === square) {
      setSelectedSquare(null);
      setValidMoves([]);
      return;
    }

    try {
      const allMoves = chess.moves({ verbose: true }) as Move[];
      const possibleMove = allMoves.find(m => m.from === selectedSquare && m.to === square);
      
      const moveObj: any = {
        from: selectedSquare,
        to: square,
      };
      
      if (possibleMove && possibleMove.promotion) {
        moveObj.promotion = 'q';
      }
      
      let move;
      const state = useGameStore.getState();
      const sourcePiece = chess.get(selectedSquare);

      if (!possibleMove && state.superPawnSquare === selectedSquare && sourcePiece && sourcePiece.type === 'p') {
         chess.remove(selectedSquare);
         chess.put({ type: 'n', color: turn }, selectedSquare);
         const kmoves = chess.moves({ square: selectedSquare, verbose: true });
         const kmove = kmoves.find(m => m.from === selectedSquare && m.to === square);
         
         if (kmove) {
           move = chess.move({ from: selectedSquare, to: square, promotion: 'q' });
           chess.remove(square);
           const isLastRank = turn === 'w' ? square.endsWith('8') : square.endsWith('1');
           if (isLastRank) {
              chess.put({ type: 'q', color: turn }, square);
              state.setSuperPawnSquare(null);
           } else {
              chess.put({ type: 'p', color: turn }, square);
              state.setSuperPawnSquare(square);
           }
         } else {
           chess.remove(selectedSquare);
           chess.put({ type: 'p', color: turn }, selectedSquare);
           move = chess.move(moveObj);
         }
      } else {
         move = chess.move(moveObj);
         if (move && state.superPawnSquare === selectedSquare) {
             const isLastRank = turn === 'w' ? square.endsWith('8') : square.endsWith('1');
             if (isLastRank) {
               state.setSuperPawnSquare(null);
             } else {
               state.setSuperPawnSquare(square);
             }
         }
      }
      
      setLastMove({ from: selectedSquare, to: square });
      setLastAction(null);

      const hadBounty = state.bountiedPieces.includes(square);
      const hadBait = state.baitedPieces.includes(square);

      const { protectedPieces, setProtectedPieces } = useGameStore.getState();
      let newProtected = protectedPieces.filter(sq => sq !== square); // remove protection if piece was captured
      if (newProtected.includes(selectedSquare)) {
         newProtected = newProtected.filter(sq => sq !== selectedSquare);
         newProtected.push(square); // transfer protection to new square
      }
      setProtectedPieces(newProtected);
      let newBountied = useGameStore.getState().bountiedPieces.filter(sq => sq !== square);
      if (newBountied.includes(selectedSquare)) {
         newBountied = newBountied.filter(sq => sq !== selectedSquare);
         newBountied.push(square);
      }
      useGameStore.getState().setBountiedPieces(newBountied);
      let newBaited = useGameStore.getState().baitedPieces.filter(sq => sq !== square);
      if (newBaited.includes(selectedSquare)) {
         newBaited = newBaited.filter(sq => sq !== selectedSquare);
         newBaited.push(square);
      }
      useGameStore.getState().setBaitedPieces(newBaited);

      let newBunkered = useGameStore.getState().bunkeredPieces.filter(bp => bp.square !== square);
      const bunkeredPiece = newBunkered.find(bp => bp.square === selectedSquare);
      if (bunkeredPiece) {
         bunkeredPiece.square = square;
      }
      useGameStore.getState().setBunkeredPieces(newBunkered);

      let gainedInfluence = 10;
      if (move.captured) {
        gainedInfluence += 20;
        
        // Comeback Mechanic
        const myMaterial = calculateMaterialScore(chess, turn);
        const enemyMaterial = calculateMaterialScore(chess, turn === 'w' ? 'b' : 'w');
        if (myMaterial <= enemyMaterial - 5) {
          gainedInfluence = Math.floor(gainedInfluence * 1.5);
          requestCommentary("Underdog Bonus", `${turn} gains 1.5x Influence for capturing while behind on material!`);
        }

        audio.playCapture();
        
        if (hadBounty) {
           gainedInfluence += 100;
           requestCommentary("Bounty Claimed", `A massive bounty was claimed on ${square}! (+100 Influence)`);
        }
        if (hadBait) {
           if (move.piece !== 'k') {
             chess.remove(square);
             requestCommentary("Trap Sprung!", `The piece on ${square} was bait! The capturer has been eliminated.`);
           } else {
             requestCommentary("Trap Failed!", `The King sprung the trap on ${square}, but Kings are immune!`);
           }
        }

      } else {
        audio.playMove();
      }

      updateEconomy(turn, gainedInfluence);
      setSelectedSquare(null);
      setValidMoves([]);
      handleLocalSyncBoard();
      
      if (chess.inCheck()) {
           const checkRoasts = [
             "You realize the King is important, right?",
             "Check. Again. Are you playing with your eyes closed?",
             "I calculated 14 million futures and you lose in every single one.",
             "Your grid control is embarrassing.",
           ];
           if (Math.random() > 0.4) {
             roastUser(checkRoasts[Math.floor(Math.random() * checkRoasts.length)]);
           }
      }
      
      checkRedZone();
      checkTicTacToe(turn);
      requestCommentary("Standard Move", `${turn} moved ${move.piece} from ${move.from} to ${move.to}${move.captured ? ' capturing ' + move.captured : ''}`);
      
    } catch (e) {
      if (piece && piece.color === turn) {
        setSelectedSquare(square);
        const moves = chess.moves({ square, verbose: true }) as Move[];
        setValidMoves(moves.map(m => m.to as Square));
      } else {
        setSelectedSquare(null);
        setValidMoves([]);
      }
    }
  };

  const handlePowerClick = (power: "bribe" | "assassinate" | "protect" | "bounty" | "bait" | "bunker") => {
    const turn = chess.turn();
    const { isMultiplayer, playerColor } = useGameStore.getState();
    const activeColor = isMultiplayer ? (playerColor as 'w' | 'b') : turn;
    const currentPlayerState = activeColor === 'w' ? white : black;
    
    if (isMultiplayer && playerColor === 'spectator') return;
    
    if (activePower === power) {
      setActivePower(null);
      return;
    }

    const minBribe = Math.floor(powerPrices.bribe * 0.5);
    if (power === "bribe" && currentPlayerState.influence < minBribe) {
      showToast(`Not enough influence for a bribe! Need at least ${minBribe} (for pawns).`);
      return;
    }
    
    const minAssassinate = Math.floor(powerPrices.assassinate * 0.5);
    if (power === "assassinate" && currentPlayerState.influence < minAssassinate) {
      showToast(`Not enough influence for an assassination! Need at least ${minAssassinate} (for pawns).`);
      return;
    }

    if (power === "bunker" && currentPlayerState.influence < powerPrices.bunker) {
      showToast(`Not enough influence for a bunker! Need ${powerPrices.bunker}.`);
      return;
    }
    
    if (power === "bounty" && currentPlayerState.influence < powerPrices.bounty) {
      showToast(`Not enough influence for a bounty! Need ${powerPrices.bounty}.`);
      return;
    }
    if (power === "bait" && currentPlayerState.influence < powerPrices.bait) {
      showToast(`Not enough influence for bait! Need ${powerPrices.bait}.`);
      return;
    }
    if (power === "protect" && currentPlayerState.influence < powerPrices.protect) {
      showToast(`Not enough influence for protection! Need ${powerPrices.protect}.`);
      return;
    }

    setActivePower(power);
    setSelectedSquare(null);
    setValidMoves([]);
  };

  // Handle unpausing and tampering detection
  const previousIsPaused = useRef(isPaused);
  useEffect(() => {
    let tiltTimer: NodeJS.Timeout | null = null;
    if (previousIsPaused.current === true && isPaused === false) {
      if (boardTampered) {
         audio.playError();
         requestCommentary("Tampering Detected", "System anomaly detected. The board state... has changed.");
         setBoardTampered(false);
         setIsTilted(true);
         tiltTimer = setTimeout(() => {
            setIsTilted(false);
         }, 10000); // 10 seconds of tilt
      }
    }
    previousIsPaused.current = isPaused;
    return () => {
      if (tiltTimer) clearTimeout(tiltTimer);
    };
  }, [isPaused, boardTampered, requestCommentary, setBoardTampered, setIsTilted]);

  // Handle game over effects
  useEffect(() => {
    if (!isGameOver) {
      recordedMatch.current = false;
      return;
    }

    if (isGameOver && !recordedMatch.current) {
      recordedMatch.current = true;
      
      const isRedZoneDeath = gameEndState?.reason === 'Consumed by the Red Zone';
      const isMutual = gameEndState?.reason === 'Mutual Annihilation in the Red Zone';
      const isCorruption = gameEndState?.reason === 'grid_corruption';
      const isTimeout = gameEndState?.reason === "timeout";
      
      if (chess.isCheckmate() || isCorruption || isTimeout || isRedZoneDeath || isMutual || chess.isDraw()) {
         const winnerColor = gameEndState?.winner || (chess.turn() === 'w' ? 'b' : 'w');
         
         const state = useGameStore.getState();
         const isMulti = state.isMultiplayer;
         const pColor = state.playerColor;
         
         if (isMutual || chess.isDraw()) {
           useProfileStore.getState().recordMatch('draw');
         } else if (isMulti) {
           if (pColor === winnerColor) {
             useProfileStore.getState().recordMatch('win');
           } else if (pColor && pColor !== 'spectator') {
             useProfileStore.getState().recordMatch('loss');
           }
         } else {
            const myColor = state.whitePlayerType === 'human' ? 'w' : 'b';
            if (winnerColor === myColor) {
               useProfileStore.getState().recordMatch('win');
            } else {
               useProfileStore.getState().recordMatch('loss');
            }
         }

         if (!isMutual && !chess.isDraw()) {
           confetti({
             particleCount: 150,
             spread: 180,
             origin: { y: 0.1 },
             colors: winnerColor === 'w' ? ['#f59e0b', '#fcd34d', '#ffffff'] : ['#a855f7', '#d946ef', '#000000']
           });
         }
      }
    }
  }, [fen, chess, isGameOver, gameEndState]);

  // Interactive Tutorial Logic
  useEffect(() => {
    if (!isTutorial || isGameOver) return;
    const state = useGameStore.getState();
    const history = chess.history();
    const len = history.length;
    
    if (tutorialStep === 0) {
      setAiCommentary("Welcome to Sovereign. To begin, click on your white pawn and move it forward.");
      if (len > 0) state.setTutorialStep(1);
    } else if (tutorialStep === 1) {
      setAiCommentary("Good. Every move or capture earns you Influence (wealth). Wait for the AI to move.");
      if (len > 1) state.setTutorialStep(2);
    } else if (tutorialStep === 2) {
      setAiCommentary("The AI has moved. Now, click 'Pause Grid' at the top right to freeze time.");
      if (isPaused) state.setTutorialStep(3);
    } else if (tutorialStep === 3) {
      setAiCommentary("While paused, you can use Powers. Click 'Bribe' on the left, then click an enemy piece.");
      if (activePower === 'bribe') state.setTutorialStep(4);
    } else if (tutorialStep === 4) {
      setAiCommentary("Select an enemy piece to convert it. This costs Influence.");
      if (lastAction?.type === 'bribe') state.setTutorialStep(5);
    } else if (tutorialStep === 5) {
      setAiCommentary("Excellent! You've bent the rules. Unpause the grid and resume playing. Remember the Tic-Tac-Toe pattern to make your King invincible!");
      if (!isPaused) {
        state.setTutorialStep(6);
        localStorage.setItem('sovereign_tutorial_completed', 'true');
      }
    }
  }, [chess, fen, isTutorial, tutorialStep, isPaused, activePower, lastAction, isGameOver, setAiCommentary]);

  return (
    <>
      <CompanionOverlay />

      {/* Global toast notifications (power gates, pause warnings, etc.) */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-[76px] left-1/2 -translate-x-1/2 z-[100] bg-white border border-red-300 text-red-600 px-6 py-3 rounded-full font-bold uppercase tracking-wider shadow-[0_0_20px_rgba(239,68,68,0.2)] max-w-[90vw] text-center text-sm pointer-events-none"
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {currentView === 'menu' && (
        <MainMenu onSelect={(action) => {
          const store = useGameStore.getState();
          if (action === 'play_classic') {
            store.resetGame();
            setPlayerType('w', 'human');
            setPlayerType('b', 'ai');
            setDifficulty('medium');
            setIsPaused(false);
            store.setIsClassicMode(true);
            store.setIsTutorial(false);
            setCurrentView('playing');
            setShowOnboarding(false);
          } else if (action === 'play_troublemaker') {
            store.resetGame();
            setPlayerType('w', 'human');
            setPlayerType('b', 'ai');
            setDifficulty('hard');
            setIsPaused(false);
            store.setIsClassicMode(false);
            store.setIsTutorial(false);
            setCurrentView('playing');
            setShowOnboarding(false); 
          } else if (action === 'play_local') {
            store.resetGame();
            setPlayerType('w', 'human');
            setPlayerType('b', 'human');
            setIsPaused(false);
            store.setIsClassicMode(false);
            store.setIsTutorial(false);
            setCurrentView('playing');
            setShowOnboarding(false);
          } else if (action === 'play_multiplayer') {
            setCurrentView('multiplayer_lobby');
          } else if (action === 'tutorial') {
            store.resetGame();
            setPlayerType('w', 'human');
            setPlayerType('b', 'ai');
            setDifficulty('easy');
            setIsPaused(false);
            store.setIsClassicMode(false);
            store.setIsTutorial(true);
            store.setTutorialStep(0);
            store.updateEconomy('w', 60, true);
            setCurrentView('playing');
            setShowOnboarding(false);
          } else if (action === 'about') {
            setCurrentView('about');
          }
        }} />
      )}

      {currentView === 'multiplayer_lobby' && (
        <MultiplayerLobby />
      )}

      {currentView === 'about' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-100/95 backdrop-blur-xl p-4">
          <div className="bg-white border border-stone-200 p-8 rounded-3xl max-w-lg w-full text-center shadow-2xl relative">
            <h2 className="text-3xl font-black font-serif text-amber-600 mb-6 uppercase tracking-widest">The Grid</h2>
            <p className="text-stone-700 mb-6 leading-relaxed">
              This is not standard chess. This is a game of power, influence, and survival. 
              Accumulate wealth, bend the rules, and crush your opposition.
            </p>
            <button
              onClick={() => setCurrentView('menu')}
              className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black rounded-xl uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Back to Menu
            </button>
          </div>
        </div>
      )}
      
      {isGlobalPaused && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-100/95 backdrop-blur-xl p-4 cursor-pointer" onClick={() => setIsGlobalPaused(false)}>
          <div className="text-center">
            <h2 className="text-3xl sm:text-5xl font-black font-serif text-stone-500 mb-4 uppercase tracking-[0.5em] opacity-50">Paused</h2>
            <p className="text-stone-400 text-sm tracking-widest uppercase animate-pulse">Click anywhere to resume</p>
          </div>
        </div>
      )}

      {(isGameOver || !!gameEndState) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-100/90 backdrop-blur-md p-4 animate-in fade-in duration-1000">
          <div className="bg-white border border-stone-200 p-8 sm:p-12 rounded-3xl max-w-lg w-full text-center shadow-[0_0_100px_rgba(245,158,11,0.2)] transform animate-in zoom-in-95 duration-500">
            <h2 className="text-4xl sm:text-5xl font-black font-serif text-amber-600 mb-4 uppercase tracking-widest drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]">
              {gameEndState?.reason === 'timeout' 
                ? "Time Expired" 
                : (gameEndState?.reason === 'grid_corruption' 
                  ? "Grid Corruption" 
                  : (gameEndState?.reason === 'opponent_disconnected' 
                    ? "Opponent Fled" 
                    : (gameEndState?.reason === 'Consumed by the Red Zone' 
                      ? "Grid Annihilation" 
                      : (gameEndState?.reason === 'Mutual Annihilation in the Red Zone' 
                        ? "Mutual Annihilation" 
                        : (chess.isCheckmate() ? "Checkmate" : (chess.isDraw() ? "Draw" : "Stalemate"))))))}
            </h2>
            <p className="text-xl sm:text-2xl text-stone-700 mb-10 font-serif uppercase tracking-wider">
              {gameEndState?.reason === 'timeout' 
                ? `${gameEndState?.winner === 'w' ? whiteName : blackName} Wins By Timeout` 
                : (gameEndState?.reason === 'grid_corruption' 
                  ? `${gameEndState?.winner === 'w' ? whiteName : blackName} Claims The Grid` 
                  : (gameEndState?.reason === 'opponent_disconnected' 
                    ? `${gameEndState?.winner === 'w' ? whiteName : blackName} Wins By Forfeit` 
                    : (gameEndState?.reason === 'Consumed by the Red Zone'
                      ? `${gameEndState?.winner === 'w' ? whiteName : blackName} Wins — Enemy King Consumed by Red Zone`
                      : (gameEndState?.reason === 'Mutual Annihilation in the Red Zone'
                        ? "Both Kings Vaporized in the Red Zone"
                        : (chess.isCheckmate() ? `${chess.turn() === 'w' ? blackName : whiteName} Claims The Grid` : (chess.isDraw() ? "The Grid Is Drawn" : "The Grid Is Deadlocked"))))))}
            </p>
            <div className="flex flex-col gap-3">
              {(isMultiplayer && playerColor === 'spectator') ? (
                <button
                  onClick={() => {
                    const store = useGameStore.getState();
                    socket.emit('challenge-winner', { roomId: store.roomId, challengerName: username });
                    setChallengeSent(true);
                  }}
                  disabled={challengeSent}
                  className="w-full py-4 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-black rounded-xl uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] text-lg shadow-[0_0_20px_rgba(168,85,247,0.4)] flex items-center justify-center gap-2"
                >
                  <Swords className="w-6 h-6" /> {challengeSent ? "Challenge Sent..." : "Challenge Winner"}
                </button>
              ) : (
                <>
                  {incomingChallenge && (
                    <div className="mb-4 p-4 border border-purple-500/50 bg-purple-500/10 rounded-xl animate-pulse">
                      <p className="text-purple-600 font-bold mb-2 uppercase tracking-widest">{incomingChallenge.challengerName} is challenging you!</p>
                      <button
                        onClick={() => {
                          const store = useGameStore.getState();
                          // Determine if winner was white or black
                          let winnerWasWhite = true;
                          if (gameEndState?.winner === 'b') winnerWasWhite = false;
                          else if (chess.isCheckmate() && chess.turn() === 'w') winnerWasWhite = false;
                          
                          socket.emit('accept-challenge', { roomId: store.roomId, challengerId: incomingChallenge.challengerId, winnerWasWhite });
                          store.resetGame(true);
                          store.setCurrentView('playing');
                          setIncomingChallenge(null);
                        }}
                        className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg uppercase tracking-wider"
                      >
                        Accept Challenge
                      </button>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      const store = useGameStore.getState();
                      store.resetGame(store.isMultiplayer);
                      setCurrentView('playing');
                    }}
                    className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black rounded-xl uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] text-lg shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:shadow-[0_0_30px_rgba(245,158,11,0.6)]"
                  >
                    Play Again
                  </button>
                  {fenHistory.length >= 3 && (
                     <button
                       onClick={() => { setIsReplaying(true); setReplayStep(Math.max(0, fenHistory.length - 4)); }}
                       className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_15px_rgba(220,38,38,0.4)] flex items-center justify-center gap-2"
                     >
                       <Clapperboard className="w-5 h-5" /> Deathblow Replay
                     </button>
                  )}
                </>
              )}
              <button
                onClick={() => { resetGame(); setCurrentView('menu'); }}
                className="w-full py-3 border border-amber-500/30 hover:border-amber-500 text-amber-600 hover:text-amber-600 font-bold rounded-xl uppercase tracking-widest transition-all hover:bg-amber-500/10"
              >
                Main Menu
              </button>
            </div>
          </div>
        </div>
      )}
      
      
      {isReplaying && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-50 p-4">
           <div className="absolute inset-0 bg-red-900/10 animate-pulse pointer-events-none" />
           
           <div className="w-full max-w-[600px] aspect-square transform scale-[1.1] transition-transform duration-1000 ease-out relative">
              <ChessBoard 
                 chess={new Chess(fenHistory[replayStep] || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")}
                 selectedSquare={null}
                 onSquareClick={() => {}}
                 validMoves={[]}
                 protectedPieces={[]}
                 bountiedPieces={[]}
                 baitedPieces={[]}
                 superPawnSquare={null}
                 redZone={[]}
                 redZoneWarning={[]}
                 bunkeredPieces={[]}
              />
              
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                 {(() => {
                    const stepsFromEnd = Math.max(0, fenHistory.length - 1 - replayStep);
                    if (stepsFromEnd >= 3) return <h1 className="text-6xl md:text-8xl font-black italic uppercase text-white tracking-tighter drop-shadow-[0_0_30px_rgba(255,255,255,0.8)] animate-in zoom-in-50 duration-300 -rotate-6">THE BAIT...</h1>;
                    if (stepsFromEnd === 2) return <h1 className="text-6xl md:text-8xl font-black italic uppercase text-red-500 tracking-tighter drop-shadow-[0_0_30px_rgba(239,68,68,0.8)] animate-in zoom-in-50 duration-300 -rotate-6">THE MISTAKE...</h1>;
                    if (stepsFromEnd <= 1) return <h1 className="text-6xl md:text-9xl font-black italic uppercase text-amber-600 tracking-tighter drop-shadow-[0_0_50px_rgba(245,158,11,1)] animate-in zoom-in-50 duration-300 scale-125">DEATHBLOW.</h1>;
                    return null;
                 })()}
              </div>
           </div>
           
           <button 
             onClick={() => setIsReplaying(false)}
             className="absolute top-6 right-6 p-4 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md z-50 transition-all"
           >
             <X className="w-8 h-8" />
           </button>
        </div>
      )}

      <div ref={containerRef} className="h-[100dvh] w-full bg-stone-50 text-stone-800 font-sans selection:bg-amber-200 flex flex-col relative overflow-hidden select-none touch-manipulation overscroll-none">
      
        {/* TOP BAR - Compact */}
        <header className={`flex items-center justify-between px-2 py-1 sm:px-4 sm:py-2 bg-white/80 backdrop-blur-xl border-b border-stone-200 z-30 shrink-0 gap-1 sm:gap-3 ${currentView !== 'playing' ? 'opacity-0 pointer-events-none' : ''} transition-opacity duration-500`}>
          <div className="flex items-center gap-1 sm:gap-3 shrink-0">
            <button 
              onClick={() => { resetGame(); setCurrentView('menu'); }}
              className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg border border-stone-300 bg-stone-100/50 text-stone-700 hover:text-amber-600 hover:border-amber-500/50 hover:bg-stone-100 transition-colors text-[10px] sm:text-xs font-bold uppercase tracking-wider hidden sm:block"
            >
              Menu
            </button>
            <h1 className="text-lg xl:text-xl font-serif text-amber-600 font-black tracking-tight uppercase drop-shadow-[0_0_10px_rgba(245,158,11,0.5)] hidden lg:block whitespace-nowrap">Power & Chaos</h1>
            <button 
              onClick={() => {
                const state = useGameStore.getState();
                if (state.isMultiplayer && state.playerColor !== chess.turn() && !isPaused) {
                  showToast("It's not your turn!");
                  return;
                }
                
                if (isPaused) {
                  setIsPaused(false);
                  setTimeout(() => broadcastState(), 10);
                } else {
                  const turn = chess.turn();
                  const currentPlayerState = turn === 'w' ? white : black;
                  setIsPaused(true);
                  setTimeout(() => broadcastState(), 10);
                }
              }} 
              className={cn("flex items-center gap-1 text-[10px] sm:text-xs font-bold uppercase px-2 py-1 sm:px-3 sm:py-1.5 rounded transition-colors whitespace-nowrap", isPaused ? "bg-amber-500/20 text-amber-600 hover:bg-amber-500/30" : "bg-stone-100 text-stone-700 hover:bg-stone-200")}
            >
              {isPaused ? <Play className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : <Pause className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
              <span>{isPaused ? "Resume" : "Pause"}</span>
            </button>
          </div>
          
          <div className="flex items-center gap-1 sm:gap-3 flex-1 justify-center px-0.5 min-w-0 max-w-[460px]">
            <div className={cn("flex-1 flex flex-col items-center p-1 sm:p-1.5 rounded-lg border min-w-0 transition-shadow", chess.turn() === 'w' ? "border-amber-500/50 bg-amber-50 shadow-md border-amber-300" : "border-stone-200 bg-white shadow-sm", (isAiThinking && chess.turn() === 'w' && whitePlayerType === 'ai') && "ring-2 ring-amber-400/70 shadow-[0_0_18px_rgba(245,158,11,0.35)]")}>
              <div className="flex items-center justify-between w-full mb-0.5 sm:mb-1 gap-1 min-w-0">
                <span className={cn("text-[8px] sm:text-[10px] font-black tracking-widest uppercase flex items-center gap-0.5 sm:gap-1 min-w-0", chess.turn() === 'w' ? "text-amber-600" : "text-stone-500")}>
                  <span className="truncate min-w-0">{whiteName}</span>
                  <span className="font-mono bg-stone-50 px-1 py-0.5 rounded border border-stone-200 shrink-0 text-[8px] sm:text-[9px]">
                    {formatTime(whiteTime)}
                  </span>
                  {isAiThinking && chess.turn() === 'w' && whitePlayerType === 'ai' && (
                    <span className="animate-pulse text-[7px] sm:text-[8px] font-bold text-amber-500 shrink-0">THINKING</span>
                  )}
                </span>
                <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                  <Coins className={cn("w-2.5 h-2.5 sm:w-3.5 sm:h-3.5", chess.turn() === 'w' ? "text-amber-600" : "text-stone-500")} />
                  <span className={cn("font-mono font-bold text-xs sm:text-sm leading-none", chess.turn() === 'w' ? "text-amber-700" : "text-stone-600")}>{white.influence}</span>
                </div>
              </div>
              <button 
                onClick={() => setPlayerType('w', whitePlayerType === 'human' ? 'ai' : 'human')}
                style={{ display: (isMultiplayer || opponentProfile) ? 'none' : 'flex' }}
                className={cn("w-full flex items-center justify-center gap-1 py-1 sm:py-1.5 rounded-md text-[9px] sm:text-[10px] uppercase font-bold transition-all border", whitePlayerType === 'human' ? "bg-amber-100 border-amber-300 hover:bg-amber-200 text-amber-800" : "bg-stone-800 border-stone-700 hover:bg-stone-700 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)]", (whitePlayerType === 'ai' && blackPlayerType === 'ai') ? "animate-pulse" : "")}
                title={whitePlayerType === 'human' ? "Let the AI drive — take back control anytime" : "Take back control and play yourself"}
              >
                {whitePlayerType === 'human' ? <><Cpu className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> <span className="hidden sm:inline">Let AI Play</span><span className="sm:hidden">AI</span></> : <><span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" /><User className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> <span className="hidden sm:inline">Take Over</span><span className="sm:hidden">Play</span></>}
              </button>
            </div>
            
            <div className="text-stone-400 font-serif italic text-[9px] sm:text-xs shrink-0 px-0.5">vs</div>
            
            <div className={cn("flex-1 flex flex-col items-center p-1 sm:p-1.5 rounded-lg border min-w-0 transition-shadow", chess.turn() === 'b' ? "border-purple-500/50 bg-purple-50 shadow-md border-purple-300" : "border-stone-200 bg-white shadow-sm", (isAiThinking && chess.turn() === 'b' && blackPlayerType === 'ai') && "ring-2 ring-purple-400/70 shadow-[0_0_18px_rgba(168,85,247,0.35)]")}>
              <div className="flex items-center justify-between w-full mb-0.5 sm:mb-1 gap-1 min-w-0">
                <span className={cn("text-[8px] sm:text-[10px] font-black tracking-widest uppercase flex items-center gap-0.5 sm:gap-1 min-w-0", chess.turn() === 'b' ? "text-purple-600" : "text-stone-500")}>
                  <span className="truncate min-w-0">{blackName}</span>
                  <span className="font-mono bg-stone-50 px-1 py-0.5 rounded border border-stone-200 shrink-0 text-[8px] sm:text-[9px]">
                    {formatTime(blackTime)}
                  </span>
                  {isAiThinking && chess.turn() === 'b' && blackPlayerType === 'ai' && (
                    <span className="animate-pulse text-[7px] sm:text-[8px] font-bold text-purple-500 shrink-0">THINKING</span>
                  )}
                </span>
                <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                  <Coins className={cn("w-2.5 h-2.5 sm:w-3.5 sm:h-3.5", chess.turn() === 'b' ? "text-purple-600" : "text-stone-500")} />
                  <span className={cn("font-mono font-bold text-xs sm:text-sm leading-none", chess.turn() === 'b' ? "text-purple-700" : "text-stone-600")}>{black.influence}</span>
                </div>
              </div>
              <button 
                onClick={() => setPlayerType('b', blackPlayerType === 'human' ? 'ai' : 'human')}
                style={{ display: (isMultiplayer || opponentProfile) ? 'none' : 'flex' }}
                className={cn("w-full flex items-center justify-center gap-1 py-1 sm:py-1.5 rounded-md text-[9px] sm:text-[10px] uppercase font-bold transition-all border", blackPlayerType === 'human' ? "bg-purple-100 border-purple-300 hover:bg-purple-200 text-purple-800" : "bg-stone-800 border-stone-700 hover:bg-stone-700 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.25)]", (whitePlayerType === 'ai' && blackPlayerType === 'ai') ? "animate-pulse" : "")}
                title={blackPlayerType === 'human' ? "Let the AI drive — take back control anytime" : "Take back control and play yourself"}
              >
                {blackPlayerType === 'human' ? <><Cpu className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> <span className="hidden sm:inline">Let AI Play</span><span className="sm:hidden">AI</span></> : <><span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse shrink-0" /><User className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> <span className="hidden sm:inline">Take Over</span><span className="sm:hidden">Play</span></>}
              </button>
            </div>
          </div>


          <div className="flex items-center gap-0.5 sm:gap-1.5 shrink-0">
            <button onClick={() => setShowActionLog(true)} className="p-1.5 sm:px-2.5 sm:py-1.5 flex items-center gap-1 hover:bg-stone-100 rounded text-stone-600 transition-colors" title="View Action Log">
              <ScrollText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden md:inline text-xs font-bold uppercase tracking-wider">Log</span>
            </button>
            <button onClick={handleToggleAudio} className="p-1.5 sm:p-2 hover:bg-stone-100 rounded text-stone-600 transition-colors hidden sm:block" title="Toggle Audio">
              {audioEnabled ? <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            </button>
            <button onClick={toggleFullscreen} className="p-1.5 sm:p-2 hover:bg-stone-100 rounded text-stone-600 transition-colors hidden sm:block" title="Fullscreen">
              <Maximize className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <div className="relative">
              <button onClick={() => setShowMenu(!showMenu)} className="p-1.5 sm:p-2 hover:bg-stone-100 rounded text-stone-600 transition-colors" title="Menu">
                <MoreVertical className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-stone-200 rounded-lg shadow-2xl py-1 z-50 overflow-hidden">
                    {(!isMultiplayer && !opponentProfile?.isGhostBot) && (
                      <button onClick={() => { setIsGlobalPaused(true); setShowMenu(false); }} className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-stone-100 text-stone-700 transition-colors">
                        <Pause className="w-4 h-4" />
                        <span className="text-sm font-medium">Pause Game</span>
                      </button>
                    )}
                    {(!isMultiplayer && !opponentProfile?.isGhostBot) && (
                    <button onClick={() => { resetGame(); setShowMenu(false); }} className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-stone-100 text-stone-700 transition-colors">
                      <RotateCcw className="w-4 h-4" />
                      <span className="text-sm font-medium">Restart Game</span>
                    </button>
                  )}
                    <button onClick={() => { setCurrentView('menu'); setShowMenu(false); }} className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-stone-100 text-red-400 transition-colors border-t border-stone-200 mt-1">
                      <LogOut className="w-4 h-4" />
                      <span className="text-sm font-medium">{(isMultiplayer || opponentProfile?.isGhostBot) ? 'Resign & Leave' : 'Quit to Menu'}</span>
                    </button>
                  </div>
    </>
              )}
            </div>
          </div>
        </header>

        {/* MAIN BOARD & POWERS AREA */}
        <div className="flex-1 flex flex-col lg:flex-row items-center justify-center p-2 sm:p-4 gap-4 sm:gap-8 relative min-h-0">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] opacity-20 pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] max-w-[600px] max-h-[600px] bg-amber-100/30 blur-[100px] rounded-full pointer-events-none" />
          
          {/* SPECTATOR CONTROLS */}
          {(isMultiplayer && playerColor === 'spectator') && (
          <div className="flex flex-row lg:flex-col gap-1 sm:gap-4 shrink-0 z-20 w-full lg:w-48 max-w-full overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pb-1 px-1">
             <div className="p-3 sm:p-4 rounded-xl border border-stone-200 bg-white/80 mb-2">
                <h3 className="text-stone-600 font-bold uppercase tracking-widest text-xs flex items-center gap-2 mb-2"><EyeOff className="w-4 h-4 text-purple-600" /> Spectator Mode</h3>
                <p className="text-stone-500 text-[10px] leading-tight">You are watching this match. Trigger audio taunts below.</p>
             </div>
             <button
              onClick={() => { socket.emit('spectator-taunt', { roomId: useGameStore.getState().roomId, type: 'clap' }); audio.playAudioTaunt('clap'); }}
              className="p-3 sm:p-4 rounded-lg flex-1 lg:flex-none flex items-center justify-between border-2 border-stone-200 bg-white text-stone-700 hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700 transition-all group"
            >
              <span className="font-bold flex items-center gap-2 text-sm">👏 Slow Clap</span>
            </button>
             <button
              onClick={() => { socket.emit('spectator-taunt', { roomId: useGameStore.getState().roomId, type: 'gasp' }); audio.playAudioTaunt('gasp'); }}
              className="p-3 sm:p-4 rounded-lg flex-1 lg:flex-none flex items-center justify-between border-2 border-stone-200 bg-white text-stone-700 hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700 transition-all group"
            >
              <span className="font-bold flex items-center gap-2 text-sm">😱 Crowd Gasp</span>
            </button>
             <button
              onClick={() => { socket.emit('spectator-taunt', { roomId: useGameStore.getState().roomId, type: 'laugh' }); audio.playAudioTaunt('laugh'); }}
              className="p-3 sm:p-4 rounded-lg flex-1 lg:flex-none flex items-center justify-between border-2 border-stone-200 bg-white text-stone-700 hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700 transition-all group"
            >
              <span className="font-bold flex items-center gap-2 text-sm">😈 Dark Laugh</span>
            </button>
          </div>
          )}
          {/* DARK ARTS BUTTONS */}
          {(!isClassicMode && (!isMultiplayer || playerColor !== 'spectator')) && (
          <div className="grid grid-cols-3 sm:grid-cols-6 lg:flex lg:flex-col gap-1 sm:gap-2 lg:gap-3 shrink-0 z-20 w-full lg:w-48 max-w-full pb-1 px-1">
             {(isMultiplayer && playerColor !== 'spectator' && useGameStore.getState().roomId) && (
               <button
                 onClick={handleSOS}
                 className="col-span-3 lg:col-span-1 p-2 sm:p-3 mb-1 rounded-xl flex items-center justify-between border-2 border-emerald-500/50 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)]"
               >
                 <span className="font-bold flex items-center gap-2 text-xs sm:text-sm uppercase tracking-wider">
                   <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5" /> {sosCopied ? "SOS Copied!" : "Call Backup"}
                 </span>
               </button>
             )}
             <button
              onClick={() => handlePowerClick("bribe")}
              className={cn(
                "p-1.5 sm:p-3 lg:p-4 landscape:p-1.5 rounded-lg flex flex-col items-start text-left gap-0.5 sm:gap-1.5 landscape:gap-0 border-2 transition-all group min-w-0",
                activePower === "bribe" 
                  ? "border-amber-500 bg-amber-50 text-amber-700 shadow-[0_0_15px_rgba(245,158,11,0.2)]" 
                  : "border-stone-200 bg-white text-stone-800 hover:border-amber-500 hover:bg-stone-50 shadow-sm"
              )}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-bold flex items-center gap-1 sm:gap-2 text-[11px] sm:text-sm lg:text-base min-w-0">
                  <Coins className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0", activePower === "bribe" ? "text-amber-600" : "text-amber-600/50 group-hover:text-amber-600")} /> <span className="truncate min-w-0">Bribe</span>
                </span>
                <span className="text-[10px] sm:text-xs font-mono bg-stone-50 px-1 sm:px-2 py-0.5 rounded border border-stone-200 text-amber-600 shrink-0">~{powerPrices.bribe}</span>
              </div>
              <span className="text-[10px] sm:text-xs opacity-70 hidden sm:block landscape:hidden">Target an enemy piece. Make it yours. Cost scales.</span>
            </button>

            <button
              onClick={() => handlePowerClick("assassinate")}
              className={cn(
                "p-1.5 sm:p-3 lg:p-4 landscape:p-1.5 rounded-lg flex flex-col items-start text-left gap-0.5 sm:gap-1.5 landscape:gap-0 border-2 transition-all group min-w-0",
                activePower === "assassinate" 
                  ? "border-red-500 bg-red-50 text-red-700 shadow-[0_0_15px_rgba(239,68,68,0.2)]" 
                  : "border-stone-200 bg-white text-stone-800 hover:border-red-500 hover:bg-stone-50 shadow-sm"
              )}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-bold flex items-center gap-1 sm:gap-2 text-[11px] sm:text-sm lg:text-base min-w-0">
                  <Skull className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0", activePower === "assassinate" ? "text-red-500" : "text-red-500/50 group-hover:text-red-500")} /> <span className="truncate min-w-0">Kill</span>
                </span>
                <span className="text-[10px] sm:text-xs font-mono bg-stone-50 px-1 sm:px-2 py-0.5 rounded border border-stone-200 text-red-500 shrink-0">~{powerPrices.assassinate}</span>
              </div>
              <span className="text-[10px] sm:text-xs opacity-70 hidden sm:block landscape:hidden">Instantly remove any piece from the board. Cost scales.</span>
            </button>

            <button
              onClick={() => handlePowerClick("protect")}
              className={cn(
                "p-1.5 sm:p-3 lg:p-4 landscape:p-1.5 rounded-lg flex flex-col items-start text-left gap-0.5 sm:gap-1.5 landscape:gap-0 border-2 transition-all group min-w-0",
                activePower === "protect" 
                  ? "border-blue-500 bg-blue-50 text-blue-700 shadow-[0_0_15px_rgba(59,130,246,0.2)]" 
                  : "border-stone-200 bg-white text-stone-800 hover:border-blue-500 hover:bg-stone-50 shadow-sm"
              )}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-bold flex items-center gap-1 sm:gap-2 text-[11px] sm:text-sm lg:text-base min-w-0">
                  <ShieldAlert className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0", activePower === "protect" ? "text-blue-500" : "text-blue-500/50 group-hover:text-blue-500")} /> <span className="truncate min-w-0">Protect</span>
                </span>
                <span className="text-[10px] sm:text-xs font-mono bg-stone-50 px-1 sm:px-2 py-0.5 rounded border border-stone-200 text-blue-500 shrink-0">{powerPrices.protect}</span>
              </div>
              <span className="text-[10px] sm:text-xs opacity-70 hidden sm:block landscape:hidden">1.5x cost for enemies to Bribe/Kill this piece. Max 3.</span>
            </button>

            <button
              onClick={() => handlePowerClick("bunker")}
              className={cn(
                "p-1.5 sm:p-3 lg:p-4 landscape:p-1.5 rounded-lg flex flex-col items-start text-left gap-0.5 sm:gap-1.5 landscape:gap-0 border-2 transition-all group min-w-0",
                activePower === "bunker" 
                  ? "border-orange-500 bg-orange-50 text-orange-700 shadow-[0_0_15px_rgba(249,115,22,0.2)]" 
                  : "border-stone-200 bg-white text-stone-800 hover:border-orange-500 hover:bg-stone-50 shadow-sm"
              )}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-bold flex items-center gap-1 sm:gap-2 text-[11px] sm:text-sm lg:text-base min-w-0">
                  <Flame className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0", activePower === "bunker" ? "text-orange-500" : "text-orange-500/50 group-hover:text-orange-500")} /> <span className="truncate min-w-0">Bunker</span>
                </span>
                <span className="text-[10px] sm:text-xs font-mono bg-stone-50 px-1 sm:px-2 py-0.5 rounded border border-stone-200 text-orange-500 shrink-0">{powerPrices.bunker}</span>
              </div>
              <span className="text-[10px] sm:text-xs opacity-70 hidden sm:block landscape:hidden">Immunity to the Red Zone for 2 turns.</span>
            </button>

            <button
              onClick={() => handlePowerClick("bounty")}
              className={cn(
                "p-1.5 sm:p-3 lg:p-4 landscape:p-1.5 rounded-lg flex flex-col items-start text-left gap-0.5 sm:gap-1.5 landscape:gap-0 border-2 transition-all group min-w-0",
                activePower === "bounty" 
                  ? "border-green-500 bg-green-50 text-green-700 shadow-[0_0_15px_rgba(34,197,94,0.2)]" 
                  : "border-stone-200 bg-white text-stone-800 hover:border-green-500 hover:bg-stone-50 shadow-sm"
              )}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-bold flex items-center gap-1 sm:gap-2 text-[11px] sm:text-sm lg:text-base min-w-0">
                  <Target className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0", activePower === "bounty" ? "text-green-500" : "text-green-500/50 group-hover:text-green-500")} /> <span className="truncate min-w-0">Bounty</span>
                </span>
                <span className="text-[10px] sm:text-xs font-mono bg-stone-50 px-1 sm:px-2 py-0.5 rounded border border-stone-200 text-green-600 shrink-0">{powerPrices.bounty}</span>
              </div>
              <span className="text-[10px] sm:text-xs opacity-70 hidden sm:block landscape:hidden">Mark enemy piece. Gain +100 on capture.</span>
            </button>

            <button
              onClick={() => handlePowerClick("bait")}
              className={cn(
                "p-1.5 sm:p-3 lg:p-4 landscape:p-1.5 rounded-lg flex flex-col items-start text-left gap-0.5 sm:gap-1.5 landscape:gap-0 border-2 transition-all group min-w-0",
                activePower === "bait" 
                  ? "border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700 shadow-[0_0_15px_rgba(217,70,239,0.2)]" 
                  : "border-stone-200 bg-white text-stone-800 hover:border-fuchsia-500 hover:bg-stone-50 shadow-sm"
              )}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-bold flex items-center gap-1 sm:gap-2 text-[11px] sm:text-sm lg:text-base min-w-0">
                  <AlertTriangle className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0", activePower === "bait" ? "text-fuchsia-500" : "text-fuchsia-500/50 group-hover:text-fuchsia-500")} /> <span className="truncate min-w-0">Bait</span>
                </span>
                <span className="text-[10px] sm:text-xs font-mono bg-stone-50 px-1 sm:px-2 py-0.5 rounded border border-stone-200 text-fuchsia-600 shrink-0">{powerPrices.bait}</span>
              </div>
              <span className="text-[10px] sm:text-xs opacity-70 hidden sm:block landscape:hidden">Trap piece. Eliminates capturer.</span>
            </button>

            <div className="hidden lg:flex flex-col gap-1 mt-auto pt-4 opacity-50">
               <div className="text-[10px] uppercase font-bold tracking-widest text-stone-500 mb-1">Hitbox Legend</div>
               <div className="flex items-center gap-1.5 text-[9px] uppercase"><div className="w-2 h-2 border border-red-500 bg-red-500/20" /> Killed</div>
               <div className="flex items-center gap-1.5 text-[9px] uppercase"><div className="w-2 h-2 border border-amber-500 bg-amber-500/20" /> Bribed</div>
               <div className="flex items-center gap-1.5 text-[9px] uppercase"><div className="w-2 h-2 border border-green-500 bg-green-500/20" /> Bountied</div>
               <div className="flex items-center gap-1.5 text-[9px] uppercase"><div className="w-2 h-2 border border-fuchsia-500 bg-fuchsia-500/20" /> Baited</div>
               <div className="flex items-center gap-1.5 text-[9px] uppercase"><div className="w-2 h-2 border border-blue-500 bg-blue-500/20" /> Protected</div>
               <div className="flex items-center gap-1.5 text-[9px] uppercase"><div className="w-2 h-2 border border-orange-500 bg-orange-500/20" /> Bunkered</div>
               <div className="flex items-center gap-1.5 text-[9px] uppercase"><div className="w-2 h-2 bg-sky-500/40" /> Last Move</div>
            </div>
          </div>
          )}

          {/* CHESS BOARD (Maximizing remaining space) */}
          {chess.inCheck() && !isGameOver && currentView === 'playing' && (
           <div className="absolute top-[10%] left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-pulse">
              <span className="px-6 py-2 bg-red-600/90 text-white text-xl md:text-2xl font-black italic tracking-widest uppercase rounded-full shadow-[0_0_30px_rgba(220,38,38,1)] border border-red-400 block">
                CHECK
              </span>
           </div>
          )}
          <div className={`flex items-center justify-center h-full w-full z-20 ${currentView !== 'playing' ? 'pointer-events-none' : ''}`}>
             <div className={cn("w-full max-w-[min(90vw,calc(100dvh-200px))] max-h-[min(90vw,calc(100dvh-200px))] landscape:max-lg:max-w-[min(90vw,calc(100dvh-260px))] landscape:max-lg:max-h-[min(90vw,calc(100dvh-260px))] aspect-square flex items-center justify-center p-1 sm:p-0 relative group transition-all duration-700", boardShake && "animate-shake", heavyShake && "animate-heavy-shake", currentView === 'story' && "scale-[0.85] lg:scale-[0.9] -translate-y-10 lg:-translate-y-16")}>
               <ChessBoard 
                chess={chess}
                selectedSquare={selectedSquare}
                onSquareClick={handleSquareClick}
                validMoves={validMoves}
                protectedPieces={useGameStore.getState().protectedPieces}
                bountiedPieces={useGameStore.getState().bountiedPieces}
                baitedPieces={useGameStore.getState().baitedPieces}
                superPawnSquare={useGameStore.getState().superPawnSquare}
                redZone={useGameStore.getState().redZone}
                redZoneWarning={useGameStore.getState().redZoneWarning}
                bunkeredPieces={useGameStore.getState().bunkeredPieces}
                lastMove={lastMove}
                lastAction={lastAction}
                activePower={activePower}
               />
               
               {isPaused && (
                 <div className="absolute inset-0 m-2 sm:m-0 pointer-events-none z-30 flex items-center justify-center bg-blue-900/10 backdrop-contrast-[1.1] rounded-lg border-2 border-blue-500/20 shadow-[inset_0_0_100px_rgba(59,130,246,0.15)] animate-in fade-in duration-500">
                   <div className="text-blue-300/20 font-black tracking-[0.5em] text-5xl sm:text-7xl uppercase transform -rotate-12 select-none pointer-events-none drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]">FROZEN</div>
                 </div>
               )}
              </div>
           </div>
           
         </div>

       </div>
      <AnimatePresence>
        {showActionLog && (
          <div className="fixed inset-0 z-[100] flex justify-end">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowActionLog(false)} />
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              className="relative w-full max-w-sm bg-white border-l border-stone-200 h-full flex flex-col shadow-2xl"
            >
              <div className="p-4 border-b border-stone-200 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <ScrollText className="w-5 h-5 text-stone-600" />
                  <h3 className="font-bold text-stone-800">Action Log</h3>
                </div>
                <button onClick={() => setShowActionLog(false)} className="p-2 hover:bg-stone-100 rounded text-stone-600 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {actionLog.map((log, i) => (
                  <div key={i} className="flex gap-3 relative">
                    <div className="w-2 h-2 mt-2 rounded-full bg-purple-500 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-1">{log.title}</div>
                      <div className="text-sm text-stone-700">{log.message}</div>
                    </div>
                  </div>
                ))}
                {actionLog.length === 0 && (
                  <div className="text-center text-stone-500 py-8">
                    No actions recorded yet.
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
   );
}
