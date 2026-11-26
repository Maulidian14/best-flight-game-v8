// Missions for Skyhook Courier: one job, what "winning" means.
// Each mission reads the flight + world state and answers three questions:
// what is the objective, is it complete, and did the pilot fail?

import { SCORE } from './config.js';

export class MissionRunner {
  constructor(mission, flight, world) {
    this.mission = mission;
    this.flight = flight;
    this.world = world;
    this.complete = false;
    this.failed = false;
    this.failReason = '';
    this.completeBonus = 0;
    this.elapsed = 0;
  }

  // Where the pilot should aim next: a ring, or a runway to land on.
  nextTarget() {
    const ring = this.world.nextRing();
    if (ring) return { kind: 'ring', x: ring.x, y: ring.y, z: ring.z, label: 'RING ' + (this.flight.ringsPassed + 1) + '/' + this.mission.rings };
    if (this.mission.landings > 0) {
      const order = ['B', 'C', 'A'];
      const nextId = order[(this.flight.landingsDone) % order.length];
      const strip = this.world.strips.find((s) => s.id === nextId);
      if (strip) return { kind: 'runway', strip, x: strip.x, y: strip.elevation, z: strip.z, label: 'LAND AT ' + strip.name.toUpperCase() };
    }
    return null;
  }

  objectiveText() {
    if (this.mission.id === 'ring-run') {
      return 'RINGS ' + this.flight.ringsPassed + ' / ' + this.mission.rings;
    }
    if (this.mission.id === 'island-hop') {
      const order = ['CORAL BAY', 'PALM RIDGE', 'MERIDIAN FIELD'];
      const next = order[this.flight.landingsDone] || 'DONE';
      return 'LANDINGS ' + this.flight.landingsDone + ' / 3  ·  NEXT: ' + next;
    }
    return 'RINGS ' + this.flight.ringsPassed + ' / ' + this.mission.rings + '  ·  THEN LAND AT CORAL BAY';
  }

  update(dt) {
    if (this.complete || this.failed) return;
    this.elapsed += dt;
    const f = this.flight;
    if (f.crashed) {
      this.failed = true;
      this.failReason = f.crashReason || 'You crashed.';
      return;
    }
    if (f.fuel <= 0 && f.airborne && f.speed < 30) {
      this.failed = true;
      this.failReason = 'Out of fuel — she glided down into the sea.';
      return;
    }
    if (this.mission.id === 'ring-run' && f.ringsPassed >= this.mission.rings) {
      this.finish();
      return;
    }
    if (this.mission.id === 'island-hop' && f.landingsDone >= 3) {
      this.finish();
      return;
    }
    if (this.mission.id === 'storm-courier' && f.ringsPassed >= this.mission.rings && f.landingsDone >= 1) {
      this.finish();
    }
  }

  finish() {
    this.complete = true;
    const fuelBonus = Math.round(this.flight.fuel) * SCORE.timeBonusPerSecond;
    this.completeBonus = SCORE.missionComplete + fuelBonus;
    this.flight.score += this.completeBonus;
    this.flight.messages.push({
      text: 'MISSION COMPLETE! +' + SCORE.missionComplete + '  ·  FUEL BONUS +' + fuelBonus,
      ttl: 4,
      kind: 'good',
    });
  }

  summaryLines() {
    const f = this.flight;
    return [
      ['Score', String(f.score)],
      ['Rings flown', f.ringsPassed + ' / ' + this.mission.rings],
      ['Landings', String(f.landingsDone)],
      ['Distance', (f.distanceFlown / 1000).toFixed(1) + ' km'],
      ['Flight time', Math.floor(this.elapsed / 60) + ':' + String(Math.floor(this.elapsed % 60)).padStart(2, '0')],
      ['Fuel left', Math.round(f.fuel) + '%'],
      ['Hull', Math.round(100 - f.damage) + '%'],
    ];
  }
}
