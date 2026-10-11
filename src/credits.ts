export interface CreditEntry {
  title: string;
  text: string;
  url: string;
  license: string;
  licenseUrl: string;
}

/**
 * Shown in the in-app credits panel. Keep in sync with CREDITS.md.
 * The Solar System Scope entry is required by their CC BY 4.0 license.
 */
export const CREDITS: CreditEntry[] = [
  {
    title: 'Planet textures',
    text: 'Copyright (c) 2010-2017, Solar System Scope',
    url: 'https://www.solarsystemscope.com/textures/',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  },
  {
    title: 'Planet positions',
    text: 'Astronomy Engine by Don Cross',
    url: 'https://github.com/cosinekitty/astronomy',
    license: 'MIT',
    licenseUrl: 'https://opensource.org/license/mit',
  },
  {
    title: '3D rendering',
    text: 'three.js',
    url: 'https://threejs.org/',
    license: 'MIT',
    licenseUrl: 'https://opensource.org/license/mit',
  },
  {
    title: 'Space pictures and data',
    text: 'NASA Open APIs (Astronomy Picture of the Day, EPIC Earth images, NeoWs asteroids), NASA Solar Dynamics Observatory, and NOAA Space Weather Prediction Center. Images may carry their own credit.',
    url: 'https://api.nasa.gov/',
    license: 'NASA media usage guidelines',
    licenseUrl: 'https://www.nasa.gov/nasa-brand-center/images-and-media/',
  },
];
