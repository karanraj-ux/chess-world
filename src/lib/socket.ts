import { io } from "socket.io-client";

// In production, Vite proxies /socket.io correctly if we connect to the same host
export const socket = io(window.location.origin, {
  autoConnect: false,
});
