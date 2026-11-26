// Skyhook Courier — game loop, state machine and autopilot.
// One job: wire input, physics, world, rendering and sound together.

import { MISSIONS, VIEW } from './config.js';
import { angleDiff, clamp, degToRad } from './random.js';
import { Flight } from './physics.js';
import { World } from './world.js';
import { MissionRunner } from './missions.js';
import { Renderer } from './render.js';
import { Hud } from './hud.js';
import { Input } from './input.js';
import { SoundEngine } from './audio.js';
import { readShotParams, setupShot } from './shots.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.hud = new Hud(canvas);
    this.input = new Input(canvas);
    this.sound = new SoundEngine();
    this.mode = 'menu'; // menu | fly | paused | over | complete
    this.missionIndex = 0;
    this.mission = MISSIONS[0];
    this.best = 0;
    this.time = 0;
    this.autopilot = false;
    this.frozen = false;
    this.frozenTime = 0;
    this.endTimer = 0;
    this.menuBoxes = [];
    this.muted = false;
    this.lastTs = 0;
    this.shot = null;
    this.startMenuDemo();
  }

  startMenuDemo() {
    const { seed } = readShotParams();
    this.startMission(0, seed, true);
    this.mode = 'menu';
    this.autopilot = true;
  }

  startMission(index, seed, demo = false) {
    this.missionIndex = index;
    this.mission = MISSIONS[index];
    const s = seed ?? Math.floor(Math.random() * 1000000000);
    this.world = new World(s, this.mission);
    this.flight = new Flight(this.world, this.mission);
    this.runner = new MissionRunner(this.mission, this.flight, this.world);
    this.hud.messages = this.flight.messages;
    this.mode = 'fly';
    this.autopilot = demo;
    this.frozen = false;
    this.endTimer = 0;
    if (!demo) this.sound.ensure();
  }

  // The autopilot: flies toward the next ring or runway, climbs over
  // terrain, and flares for landing. Also the menu's background pilot.
  autopilotInputs() {
    const f = this.flight;
    const target = this.runner.nextTarget();
    if (!target) return { pitch: 0, roll: 0, throttleDelta: 0, brake: false };

    let aimX = target.x;
    let aimZ = target.z;
    let dist = Math.hypot(target.x - f.x, target.z - f.z);
    let targetY = target.y;
    let onFinal = false;

    if (target.kind === 'runway') {
      // A runway is not a point to fly AT — it is a line to fly ALONG.
      // The approach has two legs: first the approach fix, 500 m past the
      // threshold on the extended centreline, then the final itself, flown
      // down the glide slope to the far end. Two rules make it work:
      // (1) once the plane is near the fix it aims at the FAR end, which
      // turns it onto the runway heading from any arrival direction;
      // (2) "on final" is a corridor, not a side of the threshold — it
      // must stay true while the plane is past the threshold and still
      // over the strip, or the autopilot aborts the landing a second
      // before the wheels touch.
      const s = target.strip;
      const half = 215; // WORLD.runwayLength / 2
      const threshX = s.x - s.dirX * half;
      const threshZ = s.z - s.dirZ * half;
      const distThresh = Math.hypot(threshX - f.x, threshZ - f.z);
      const along = (f.x - threshX) * s.dirX + (f.z - threshZ) * s.dirZ;
      const lateral = Math.abs((f.x - threshX) * s.dirZ - (f.z - threshZ) * s.dirX);
      const aligned = Math.abs(angleDiff(f.heading, s.headingRad)) < 0.35;
      const fixX = s.x - s.dirX * (half + 500);
      const fixZ = s.z - s.dirZ * (half + 500);
      const distFix = Math.hypot(fixX - f.x, fixZ - f.z);
      onFinal = aligned && along > -900 && along < 800 && lateral < 250;
      if (onFinal) {
        aimX = s.x + s.dirX * (half + 600);
        aimZ = s.z + s.dirZ * (half + 600);
        // Glide slope to a touchdown 150 m past the threshold. The slope
        // must keep descending past the touchdown point — a slope that
        // bottoms out above the strip never lets the wheels find the
        // ground, the plane just flies over it and climbs away again.
        targetY = s.elevation + 2 + Math.max(0, 150 - along) * 0.10 - Math.max(0, along - 150) * 0.05;
      } else if (distFix < 250) {
        // Near the fix: aim at the far end. From here the far end sits
        // 1.5 km down the centreline, so aiming at it turns the plane
        // onto the runway heading whatever way it arrived.
        aimX = s.x + s.dirX * (half + 600);
        aimZ = s.z + s.dirZ * (half + 600);
        targetY = 120;
      } else {
        aimX = fixX;
        aimZ = fixZ;
        targetY = 120; // pattern altitude while positioning for the final
      }
      dist = distThresh;
    }

    const desiredHeading = Math.atan2(aimX - f.x, aimZ - f.z);
    const headingErr = angleDiff(f.heading, desiredHeading);
    // On final, steer gently: the runway is 30 m wide and a twitchy
    // autopilot S-turns across it instead of settling on the centreline.
    const rollGain = target.kind === 'runway' && onFinal ? 1.0 : 1.8;
    let roll = clamp(headingErr * rollGain, -1, 1);
    let pitch = clamp((targetY - f.y) / 55, -1, 1);
    let throttleDelta = 0;
    if (target.kind === 'runway') {
      // Final approach: hold ~48 m/s, never bleed off into a stall.
      throttleDelta = f.speed < 48 ? 0.6 : f.speed > 56 ? -0.5 : 0;
      if (dist > 500 && f.speed < 62) throttleDelta = 0.5;
    } else {
      // Rings are a turning game: hold ~62 m/s so the nose can swing.
      throttleDelta = f.speed < 58 ? 0.6 : f.speed > 68 ? -0.5 : 0;
      if (targetY - f.y > 40) pitch = Math.max(pitch, 0.55);
    }
    if (target.kind === 'runway' && onFinal) {
      // Final approach, done properly: follow the centreline and the
      // glide slope with two controllers, not one aim point.
      // (a) Line following: heading = runway heading, crabbed toward the
      // line in proportion to how far off it the plane is.
      const s = target.strip;
      const half = 215;
      const threshX = s.x - s.dirX * half;
      const threshZ = s.z - s.dirZ * half;
      const lateralSigned = (f.x - threshX) * s.dirZ - (f.z - threshZ) * s.dirX;
      const lineHeading = s.headingRad + clamp(-lateralSigned * 0.005, -0.45, 0.45);
      roll = clamp(angleDiff(f.heading, lineHeading) * 2.0, -1, 1);
      // (b) Vertical-speed control on the slope: descend at the slope's
      // rate plus a correction for the altitude error, so the plane gets
      // ON the slope instead of trailing above it all the way to the
      // far end of the strip.
      // Hold altitude until the plane is lined up: descending while still
      // 80 m off the centreline just plants it in the grass beside the
      // runway. The strip is long enough to absorb the delay.
      const lateral = Math.abs(lateralSigned);
      if (lateral > 50) targetY = Math.max(targetY, 55);
      const slopeVS = -0.10 * f.speed;
      const correction = -(f.y - targetY) * 0.15;
      const desiredVS = clamp(slopeVS + correction, -12, 3);
      const pitchRad = Math.asin(clamp(desiredVS / (Math.max(f.speed, 20) * 0.9), -0.3, 0.3));
      pitch = clamp(pitchRad / degToRad(16), -1, 1);
    }
    // Terrain ahead: climb if the ground rises into our path — except on
    // final approach, where the glide slope is the plan and the ground
    // around the strip is flattened for landing.
    if (!(target.kind === 'runway' && onFinal)) {
      const aheadX = f.x + Math.sin(f.heading) * 260;
      const aheadZ = f.z + Math.cos(f.heading) * 260;
      const aheadGround = this.world.heightAt(aheadX, aheadZ);
      if (f.y < aheadGround + 25) pitch = Math.max(pitch, 0.5);
    }
    return { pitch, roll, throttleDelta, brake: false };
  }

  playerInputs() {
    const inp = this.input;
    let pitch = 0;
    let roll = 0;
    if (inp.pitchUp) pitch += 1;
    if (inp.pitchDown) pitch -= 1;
    if (inp.rollLeft) roll -= 1;
    if (inp.rollRight) roll += 1;
    roll += inp.mouseSteer * 0.85;
    let throttleDelta = 0;
    if (inp.throttleUp) throttleDelta += 1;
    if (inp.throttleDown) throttleDelta -= 1;
    return {
      pitch: clamp(pitch, -1, 1),
      roll: clamp(roll, -1, 1),
      throttleDelta,
      brake: inp.brake,
    };
  }

  update(dt) {
    const inp = this.input;
    if (inp.anyGesture) this.sound.ensure();

    if (this.mode === 'menu') {
      // Background demo flight keeps the menu alive.
      const inputs = this.autopilotInputs();
      this.flight.step(dt, inputs, this.mission.storm);
      this.flight.checkRings();
      this.world.update(dt, this.flight.time);
      if (this.flight.crashed || this.runner.complete || this.runner.failed) {
        this.startMenuDemo();
      }
      // Hover + click on mission cards, or keys 1-3.
      this.menuBoxes.forEach((b) => {
        if (inp.mouseX >= b.x && inp.mouseX <= b.x + b.w && inp.mouseY >= b.y && inp.mouseY <= b.y + b.h) {
          this.missionIndex = b.index;
          if (inp.clicked) {
            this.sound.blip(660, 0.08, 'sine', 0.12);
            this.startMission(b.index);
          }
        }
      });
      if (inp.hit('1')) this.startMission(0);
      if (inp.hit('2')) this.startMission(1);
      if (inp.hit('3')) this.startMission(2);
      if (inp.hit('m')) this.toggleMute();
      this.input.consume();
      return;
    }

    if (this.mode === 'fly') {
      if (inp.hit('p')) {
        this.mode = 'paused';
        this.input.consume();
        return;
      }
      if (inp.hit('m')) this.toggleMute();
      if (inp.hit('r')) {
        this.startMission(this.missionIndex);
        this.input.consume();
        return;
      }
      if (inp.hit('q') || inp.hit('escape')) {
        this.startMenuDemo();
        this.input.consume();
        return;
      }
      const inputs = this.autopilot ? this.autopilotInputs() : this.playerInputs();
      this.flight.step(dt, inputs, this.mission.storm);
      this.flight.checkRings();
      this.runner.update(dt);
      this.world.update(dt, this.flight.time);
      this.hud.tick(dt);
      this.sound.update(this.flight.throttle, this.flight.speed, this.flight.airborne);
      if (this.flight.fuel < 20 && this.flight.fuel > 0 && Math.floor(this.time * 1.2) !== Math.floor((this.time - dt) * 1.2)) {
        this.sound.warning();
      }
      if (this.runner.failed || this.runner.complete) {
        this.endTimer += dt;
        if (this.endTimer > 1.4) {
          this.mode = this.runner.complete ? 'complete' : 'over';
          if (this.flight.score > this.best) this.best = this.flight.score;
          if (this.runner.complete) this.sound.ringChime();
          else this.sound.crash();
        }
      }
      this.input.consume();
      return;
    }

    if (this.mode === 'paused') {
      if (inp.hit('p')) this.mode = 'fly';
      if (inp.hit('m')) this.toggleMute();
      if (inp.hit('q') || inp.hit('escape')) this.startMenuDemo();
      if (inp.hit('r')) this.startMission(this.missionIndex);
      this.input.consume();
      return;
    }

    // over | complete
    if (inp.hit('r') || inp.hit('enter')) this.startMission(this.missionIndex);
    if (inp.hit('m')) this.toggleMute();
    if (inp.hit('q') || inp.hit('escape')) this.startMenuDemo();
    this.input.consume();
  }

  toggleMute() {
    this.muted = !this.muted;
    this.sound.setMuted(this.muted);
    this.flight.messages.push({ text: this.muted ? 'SOUND OFF' : 'SOUND ON', ttl: 1.2, kind: 'good' });
  }

  render() {
    const t = this.frozen ? this.frozenTime : this.time;
    this.renderer.render(this.flight, this.world, this.mission, t, this.mode === 'menu' ? 'fly' : this.mode);
    if (this.mode === 'menu') {
      this.menuBoxes = this.hud.drawMenu(this.renderer.ctx, MISSIONS, this.missionIndex, this.best);
    } else if (this.mode === 'fly') {
      this.hud.draw(this.flight, this.mission, this.runner, t);
    } else if (this.mode === 'paused') {
      this.hud.draw(this.flight, this.mission, this.runner, t);
      this.hud.drawPaused(this.renderer.ctx);
    } else if (this.mode === 'over') {
      this.hud.drawEndScreen(
        this.renderer.ctx,
        'CRASHED',
        this.runner.failReason,
        this.runner.summaryLines(),
        'Press R to fly again  ·  M for menu',
      );
    } else if (this.mode === 'complete') {
      this.hud.drawEndScreen(
        this.renderer.ctx,
        'MISSION COMPLETE',
        this.mission.name + ' — the parcel is delivered, the plane is whole.',
        this.runner.summaryLines(),
        'Press R to fly it again  ·  M for menu',
      );
    }
  }

  frame(ts) {
    const dt = Math.min(0.05, (ts - this.lastTs) / 1000 || 0.016);
    this.lastTs = ts;
    if (!this.frozen) {
      this.time += dt;
      this.update(dt);
    }
    this.render();
    if (!this.frozen) requestAnimationFrame((t) => this.frame(t));
  }

  start() {
    const { shot, seed, demo, mission } = readShotParams();
    if (shot) {
      this.shot = shot;
      // Screenshot mode: the page hint sits below the canvas and would
      // peek into the frame — hide it so the shot is pure game.
      const hint = document.getElementById('hint');
      if (hint) hint.style.display = 'none';
      setupShot(this, shot, seed);
      this.render();
      window.__shotReady = true;
      return;
    }
    // Demo mode: the autopilot flies the chosen mission with the HUD up.
    // It is the attract mode on the title screen, and the way to watch
    // the game play itself.
    if (demo) {
      this.startMission(mission, seed, true);
    }
    requestAnimationFrame((t) => this.frame(t));
  }
}

const canvas = document.getElementById('game');
canvas.width = VIEW.width;
canvas.height = VIEW.height;
const game = new Game(canvas);
window.__game = game;
game.start();
