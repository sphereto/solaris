# Credits

Solaris's source code is MIT licensed (see `LICENSE`). The files in `public/textures/`
are **not** covered by that license. They keep the license below.

## Planet textures

- **Source:** Solar System Scope texture library, <https://www.solarsystemscope.com/textures>
- **Copyright:** Copyright (c) 2010-2017, Solar System Scope
- **License:** Creative Commons Attribution 4.0 International (CC BY 4.0),
  <https://creativecommons.org/licenses/by/4.0/>
- **How we got them:** from the copies shipped with the Qt 3D `planets-qml` example
  (`tests/manual/planets-qml/images/solarsystemscope/` in <https://github.com/qt/qt3d>),
  which carries the same copyright and license notice.
- **Changes made by Solaris** (CC BY 4.0 asks for these to be listed):
  - Sun, planet and Earth day maps were resized to 1024x512 and re-encoded as JPEG.
  - The Earth cloud map was resized to 1024x512, converted to grayscale and is used as a transparency map.
  - The Saturn ring image was cropped to a single ring disc (the original file holds two side by side),
    resized to 512x512, and the color under fully transparent pixels was changed to avoid light edges.

| File | Original name |
| --- | --- |
| `sun.jpg` | `sunmap.jpg` |
| `mercury.jpg` | `mercurymap.jpg` |
| `venus.jpg` | `venusmap.jpg` |
| `earth.jpg` | `earthmap2k.jpg` |
| `earth-clouds.jpg` | `earthcloudmapspec.jpg` |
| `mars.jpg` | `marsmap2k.jpg` |
| `jupiter.jpg` | `jupitermap.jpg` |
| `saturn.jpg` | `saturnmap.jpg` |
| `saturn-ring.png` | `saturnringcolortrans.png` (left disc) |
| `uranus.jpg` | `uranusmap.jpg` |
| `neptune.jpg` | `neptunemap.jpg` |

The upstream images are described as based on NASA imagery. This project did not verify that claim.

If you want to swap in the official downloads, replace the files above with the same names.

## Code dependencies

- [Astronomy Engine](https://github.com/cosinekitty/astronomy) by Don Cross, MIT. Planet positions.
- [three.js](https://threejs.org/), MIT. 3D rendering.
- [React](https://react.dev/), MIT. Interface.
- [Vite](https://vite.dev/) and [vite-plugin-pwa](https://vite-pwa-org.netlify.app/), MIT. Build and offline support.

The in-app credits panel (`src/credits.ts`) must stay in sync with this file.

## Space pictures and data

Astronomy Picture of the Day, EPIC Earth images, NeoWs asteroid data and the NASA Image and Video Library via the NASA Open APIs (https://api.nasa.gov/).
Sun pictures: NASA Solar Dynamics Observatory (https://sdo.gsfc.nasa.gov/). Space weather numbers: NOAA Space Weather Prediction Center (https://www.swpc.noaa.gov/).
Exoplanet data: NASA Exoplanet Archive (https://exoplanetarchive.ipac.caltech.edu/), downloaded at build time.
Images may carry their own credit, which the app shows next to each picture.
See the NASA media usage guidelines: https://www.nasa.gov/nasa-brand-center/images-and-media/
