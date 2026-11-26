// World rendering for Skyhook Courier: one job, the 3D chase view.
// Sky, sun, mountain ridges, clouds, terrain grid, runways, rings,
// balloons and the plane's shadow — all projected from world space.

import { PALETTE, VIEW, WORLD } from './config.js';
import { clamp, fbm2, lerp, noise2 } from './random.js';
import { drawBalloon, drawPlane } from './sprites.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.focal = (VIEW.height / 2) / Math.tan(((VIEW.fovDeg / 2) * Math.PI) / 180);
    this.cx = VIEW.width / 2;
    this.cy = VIEW.height * VIEW.horizonY;
  }

  // Camera: behind the plane, looking along its heading, pitch following it.
  cameraFor(flight) {
    const fx = Math.sin(flight.heading);
    const fz = Math.cos(flight.heading);
    return {
      x: flight.x - fx * 19,
      y: flight.y + 5.5,
      z: flight.z - fz * 19,
      heading: flight.heading,
      pitch: flight.pitch * 0.35,
      fx,
      fz,
      rx: Math.cos(flight.heading),
      rz: -Math.sin(flight.heading),
    };
  }

  project(cam, x, y, z) {
    const dx = x - cam.x;
    const dy = y - cam.y;
    const dz = z - cam.z;
    const fwd = dx * cam.fx + dz * cam.fz;
    const rgt = dx * cam.rx + dz * cam.rz;
    const cp = Math.cos(cam.pitch);
    const sp = Math.sin(cam.pitch);
    const depth = fwd * cp + dy * sp;
    if (depth < 2) return null;
    const up = dy * cp - fwd * sp;
    return {
      x: this.cx + (rgt / depth) * this.focal,
      y: this.cy - (up / depth) * this.focal,
      depth,
      scale: this.focal / depth,
    };
  }

  horizonScreenY(cam) {
    return this.cy - Math.tan(cam.pitch) * this.focal;
  }

  render(flight, world, mission, time, mode) {
    const ctx = this.ctx;
    const cam = this.cameraFor(flight);
    const storm = mission && mission.storm;
    this.drawSky(ctx, cam, storm, time);
    this.drawRidges(ctx, cam, storm);
    this.drawClouds(ctx, cam, world, storm);
    this.drawTerrain(ctx, cam, world, time);
    this.drawRunways(ctx, cam, world);
    this.drawRings(ctx, cam, world, flight);
    this.drawBalloons(ctx, cam, world, time);
    this.drawPlaneShadow(ctx, cam, flight, world);
    if (mode === 'fly' || mode === 'shot') {
      drawPlane(ctx, this.cx, VIEW.height * 0.62, 1.05, flight.roll, flight.pitch, time, flight.throttle);
    }
  }

  drawSky(ctx, cam, storm, time) {
    const horizonY = this.horizonScreenY(cam);
    const g = ctx.createLinearGradient(0, 0, 0, Math.max(horizonY, 1));
    if (storm) {
      g.addColorStop(0, PALETTE.stormTop);
      g.addColorStop(0.6, PALETTE.stormMid);
      g.addColorStop(1, PALETTE.stormHorizon);
    } else {
      g.addColorStop(0, PALETTE.skyTop);
      g.addColorStop(0.55, PALETTE.skyMid);
      g.addColorStop(1, PALETTE.skyHorizon);
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW.width, Math.max(horizonY, 1));
    // Sun: fixed in the sky, parallax-free, top right.
    if (!storm) {
      const sx = VIEW.width * 0.78;
      const sy = VIEW.height * 0.13;
      const sg = ctx.createRadialGradient(sx, sy, 4, sx, sy, 90);
      sg.addColorStop(0, 'rgba(255, 243, 196, 0.95)');
      sg.addColorStop(0.25, 'rgba(255, 236, 170, 0.45)');
      sg.addColorStop(1, 'rgba(255, 236, 170, 0)');
      ctx.fillStyle = sg;
      ctx.fillRect(sx - 100, sy - 100, 200, 200);
      ctx.fillStyle = PALETTE.sun;
      ctx.beginPath();
      ctx.arc(sx, sy, 26, 0, Math.PI * 2);
      ctx.fill();
    }
    // Below the horizon: a base wash so terrain cells never show gaps.
    ctx.fillStyle = storm ? '#5d6a7a' : PALETTE.waterDeep;
    ctx.fillRect(0, Math.max(horizonY, 0), VIEW.width, VIEW.height - Math.max(horizonY, 0));
  }

  drawRidges(ctx, cam, storm) {
    const horizonY = this.horizonScreenY(cam);
    const layers = [
      { amp: 46, base: 0, color: storm ? '#4c5566' : '#7fa3c8', par: 0.6 },
      { amp: 78, base: 26, color: storm ? '#3d4454' : '#5d84ad', par: 1.0 },
    ];
    for (const layer of layers) {
      ctx.fillStyle = layer.color;
      ctx.beginPath();
      ctx.moveTo(0, VIEW.height);
      for (let sx = 0; sx <= VIEW.width; sx += 16) {
        const az = (sx / VIEW.width) * Math.PI * 2 + cam.heading * layer.par;
        const h = layer.base + (0.5 + 0.5 * noise2(Math.cos(az) * 2.1, Math.sin(az) * 2.1, 99)) * layer.amp;
        ctx.lineTo(sx, horizonY - h);
      }
      ctx.lineTo(VIEW.width, VIEW.height);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawClouds(ctx, cam, world, storm) {
    for (const c of world.clouds) {
      const p = this.project(cam, c.x, c.y, c.z);
      if (!p || p.depth > 5200) continue;
      const r = c.r * p.scale;
      if (r < 4) continue;
      ctx.fillStyle = storm ? 'rgba(70, 76, 90, 0.75)' : 'rgba(255, 255, 255, 0.88)';
      for (let i = 0; i < c.puffs; i++) {
        const px = p.x + (noise2(c.seed + i * 7, 3, 5) * 0.9) * r;
        const py = p.y + (noise2(c.seed + i * 13, 9, 5) * 0.28) * r;
        const pr = r * (0.45 + 0.3 * Math.abs(noise2(c.seed + i * 3, 1, 5)));
        ctx.beginPath();
        ctx.ellipse(px, py, pr, pr * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  terrainColor(x, z, h, time) {
    if (h < 0.5) {
      const shimmer = 0.5 + 0.5 * Math.sin(x * 0.011 + z * 0.009);
      return h < -4 ? this.shade(PALETTE.waterDeep, shimmer * 0.05) : this.shade(PALETTE.waterShallow, shimmer * 0.04);
    }
    if (h < 3.5) return PALETTE.sand;
    const field = (Math.floor(x / 130) + Math.floor(z / 130)) % 2 === 0;
    if (h < 26) return field ? PALETTE.grass : PALETTE.grassDark;
    if (h < 52) {
      return noise2(x * 0.02, z * 0.02, 7) > 0.25 ? PALETTE.forest : PALETTE.grassDark;
    }
    if (h < 88) return PALETTE.rock;
    return PALETTE.snow;
  }

  shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = clamp(((n >> 16) & 255) + amt * 255, 0, 255) | 0;
    const g = clamp(((n >> 8) & 255) + amt * 255, 0, 255) | 0;
    const b = clamp((n & 255) + amt * 255, 0, 255) | 0;
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  drawTerrain(ctx, cam, world) {
    const cols = WORLD.gridCols;
    const rows = WORLD.gridRows;
    const cell = WORLD.cellSize;
    // The ground right under the camera is closer than the first grid row,
    // so paint the lower screen with the local terrain colour first: no
    // bare base-wash band ever shows at the bottom of the frame.
    const horizonY = this.horizonScreenY(cam);
    const underColor = this.terrainColor(cam.x, cam.z, world.heightAt(cam.x, cam.z));
    ctx.fillStyle = underColor;
    ctx.fillRect(0, Math.max(horizonY, 0), VIEW.width, VIEW.height - Math.max(horizonY, 0));
    // Depth of each row grows geometrically so far cells stay big on screen.
    const depths = [];
    for (let j = 0; j <= rows; j++) depths.push(12 * Math.pow(1.26, j));
    // Project the whole grid first.
    const pts = [];
    for (let j = 0; j <= rows; j++) {
      pts[j] = [];
      for (let i = 0; i <= cols; i++) {
        const lat = (i - cols / 2) * cell;
        const wx = cam.x + cam.fx * depths[j] + cam.rx * lat;
        const wz = cam.z + cam.fz * depths[j] + cam.rz * lat;
        const h = world.heightAt(wx, wz);
        const p = this.project(cam, wx, h, wz);
        pts[j][i] = { p, h, x: wx, z: wz };
      }
    }
    // Far rows first so near cells paint over them.
    for (let j = rows - 1; j >= 0; j--) {
      for (let i = 0; i < cols; i++) {
        const a = pts[j][i];
        const b = pts[j][i + 1];
        const c = pts[j + 1][i + 1];
        const d = pts[j + 1][i];
        if (!a.p || !b.p || !c.p || !d.p) continue;
        const mh = (a.h + b.h + c.h + d.h) / 4;
        const mx = (a.x + b.x + c.x + d.x) / 4;
        const mz = (a.z + b.z + c.z + d.z) / 4;
        ctx.fillStyle = this.terrainColor(mx, mz, mh);
        ctx.beginPath();
        ctx.moveTo(a.p.x, a.p.y);
        ctx.lineTo(b.p.x, b.p.y);
        ctx.lineTo(c.p.x, c.p.y);
        ctx.lineTo(d.p.x, d.p.y);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  drawRunways(ctx, cam, world) {
    for (const s of world.strips) {
      const halfW = WORLD.runwayWidth / 2;
      const px = -s.dirZ;
      const pz = s.dirX;
      const corners = [
        [s.startX + px * halfW, s.startZ + pz * halfW],
        [s.startX - px * halfW, s.startZ - pz * halfW],
        [s.endX - px * halfW, s.endZ - pz * halfW],
        [s.endX + px * halfW, s.endZ + pz * halfW],
      ];
      const proj = corners.map(([x, z]) => this.project(cam, x, s.elevation, z));
      if (proj.some((p) => !p)) continue;
      ctx.fillStyle = PALETTE.runway;
      ctx.beginPath();
      ctx.moveTo(proj[0].x, proj[0].y);
      for (let i = 1; i < 4; i++) ctx.lineTo(proj[i].x, proj[i].y);
      ctx.closePath();
      ctx.fill();
      // Centreline dashes.
      ctx.fillStyle = PALETTE.runwayMark;
      const dashes = 9;
      for (let k = 0; k < dashes; k++) {
        const t0 = (k + 0.25) / dashes;
        const t1 = (k + 0.65) / dashes;
        const x0 = lerp(s.startX, s.endX, t0);
        const z0 = lerp(s.startZ, s.endZ, t0);
        const x1 = lerp(s.startX, s.endX, t1);
        const z1 = lerp(s.startZ, s.endZ, t1);
        const a = this.project(cam, x0 + px * 1.2, s.elevation + 0.4, z0 + pz * 1.2);
        const b = this.project(cam, x1 + px * 1.2, s.elevation + 0.4, z1 + pz * 1.2);
        const c = this.project(cam, x1 - px * 1.2, s.elevation + 0.4, z1 - pz * 1.2);
        const d = this.project(cam, x0 - px * 1.2, s.elevation + 0.4, z0 - pz * 1.2);
        if (!a || !b || !c || !d) continue;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(c.x, c.y);
        ctx.lineTo(d.x, d.y);
        ctx.closePath();
        ctx.fill();
      }
      // Threshold bars at both ends.
      for (const t of [0.02, 0.98]) {
        const cxp = lerp(s.startX, s.endX, t);
        const czp = lerp(s.startZ, s.endZ, t);
        const a = this.project(cam, cxp + px * (halfW - 3), s.elevation + 0.4, czp + pz * (halfW - 3));
        const b = this.project(cam, cxp - px * (halfW - 3), s.elevation + 0.4, czp - pz * (halfW - 3));
        if (!a || !b) continue;
        ctx.strokeStyle = PALETTE.runwayMark;
        ctx.lineWidth = Math.max(1, 900 / a.depth);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      // Windsock beside the strip.
      const wx = s.x + px * (halfW + 26);
      const wz = s.z + pz * (halfW + 26);
      const base = this.project(cam, wx, s.elevation, wz);
      const top = this.project(cam, wx, s.elevation + 12, wz);
      if (base && top) {
        ctx.strokeStyle = '#dddddd';
        ctx.lineWidth = Math.max(1, 500 / base.depth);
        ctx.beginPath();
        ctx.moveTo(base.x, base.y);
        ctx.lineTo(top.x, top.y);
        ctx.stroke();
        ctx.fillStyle = '#ff7a1a';
        ctx.beginPath();
        ctx.moveTo(top.x, top.y);
        ctx.lineTo(top.x + 14, top.y + 4);
        ctx.lineTo(top.x, top.y + 8);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  drawRings(ctx, cam, world, flight) {
    const sorted = [...world.rings].sort((a, b) => {
      const da = (a.x - cam.x) ** 2 + (a.z - cam.z) ** 2;
      const db = (b.x - cam.x) ** 2 + (b.z - cam.z) ** 2;
      return db - da;
    });
    for (const ring of sorted) {
      const p = this.project(cam, ring.x, ring.y, ring.z);
      if (!p || p.depth > 2400) continue;
      const rPx = ring.radius * p.scale;
      if (rPx < 3) continue;
      const next = world.nextRing() === ring;
      // Guide line from the ring down to the ground.
      const groundY = world.heightAt(ring.x, ring.z);
      const gp = this.project(cam, ring.x, groundY, ring.z);
      if (gp && next) {
        ctx.strokeStyle = 'rgba(255, 210, 63, 0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 8]);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y + rPx);
        ctx.lineTo(gp.x, gp.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.save();
      ctx.globalAlpha = ring.passed ? 0.35 : 1;
      ctx.shadowColor = next ? '#ffd23f' : '#ff9d2e';
      ctx.shadowBlur = next ? 26 : 12;
      ctx.strokeStyle = next ? PALETTE.ring : PALETTE.ringInner;
      ctx.lineWidth = Math.max(2, rPx * 0.14);
      ctx.beginPath();
      ctx.arc(p.x, p.y, rPx, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = Math.max(1, rPx * 0.05);
      ctx.beginPath();
      ctx.arc(p.x, p.y, rPx * 0.82, 0, Math.PI * 2);
      ctx.stroke();
      if (next && rPx > 14) {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = 'bold ' + Math.max(11, rPx * 0.34) + 'px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(Math.round(p.depth) + 'm', p.x, p.y - rPx - 10);
      }
      ctx.restore();
    }
  }

  drawBalloons(ctx, cam, world, time) {
    for (const b of world.balloons) {
      const p = this.project(cam, b.x, b.y, b.z);
      if (!p || p.depth > 2200) continue;
      const rPx = b.r * p.scale;
      if (rPx < 2) continue;
      drawBalloon(ctx, p.x, p.y, rPx, b.color, time, b.phase);
    }
  }

  drawPlaneShadow(ctx, cam, flight, world) {
    if (!flight.airborne) return;
    const groundY = world.heightAt(flight.x, flight.z);
    const p = this.project(cam, flight.x, groundY + 1, flight.z);
    if (!p) return;
    const alt = Math.max(0, flight.y - groundY);
    const r = clamp(4200 / (alt + 60), 6, 60);
    ctx.fillStyle = 'rgba(10, 20, 30, ' + clamp(0.3 - alt / 900, 0.05, 0.3) + ')';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r, r * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
