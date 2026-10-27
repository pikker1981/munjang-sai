// Progressive enhancement: the artwork and page remain usable without WebGL.
const TAU = Math.PI * 2;
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function makeGlobe(host) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none' });
  host.append(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) { canvas.remove(); return () => {}; }
  // Hand-drawn geographic silhouettes provide recognizable, deliberately soft land masses.
  const continents = [
    [[-168,70],[-135,72],[-118,59],[-100,54],[-82,50],[-55,53],[-67,34],[-82,25],[-89,16],[-105,23],[-119,34],[-130,51]],
    [[-81,13],[-64,11],[-48,-1],[-35,-9],[-43,-25],[-57,-54],[-72,-43],[-76,-16]],
    [[-17,35],[9,38],[33,30],[45,12],[38,-13],[23,-35],[12,-34],[5,-13],[-9,4]],
    [[-11,36],[-10,57],[15,70],[39,69],[50,55],[39,39],[25,35]],
    [[35,69],[75,75],[115,70],[166,61],[176,48],[143,42],[124,24],[106,0],[95,7],[78,8],[68,25],[48,30],[39,45]],
    [[112,-11],[134,-10],[153,-25],[147,-40],[116,-34]],
    [[-53,60],[-23,65],[-25,82],[-54,83],[-65,70]],
    [[46,-13],[51,-15],[49,-26],[44,-24]],
    [[130,31],[144,45],[146,40],[137,30]],
    [[166,-34],[179,-39],[172,-47],[164,-46]]
  ];
  function inPolygon(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  const land = [];
  for (let lat = -57; lat < 82; lat += 2.1) {
    const step = 2.1 / Math.max(.3, Math.cos(lat * Math.PI / 180));
    for (let lon = -178; lon < 180; lon += step) {
      if (continents.some(poly => inPolygon(lon, lat, poly))) land.push([lat * Math.PI / 180, lon * Math.PI / 180]);
    }
  }
  let w = 0, h = 0, radius = 0, cx = 0, cy = 0, phase = -.52;
  let frame = 0, previous = 0, visible = true, disposed = false;
  let pointer = null;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const project = (lat, lon) => {
    const a = lon + phase;
    const x = Math.cos(lat) * Math.sin(a), y = -Math.sin(lat), z = Math.cos(lat) * Math.cos(a);
    const tilt = -.13;
    return [cx + radius * (x * Math.cos(tilt) - y * Math.sin(tilt)), cy + radius * (x * Math.sin(tilt) + y * Math.cos(tilt)), z];
  };
  function drawLine(points) {
    let open = false;
    ctx.beginPath();
    for (const [lat, lon] of points) {
      const p = project(lat, lon);
      if (p[2] < 0) { open = false; continue; }
      if (open) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]);
      open = true;
    }
    ctx.stroke();
  }
  function draw() {
    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = .65;
    ctx.strokeStyle = 'rgba(77,70,56,.13)';
    for (let lat = -75; lat <= 75; lat += 15) {
      drawLine(Array.from({length: 181}, (_, i) => [lat * Math.PI / 180, i * TAU / 180]));
    }
    for (let lon = 0; lon < 360; lon += 15) {
      drawLine(Array.from({length: 91}, (_, i) => [-Math.PI / 2 + i * Math.PI / 90, lon * Math.PI / 180]));
    }
    for (const [lat, lon] of land) {
      const p = project(lat, lon);
      if (p[2] < .03) continue;
      let x = p[0], y = p[1];
      if (pointer && !motion.matches) {
        const dx = x - pointer.x, dy = y - pointer.y, distance = Math.hypot(dx, dy);
        if (distance > .1 && distance < 110) {
          const push = (1 - distance / 110) ** 2 * 19;
          x += dx / distance * push; y += dy / distance * push;
        }
      }
      ctx.fillStyle = `rgba(77,70,56,${.22 + p[2] * .27})`;
      ctx.beginPath(); ctx.arc(x, y, 1.05 + p[2] * .35, 0, TAU); ctx.fill();
    }
  }
  function tick(time) {
    frame = 0;
    if (disposed || !visible || document.hidden) { previous = 0; return; }
    if (previous && !motion.matches) phase += Math.min((time - previous) / 1000, .05) * .028;
    previous = time;
    draw();
    if (!motion.matches) frame = requestAnimationFrame(tick);
  }
  function resume() { if (!frame && visible && !document.hidden && !disposed) frame = requestAnimationFrame(tick); }
  function resize() {
    const rect = host.getBoundingClientRect(); w = rect.width; h = rect.height;
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    radius = Math.min(w * .445, 900); cx = w / 2; cy = radius * 1.01;
    draw(); resume();
  }
  const move = event => {
    const rect = host.getBoundingClientRect();
    pointer = {x: event.clientX - rect.left, y: event.clientY - rect.top};
  };
  const leave = () => { pointer = null; };
  // Listen on the hero so a decorative layer never intercepts its content.
  const interactionHost = host.closest('section') || host.parentElement || host;
  interactionHost.addEventListener('pointermove', move, {passive: true});
  interactionHost.addEventListener('pointerleave', leave, {passive: true});
  const ro = new ResizeObserver(resize); ro.observe(host);
  const io = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (!visible && frame) { cancelAnimationFrame(frame); frame = 0; previous = 0; }
    resume();
  }); io.observe(host);
  const stateChange = () => {
    previous = 0;
    if (frame) { cancelAnimationFrame(frame); frame = 0; }
    resume();
  };
  document.addEventListener('visibilitychange', stateChange);
  motion.addEventListener('change', stateChange);
  resize();
  return () => {
    disposed = true; cancelAnimationFrame(frame); ro.disconnect(); io.disconnect();
    interactionHost.removeEventListener('pointermove', move); interactionHost.removeEventListener('pointerleave', leave);
    document.removeEventListener('visibilitychange', stateChange); motion.removeEventListener('change', stateChange); canvas.remove();
  };
}

