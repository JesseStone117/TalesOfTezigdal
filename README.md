# Tales of Tezigdal

A browser third-person campaign game. The first campaign follows **Destral** in the mountain village of Hollyhollow.

Everything runs locally in the browser. There is no game server.

## Run

```bash
npm install
npm run dev
```

Then open the URL Vite prints (default `http://localhost:5173`).

Production build (hashed assets, so later updates cache-bust cleanly):

```bash
npm run build
npm run preview
```

## Play

The title screen is campaign select. **Destral** is available; later campaigns stay locked.

Hollyhollow sits in a tight mountain bowl. Talk to the villagers about Tezigdal, drink from the well to heal, and take the cave pass when you are ready. The cave has enemies and a boss at the far end. The road beyond is sealed for now.

A second player can join as the **Sprite**, a blue pixie that hovers with Destral, aims a 2D cursor, fires bolts, and can heal.

### Controls

| Action | Gamepad | Keyboard / mouse |
| --- | --- | --- |
| P1 Move | Left stick | WASD |
| P1 Look | Right stick | Mouse (click the world to capture) |
| Talk / confirm | A | E or Enter |
| Punch | X (or RT) | Space or left click |
| Pause / save / menu | Start | Esc |
| P2 Aim | Left (or right) stick | Arrow keys |
| P2 Fire | RT / A / X | C |
| P2 Heal | Y / LB | V |

Assign which controller is Player 1 or Player 2 in **Settings**. Invert vertical look is on by default. Fullscreen is also in Settings.

A controller is picked up as soon as it is connected.

### Saves

- Written to `localStorage` under `talesOfTezigdal.saves`
- Manual save and return-to-menu live on the pause screen
- Autosave about every 45 seconds and whenever you change areas
- **Export Save** downloads a JSON file
- **Import Save** reads that JSON back into this browser

## Project layout

- `assets/models/Destral.glb` — source character (copied into `public/models` for the runtime)
- `src/campaigns.js` — campaign registry and Hollyhollow dialogue
- `src/world/` — village, cave, NPCs, enemies
- `src/save.js` — localStorage plus import/export
