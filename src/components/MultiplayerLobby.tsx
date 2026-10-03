import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Copy, ArrowRight, Loader, MessageSquare, Globe, Lock, Plus, Swords, User, Target } from 'lucide-react';
import { useGameStore } from '../store/gameStore';

interface GhostBot {
  id: string;
  name: string;
  bounty: number;
  status: 'looking' | 'in_match';
}

const GHOST_BOTS: GhostBot[] = [
  { id: 'bot_1', name: 'NeonGrifter', bounty: 850, status: 'looking' },
  { id: 'bot_2', name: 'NullSector', bounty: 1200, status: 'in_match' },
  { id: 'bot_3', name: 'Shadow_99', bounty: 420, status: 'looking' },
  { id: 'bot_4', name: 'CrypticK', bounty: 1550, status: 'looking' },
  { id: 'bot_5', name: 'Data_Wraith', bounty: 600, status: 'in_match' },
];
import { useProfileStore } from '../store/profileStore';
import { socket } from '../lib/socket';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '../lib/utils';

interface PublicRoom {
  id: string;
  name: string;
  players: number;
  createdAt: number;
  hostStats?: any;
}

interface LogEntry {
  id: string;
  message: string;
  timestamp: number;
  type: 'chat' | 'system' | 'game';
  author?: string;
}

