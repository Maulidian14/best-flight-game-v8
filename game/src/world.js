// The world of Skyhook Courier: terrain, airstrips, rings, balloons, clouds.
// One job: everything about WHERE things are. No drawing, no flight model.

import { AIRSTRIPS, WORLD } from './config.js';
import { clamp, fbm2, lerp, mulberry32 } from './random.js';

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export class World {
  constructor(seed, mission) {
    this.seed = seed;
    this.mission = mission;
    this.rng = mulberry32(seed * 7919 + 13);
    this.rings = [];
    this.balloons = [];
    this.clouds = [];
    this.islets = [
      { x: 700, z: 1150, r: 650 },
      { x: -850, z: 1950, r: 750 },
      { x: 350, z: 2750, r: 600 },
    ];
    this.buildAirstrips();
    this.buildRings();
    this.buildBalloons();
    this.buildClouds();
  }

  buildAirstrips() {
    this.strips = AIRSTRIPS.map((s) => {
      const hd = (s.headingDeg * Math.PI) / 180;
      const dx = Math.sin(hd);
      const dz = Math.cos(hd);
      const half = WORLD.runwayLength / 2;
      return {
        ...s,
        headingRad: hd,
        dirX: dx,
        dirZ: dz,
        startX: s.x - dx * half,
        startZ: s.z - dz * half,
        endX: s.x + dx * half,
        endZ: s.z + dz * half,
        elevation: WORLD.runwayElevation,
      };
    });
  }

  // Rolling hills that rise into islands and sink into the sea between them.
  heightAt(x, z) {
    let land = 0;
    for (const s of this.strips) {
      const dx = x - s.x;
      const dz = z - s.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      const mask = 1 - smoothstep(WORLD.islandRadius * 0.55, WORLD.islandRadius, d);
      if (mask > 0) land = Math.max(land, mask);
    }
    // Small uninhabited islets along the ring course, so the flight
    // between airstrips crosses green land, not just open sea.
    for (const isl of this.islets) {
      const dx = x - isl.x;
      const dz = z - isl.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      const mask = 1 - smoothstep(isl.r * 0.5, isl.r, d);
      if (mask > 0) land = Math.max(land, mask * 0.85);
    }
    const hills =
      46 * (0.5 + 0.5 * fbm2(x * 0.0021, z * 0.0021, this.seed, 3)) +
      22 * fbm2(x * 0.011 + 40, z * 0.011 - 17, this.seed + 5, 2);
    let h = hills * land - 9;
    // Flatten the ground under each runway so landings are possible.
    for (const s of this.strips) {
      const d = this.distToRunway(x, z, s);
      if (d < 320) {
        const blend = 1 - smoothstep(140, 320, d);
        h = lerp(h, WORLD.runwayElevation, blend);
      }
    }
    return h;
  }

  distToRunway(x, z, s) {
    const px = x - s.startX;
    const pz = z - s.startZ;
    const ex = s.endX - s.startX;
    const ez = s.endZ - s.startZ;
    const len2 = ex * ex + ez * ez;
    let t = (px * ex + pz * ez) / len2;
    t = clamp(t, 0, 1);
    const qx = s.startX + ex * t;
    const qz = s.startZ + ez * t;
    return Math.sqrt((x - qx) * (x - qx) + (z - qz) * (z - qz));
  }

  // The strip under (x, z), or null when the plane is not over a runway.
  stripUnder(x, z) {
    for (const s of this.strips) {
      if (this.distToRunway(x, z, s) < WORLD.runwayWidth / 2 + 4) return s;
    }
    return null;
  }

  // Is (x, z) on the runway surface, inside its length?
  // along is measured from the threshold (the runway's start), so it runs
  // 0..runwayLength — not -half..half.
  onRunway(x, z, s) {
    const px = x - s.startX;
    const pz = z - s.startZ;
    const along = px * s.dirX + pz * s.dirZ;
    const across = Math.abs(px * s.dirZ - pz * s.dirX);
    return along > -8 && along < WORLD.runwayLength + 8 && across < WORLD.runwayWidth / 2 + 3;
  }

  buildRings() {
    const rng = this.rng;
    const count = this.mission.rings;
    if (count === 0) return;
    if (this.mission.id === 'island-hop') {
      // All four rings sit on the first leg, A -> B, so the pilot collects
      // them on the way to the first landing instead of touring the whole
      // triangle before ever touching down.
      const [a, b] = [this.strips[0], this.strips[1]];
      const lx = b.x - a.x;
      const lz = b.z - a.z;
      const ll = Math.sqrt(lx * lx + lz * lz) || 1;
      for (let i = 0; i < count; i++) {
        const t = 0.2 + i * 0.2;
        const x = lerp(a.x, b.x, t) + (rng() - 0.5) * 260;
        const z = lerp(a.z, b.z, t) + (rng() - 0.5) * 260;
        this.rings.push(this.makeRing(x, z, 78 + rng() * 85, lx / ll, lz / ll));
      }
      return;
    }
    // Ring Run / Storm: a weaving course north out of Meridian Field.
    // The weave is gentle on purpose: the plane's turn radius at chase
    // speed is ~115 m, so a ring 500 m ahead must not sit 500 m aside.
    let x = 0;
    let z = 420;
    for (let i = 0; i < count; i++) {
      x = clamp(x + (rng() - 0.5) * 500, -1100, 1100);
      z += 450 + rng() * 200;
      this.rings.push(this.makeRing(x, z, 80 + rng() * 95, 0, 1));
    }
  }

  makeRing(x, z, y, nx = 0, nz = 1) {
    return {
      x,
      z,
      y,
      nx,
      nz,
      radius: 24 + this.rng() * 8,
      passed: false,
      hue: this.rng(),
    };
  }

  buildBalloons() {
    const rng = this.rng;
    const n = this.mission.storm ? 9 : 6;
    for (let i = 0; i < n; i++) {
      this.balloons.push({
        x: (rng() - 0.5) * 3200,
        z: 500 + rng() * 3200,
        y: 95 + rng() * 75,
        r: 13 + rng() * 5,
        drift: 1.5 + rng() * 2.5,
        phase: rng() * Math.PI * 2,
        color: ['#e74c3c', '#f39c12', '#8e44ad', '#16a085'][i % 4],
      });
    }
  }

  buildClouds() {
    const rng = this.rng;
    const n = this.mission.storm ? 34 : 24;
    for (let i = 0; i < n; i++) {
      this.clouds.push({
        x: (rng() - 0.5) * 7000,
        z: -800 + rng() * 5600,
        y: 250 + rng() * 150,
        r: 70 + rng() * 90,
        puffs: 3 + Math.floor(rng() * 3),
        seed: Math.floor(rng() * 100000),
      });
    }
  }

  // Balloons drift slowly with the wind; called once per frame.
  update(dt, time) {
    for (const b of this.balloons) {
      b.x += Math.sin(time * 0.05 + b.phase) * b.drift * dt;
      b.y += Math.sin(time * 0.3 + b.phase) * 0.6 * dt;
    }
  }

  nextRing() {
    return this.rings.find((r) => !r.passed) || null;
  }

  ringsRemaining() {
    return this.rings.filter((r) => !r.passed).length;
  }
}
