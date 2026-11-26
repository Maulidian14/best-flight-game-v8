// HUD and screens for Skyhook Courier: one job, everything drawn in 2D
// on top of the 3D view — instruments, warnings, messages and menus.

import { PALETTE, VIEW } from './config.js';
import { clamp, radToDeg } from './random.js';

export class Hud {
  constructor(canvas) {
    this.ctx = canvas.getContext('2d');
    this.messages = [];
  }

  push(text, kind, ttl = 2.5) {
    this.messages.push({ text, kind, ttl, max: ttl });
  }

  draw(flight, mission, runner, time) {
    const ctx = this.ctx;
    this.drawTopBar(ctx, flight, mission, runner);
    this.drawSpeedTape(ctx, flight);
    this.drawAltTape(ctx, flight);
    this.drawThrottle(ctx, flight);
    this.drawFuelDamage(ctx, flight);
    this.drawAttitude(ctx, flight);
    this.drawCompass(ctx, flight);
    this.drawTargetArrow(ctx, flight, runner);
    this.drawWarnings(ctx, flight, time);
    this.drawMessages(ctx);
  }

  panel(ctx, x, y, w, h) {
    ctx.fillStyle = PALETTE.panel;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
  }

  drawTopBar(ctx, flight, mission, runner) {
    // Mission + objective, top left.
    this.panel(ctx, 16, 14, 330, 56);
    ctx.fillStyle = PALETTE.hud;
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(mission.name.toUpperCase(), 28, 36);
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = '#cfe3f2';
    ctx.fillText(runner.objectiveText(), 28, 58);
    // Score, top centre.
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillText(String(flight.score).padStart(6, '0'), VIEW.width / 2, 44);
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = '#cfe3f2';
    ctx.fillText('SCORE', VIEW.width / 2, 62);
    // Clock, top right.
    this.panel(ctx, VIEW.width - 146, 14, 130, 56);
    ctx.fillStyle = PALETTE.hud;
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'right';
    const t = Math.floor(runner.elapsed);
    ctx.fillText(Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'), VIEW.width - 30, 40);
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = '#cfe3f2';
    ctx.fillText('FLIGHT TIME', VIEW.width - 30, 58);
  }

  drawSpeedTape(ctx, flight) {
    const x = 16;
    const y = 120;
    const h = 210;
    this.panel(ctx, x, y, 74, h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, 74, h);
    ctx.clip();
    const speed = Math.round(flight.speed * 3.6); // km/h
    ctx.font = '13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    for (let v = Math.max(0, speed - 60); v <= speed + 60; v += 10) {
      const dy = y + h / 2 - (v - speed) * 1.6;
      if (dy < y + 8 || dy > y + h - 8) continue;
      ctx.fillStyle = v % 50 === 0 ? '#ffffff' : '#9db8cc';
      ctx.fillText(String(v), x + 10, dy + 4);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.moveTo(x + 52, dy);
      ctx.lineTo(x + 64, dy);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.moveTo(x + 74, y + h / 2 - 8);
    ctx.lineTo(x + 88, y + h / 2);
    ctx.lineTo(x + 74, y + h / 2 + 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillText(String(speed), x + 92, y + h / 2 + 6);
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillStyle = '#cfe3f2';
    ctx.fillText('KM/H', x + 92, y + h / 2 + 22);
  }

  drawAltTape(ctx, flight) {
    const x = VIEW.width - 90;
    const y = 120;
    const h = 210;
    this.panel(ctx, x, y, 74, h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, 74, h);
    ctx.clip();
    const alt = Math.round(flight.y);
    ctx.font = '13px system-ui, sans-serif';
    ctx.textAlign = 'right';
    for (let v = Math.max(0, alt - 120); v <= alt + 120; v += 20) {
      const dy = y + h / 2 - (v - alt) * 0.85;
      if (dy < y + 8 || dy > y + h - 8) continue;
      ctx.fillStyle = v % 100 === 0 ? '#ffffff' : '#9db8cc';
      ctx.fillText(String(v), x + 62, dy + 4);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.moveTo(x + 10, dy);
      ctx.lineTo(x + 22, dy);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.moveTo(x, y + h / 2 - 8);
    ctx.lineTo(x - 14, y + h / 2);
    ctx.lineTo(x, y + h / 2 + 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(String(alt), x - 18, y + h / 2 + 6);
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillStyle = '#cfe3f2';
    ctx.fillText('ALT M', x - 18, y + h / 2 + 22);
  }

  drawThrottle(ctx, flight) {
    const x = 100;
    const y = 360;
    const h = 150;
    this.panel(ctx, x, y, 26, h);
    const fill = clamp(flight.throttle, 0, 1) * (h - 12);
    ctx.fillStyle = flight.throttle > 0.85 ? '#ff9d2e' : '#7dff9a';
    ctx.beginPath();
    ctx.roundRect(x + 6, y + h - 6 - fill, 14, fill, 4);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('THR', x + 13, y + h + 16);
    ctx.fillText(Math.round(flight.throttle * 100) + '%', x + 13, y - 8);
  }

  drawFuelDamage(ctx, flight) {
    const x = VIEW.width - 226;
    const y = 360;
    this.panel(ctx, x, y, 210, 74);
    ctx.textAlign = 'left';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillStyle = flight.fuel < 25 ? PALETTE.hudWarn : '#ffffff';
    ctx.fillText('FUEL ' + Math.round(flight.fuel) + '%', x + 12, y + 20);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.roundRect(x + 12, y + 28, 186, 10, 5);
    ctx.fill();
    ctx.fillStyle = flight.fuel < 25 ? '#ff5a4e' : '#ffd23f';
    ctx.beginPath();
    ctx.roundRect(x + 12, y + 28, 186 * clamp(flight.fuel / 100, 0, 1), 10, 5);
    ctx.fill();
    ctx.fillStyle = flight.damage > 60 ? PALETTE.hudWarn : '#ffffff';
    ctx.fillText('HULL ' + Math.round(100 - flight.damage) + '%', x + 12, y + 56);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.roundRect(x + 12, y + 62, 186, 8, 4);
    ctx.fill();
    ctx.fillStyle = flight.damage > 60 ? '#ff5a4e' : '#7dff9a';
    ctx.beginPath();
    ctx.roundRect(x + 12, y + 62, 186 * clamp(1 - flight.damage / 100, 0, 1), 8, 4);
    ctx.fill();
  }

  drawAttitude(ctx, flight) {
    const cx = VIEW.width / 2;
    const cy = VIEW.height - 78;
    const r = 52;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(cx, cy);
    ctx.rotate(-flight.roll);
    const pitchPx = clamp(radToDeg(flight.pitch), -20, 20) * 1.6;
    ctx.fillStyle = '#3f8fd2';
    ctx.fillRect(-r, -r + pitchPx, r * 2, r - pitchPx);
    ctx.fillStyle = '#8a6b42';
    ctx.fillRect(-r, pitchPx, r * 2, r - pitchPx + 1);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-r, pitchPx);
    ctx.lineTo(r, pitchPx);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    // Fixed aircraft symbol.
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 4);
    ctx.lineTo(cx - 16, cy + 6);
    ctx.lineTo(cx - 6, cy + 6);
    ctx.lineTo(cx, cy + 2);
    ctx.lineTo(cx + 6, cy + 6);
    ctx.lineTo(cx + 16, cy + 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#cfe3f2';
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ATTITUDE', cx, cy + r + 14);
  }

  drawCompass(ctx, flight) {
    const cx = VIEW.width / 2;
    const y = 92;
    const w = 340;
    this.panel(ctx, cx - w / 2, y - 16, w, 34);
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - w / 2, y - 16, w, 34);
    ctx.clip();
    const headingDeg = ((radToDeg(flight.heading) % 360) + 360) % 360;
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (let d = -180; d <= 180; d += 15) {
      const deg = ((Math.round(headingDeg / 15) * 15 + d) % 360 + 360) % 360;
      const dx = (d * w) / 180;
      const px = cx + dx;
      const label = deg % 45 === 0 ? dirs[Math.round(deg / 45) % 8] : String(deg);
      ctx.fillStyle = deg % 45 === 0 ? '#ffd23f' : '#9db8cc';
      ctx.fillText(label, px, y + 5);
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.moveTo(px, y + 10);
      ctx.lineTo(px, y + 16);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.moveTo(cx, y - 16);
    ctx.lineTo(cx - 6, y - 24);
    ctx.lineTo(cx + 6, y - 24);
    ctx.closePath();
    ctx.fill();
  }

  drawTargetArrow(ctx, flight, runner) {
    const target = runner.nextTarget();
    if (!target) return;
    const dx = target.x - flight.x;
    const dz = target.z - flight.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const targetHeading = Math.atan2(dx, dz);
    let rel = targetHeading - flight.heading;
    while (rel > Math.PI) rel -= Math.PI * 2;
    while (rel < -Math.PI) rel += Math.PI * 2;
    // Only show the arrow when the target is off the nose.
    if (Math.abs(rel) < 0.35) return;
    const cx = VIEW.width / 2;
    const cy = VIEW.height * 0.3;
    const r = 120;
    const ax = cx + Math.sin(rel) * r;
    const ay = cy - Math.cos(rel) * r * 0.4;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(rel);
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(10, 8);
    ctx.lineTo(-10, 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(target.label + '  ·  ' + (dist > 1000 ? (dist / 1000).toFixed(1) + ' km' : Math.round(dist) + ' m'), ax, ay + 26);
  }

  drawWarnings(ctx, flight, time) {
    const warns = [];
    if (flight.stalled) warns.push('STALL — NOSE DOWN, THROTTLE UP');
    if (flight.fuel < 20 && flight.fuel > 0) warns.push('LOW FUEL — FIND A RUNWAY');
    if (flight.fuel <= 0) warns.push('OUT OF FUEL');
    if (flight.damage > 65) warns.push('HULL CRITICAL');
    if (warns.length === 0) return;
    if (Math.floor(time * 2.4) % 2 === 0) return; // blink
    ctx.fillStyle = PALETTE.hudWarn;
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(warns[0], VIEW.width / 2, 150);
  }

  drawMessages(ctx) {
    const now = performance.now();
    ctx.textAlign = 'center';
    let y = 190;
    this.messages = this.messages.filter((m) => m.ttl > 0);
    for (const m of this.messages) {
      const alpha = clamp(m.ttl / 0.6, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = m.kind === 'bad' ? PALETTE.hudWarn : PALETTE.hudGood;
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.fillText(m.text, VIEW.width / 2, y);
      ctx.globalAlpha = 1;
      y += 30;
    }
  }

  tick(dt) {
    for (const m of this.messages) m.ttl -= dt;
  }

  // ---- full-screen menus ----

  drawMenu(ctx, missions, selected, best) {
    ctx.fillStyle = 'rgba(6, 14, 28, 0.45)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.fillText('SKYHOOK COURIER', VIEW.width / 2, 150);
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('BUSH PILOT OF THE MERIDIAN ARCHIPELAGO', VIEW.width / 2, 186);
    ctx.fillStyle = '#eaf6ff';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('Fly the rings. Mind the fuel. Put her down gentle.', VIEW.width / 2, 220);

    const cardW = 340;
    const gap = 26;
    const total = cardW * 3 + gap * 2;
    let x = (VIEW.width - total) / 2;
    const y = 270;
    const h = 220;
    const boxes = [];
    missions.forEach((m, i) => {
      const sel = i === selected;
      ctx.fillStyle = sel ? 'rgba(255, 210, 63, 0.16)' : PALETTE.panel;
      ctx.strokeStyle = sel ? '#ffd23f' : 'rgba(255,255,255,0.25)';
      ctx.lineWidth = sel ? 3 : 1.5;
      ctx.beginPath();
      ctx.roundRect(x, y, cardW, h, 12);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffd23f';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.fillText('PRESS ' + (i + 1), x + cardW / 2, y + 34);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px system-ui, sans-serif';
      ctx.fillText(m.name.toUpperCase(), x + cardW / 2, y + 74);
      ctx.fillStyle = '#cfe3f2';
      ctx.font = '15px system-ui, sans-serif';
      this.wrapText(ctx, m.tagline, x + cardW / 2, y + 106, cardW - 36, 22);
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillStyle = '#9db8cc';
      const detail =
        m.id === 'ring-run'
          ? '12 rings · calm skies'
          : m.id === 'island-hop'
            ? '3 landings · 4 rings'
            : '8 rings · storm · 1 landing';
      ctx.fillText(detail, x + cardW / 2, y + h - 26);
      boxes.push({ x, y, w: cardW, h, index: i });
      x += cardW + gap;
    });

    ctx.fillStyle = '#eaf6ff';
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText('↑ ↓ pitch   ← → bank & turn   W / S throttle   SPACE brake   P pause   M sound', VIEW.width / 2, 560);
    ctx.fillText('Mouse: hold to steer. Click a mission card, or press 1, 2 or 3.', VIEW.width / 2, 588);
    if (best > 0) {
      ctx.fillStyle = '#ffd23f';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.fillText('BEST SCORE THIS SESSION: ' + best, VIEW.width / 2, 632);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('Skyhook Courier — an original game. No real aircraft, places or airlines.', VIEW.width / 2, 760);
    return boxes;
  }

  wrapText(ctx, text, cx, y, maxW, lineH) {
    const words = text.split(' ');
    const lines = [''];
    for (const w of words) {
      const test = lines[lines.length - 1] ? lines[lines.length - 1] + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && lines[lines.length - 1]) lines.push(w);
      else lines[lines.length - 1] = test;
    }
    lines.forEach((line, i) => ctx.fillText(line, cx, y + i * lineH));
  }

  drawEndScreen(ctx, title, subtitle, lines, prompt) {
    ctx.fillStyle = 'rgba(6, 14, 28, 0.62)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 52px system-ui, sans-serif';
    ctx.fillText(title, VIEW.width / 2, 190);
    ctx.fillStyle = '#ffd23f';
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText(subtitle, VIEW.width / 2, 228);
    ctx.font = '17px system-ui, sans-serif';
    let y = 300;
    for (const [k, v] of lines) {
      ctx.fillStyle = '#9db8cc';
      ctx.textAlign = 'right';
      ctx.fillText(k, VIEW.width / 2 - 14, y);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.fillText(v, VIEW.width / 2 + 14, y);
      y += 32;
    }
    ctx.fillStyle = '#eaf6ff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(prompt, VIEW.width / 2, y + 40);
  }

  drawPaused(ctx) {
    ctx.fillStyle = 'rgba(6, 14, 28, 0.55)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', VIEW.width / 2, VIEW.height / 2 - 10);
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillStyle = '#cfe3f2';
    ctx.fillText('Press P to keep flying  ·  M menu', VIEW.width / 2, VIEW.height / 2 + 30);
  }
}
