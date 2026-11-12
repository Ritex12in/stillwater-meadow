/* Stargazing: lie down on the grass or the jetty (Z) and the view tilts up to the sky.
   Shooting stars cross the sky on clear nights, far more often while you're lying down. */
(() => {
  'use strict';
  const SW = window.SW;
  if (!SW) return;
  const { THREE, rand, clamp, lerp, damp, TAU, player } = SW;
  player.lieAmt = 0;

  function lieDown() {
    if (player.lie) { getUp(); return; }
    if (player.seat || player.petting || player.fishing) return;
    player.lie = true;
    player.freeze = true;
    player.wished = false;
    SW.camState.pitch = 0.32;
  }
  function getUp() {
    player.lie = false;
    setTimeout(() => { if (!player.lie) player.freeze = false; }, 500);
  }
  const prompt = SW.addPrompt('Z', lieDown);
  SW.onKey('KeyZ', lieDown);

  // lying pose: on your back, hands behind your head
  SW.hooks.pose.push((dt) => {
    player.lieAmt = damp(player.lieAmt, player.lie ? 1 : 0, 4, dt);
    const la = player.lieAmt;
    if (la < 0.001) return;
    const h = SW.hero;
    h.body.rotation.x = lerp(h.body.rotation.x, -1.52, la);
    h.body.position.y = lerp(h.body.position.y, 0.27, la);
    h.legs.forEach((l, i) => { l.rotation.x = lerp(l.rotation.x, i ? 0.05 : -0.08, la); });
    h.knees.forEach((k, i) => { k.rotation.x = lerp(k.rotation.x, i ? 0.4 : 0, la); });
    h.arms.forEach((a, i) => { a.rotation.x = lerp(a.rotation.x, -2.9, la); a.rotation.z = lerp(a.rotation.z, i ? -0.45 : 0.45, la); });
    h.head.rotation.x = lerp(h.head.rotation.x, -0.25, la);
  });

  // camera looks up at the sky from just above your face
  const head = new THREE.Vector3(), want = new THREE.Vector3(), look = new THREE.Vector3();
  SW.hooks.camera.push((dt, camTarget) => {
    const la = player.lieAmt;
    if (la < 0.05) return false;
    SW.hero.head.getWorldPosition(head);
    camTarget.set(player.x, player.y + 1.55, player.z);
    want.set(head.x, head.y + 0.75, head.z); // just above the grass tips
    const yaw = SW.camState.yaw;
    const el = clamp(1.0 - (SW.camState.pitch - 0.32) * 1.5, 0.3, 1.5);
    look.set(want.x - Math.sin(yaw) * Math.cos(el) * 10, want.y + Math.sin(el) * 10, want.z - Math.cos(yaw) * Math.cos(el) * 10);
    SW.camera.position.lerp(want, 1 - Math.exp(-dt * 3 * la));
    SW.camera.lookAt(look);
    if (SW.moving()) getUp();
    return true;
  });

  // shooting stars
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array([1, 1, 1, 0, 0, 0]), 3));
  const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
  const streak = new THREE.Line(geo, mat);
  streak.frustumCulled = false;
  streak.visible = false;
  SW.sky.add(streak);
  const s = { t: 1, start: new THREE.Vector3(), vel: new THREE.Vector3() };
  let nextIn = 20;
  function launch() {
    const az = Math.random() * TAU, el = rand(0.5, 1.15);
    // when lying down, put it where you're looking
    const yaw = SW.camState.yaw;
    const baseAz = player.lie ? Math.atan2(-Math.cos(yaw), -Math.sin(yaw)) + rand(-0.6, 0.6) : az;
    s.start.set(Math.cos(baseAz) * Math.cos(el), Math.sin(el), Math.sin(baseAz) * Math.cos(el)).multiplyScalar(600);
    const side = new THREE.Vector3(-Math.sin(baseAz), 0, Math.cos(baseAz)).multiplyScalar(Math.random() < 0.5 ? 1 : -1);
    s.vel.copy(side).addScaledVector(new THREE.Vector3(0, -1, 0), 0.45).normalize().multiplyScalar(rand(320, 460));
    s.t = 0;
    streak.visible = true;
    if (player.lie && !player.wished) { player.wished = true; SW.toast('A shooting star. Make a wish.'); }
  }
  let promptIn = 0;
  SW.hooks.frame.push((dt) => {
    const clearNight = SW.cur.stars > 0.35 && SW.wx.cloud < 0.55;
    nextIn -= dt;
    if (clearNight && nextIn <= 0) { launch(); nextIn = player.lie ? rand(4, 10) : rand(25, 60); }
    if (s.t < 1) {
      s.t += dt / 0.85;
      const k = Math.min(1, s.t), arr = geo.attributes.position.array;
      const hx = s.start.x + s.vel.x * k * 0.85, hy = s.start.y + s.vel.y * k * 0.85, hz = s.start.z + s.vel.z * k * 0.85;
      const len = Math.min(k * 4, 1) * 0.16;
      arr[0] = hx; arr[1] = hy; arr[2] = hz;
      arr[3] = hx - s.vel.x * len; arr[4] = hy - s.vel.y * len; arr[5] = hz - s.vel.z * len;
      geo.attributes.position.needsUpdate = true;
      mat.opacity = (1 - k * k) * SW.cur.stars;
      if (k >= 1) streak.visible = false;
    }
    promptIn -= dt;
    if (promptIn <= 0) {
      promptIn = 0.25;
      if (player.lie) prompt.set('Get up');
      else if (SW.cur.stars > 0.3 && !player.seat && !player.petting && !player.fishing && !SW.moving() && SW.walkable(player.x, player.z)) prompt.set('Lie down and watch the stars');
      else prompt.set('');
    }
  });
})();
