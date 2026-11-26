// The flight model for Skyhook Courier: one job, how the plane moves.
// Speed, pitch, roll, heading, fuel, damage, stalls, landings and crashes.
// Everything here is numbers in, numbers out — no drawing, no input.

import { PLANE } from './config.js';
import { angleDiff, clamp, degToRad, lerp } from './random.js';

export class Flight {
  constructor(world, mission) {
    this.world = world;
    this.mission = mission;
    this.reset();
  }

  reset() {
    const home = this.world.strips[0];
    this.x = home.x;
    this.z = home.z - 40;
    this.y = home.elevation + 2;
    this.heading = home.headingRad;
    this.pitch = 0; // radians, + = nose up
    this.roll = 0; // radians, + = bank right
    this.speed = 0;
    this.throttle = 0;
    this.fuel = this.mission.fuel;
    this.damage = 0;
    this.gearDown = true;
    this.airborne = false;
    this.onGround = true;
    this.verticalSpeed = 0;
    this.stalled = false;
    this.crashed = false;
    this.landed = false;
    this.landTimer = 0;
    this.score = 0;
    this.combo = 0;
    this.ringsPassed = 0;
    this.landingsDone = 0;
    this.distanceFlown = 0;
    this.time = 0;
    this.prevX = this.x;
    this.prevZ = this.z;
    this.messages = [];
  }

  // inputs: { pitch: -1..1 (up positive), roll: -1..1 (right positive),
  //           throttleDelta: -1..1, brake: bool, gear: bool|null }
  step(dt, inputs, storm) {
    if (this.crashed) return;
    this.time += dt;
    this.prevX = this.x;
    this.prevZ = this.z;
    const P = PLANE;

    // --- throttle ---
    this.throttle = clamp(this.throttle + inputs.throttleDelta * dt * 0.55, 0, 1);
    if (inputs.brake) this.throttle = Math.max(0, this.throttle - dt * 1.4);

    // --- speed toward the throttle's target ---
    // On the ground the plane only rolls when the throttle is open;
    // in the air the wing keeps a minimum flying speed even at idle.
    const targetSpeed = this.onGround
      ? this.throttle * P.maxSpeed
      : P.minSpeed + this.throttle * (P.maxSpeed - P.minSpeed);
    const accel = this.onGround ? P.accel * 1.5 : P.accel;
    this.speed += clamp(targetSpeed - this.speed, -accel * dt, accel * dt);
    if (inputs.brake && this.onGround) this.speed = Math.max(0, this.speed - 30 * dt);

    // --- pitch & roll authority grows with airspeed ---
    const authority = clamp((this.speed - 12) / 45, 0, 1);
    const pitchTarget = inputs.pitch * degToRad(P.maxPitchDeg) * authority;
    const rollTarget = inputs.roll * degToRad(P.maxRollDeg) * authority;
    this.pitch += clamp(pitchTarget - this.pitch, -degToRad(P.pitchRateDeg) * dt, degToRad(P.pitchRateDeg) * dt);
    this.roll += clamp(rollTarget - this.roll, -degToRad(P.rollRateDeg) * dt, degToRad(P.rollRateDeg) * dt);

    // --- storm turbulence shoves the plane around ---
    if (storm) {
      const t = this.time;
      this.pitch += Math.sin(t * 1.7) * 0.006 + (Math.random() - 0.5) * 0.004;
      this.roll += Math.sin(t * 1.3 + 2) * 0.009 + (Math.random() - 0.5) * 0.006;
      this.pitch = clamp(this.pitch, degToRad(P.minPitchDeg), degToRad(P.maxPitchDeg));
      this.roll = clamp(this.roll, degToRad(-P.maxRollDeg), degToRad(P.maxRollDeg));
    }

    // --- turn: bank turns the nose ---
    const turnRate = Math.tan(this.roll) * 9.81 / Math.max(this.speed, 20) * P.turnAuthority;
    this.heading += turnRate * dt;

    // --- stall: too slow and the wing gives up ---
    this.stalled = this.airborne && this.speed < P.stallSpeed;
    if (this.stalled) {
      this.pitch = Math.max(this.pitch - degToRad(30) * dt, degToRad(-10));
    }

    // --- move ---
    const prevY = this.y;
    const forward = this.speed * dt;
    this.x += Math.sin(this.heading) * Math.cos(this.pitch) * forward;
    this.z += Math.cos(this.heading) * Math.cos(this.pitch) * forward;
    this.y += Math.sin(this.pitch) * this.speed * dt * P.climbFactor;
    if (this.stalled) this.y -= 14 * dt;
    this.verticalSpeed = (this.y - prevY) / dt;
    this.distanceFlown += forward;

    // --- fuel ---
    const drain = (P.fuelDrain + this.throttle * P.fuelDrainThrottle) * (storm ? 1.15 : 1);
    this.fuel = Math.max(0, this.fuel - drain * dt * (this.airborne || this.speed > 5 ? 1 : 0.25));
    if (this.fuel <= 0 && this.throttle > 0) this.throttle = Math.max(0, this.throttle - dt * 0.5);

    // --- ground contact ---
    const ground = this.world.heightAt(this.x, this.z);
    const strip = this.world.stripUnder(this.x, this.z);
    const clearance = this.y - ground;
    if (clearance <= 2) {
      this.handleGroundContact(ground, strip, dt);
    } else if (this.onGround && this.speed < 42) {
      // Still rolling: a nose-up taxi at low speed must not count as flying,
      // or the wing would stall the moment the nose comes up.
      this.y = ground + 2;
    } else {
      this.onGround = false;
      this.airborne = true;
      this.landed = false;
      this.landTimer = 0;
    }

    // --- balloons ---
    for (const b of this.world.balloons) {
      const dx = this.x - b.x;
      const dy = this.y - b.y;
      const dz = this.z - b.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < b.r + 6 && !this.crashed) {
        this.damage += P.damageBalloon;
        this.speed *= 0.55;
        this.messages.push({ text: 'BALLOON STRIKE! -' + P.damageBalloon + ' HULL', ttl: 2.2, kind: 'bad' });
        b.x += dx * 4;
        b.y += 30;
        if (this.damage >= 100) this.crash('You clipped a balloon and lost the wing.');
      }
    }

