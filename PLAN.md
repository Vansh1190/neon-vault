# NEON VAULT — Plan v1

Open-source, browser-native, GTA-VC-flavored open city. Ships to GitHub Pages. No backend, no login, no install.

## 0. Reality ceiling (read this first)

| Claim | Verdict |
|---|---|
| "AAA quality" | Not possible from static Pages. No RAGE geometry density, no 40GB textures, no server sim. |
| "AAA-*looking* screenshots/clips" | Yes. Achievable via ACES tonemap + HDR bloom + baked GI + PBR + neon emissive + wet-road reflections. |
| Bundle budget | Practical: 20–35 MB first paint, 60 MB total. Repo soft cap ~100MB → assets in a release/LFS + jsDelivr CDN. |
| WebGPU | Best path, but still patchy on older GPUs/mobile. Ship WebGL2 fallback or you lose half the "goes viral" audience. |
| Perf target | 60fps @1080p on a 2020 mid laptop iGPU. 30fps acceptable on mobile. |

So v1 = **one dense, dripping-wet neon district you can drive in 8 seconds after page load**, not a 3-island state.

## 1. Why this one goes viral (differentiators)

Static hosting is a constraint we weaponize. Every state of the game is a URL.

1. **SEED THE CITY** — one text line → a whole district. `type "rainy little havana at midnight"` → deterministic 1km² city (procedural generator seeded from string hash). Screenshot bait #1.
2. **URL IS THE SAVE FILE** — world seed + camera path + time-of-day + weather live in the URL fragment (deflate + base64). No server, no DB, still 100% shareable. `.../#v1.K3d9...`
3. **PRESS R = CLIP** — last 20s ring buffer of input state → replay → `MediaRecorder` exports webm, or GIF. Instantly shareable driving clip with no upload. This is the actual growth loop.
4. **DRIVE-IN CAMERA** — one key: drone flythrough of the skyline that dive-cuts into the third-person chase cam on your car at 90km/h. 6-second clip that looks like a trailer. Every user films it.
5. **LIVE CITY EDITOR** (`E`) — extrude/bulldoze buildings, move roads, paint neon, drag time-of-day, then hit "share" (feature #2). Turns consumers into modders → the OSS contributor funnel.
6. **RADIO THAT SYNCS TO THE CITY** — fully procedural synthwave via WebAudio (no MP3s = ~0 MB), BPM/key derived from the seed, and neon emissive + fog pulse on the beat.
7. **MODS AS JSON** — vehicle/mission/paint definitions are declarative files, hot-reloadable in editor mode. Fork → new car → new URL → new tweet.

Pick 3 of these and the game is a meme for a week. All 7 and it's a community.

## 2. v1 scope — "Sunset Run"

Playable loop ≤ 10 min, load-to-driving < 10s on broadband.

**World** — 1.0 km² district, procedural from seed: beach + pier, one main neon strip, 2 alleys, 1 underpass, 1 big ramp, 6 blocks of facade variety, ~400 buildings (instanced, 6 archetypes × trim sheets), ~1200 neon signs from one emissive atlas.

**Movement** — on foot 3rd person (run, jump, vault, dodge-walk) + 5 vehicles (muscle car, bike, van, boat, police cruiser) with arcade drift physics, weight transfer, tire smoke, suspension bob.

**City lives** — 12 ambient traffic cars (lane graph + avoidance + honk + swerve), 20 pedestrians (path follow, look at you, flee on near-miss), 3 police that escalate on damage, birds/sea foam/palm sway.

**Missions** — 3 courier checkpoints (route arrows), 1 timed ramp stunt, endless "outrun 3 cruisers" score run. Best times + score in localStorage, ghost replay of your best line.

**Weather/time** — day/night cycle + magic-hour default + rain toggle (wet asphalt reflectivity, rain particles, heavier spray).

**Presentation** — ACES + bloom + grain + vignette + chromatic aberration + DOD-lite, baked lightmaps, SSR-lite on road, godrays, LOD + GPU instancing, frustum culling.

**UI** — loading screen with tips + progress, HUD (minimap top-down vector, speedo, mission ticker, seed badge), quality presets low/med/ultra, keybind list, settings persisted.

**Audio** — procedural radio (3 stations), engine pitch from RPM, tire screech/wave/horn synthesized, distance attenuation.

**Input** — WASD+mouse, full gamepad with vibration, mobile touch-lite (driving only).

## 3. Explicitly out of v1

Multiplayer, weapons/shooting/on-foot combat, story/dialogue, interiors, wanted-star economy, phone UI, cross-device saves, mobile on-foot, localization, >2km² world, ray-traced anything, physics wasm engine.

## 4. Architecture

```
neon-vault/
  packages/engine/     renderer, postfx, audio, input, ecs, streaming  (no game logic)
  packages/game/       citygen, vehicles, ai, missions, hud
  packages/schema/     mod + save-format types (zod), shared by editor & game
  packages/assets/     source art, pipeline scripts, KTX2/Draco outputs
  tools/citygen-cli/   headless seed → city.json (testable, deterministic)
  tools/asset-pipe/    FBX→glTF→Draco, textures→KTX2, atlas packer
  site/                Vite app, Pages base path, CI deploy
```
Rules: `engine` never imports `game`. Every system is a pure-ish module with typed data → testable headless in Node, deterministic from seed, and replayable. That determinism is what makes #3 (replay→clip) work.

## 5. Milestones (~5 weeks, solo pace)

- **M0 — 2d**: repo, Vite+TS strict, CI (typecheck/lint/test/build→Pages). Empty scene renders at 60fps with ACES+bloom. Pages URL live day 2.
- **M1 — 4d**: greybox citygen from seed, camera rig, DRIVE-IN CAMERA, on-foot controller. *Internal demo.*
- **M2 — 5d**: vehicle physics, 5 vehicles, traffic+ped AI, police chase, collision feedback.
- **M3 — 6d**: art pass. PBR trim sheets, baked GI, neon atlas, godrays, rain, LOD/instancing, memory + fps profiling to hit budget.
- **M4 — 5d**: missions, HUD, procedural radio, settings, gamepad, touch.
- **M5 — 4d**: viral layer. URL codec, replay ring buffer + MediaRecorder export, live editor v0 (bulldoze/extrude/neon/time). Clip-quality polish.
- **M6 — 3d**: perf pass, a11y, error boundary + Sentry-less crash card with "copy diagnostics", README/GIF, modding doc, launch.

**v1.0 = M0–M6.** Ship date = when a 15s capture of DRAMATIC CAMERA + rain + drift looks good enough to post.

## 6. Licensing & OSS mechanics

Code MIT. Assets CC-BY-4.0 (all original or CC0 sources, logged in `CREDITS.md`). No Rockstar/R *  * trademarks, name, art, or audio — "VC-like" is a vibe, not an asset. CI blocks binary files without a license entry.

Good-first-issue targets: citygen rules, neon sign SVG→emissive importer, mission JSON packs, quality preset tuning, doc/site. Governance: RFC issue template for engine changes, `tools/` documented so non-artists can contribute.

## 7. Risks

| Risk | Mitigation |
|---|---|
| Asset bloat kills Pages | KTX2+Basis+Draco, atlas everything, release-attached assets, CDN fetch, budget assert in CI |
| WebGPU-only looks broken for many | WebGL2 path from M0, preset auto-detect, no GPU feature without fallback |
| Procedural city looks samey | archetypes + rule-based block templates, seed-driven palette/height rules, hand-authored district preset as default |
| No server → no leaderboards | signed localStorage + optional community high-score Gist (later: free read-only API) |
| Solo scope bleed | anything not in §2 needs a v1.1 issue, not a branch |
| Legal | vibe-only art, CREDITS.md, CI license gate |

## 8. Metrics for "went wild"

Time-to-first-drive < 10s, 60fps on mid laptop, ≥3s clip posted by users without being asked, ≥10 forks with a mod within 2 weeks, ≥1 community seed shared.