async function makePeels(elements, isDisposed) {
  if (!elements.length || reducedMotion() || matchMedia('(pointer: coarse)').matches) return () => {};
  let THREE;
  try { THREE = await import('./vendor/three.module.js'); } catch { return () => {}; }
  if (isDisposed()) return () => {};
  const cleanups = [];
  for (const host of elements) {
    const img = host.querySelector('img');
    if (!img) continue;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({alpha: true, antialias: true, powerPreference: 'low-power'}); }
    catch { continue; }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0);
    const canvas = renderer.domElement;
    canvas.setAttribute('aria-hidden', 'true');
    Object.assign(canvas.style, {position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none'});
    const originalPosition = host.style.position;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.append(canvas);
    let texture = null, mesh = null, material = null, geometry = null;
    let gone = false, ready = false, frame = 0, visible = true, dragging = false;
    let amount = 0, velocity = 0, target = 0, last = 0, startX = 0, startY = 0, activePointer = null;
    let width = 1, height = 1;
    const originalVisibility = img.style.visibility;
    const originalRole = host.getAttribute('role');
    const originalLabel = host.getAttribute('aria-label');
    const restoreSemantics = () => {
      if (originalRole === null) host.removeAttribute('role'); else host.setAttribute('role', originalRole);
      if (originalLabel === null) host.removeAttribute('aria-label'); else host.setAttribute('aria-label', originalLabel);
    };
    const enhanceSemantics = () => {
      if (img.alt) {host.setAttribute('role', 'img'); host.setAttribute('aria-label', img.alt);}
    };
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 5000); camera.position.z = 2000;
    const uniforms = {map: {value: null}, curl: {value: 0}, size: {value: new THREE.Vector2(1, 1)}};
    function render() {
      if (!ready || gone || document.hidden || !visible) return;
      uniforms.curl.value = amount;
      renderer.render(scene, camera);
    }
    function animate(time) {
      frame = 0;
      if (gone || !visible || document.hidden) {last = 0; return;}
      const dt = last ? Math.min((time - last) / 1000, .035) : 1 / 60; last = time;
      velocity += ((target - amount) * 110 - velocity * 17) * dt;
      amount = Math.max(0, Math.min(1, amount + velocity * dt));
      render();
      if (dragging || Math.abs(target - amount) > .0005 || Math.abs(velocity) > .002) frame = requestAnimationFrame(animate);
      else {amount = target; last = 0; render();}
    }
    function wake() {if (!frame && ready && visible && !document.hidden && !gone) frame = requestAnimationFrame(animate);}
    function resize() {
      const rect = host.getBoundingClientRect(); width = Math.max(1, rect.width); height = Math.max(1, rect.height);
      renderer.setSize(width, height, false);
      camera.left = -width / 2; camera.right = width / 2; camera.top = height / 2; camera.bottom = -height / 2; camera.updateProjectionMatrix();
      if (mesh && texture) {
        const aspect = (texture.image.naturalWidth || texture.image.width) / (texture.image.naturalHeight || texture.image.height);
        const artWidth = Math.min(width, height * aspect), artHeight = artWidth / aspect;
        mesh.scale.set(artWidth, artHeight, 1); uniforms.size.value.set(artWidth, artHeight);
      }
      render();
    }
    const down = event => {
      if (!ready || event.button !== 0 || reducedMotion()) return;
      dragging = true; activePointer = event.pointerId; startX = event.clientX; startY = event.clientY;
      host.setPointerCapture(event.pointerId); host.style.cursor = 'grabbing'; event.preventDefault(); wake();
    };
    const move = event => {
      if (!dragging || event.pointerId !== activePointer) return;
      const distance = Math.hypot(event.clientX - startX, (event.clientY - startY) * .65);
      target = Math.min(.95, distance / Math.max(100, width * .52)); wake();
    };
    const release = event => {
      if (event && event.pointerId !== activePointer) return;
      if (activePointer !== null && host.hasPointerCapture(activePointer)) host.releasePointerCapture(activePointer);
      dragging = false; activePointer = null; target = 0; host.style.cursor = 'grab'; wake();
    };
    const ro = new ResizeObserver(resize); ro.observe(host);
    const io = new IntersectionObserver(entries => {visible = entries[0].isIntersecting; if (visible) {render(); wake();}}); io.observe(host);
    const stateChange = () => {last = 0; if (document.hidden) release(); else {render(); wake();}};
    document.addEventListener('visibilitychange', stateChange);
    const originalCursor = host.style.cursor;
    host.addEventListener('pointerdown', down); host.addEventListener('pointermove', move);
    host.addEventListener('pointerup', release); host.addEventListener('pointercancel', release);
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const motionChange = () => {
      if (motion.matches) {release(); amount = target = velocity = 0; canvas.style.display = 'none'; img.style.visibility = originalVisibility; restoreSemantics();}
      else if (ready) {canvas.style.display = ''; img.style.visibility = 'hidden'; enhanceSemantics(); render();}
    };
    motion.addEventListener('change', motionChange);
    const cleanup = () => {
      gone = true; cancelAnimationFrame(frame); ro.disconnect(); io.disconnect();
      document.removeEventListener('visibilitychange', stateChange); motion.removeEventListener('change', motionChange);
      host.removeEventListener('pointerdown', down); host.removeEventListener('pointermove', move);
      host.removeEventListener('pointerup', release); host.removeEventListener('pointercancel', release);
      img.style.visibility = originalVisibility; host.style.cursor = originalCursor; host.style.position = originalPosition;
      restoreSemantics();
      texture?.dispose(); geometry?.dispose(); material?.dispose(); renderer.dispose(); canvas.remove();
    };
    cleanups.push(cleanup);
    new THREE.TextureLoader().load(img.currentSrc || img.src, loaded => {
      if (gone || isDisposed()) {loaded.dispose(); return;}
      texture = loaded; texture.colorSpace = THREE.SRGBColorSpace;
      uniforms.map.value = texture;
      geometry = new THREE.PlaneGeometry(1, 1, 100, 30);
      material = new THREE.ShaderMaterial({
        uniforms, transparent: true, side: THREE.DoubleSide,
        vertexShader: `
          varying vec2 vUv; varying float vBend;
          uniform float curl; uniform vec2 size;
          void main() {
            vUv = uv;
            vec3 p = position;
            float axis = 1.04 - curl * .79;
            float distance = max(0.0, uv.x - axis);
            float radius = .19;
            float theta = min(distance / radius, 3.05);
            float foldedX = axis + sin(theta) * radius;
            p.x = mix(uv.x, foldedX, step(axis, uv.x)) - .5;
            p.z = (1.0 - cos(theta)) * radius * size.x;
            p.y += sin(theta) * .025 * (uv.y - .15);
            vBend = theta;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }`,
        fragmentShader: `
          varying vec2 vUv; varying float vBend; uniform sampler2D map;
          void main() {
            vec4 art = texture2D(map, vUv);
            if (art.a < .015) discard;
            float shade = 1.0 - .15 * sin(vBend);
            vec3 front = art.rgb * shade;
            vec3 back = vec3(.951,.937,.907) * (.96 + .04 * cos(vBend));
            gl_FragColor = vec4(gl_FrontFacing ? front : back, art.a);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`
      });
      mesh = new THREE.Mesh(geometry, material); scene.add(mesh); ready = true;
      resize();
      // Only remove the source from view after a successful first WebGL render.
      try {renderer.render(scene, camera); img.style.visibility = 'hidden'; enhanceSemantics(); host.style.cursor = 'grab';}
      catch {cleanup();}
    }, undefined, () => {cleanup();});
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault(); ready = false; img.style.visibility = originalVisibility; canvas.style.display = 'none'; restoreSemantics();
    });
  }
  return () => cleanups.forEach(cleanup => cleanup());
}

export function initEffects() {
  let disposed = false;
  const host = document.querySelector('#globe');
  const globeCleanup = host ? makeGlobe(host) : () => {};
  let peelCleanup = () => {};
  makePeels([...document.querySelectorAll('[data-peel]')], () => disposed)
    .then(cleanup => { if (disposed) cleanup(); else peelCleanup = cleanup; })
    .catch(() => {});
  return () => {disposed = true; globeCleanup(); peelCleanup();};
}