    if (this.damage >= 100 && !this.crashed) this.crash('The airframe gave out.');
  }

  // Ground contact has two very different meanings, and confusing them
  // wrecks the game: a takeoff roll is NOT a landing. A touchdown only
  // counts when the plane was flying a moment ago; a plane already on the
  // ground is taxiing, and it lifts off once it is fast and nose-up.
  handleGroundContact(ground, strip, dt) {
    const P = PLANE;
    const onStrip = strip && this.world.onRunway(this.x, this.z, strip);
    const wasAirborne = this.airborne;
    const descending = this.verticalSpeed < -1;

    if (!wasAirborne && !descending) {
      // Takeoff roll or taxi: already on the ground.
      if (onStrip) {
        if (this.speed > 42 && this.pitch > degToRad(5)) {
          // Rotation: fast enough and nose up — she flies.
          this.onGround = false;
          this.airborne = true;
          return;
        }
        this.y = ground + 2;
        this.onGround = true;
        if (this.speed < 20) this.pitch = 0;
        this.roll = lerp(this.roll, 0, 0.2);
        this.speed = Math.max(0, this.speed - 8 * dt);
        return;
      }
      // Creeping on the grass beside the strip at walking pace is fine.
      if (this.speed < 15) {
        this.y = ground + 2;
        this.onGround = true;
        this.speed = Math.max(0, this.speed - 12 * dt);
        return;
      }
      this.crash('You ran off the runway into the rough.');
      return;
    }

    // Touchdown: the plane was flying and has come down.
    if (onStrip) {
      const gentle = Math.abs(this.verticalSpeed) < P.safeDescent && this.speed < P.safeLandingSpeed;
      if (gentle) {
        this.y = ground + 2;
        this.onGround = true;
        this.airborne = false;
        this.pitch = 0;
        this.roll = lerp(this.roll, 0, 0.2);
        this.speed = Math.max(0, this.speed - 26 * dt);
        this.landTimer += dt;
        if (!this.landed) {
          this.landed = true;
          this.registerLanding(strip);
        }
      } else if (Math.abs(this.verticalSpeed) < P.safeDescent * 2.2) {
        // A hard landing on the strip: survives, but it hurts.
        this.y = ground + 2;
        this.onGround = true;
        this.airborne = false;
        this.damage += P.damageHardLanding;
        this.speed *= 0.6;
        this.messages.push({ text: 'HARD LANDING! -' + P.damageHardLanding + ' HULL', ttl: 2.2, kind: 'bad' });
        if (this.damage >= 100) this.crash('The landing gear folded on touchdown.');
        else if (!this.landed) {
          this.landed = true;
          this.registerLanding(strip);
        }
      } else {
        this.crash('You hit the runway far too fast.');
      }
    } else {
      // Terrain, water or a field: a crash.
      this.crash('You flew into the terrain.');
    }
  }

  registerLanding(strip) {
    const P = PLANE;
    this.landingsDone += 1;
    const perfect = Math.abs(this.verticalSpeed) < 3 && this.speed < 45;
    const points = 250 + (perfect ? 150 : 0);
    this.score += points;
    this.fuel = P.fuelPerLanding;
    this.damage = Math.max(0, this.damage - 30);
    this.messages.push({
      text: (perfect ? 'PERFECT LANDING +' : 'LANDED +') + points + '  ·  ' + strip.name.toUpperCase() + '  ·  REFUELLED',
      ttl: 3,
      kind: 'good',
    });
  }

  crash(reason) {
    this.crashed = true;
    this.crashReason = reason;
    this.speed = 0;
  }

  // Rings are checked after the step: the plane crosses the ring's plane
  // along the ring's normal, inside its radius, to count as flown through.
  checkRings() {
    if (this.crashed) return;
    const P = PLANE;
    for (const ring of this.world.rings) {
      if (ring.passed) continue;
      const dNow = (this.x - ring.x) * ring.nx + (this.z - ring.z) * ring.nz;
      const dPrev = (this.prevX - ring.x) * ring.nx + (this.prevZ - ring.z) * ring.nz;
      if (dPrev >= 0 || dNow < 0) continue;
      const dx = this.x - ring.x;
      const dy = this.y - ring.y;
      const dz = this.z - ring.z;
      const along = dx * ring.nx + dz * ring.nz;
      const rx = dx - ring.nx * along;
      const ry = dy;
      const rz = dz - ring.nz * along;
      const radial = Math.sqrt(rx * rx + ry * ry + rz * rz);
      if (radial < ring.radius) {
        ring.passed = true;
        this.ringsPassed += 1;
        this.combo += 1;
        const points = 100 + (this.combo - 1) * 25;
        this.score += points;
        this.fuel = Math.min(100, this.fuel + P.fuelPerRing);
        this.messages.push({ text: 'RING +' + points + (this.combo > 1 ? '  ·  COMBO x' + this.combo : ''), ttl: 2, kind: 'good' });
      } else {
        this.combo = 0;
      }
    }
  }
}
