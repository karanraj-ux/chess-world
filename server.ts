import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { Server as SocketIOServer } from "socket.io";
import { createServer } from "http";

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  app.use(express.json());

  interface Room {
    id: string;
    players: string[];
    playerNames?: string[]; 
    hostStats?: any;
    state: any;
    isPublic: boolean;
    name: string;
    createdAt: number;
  }

  interface LogEntry {
    id: string;
    message: string;
    timestamp: number;
    type: 'chat' | 'system' | 'game';
    author?: string;
  }

  const rooms = new Map<string, Room>();
  const tavernLogs: LogEntry[] = [];
  const activeUsers = new Map<string, { id: string, name: string, status: 'idle'|'hosting'|'playing' }>();

  const broadcastTavernState = () => {
    const publicRooms = Array.from(rooms.values())
      .filter(r => r.isPublic)
      .map(r => ({
        id: r.id,
        name: r.name,
        players: r.players.length,
        createdAt: r.createdAt, playerNames: r.playerNames || [],
        hostStats: r.hostStats
      }));
    
    io.emit("tavern-update", {
      publicRooms,
      onlineCount: activeUsers.size,
      idleUsers: Array.from(activeUsers.values()).filter(u => u.status === 'idle').slice(-20),
      logs: tavernLogs.slice(-50)
    });
  };

  const addTavernLog = (type: 'chat'|'system'|'game', message: string, author?: string) => {
    tavernLogs.push({
      id: Math.random().toString(36).substring(7),
      type,
      message,
      author,
      timestamp: Date.now()
    });
    if (tavernLogs.length > 50) tavernLogs.shift();
    broadcastTavernState();
  };

  io.on("connection", (socket) => {
    socket.on("challenge-idle-user", ({ targetUserId, challengerId, challengerName, challengerElo }) => {
      // Find target socket
      for (const [sid, u] of activeUsers.entries()) {
        if (u.id === targetUserId && u.status === 'idle') {
          io.to(sid).emit("incoming-challenge", { challengerId, challengerName, challengerElo });
          break;
        }
      }
    });
    
    
    socket.on("accept-challenge-from-lobby", ({ challengerId, targetId, targetName, targetElo }) => {
      // Find challenger socket
      for (const [sid, u] of activeUsers.entries()) {
        if (u.id === challengerId) {
           const roomId = 'direct_' + Math.random().toString(36).substring(7);
           
           // Notify both clients to start direct match
           const targetUser = activeUsers.get(socket.id);
           
           io.to(sid).emit("start-direct-match", { 
             roomId, color: 'w', 
             opponentProfile: { name: targetName, bounty: targetElo }
           });
           
           socket.emit("start-direct-match", {
             roomId, color: 'b',
             opponentProfile: { name: u.name, bounty: 1200 } // we don't have challengerElo here but we can pass it if we store it
           });
           
           // Create room object internally
           rooms.set(roomId, {
             id: roomId,
             players: [challengerId, targetId],
             playerNames: [u.name, targetName],
             isPublic: true,
             name: `${u.name} vs ${targetName}`,
             state: null,
             createdAt: Date.now()
           });
           
           addTavernLog('system', `${u.name} and ${targetName} started a duel!`);
           
           u.status = 'playing';
           activeUsers.set(sid, u);
           if (targetUser) {
             targetUser.status = 'playing';
             activeUsers.set(socket.id, targetUser);
           }
           
           broadcastTavernState();
           break;
        }
      }
    });

    socket.on("reject-challenge", ({ challengerId, targetName }) => {
      // Send back rejection
      for (const [sid, u] of activeUsers.entries()) {
        if (u.id === challengerId) {
           io.to(sid).emit("challenge-rejected", { targetName });
           break;
        }
      }
    });

    console.log("Client connected:", socket.id);
    
    socket.on("join-tavern", ({ userId, username }) => {
      activeUsers.set(socket.id, { id: userId, name: username || 'Unknown Fixer', status: 'idle' });
      socket.join("tavern");
      broadcastTavernState();
    });

    socket.on("send-tavern-chat", (msg) => {
      const user = activeUsers.get(socket.id);
      if (user) {
        addTavernLog('chat', msg, user.name);
      }
    });

    socket.on("join-room", ({ roomId, userId, username, isPublic = false, roomName = "Public Match", hostStats }) => {
      let u = activeUsers.get(socket.id);
      if (u) {
        u.status = 'hosting';
        activeUsers.set(socket.id, u);
      }
      socket.join(roomId);
      
      let room = rooms.get(roomId);
      if (!room) {
        room = { id: roomId, players: [], playerNames: [], state: null, isPublic, name: roomName, createdAt: Date.now(), hostStats };
        if (isPublic) {
          addTavernLog('system', `${username || 'A player'} opened a new public table: ${roomName}`);
        }
      }
      
      if (!room.players.includes(userId)) {
        room.players.push(userId);
        if (!room.playerNames) room.playerNames = [];
        room.playerNames.push(username || 'Player');
      }
      
      rooms.set(roomId, room);

      let color = room.players[0] === userId ? 'w' : 'b';
      if (room.players.indexOf(userId) > 1) {
        color = 'spectator';
      }
      
      const roomClients = io.sockets.adapter.rooms.get(roomId);
      const playerCount = roomClients ? roomClients.size : 0;

      socket.emit("room-joined", { roomId, color, playerCount, players: room.players });
      socket.to(roomId).emit("player-joined", { playerCount, players: room.players });

      if (room.players.length === 2) {
        // Mark both as playing
        for (const pid of room.players) {
           for (const [sid, user] of activeUsers.entries()) {
             if (user.id === pid) {
               user.status = 'playing';
               activeUsers.set(sid, user);
             }
           }
        }
        if (room.isPublic) addTavernLog('game', `A match has begun at table: ${room.name}`);
      }

      broadcastTavernState();

      if (room.state) {
        setTimeout(() => {
          socket.emit("state-updated", { state: room.state });
        }, 500);
      }
    });

    socket.on("sync-state", ({ roomId, state }) => {
      let room = rooms.get(roomId);
      if (room) {
        room.state = state;
        rooms.set(roomId, room);
      }
      socket.to(roomId).emit("state-updated", { state });
    });

    
    socket.on("spectator-taunt", ({ roomId, type }) => {
      socket.to(roomId).emit("spectator-taunt", { type });
    });

    socket.on("challenge-winner", ({ roomId, challengerName }) => {
      socket.to(roomId).emit("challenge-received", { challengerName, challengerId: socket.id });
    });

    socket.on("accept-challenge", ({ roomId, challengerId, winnerWasWhite }) => {
      // Clear the current players except the winner
      let room = rooms.get(roomId);
      if (room) {
         // Assuming socket.id is the winner
         const winnerUserId = Array.from(activeUsers.values()).find(u => u.id === socket.id)?.id || socket.id; // It's stored by socket.id in activeUsers! 
         // Wait, room.players stores userId (which is sent on join-room)
         // Let's just emit an event that forces a rematch setup
         io.to(roomId).emit("challenge-accepted", { challengerId, winnerSocketId: socket.id, winnerWasWhite });
      }
    });

        socket.on("backup-arrived", ({ roomId, side, helperName }) => {
      io.to(roomId).emit("backup-granted", { side, helperName });
    });

    socket.on("disconnect", () => {
      // Notify rooms they were in
      for (const [roomId, room] of rooms.entries()) {
        const user = activeUsers.get(socket.id);
        if (user && room.players.includes(user.id)) {
           io.to(roomId).emit("opponent-disconnected");
        }
      }
      console.log("Client disconnected:", socket.id);
      activeUsers.delete(socket.id);
      broadcastTavernState();
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
