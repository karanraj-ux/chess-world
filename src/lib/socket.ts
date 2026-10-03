import { io } from "socket.io-client";

// Socket.IO server URL. Same-origin by default (local dev serves game +
// socket together). For static hosts (GitHub Pages / itch.io), set
// VITE_SOCKET_URL to the persistent socket server (e.g. Render/Railway/Fly.io)
// at build time; the Tavern multiplayer lobby will connect there.
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

export const socket = io(SOCKET_URL, {
  autoConnect: false,
});
