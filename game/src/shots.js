// Screenshot scenes for Skyhook Courier: one job, deterministic states.
// ?shot=start|flight|landing|end&seed=N builds the exact scene a
// screenshot needs, runs the simulation a fixed number of steps, then
// freezes it — so every screenshot is a real render of the game's code.

import { MISSIONS } from './config.js';
import { degToRad } from './random.js';

export function readShotParams() {
  const q = new URLSearchParams(window.location.search);
  return {
    shot: q.get('shot'),
    seed: Number(q.get('seed') || 7),
    demo: q.get('demo') === '1',
    mission: Number(q.get('mission') || 0),
  };
}

// Runs the sim for `steps` fixed frames with the autopilot flying.
function runSteps(game, steps) {
  for (let i = 0; i < steps; i++) {
    const inputs = game.autopilotInputs(1 / 60);
    game.flight.step(1 / 60, inputs, game.mission.storm);
    game.flight.checkRings();
    game.runner.update(1 / 60);
    game.world.update(1 / 60, game.flight.time);
  }
}

export function setupShot(game, shot, seed) {
  const fixedTime = 12.34;
  if (shot === 'start') {
    // Parked on Meridian Field at dawn light, menu over the top.
    game.startMission(0, seed);
    game.mode = 'menu';
    game.flight.y = game.world.strips[0].elevation + 2;
    game.flight.speed = 0;
    game.frozenTime = fixedTime;
    return 'menu';
  }
  if (shot === 'flight') {
    // Mid-course in Ring Run: two rings already banked, diving for the third.
    game.startMission(0, seed);
    game.mode = 'fly';
    game.autopilot = true;
    const f = game.flight;
    f.y = 150;
    f.speed = 78;
    f.throttle = 0.72;
    f.airborne = true;
    f.onGround = false;
    // Put the plane just past ring 1, aimed at ring 2.
    const r1 = game.world.rings[1];
    const r2 = game.world.rings[2];
    f.x = r1.x;
    f.z = r1.z + 60;
    f.heading = Math.atan2(r2.x - f.x, r2.z - f.z);
    f.pitch = degToRad(-2);
    game.world.rings[0].passed = true;
    game.world.rings[1].passed = true;
    f.ringsPassed = 2;
    f.score = 225;
    f.combo = 2;
    runSteps(game, 150);
    game.frozen = true;
    game.frozenTime = fixedTime;
    return 'fly';
  }
  if (shot === 'landing') {
    // Final approach to Coral Bay: low, slow, runway dead ahead.
    // All rings are already banked, so the autopilot aims at the runway.
    game.startMission(1, seed);
    game.mode = 'fly';
    game.autopilot = true;
    const f = game.flight;
    const strip = game.world.strips[1];
    for (const r of game.world.rings) r.passed = true;
    f.ringsPassed = game.world.rings.length;
    f.score = 450;
    f.combo = 4;
    f.x = strip.x - strip.dirX * 400;
    f.z = strip.z - strip.dirZ * 400;
    f.y = strip.elevation + 48;
    f.speed = 50;
    f.throttle = 0.34;
    f.heading = strip.headingRad;
    f.pitch = degToRad(-3);
    f.airborne = true;
    f.onGround = false;
    runSteps(game, 150);
    game.frozen = true;
    game.frozenTime = fixedTime;
    return 'fly';
  }
  if (shot === 'end') {
    // Mission complete: Ring Run finished, stats on screen.
    game.startMission(0, seed);
    game.mode = 'fly';
    game.autopilot = true;
    const f = game.flight;
    f.y = 130;
    f.speed = 70;
    f.throttle = 0.6;
    f.airborne = true;
    f.onGround = false;
    for (const r of game.world.rings) r.passed = true;
    f.ringsPassed = game.world.rings.length;
    f.score = 1425;
    f.distanceFlown = 8400;
    game.runner.elapsed = 165;
    game.runner.finish();
    game.mode = 'complete';
    game.frozenTime = fixedTime;
    return 'complete';
  }
  return null;
}

export { MISSIONS };
