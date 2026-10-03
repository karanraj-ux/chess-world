# ♟️ Chess World — Power & Chaos

A fun, non-boring chess game. Classic chess rules, but every side gets
chaos powers: **Bribe**, **Kill**, **Protect**, **Bunker**, **Bounty**, and
**Bait** — plus an AI companion that commentates your moves, and seamless
human ↔ AI control handover mid-match.

**Play it:** https://karanraj-ux.github.io/chess-world/

## Run locally

```bash
npm install
npm run dev      # serves the game AND the Socket.IO server on :3000
```

## Full stack (frontend + online multiplayer lobby)

`server.ts` is the Socket.IO multiplayer ("Tavern") server. `npm run dev`
serves the game and the socket server together on port 3000. `npm run build`
also bundles the server to `dist/server.cjs` (`npm start` runs it).

## Deploy

- **GitHub Pages** (frontend): pushes to `main` auto-deploy via
  `.github/workflows/deploy.yml` → https://karanraj-ux.github.io/chess-world/
- **itch.io**: upload a zip of the production build (built with
  `npx vite build --base=./`) as an HTML project, set *"This file will be
  played in the browser"*.

## Notes

- `GEMINI_API_KEY` in `.env.example`: the AI companion uses Gemini when a
  key is configured; the game plays fine without it.
- Online multiplayer needs the Socket.IO server on a persistent host
  (Render / Railway / Fly.io) — GitHub Pages only serves the static frontend.
