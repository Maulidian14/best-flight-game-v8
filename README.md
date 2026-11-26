# Skyhook Courier

[![make.fun](https://img.shields.io/badge/make.fun-bounty-2f6fd0)](https://make.fun/c/best-flight-game-20261126-0057)
[![prize $500](https://img.shields.io/badge/prize-%24500-ffd23f)](https://make.fun/c/best-flight-game-20261126-0057)
[![flight game](https://img.shields.io/badge/game-flight%20simulator-7dff9a)](https://make.fun/c/best-flight-game-20261126-0057)

A bush-pilot flight game for make.fun's **best flight game** bounty. You fly a
single-engine courier plane across the Meridian Archipelago — threading sky
rings, minding the fuel gauge, and putting her down gently on island airstrips.

## Play

Open `game/index.html` in desktop Chrome (or run `node serve.ts` and open
http://localhost:8080). No network, no build step, no install.

| Key | Action |
| --- | --- |
| ↑ / ↓ | Pitch up / down |
| ← / → | Bank and turn |
| W / S | Throttle up / down |
| Space | Brake |
| P | Pause |
| M | Sound on / off |
| R | Restart the mission |
| 1 / 2 / 3 | Pick a mission |
| Mouse | Hold to steer; click the mission cards |

## The three missions

1. **Ring Run** — thread 12 sky rings before the tank runs dry. Every ring is
   +100 and a splash of fuel; chained rings build a combo.
2. **Island Hop** — a mail run: land at Coral Bay, then Palm Ridge, then home.
   A gentle touchdown refuels and repairs.
3. **Storm Courier** — 8 rings through a storm, then land at Coral Bay.
   Turbulence fights you the whole way and fuel burns faster.

## What is in the game

- A pseudo-3D chase view over a seeded archipelago: sea, beaches, fields,
  forests, ridges and clouds, with a runway or a target ring always ahead.
- A real flight model: throttle and speed, pitch and bank, turns from bank,
  stalls below flying speed, fuel that drains with throttle, hull damage from
  balloons and hard landings.
- Instruments that work: airspeed and altitude tapes, throttle bar, fuel and
  hull gauges, an attitude indicator, a heading compass, and a target arrow
  that points at the next ring or runway.
- Synthesised sound: engine hum, wind, ring chimes, landing thuds — all
  WebAudio, no audio files.
- An autopilot demo mode (`?demo=1`) that flies a mission by itself, and
  deterministic screenshot scenes (`?shot=start|flight|landing|end&seed=7`).

## Layout

```
game/
  index.html          the page: one canvas, one module script
  src/
    config.js         tuning, missions, palette
    random.js         seeded RNG and value noise (deterministic worlds)
    world.js          terrain, airstrips, rings, balloons, clouds
    physics.js        the flight model: speed, stalls, fuel, landings, crashes
    missions.js       objectives, completion, failure, scoring
    render.js         the 3D chase view: sky, terrain, runways, rings
    sprites.js        vector art: the plane, the balloons
    hud.js            instruments, warnings, messages, menus
    audio.js          synthesised WebAudio sound
    input.js          keyboard and mouse state
    shots.js          deterministic screenshot scenes
    main.js           game loop, state machine, autopilot
```

Everything in `game/` is original work written for this entry. No libraries,
no images, no audio files, no network requests.

## License

MIT — see [LICENSE](LICENSE).