export function MultiplayerLobby() {
  const [roomInput, setRoomInput] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [incomingDirectChallenge, setIncomingDirectChallenge] = useState<{challengerId: string, challengerName: string, challengerElo: number} | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [localRoomId, setLocalRoomId] = useState('');
  
  // Tavern state
  const [publicRooms, setPublicRooms] = useState<PublicRoom[]>([]);
  const [idleUsers, setIdleUsers] = useState<any[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [chatMessage, setChatMessage] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  
  const { setCurrentView, setRoomId, setIsMultiplayer, setPlayerType, setIsPaused, setIsClassicMode, setIsTutorial, setShowOnboarding, setPlayerColor, setOpponentProfile, resetGame, setDifficulty } = useGameStore();
  const { userId, username, elo } = useProfileStore();

  const chatRef = useRef<HTMLDivElement>(null);

  const challengeGhostBot = (bot: GhostBot) => {
    resetGame();
    setIsMultiplayer(false);
    setRoomId(`ghost_match_${bot.id}`);
    setOpponentProfile({ name: bot.name, bounty: bot.bounty });
    setPlayerColor('w');
    setPlayerType('w', 'human');
    setPlayerType('b', 'ai');
    let diff: "easy" | "medium" | "hard" = "medium";
    if (bot.bounty < 500) diff = "easy";
    else if (bot.bounty > 1000) diff = "hard";
    setDifficulty(diff);
    setIsClassicMode(false);
    setIsPaused(false);
    setIsTutorial(false);
    setShowOnboarding(false);
    setCurrentView('playing');
  };

  useEffect(() => {
    socket.connect();
    
    // Join the global tavern room
    socket.emit('join-tavern', { userId, username });

    socket.on('tavern-update', (data) => {
      setPublicRooms(data.publicRooms);
      setOnlineCount(data.onlineCount);
      setLogs(data.logs);
      if (data.idleUsers) setIdleUsers(data.idleUsers);
    });

    socket.on('room-joined', ({ roomId, color, playerCount }) => {
      setRoomId(roomId);
      setIsMultiplayer(true);
      setPlayerColor(color);
      
      if (playerCount >= 2) {
        startGame();
      } else {
        setLocalRoomId(roomId);
        setWaiting(true);
        setConnecting(false);
      }
    });

    socket.on('incoming-challenge', ({ challengerId, challengerName, challengerElo }) => {
      setIncomingDirectChallenge({ challengerId, challengerName, challengerElo });
    });
    
    socket.on('challenge-rejected', ({ targetName }) => {
      setToastMessage(`${targetName} declined your challenge.`);
      setConnecting(false);
      setTimeout(() => setToastMessage(null), 3000);
    });
    
    socket.on('start-direct-match', ({ roomId, color, opponentProfile }) => {
      setRoomId(roomId);
      setIsMultiplayer(true);
      setPlayerColor(color);
      setOpponentProfile(opponentProfile);
      startGame();
    });

    socket.on('player-joined', ({ playerCount }) => {
      if (playerCount >= 2) {
        startGame();
      }
    });
    
    return () => {
      socket.off('tavern-update');
      socket.off('room-joined');
      socket.off('player-joined');
      socket.off('incoming-challenge');
      socket.off('challenge-rejected');
      socket.off('start-direct-match');
    };
  }, []);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [logs]);

  const startGame = () => {
    setPlayerType('w', 'human');
    setPlayerType('b', 'human');
    setIsPaused(false);
    setIsClassicMode(false); 
    setIsTutorial(false);
    setShowOnboarding(false);
    setCurrentView('playing');
  };

  const [isSearching, setIsSearching] = useState(false);
  const [searchText, setSearchText] = useState("Searching for opponent...");

  const quickMatch = () => {
    setIsSearching(true);
    setConnecting(true);
    
    let dots = 0;
    const interval = setInterval(() => {
      dots = (dots + 1) % 4;
      setSearchText("Searching for opponent" + ".".repeat(dots));
    }, 500);

    // Search time 3 to 6 seconds
    const searchTime = Math.floor(Math.random() * 3000) + 3000;

    setTimeout(() => {
      clearInterval(interval);
      // Re-check for available room
      const currentAvailable = publicRooms.find(r => r.players === 1);
      if (currentAvailable) {
        setIsSearching(false);
        joinRoom(currentAvailable.id);
      } else {
        // Trigger Ghost Matchmaking!
        setSearchText("Match Found!");
        setTimeout(() => {
          const fakeNames = ["Guest_" + Math.floor(Math.random() * 9999), "RookSlayer", "Alex_99", "ShadowKnight", "CheckmatePro", "Fixer_007", "Neo", "Trinity", "GrandmasterX", "ChessNoob88"];
          const botName = fakeNames[Math.floor(Math.random() * fakeNames.length)];
          const difficulty = Math.random() > 0.5 ? "medium" : "hard";
          
          resetGame();
          setIsMultiplayer(false);
          setRoomId('ghost_match_' + Math.random().toString(36).substr(2, 5));
          setOpponentProfile({ name: botName, bounty: Math.floor(Math.random() * 500) + 800, isGhostBot: true });
          setPlayerColor('w');
          
          useGameStore.setState({
            whitePlayerType: 'human',
            blackPlayerType: 'ai',
            difficulty: difficulty,
          });
          
          setCurrentView('playing');
          setIsSearching(false);
          setConnecting(false);
        }, 1000);
      }
    }, searchTime);
  };

  const createRoom = () => {
    setConnecting(true);
    const newRoomId = uuidv4().substring(0, 8);
    const roomName = isPrivate ? "Private Match" : `${username || 'Fixer'}'s Table`;
    socket.emit('join-room', { 
      roomId: newRoomId, 
      userId, 
      username,
      isPublic: !isPrivate,
      roomName,
      hostStats: useProfileStore.getState()
    });
  };

  const joinRoom = (id: string = roomInput) => {
    if (!id) return;
    setConnecting(true);
    socket.emit('join-room', { roomId: id, userId, username });
  };

  const sendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;
    socket.emit('send-tavern-chat', chatMessage.trim());
    setChatMessage('');
  };

  if (waiting) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-stone-50/90 backdrop-blur-md">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white border border-stone-200 p-8 rounded-3xl max-w-md w-full relative"
        >
          <div className="flex flex-col items-center">
            <div className="animate-spin text-purple-500 mb-4">
              <Loader className="w-8 h-8" />
            </div>
            <h3 className="text-xl text-stone-800 font-bold mb-2">Waiting for opponent...</h3>
            <p className="text-stone-600 mb-6 text-center">
              {isPrivate ? "Share this code with your friend to join." : "Your table is open in the Tavern. Someone will join soon!"}
            </p>
            
            <div className="flex items-center gap-2 bg-stone-200/50 p-4 rounded-xl border border-stone-200 w-full mb-4">
              <span className="font-mono text-2xl text-purple-600 tracking-widest flex-1 text-center">{localRoomId}</span>
              <button 
                onClick={() => navigator.clipboard.writeText(localRoomId)}
                className="p-2 bg-stone-100 hover:bg-stone-200 rounded-lg text-stone-800"
                title="Copy to clipboard"
              >
                <Copy className="w-5 h-5" />
              </button>
            </div>
            <button 
              onClick={() => {
                setWaiting(false);
                setConnecting(false);
                setLocalRoomId('');
                socket.emit('join-tavern', { userId, username }); // Rejoin tavern conceptually (actually just UI change)
              }}
              className="mt-4 text-stone-500 hover:text-stone-800"
            >
              Cancel Match
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-stone-50 flex flex-col items-center justify-center p-4 sm:p-6 overflow-hidden">
      
      {/* Modals & Toasts */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-white border border-red-300 text-red-600 px-6 py-3 rounded-full font-bold uppercase tracking-wider shadow-[0_0_20px_rgba(239,68,68,0.2)]"
          >
            {toastMessage}
          </motion.div>
        )}
        
        {incomingDirectChallenge && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed inset-0 z-[100] bg-stone-50/80 flex items-center justify-center p-4 backdrop-blur-sm"
          >
            <div className="bg-white border border-blue-500/50 p-6 rounded-2xl max-w-sm w-full text-center shadow-[0_0_30px_rgba(59,130,246,0.2)]">
              <h2 className="text-2xl font-black uppercase text-stone-800 mb-2">Incoming Challenge!</h2>
              <p className="text-stone-600 mb-6">
                <span className="text-blue-400 font-bold">{incomingDirectChallenge.challengerName}</span> (ELO: {incomingDirectChallenge.challengerElo}) wants to play.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    socket.emit("reject-challenge", { challengerId: incomingDirectChallenge.challengerId, targetName: username });
                    setIncomingDirectChallenge(null);
                  }}
                  className="flex-1 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg font-bold uppercase transition-colors"
                >
                  Decline
                </button>
                <button
                  onClick={() => {
                    socket.emit("accept-challenge-from-lobby", { challengerId: incomingDirectChallenge.challengerId, targetId: userId, targetName: username, targetElo: elo });
                    setIncomingDirectChallenge(null);
                  }}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-stone-800 rounded-lg font-bold uppercase transition-colors shadow-[0_0_15px_rgba(37,99,235,0.4)]"
                >
                  Accept
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background styling */}
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] opacity-20 pointer-events-none" />
      <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-purple-900/10 to-transparent pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-6xl h-full max-h-[800px] flex flex-col bg-white/80 border border-stone-200 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl relative"
      >
        {/* Header */}
        <header className="flex items-center justify-between p-4 border-b border-stone-200 bg-white/40">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 text-purple-600 rounded-lg border border-purple-500/20">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black uppercase tracking-widest text-stone-800">The Tavern</h1>
              <div className="flex items-center gap-2 text-xs font-bold text-stone-600 uppercase tracking-widest mt-1">
                <span className="flex items-center gap-1.5"><div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" /> {onlineCount} Fixers Online</span>
              </div>
            </div>
          </div>
          <button 
            onClick={() => setCurrentView('menu')}
            className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-sm font-bold uppercase tracking-wider transition-colors"
          >
            Leave Tavern
          </button>
        </header>

        <div className="flex-1 flex flex-col md:flex-row min-h-0">
          
          {/* Main Area: Tables & Matchmaking */}
          <div className="flex-1 border-r border-stone-200 flex flex-col bg-white/40 min-h-0">
            <div className="p-4 pb-2 sm:p-6 sm:pb-2">
              <h2 className="text-sm font-bold text-stone-600 uppercase tracking-widest mb-4">Play & Host</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
                <button
                  onClick={quickMatch}
                  disabled={connecting}
                  className="col-span-1 sm:col-span-3 mb-2 flex flex-row items-center justify-center gap-3 p-4 bg-purple-600 hover:bg-purple-500 rounded-xl text-white transition-all shadow-lg"
                >
                  <Globe className="w-5 h-5" />
                  <span className="font-black uppercase tracking-widest text-sm sm:text-base">{isSearching ? searchText : "Quick Match (Find or Create)"}</span>
                </button>
                <button
                  onClick={() => { setIsPrivate(false); createRoom(); }}
                  disabled={connecting}
                  className="flex flex-row sm:flex-col items-center justify-center gap-2 p-3 sm:p-4 bg-purple-600/10 hover:bg-purple-600/20 border border-purple-200 rounded-xl text-purple-700 transition-all group"
                >
                  <div className="p-2 sm:p-3 bg-purple-50 rounded-full group-hover:scale-110 transition-transform">
                    <Globe className="w-4 h-4 sm:w-6 sm:h-6" />
                  </div>
                  <span className="font-bold uppercase tracking-wider text-[10px] sm:text-sm">Host Public</span>
                </button>
                <button
                  onClick={() => { setIsPrivate(true); createRoom(); }}
                  disabled={connecting}
                  className="flex flex-row sm:flex-col items-center justify-center gap-2 p-3 sm:p-4 bg-stone-100/50 hover:bg-stone-100 border border-stone-300 rounded-xl text-stone-700 transition-all group"
                >
                  <div className="p-2 sm:p-3 bg-stone-200/50 rounded-full group-hover:scale-110 transition-transform">
                    <Lock className="w-4 h-4 sm:w-6 sm:h-6" />
                  </div>
                  <span className="font-bold uppercase tracking-wider text-[10px] sm:text-sm">Host Private</span>
                </button>
              </div>

              <div className="flex gap-2 mb-8">
                <input 
                  type="text" 
                  placeholder="Have a private code?" 
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value)}
                  className="flex-1 bg-stone-200/50 border border-stone-200 rounded-xl px-4 py-3 text-stone-800 placeholder-stone-400 font-mono focus:outline-none focus:border-stone-300 transition-colors"
                />
                <button 
                  onClick={() => joinRoom(roomInput)}
                  disabled={!roomInput || connecting}
                  className="px-6 bg-stone-100 hover:bg-stone-200 disabled:opacity-50 text-stone-800 font-bold uppercase tracking-wider rounded-xl transition-colors"
                >
                  Join
                </button>
              </div>

              <h2 className="text-sm font-bold text-stone-600 uppercase tracking-widest mb-4 flex items-center gap-2"><Target className="w-4 h-4 text-purple-600"/> The Bounty Board</h2>
            </div>
            
            <div className="flex-1 overflow-y-auto px-2 pb-4 sm:px-6 sm:pb-6 space-y-2 sm:space-y-3 mt-2 sm:mt-0">
              {/* Human players hosting open tables */}
              <AnimatePresence>
                {publicRooms.map((room) => (
                  <motion.div
                    key={room.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex items-center justify-between p-3 sm:p-4 bg-white/80 border border-purple-200 hover:border-purple-500 rounded-xl transition-colors group shadow-[0_0_15px_rgba(168,85,247,0.1)]"
                  >
                    <div className="flex flex-col gap-1 sm:gap-2 flex-1">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center border border-purple-300 shrink-0">
                          <User className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-stone-800 font-bold truncate max-w-[150px]">{room.name}</h3>
                            <span className="text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200 font-bold tracking-widest uppercase">Human</span>
                            {room.hostStats && (
                               <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-300 font-bold tracking-widest uppercase ml-1 shadow-[0_0_8px_rgba(245,158,11,0.2)]">ELO {room.hostStats.elo}</span>
                            )}
                          </div>
                          {room.hostStats ? (
                            <p className="text-[10px] text-stone-600 font-mono mt-1 flex gap-3">
                              <span>W/L: <span className="text-stone-800">{room.hostStats.wins} - {room.hostStats.losses}</span></span>
                              <span className="text-stone-400">|</span>
                              <span>Fav: <span className="text-amber-400">{Object.entries(room.hostStats.powersUsed || {}).sort((a,b) => (b[1] as number)-(a[1] as number))[0]?.[0]?.toUpperCase() || 'NONE'}</span></span>
                            </p>
                          ) : (
                            <p className="text-xs text-stone-500 font-mono mt-1">Host waiting...</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => joinRoom(room.id)}
                      disabled={connecting}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-stone-800 rounded-lg text-sm font-bold uppercase tracking-wider transition-colors"
                    >
                      Join Match
                    </button>
                  </motion.div>
                ))}

                
                {/* Idle Users (Lurkers) */}
                {idleUsers.filter(u => u.id !== userId).map((user) => (
                  <motion.div
                    key={user.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between p-3 sm:p-4 bg-white/60 border border-blue-300 hover:border-blue-400 rounded-xl transition-colors group shadow-[0_0_10px_rgba(59,130,246,0.05)]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-900/30 rounded-full flex items-center justify-center border border-blue-300">
                        <User className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-stone-700 font-bold">{user.name}</h3>
                          <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full border border-blue-300 font-bold tracking-widest uppercase">Fixer</span>
                        </div>
                        <p className="text-xs text-stone-500 font-mono mt-1 flex items-center gap-1">
                          <span className="text-emerald-500">Lurking</span>
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setConnecting(true);
                        socket.emit('challenge-idle-user', { targetUserId: user.id, challengerId: userId, challengerName: username, challengerElo: elo });
                      }}
                      disabled={connecting}
                      className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 hover:text-blue-900 border-blue-200 rounded-lg text-sm font-bold uppercase tracking-wider transition-colors border border-blue-300"
                    >
                      Challenge
                    </button>
                  </motion.div>
                ))}

                {/* Ghost Bots */}
                {GHOST_BOTS.map((bot) => (
                  <motion.div
                    key={bot.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between p-3 sm:p-4 bg-white/60 border border-stone-200 hover:border-stone-400 rounded-xl transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center">
                        <Swords className="w-5 h-5 text-stone-500 group-hover:text-stone-700 transition-colors" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-stone-700 font-bold">{bot.name}</h3>
                        </div>
                        <p className="text-xs text-stone-500 font-mono mt-1 flex items-center gap-1">
                          <span className="text-amber-700">Bounty: {bot.bounty}</span> 
                          <span className="text-stone-300">•</span>
                          <span className={bot.status === 'looking' ? "text-emerald-500" : "text-stone-500"}>
                            {bot.status === 'looking' ? 'Looking for match' : 'In a match'}
                          </span>
                        </p>
                      </div>
                    </div>
                    {bot.status === 'looking' ? (
                      <button
                        onClick={() => challengeGhostBot(bot)}
                        disabled={connecting}
                        className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 hover:text-stone-800 rounded-lg text-sm font-bold uppercase tracking-wider transition-colors"
                      >
                        Challenge
                      </button>
                    ) : (
                      <button
                        disabled
                        className="px-4 py-2 bg-white border border-stone-200 text-stone-400 rounded-lg text-sm font-bold uppercase tracking-wider"
                      >
                        Spectate
                      </button>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Sidebar: Activity Feed / Chat */}
          <div className="w-full md:w-80 lg:w-96 flex flex-col bg-white border-t md:border-t-0 border-stone-200 max-h-64 md:max-h-none min-h-0">
            <div className="p-4 border-b border-stone-200 bg-white/40 shrink-0">
              <h2 className="text-sm font-bold text-stone-600 uppercase tracking-widest flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> Live Feed
              </h2>
            </div>
            
            <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-4">
              {logs.length === 0 ? (
                <p className="text-center text-stone-400 text-sm mt-4">Quiet in the tavern...</p>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="text-sm">
                    {log.type === 'system' && (
                      <div className="flex gap-2 text-stone-500 italic">
                        <span className="shrink-0">•</span>
                        <span>{log.message}</span>
                      </div>
                    )}
                    {log.type === 'game' && (
                      <div className="flex gap-2 text-purple-600 font-medium">
                        <span className="shrink-0">⚔️</span>
                        <span>{log.message}</span>
                      </div>
                    )}
                    {log.type === 'chat' && (
                      <div>
                        <span className="font-bold text-emerald-400 mr-2">{log.author}:</span>
                        <span className="text-stone-700">{log.message}</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <form onSubmit={sendChat} className="p-4 border-t border-stone-200 bg-white/40 shrink-0">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  placeholder="Say something..."
                  className="flex-1 bg-white border border-stone-300 rounded-lg px-3 py-2 text-stone-800 text-sm focus:outline-none focus:border-purple-500 transition-colors"
                  maxLength={100}
                />
                <button 
                  type="submit"
                  disabled={!chatMessage.trim()}
                  className="p-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-stone-800 rounded-lg transition-colors"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
