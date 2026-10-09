# Solaris

An overhead 3D view of the solar system. The Sun sits in the middle, eight rings circle it, and each
ring carries a textured, spinning planet placed where it really is on the date you pick. Scrub forward
and back through time and watch them move.

```
 MM/DD/YY                                       HH:MM

                  ( overhead 3D view )

 +120 days                              [ ◄ date dial ► ]
```

Runs in the browser as an installable, offline-capable PWA. An Android APK built from the same code
comes later (see the roadmap).

## Use it

| Action | What it does |
| --- | --- |
| Tap the view | Tilt the camera: overhead, then angled, then low, then back |
| Double tap the view | Back to straight overhead |
| Drag the dial left / right | Move forward / back in time (a faster drag covers more days) |
| Mouse wheel | Scroll down moves forward in time |
| Arrow keys | One day. Hold Shift for 30 days, Alt for 365. Home returns to today |
| Tap the day counter | Back to today |

The date at top left, and the `+N days` counter, show the date you are viewing. The time at top right
is your live clock.

## What is real, what is not

- **Real:** each planet's angle around the Sun for the chosen date (heliocentric ecliptic longitude from
  [Astronomy Engine](https://github.com/cosinekitty/astronomy), accurate to about one arcminute), axial tilt,
  and spin direction. Venus spins backwards and Uranus lies on its side.
- **Not to scale:** the eight rings are evenly spaced, planet sizes are exaggerated (relative order kept),
  and spin speed is compressed so it is watchable.
- **Date range:** the dial runs about 100 years either side of today.

## Develop

Needs Node 20+ and [pnpm](https://pnpm.io/).

```bash
pnpm install
pnpm dev          # local dev server
pnpm test         # unit tests
pnpm typecheck
pnpm build        # production build in dist/
pnpm preview      # serve the production build
```

### Layout

```
src/ephemeris/   date -> planet positions (pure TypeScript, unit tested)
src/scene/       Three.js scene: Sun, rings, planets, camera, tap gestures
src/ui/          HUD: date, clock, day counter, dial, credits
src/state/       the date dial's shared state
public/textures/ planet textures (CC BY 4.0, see CREDITS.md)
```

The 3D scene is plain Three.js driven from its own render loop, not through React state, so scrubbing
the dial does not re-render React 60 times a second.

### Performance

- Pixel ratio is capped at 2 and drops automatically if frames run slow, then the frame rate is capped
  at about 30 fps. It never climbs back up, to avoid flip-flopping.
- Rendering pauses completely when the tab is hidden.
- If the browser reclaims the GPU context, the scene stops and resumes when it is restored.
- Textures are 1024x512 (about 1 MB in total) and are cached by the service worker after first load.

## Deploy

**GitHub Pages:** push to `main`. The `Deploy` workflow builds with `BASE_PATH=/solaris/` and publishes.
In the repo settings, set Pages to "GitHub Actions" as the source once.

**Vercel:** import the repo. The defaults work (build command `pnpm build`, output `dist`).

## Roadmap

- [x] PWA: overhead view, date dial, textures, tilt by tap
- [ ] Planet name labels
- [ ] Android APK (Trusted Web Activity or Capacitor, decided by a real-device smoothness test)
- [ ] Signed APK attached to GitHub Releases from CI
- [ ] Optional true-scale mode

## License

Code: [MIT](LICENSE). Textures: CC BY 4.0, see [CREDITS.md](CREDITS.md).
