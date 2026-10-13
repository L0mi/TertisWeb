# Tertis Web 1.12

Cross-platform browser edition of Tertis for iPhone, iPad, Android, Windows, and macOS. It includes touch play, configurable PC controls, Single Player, VS AI, Deadlock/Chaos rules, and 2–4 player rooms with exact-version checks.

## Run locally

1. Install Node.js 18 or newer.
2. Open this folder in Terminal.
3. Run `npm install`.
4. Run `npm start`.
5. On the computer, open `http://localhost:4173`.

For phones on the same Wi-Fi or hotspot, open `http://COMPUTER-IP:4173`. Allow incoming connections if the operating system firewall asks. The computer running the server must remain awake.

## Share online and install on iPhone

Deploy this entire folder to a Node.js host that supports persistent WebSockets and HTTPS. Set the start command to `npm start`. Send everyone the HTTPS address. In Safari on iPhone, use **Share → Add to Home Screen** to install it as a PWA.

Static-only hosting is enough for Single Player and VS AI, but multiplayer needs `server.js` and WebSocket support.

## Default PC controls

- `A`: Move left
- `D`: Move right
- `S`: Soft drop
- `W`: Rotate
- `Shift`: Hold/swap
- `Space`: Hard drop
- `Esc`: Pause

Every key can be changed under Options. The on-screen control legend updates immediately.

## Multiplayer

- 2–4 players
- Room code and host approval
- Normal, Deadlock, and hidden Chaos rules
- Hold the lobby Deadlock button for 1.2 seconds to reveal Chaos
- Exact Version 1.12 / protocol 3 check
- Live compact opponent boards and garbage lines

The current native iOS and Android apps use Bonjour/NSD and cannot enter web rooms until their multiplayer transports are changed to this WebSocket protocol.

## Notice

This unofficial fan project is for entertainment and toilet-seat gaming purposes only. It is not for profit. Tetris and all related rights belong to The Tetris Company and their respective owners.
