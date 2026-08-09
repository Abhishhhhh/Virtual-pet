# Virtual Pet

A cute pixel companion that lives on your screen — follows your cursor,
plays, naps in its own little house, and stays out of your way (feather-light,
click-through overlay). Built with Electron, so it runs on both macOS and
Windows from the same code.

## Quick start

### 1. Install Node.js (one-time)

If you don't already have it, download the **LTS** version from
[nodejs.org](https://nodejs.org) and install it (just click through the
installer). To check it worked, open a terminal (PowerShell / Command
Prompt on Windows) and run:

```
node --version
```

You should see a version number like `v20.x` or higher.

### 2. Get the code

Either download the ZIP from the green **Code** button on GitHub and unzip
it, or clone it:

```
git clone https://github.com/Abhishhhhh/virtual-pet.git
cd virtual-pet
```

### 3. Install and run

```
npm install   # one-time: downloads Electron (~150-200 MB), be patient
npm start     # launch Virtual Pet
```

A transparent overlay launches with your pet's art already in
`assets/sprites/`. Look for the pet near the bottom-right of your screen,
and a tray icon in your menu bar (macOS) / system tray (Windows).

## Controls

Right-click the tray icon:

- **Call pet here** — wakes it and brings it to your cursor
- **Send to play** — triggers the play animation
- **Send to sleep** — sends it home to nap immediately
- **Rename pet…** — give it a name (persists across restarts)
- **Start at Login** — toggle so it launches automatically (see note below)
- **Quit**

## Make it start automatically at login

The tray menu has a **Start at Login** checkbox that calls Electron's
native login-item API for you — no extra setup needed. One caveat: it
points at whatever binary is currently running. In dev mode (`npm start`)
that's the bare Electron binary inside `node_modules`, which won't
reliably reopen this project on its own after a restart. It works
correctly once you've packaged the app:

```
npm run dist:mac    # or dist:win
```

Install the resulting app, launch it once, then toggle **Start at Login**
from its tray menu — from then on it starts itself automatically.

## Your art

`assets/sprites/` already has your generated sprite sheets sliced and
matched to the code:

| File | Frames |
|---|---|
| `idle.png` | 4 |
| `walk.png` | 6 |
| `play.png` | 5 |
| `nap.png` | 2 |
| `house.png` | 1 (static) |

If a file is ever missing, that state automatically falls back to a
procedural placeholder so the app never breaks — see
`assets/sprites/README.md` for the exact spec if you want to regenerate or
add more (e.g. a `wake.png`), and `IMAGE_PROMPTS.md` for ready-to-use AI
image prompts.

## How it works

- `main.js` — Electron main process. Creates a full-screen, transparent,
  click-through, always-on-top window; polls the OS cursor position
  (~30fps) since the window itself ignores mouse events; runs the tray
  menu; persists the pet's name, house location, and start-at-login
  preference to a small JSON file in the OS user-data folder.
- `src/renderer/renderer.js` — the pet's "brain". A small state machine
  (`idle` → `walk` → `play` / `nap`) that decides behavior each frame:
  chases the cursor when it's far away, wanders home and naps after ~25s
  of no mouse movement, occasionally plays on its own, and responds to
  tray commands instantly (even waking it from a nap). Draws your sprite
  sheets (or a procedural placeholder if a file is missing).
- CPU stays near zero while napping — the animation is just a 1fps
  two-frame loop and there's no per-frame movement math while asleep.

## Package a real app (installer)

```
npm run dist:mac    # -> dist/Virtual Pet.dmg
npm run dist:win    # -> dist/Virtual Pet Setup.exe
```

Uses `electron-builder` (already a devDependency). You'll want a real
`assets/icon.png` (1024x1024 recommended) before shipping — the tray/dock
icon falls back to nothing if it's missing, which is fine for dev but not
for a shipped build.

## Tuning behavior

All the personality knobs live at the top of `src/renderer/renderer.js`:

| Constant | Effect |
|---|---|
| `FOLLOW_DISTANCE` | how far the cursor has to be before the pet chases it |
| `IDLE_TIMEOUT` | ms of cursor inactivity before the pet heads home to nap |
| `SPEED` | pet's movement speed in px/frame |
| `ANIMS[state].fps` | animation playback speed per state |

And the random self-play trigger is in `maybeTriggerPlay()`.

## Notes on going further (matching the reference product)

- **Custom pet from a photo**: that's the "Custom Pet" tier on the
  reference site — it's a manual/human-in-the-loop art pipeline (someone
  hand draws or fine-tunes a model on the customer's dog photo), not
  something the app itself does at runtime. If you want to offer that as
  a paid tier, it'd be a separate ordering flow (form → you or a
  contractor produces the sprite sheet → email delivery), not app code.
- **Licensing/selling**: use your own name, icon, and branding, and check
  `electron-builder`'s code-signing docs before you ship — unsigned
  macOS/Windows apps trigger scary OS warnings on first launch.
- **Auto-updates**: not wired up. `electron-updater` (pairs with
  `electron-builder`) is the standard next step if you want it.
