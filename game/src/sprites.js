// Aircraft and balloon art for Skyhook Courier: one job, vector sprites.
// Everything is drawn with canvas paths — no image files anywhere.

export function drawPlane(ctx, cx, cy, scale, roll, pitch, time, throttle) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(roll);
  ctx.scale(scale, scale);
  // Pitch nudges the whole airframe up or down a touch.
  ctx.translate(0, -pitch * 26);

  const body = '#f4e9c9';
  const stripe = '#e8722a';
  const teal = '#1f7a6d';
  const dark = '#2b2620';
  const glass = '#bfe3f2';

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // --- main wings (behind the fuselage) ---
  ctx.fillStyle = '#e8d9ae';
  ctx.strokeStyle = dark;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-152, 14);
  ctx.lineTo(-34, -2);
  ctx.lineTo(-30, 16);
  ctx.lineTo(-146, 30);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(152, 14);
  ctx.lineTo(34, -2);
  ctx.lineTo(30, 16);
  ctx.lineTo(146, 30);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Wing tip lights: red port, green starboard.
  ctx.fillStyle = '#ff3b30';
  ctx.beginPath();
  ctx.arc(-150, 21, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2ecc40';
  ctx.beginPath();
  ctx.arc(150, 21, 4, 0, Math.PI * 2);
  ctx.fill();
  // Wing stripes.
  ctx.strokeStyle = stripe;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-138, 20);
  ctx.lineTo(-40, 8);
  ctx.moveTo(138, 20);
  ctx.lineTo(40, 8);
  ctx.stroke();

  // --- tailplane ---
  ctx.fillStyle = '#e8d9ae';
  ctx.strokeStyle = dark;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-72, 62);
  ctx.lineTo(-18, 50);
  ctx.lineTo(-16, 62);
  ctx.lineTo(-66, 74);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(72, 62);
  ctx.lineTo(18, 50);
  ctx.lineTo(16, 62);
  ctx.lineTo(66, 74);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // --- fuselage: tail (near, wide) to nose (far, narrow) ---
  const fus = new Path2D();
  fus.moveTo(-24, 78);
  fus.quadraticCurveTo(-30, 30, -20, -18);
  fus.quadraticCurveTo(-14, -52, 0, -58);
  fus.quadraticCurveTo(14, -52, 20, -18);
  fus.quadraticCurveTo(30, 30, 24, 78);
  fus.quadraticCurveTo(0, 88, -24, 78);
  ctx.fillStyle = body;
  ctx.fill(fus);
  ctx.strokeStyle = dark;
  ctx.lineWidth = 2.5;
  ctx.stroke(fus);
  // Belly stripe.
  ctx.fillStyle = stripe;
  ctx.beginPath();
  ctx.moveTo(-22, 40);
  ctx.quadraticCurveTo(-24, 10, -17, -20);
  ctx.lineTo(-10, -20);
  ctx.quadraticCurveTo(-16, 12, -14, 42);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(22, 40);
  ctx.quadraticCurveTo(24, 10, 17, -20);
  ctx.lineTo(10, -20);
  ctx.quadraticCurveTo(16, 12, 14, 42);
  ctx.closePath();
  ctx.fill();
  // Teal cheatline along the side.
  ctx.strokeStyle = teal;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-19, 30);
  ctx.quadraticCurveTo(-20, 0, -13, -30);
  ctx.moveTo(19, 30);
  ctx.quadraticCurveTo(20, 0, 13, -30);
  ctx.stroke();

  // --- cockpit windows ---
  ctx.fillStyle = glass;
  ctx.strokeStyle = dark;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-11, -30);
  ctx.quadraticCurveTo(-13, -44, 0, -46);
  ctx.quadraticCurveTo(13, -44, 11, -30);
  ctx.quadraticCurveTo(0, -26, -11, -30);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // --- vertical fin ---
  ctx.fillStyle = teal;
  ctx.strokeStyle = dark;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-8, 78);
  ctx.lineTo(-4, 34);
  ctx.quadraticCurveTo(0, 26, 4, 34);
  ctx.lineTo(8, 78);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Fin flash.
  ctx.fillStyle = stripe;
  ctx.beginPath();
  ctx.moveTo(-5, 62);
  ctx.lineTo(-3, 40);
  ctx.lineTo(3, 40);
  ctx.lineTo(5, 62);
  ctx.closePath();
  ctx.fill();

  // --- registration on the tail ---
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 9px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PK-SKY', 0, 72);

  // --- propeller: blurred disc at the nose, spins with throttle ---
  const spin = time * (6 + throttle * 26);
  const blade = (Math.sin(spin) + 1) / 2;
  ctx.save();
  ctx.translate(0, -56);
  ctx.rotate(blade * 0.12);
  ctx.fillStyle = 'rgba(60, 60, 66, ' + (0.16 + blade * 0.1) + ')';
  ctx.beginPath();
  ctx.ellipse(0, 0, 30, 7 + blade * 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,40,44,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(0, 0, 30, 7 + blade * 4, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  // Spinner cone.
  ctx.fillStyle = stripe;
  ctx.beginPath();
  ctx.arc(0, -56, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = dark;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.restore();
}

// A hot-air balloon: envelope, band, basket. Drawn at a projected point.
export function drawBalloon(ctx, x, y, r, color, time, phase) {
  const bob = Math.sin(time * 0.8 + phase) * 3;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(30, 20, 20, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.bezierCurveTo(r * 0.95, -r * 0.7, r * 0.9, r * 0.25, 0, r * 0.75);
  ctx.bezierCurveTo(-r * 0.9, r * 0.25, -r * 0.95, -r * 0.7, 0, -r);
  ctx.fill();
  ctx.stroke();
  // Vertical panels.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.quadraticCurveTo(r * 0.45, 0, 0, r * 0.75);
  ctx.moveTo(0, -r);
  ctx.quadraticCurveTo(-r * 0.45, 0, 0, r * 0.75);
  ctx.stroke();
  // Ropes + basket.
  ctx.strokeStyle = '#4a3423';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-r * 0.45, r * 0.55);
  ctx.lineTo(-r * 0.28, r * 1.05);
  ctx.moveTo(r * 0.45, r * 0.55);
  ctx.lineTo(r * 0.28, r * 1.05);
  ctx.stroke();
  ctx.fillStyle = '#7a5230';
  ctx.fillRect(-r * 0.28, r * 1.05, r * 0.56, r * 0.4);
  ctx.restore();
}
