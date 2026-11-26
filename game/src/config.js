// Skyhook Courier — game configuration: tuning, missions, palette.
// One job: every number that shapes how the game feels lives here.

export const VIEW = {
  width: 1280,
  height: 800,
  fovDeg: 68,
  horizonY: 0.42, // fraction of height where the horizon sits
};

export const PLANE = {
  minSpeed: 26, // m/s — below this the wing stops flying
  cruiseSpeed: 62,
  maxSpeed: 118,
  accel: 22, // m/s^2 toward the throttle target speed
  maxPitchDeg: 16, // nose up
  minPitchDeg: -14, // nose down
  pitchRateDeg: 42, // deg/s of pitch authority
  maxRollDeg: 52,
  rollRateDeg: 95,
  turnAuthority: 3.0, // arcade turn: bank turns the nose fast enough to chase rings
  climbFactor: 0.9,
  stallSpeed: 32,
  fuelDrain: 0.42, // units/s at cruise throttle
  fuelDrainThrottle: 0.45, // extra units/s at full throttle
  fuelPerRing: 6,
  fuelPerLanding: 100,
  damageBalloon: 24,
  damageTerrain: 100, // touching terrain outside a runway is a crash
  damageHardLanding: 34,
  safeDescent: 6.5, // m/s vertical speed a landing may carry
  safeLandingSpeed: 58,
  ringRadius: 22,
};

export const WORLD = {
  seaLevel: 0,
  cellSize: 55, // terrain grid cell, metres
  gridCols: 26, // cells across the view
  gridRows: 22, // cells ahead of the camera
  viewAhead: 1500, // metres of terrain drawn ahead
  islandRadius: 1500,
  runwayLength: 430,
  runwayWidth: 30,
  runwayElevation: 14,
};

// The Meridian Archipelago: three airstrips, one home base.
export const AIRSTRIPS = [
  { id: 'A', name: 'Meridian Field', x: 0, z: 0, headingDeg: 0, label: 'HOME' },
  { id: 'B', name: 'Coral Bay', x: 2600, z: 2100, headingDeg: 38, label: 'BAY' },
  { id: 'C', name: 'Palm Ridge', x: -2300, z: 2900, headingDeg: -24, label: 'RIDGE' },
];

export const MISSIONS = [
  {
    id: 'ring-run',
    name: 'Ring Run',
    tagline: 'Thread 12 sky rings before the tank runs dry.',
    rings: 12,
    landings: 0,
    storm: false,
    fuel: 100,
    brief: 'Take off from Meridian Field, climb, and fly the ring course. Every ring is +100 and a splash of fuel. Finish all 12 to complete the run.',
  },
  {
    id: 'island-hop',
    name: 'Island Hop',
    tagline: 'Land at Coral Bay, then Palm Ridge, then home.',
    rings: 4,
    landings: 3,
    storm: false,
    fuel: 100,
    brief: 'A mail run across the archipelago. Land on each strip in order — a gentle touchdown refuels and repairs. Rings along the way are bonus points.',
  },
  {
    id: 'storm-courier',
    name: 'Storm Courier',
    tagline: 'One parcel, one storm, one very tight fuel gauge.',
    rings: 8,
    landings: 1,
    storm: true,
    fuel: 78,
    brief: 'A storm is sitting over the islands. Fly 8 rings through the murk, then put her down at Coral Bay. Turbulence will fight you the whole way.',
  },
];

export const PALETTE = {
  skyTop: '#2f6fd0',
  skyMid: '#7fb2e8',
  skyHorizon: '#cfe6f7',
  stormTop: '#3a4356',
  stormMid: '#6d7688',
  stormHorizon: '#aab2bd',
  sun: '#fff3c4',
  waterDeep: '#1d6fb8',
  waterShallow: '#3f9ad8',
  sand: '#e3cf9e',
  grass: '#5da24a',
  grassDark: '#4a8a3c',
  forest: '#2f6b2e',
  rock: '#8d8578',
  snow: '#eef2f5',
  runway: '#3c3f45',
  runwayMark: '#f5f2e8',
  ring: '#ffd23f',
  ringInner: '#ff9d2e',
  hud: '#eaf6ff',
  hudWarn: '#ff5a4e',
  hudGood: '#7dff9a',
  panel: 'rgba(8, 18, 34, 0.62)',
};

export const SCORE = {
  ring: 100,
  ringComboStep: 25, // extra per consecutive ring without a miss
  landing: 250,
  landingPerfect: 150, // gentle touchdown bonus
  missionComplete: 500,
  timeBonusPerSecond: 4, // leftover fuel seconds add up at mission end
};
