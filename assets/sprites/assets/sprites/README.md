# Sprite files

Your generated shiba pet is already here:

| File        | Purpose               | Frames | Layout                          |
|-------------|------------------------|--------|----------------------------------|
| `idle.png`  | standing / breathing   | 4      | horizontal strip, 64x64 per frame |
| `walk.png`  | following the cursor   | 6      | horizontal strip, 64x64 per frame |
| `play.png`  | random play animation  | 5      | horizontal strip, 64x64 per frame |
| `nap.png`   | sleeping in the house  | 2      | horizontal strip, 64x64 per frame |
| `house.png` | the house, static      | 1      | single image, 96x96              |

If any of these files is missing or fails to load, that state automatically
falls back to a simple procedural placeholder — the app never crashes for
missing art.

- All PNGs have a **transparent background**.
- A strip file is just the frames placed side by side left-to-right (e.g.
  `walk.png` at 6 frames is 384x64: 6 x 64 wide, 64 tall).
- The pet always faces right in the art — the app mirrors it automatically
  when walking left.
- If you regenerate art with a different frame count, update the matching
  `frames` value in `ANIMS` at the top of `src/renderer/renderer.js`.
- Restart the app (`npm start`) after swapping files.

See `IMAGE_PROMPTS.md` in the project root for ready-to-use AI image
generation prompts for each of these.
