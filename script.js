/* ============================================
   COOPER PORTFOLIO — Three.js
   Floating rack, servers pop in-place, arrow spin
   ============================================ */

const loadProgress = document.getElementById('load-progress');
const loadStatus = document.getElementById('load-status');
const loadingScreen = document.getElementById('loading');

function setLoad(pct, msg) {
  loadProgress.style.width = pct + '%';
  if (msg) loadStatus.textContent = msg;
}
setTimeout(function() {
  loadingScreen.classList.add('hidden');
  setTimeout(function() { loadingScreen.style.display = 'none'; }, 500);
}, 1600);

// ========== SCENE ==========
const canvas = document.getElementById('three-canvas');
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 0.5, 9);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setClearColor(0x000000, 0);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;

setLoad(5, 'Renderer online...');

// ========== GRADIENT BACKGROUND ==========
// Create a large background plane with a vertical gradient shader
const bgGeo = new THREE.PlaneGeometry(2, 2);
const bgMat = new THREE.ShaderMaterial({
  depthWrite: false,
  uniforms: {
    uColor1: { value: new THREE.Color(0xf5f5f7) }, // light gray
    uColor2: { value: new THREE.Color(0xffffff) }, // white
    uColor3: { value: new THREE.Color(0xebeef2) }, // subtle cool tint
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.9999, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform vec3 uColor3;
    varying vec2 vUv;
    void main() {
      vec3 color = mix(uColor3, uColor2, smoothstep(0.0, 0.5, vUv.y));
      color = mix(color, uColor1, smoothstep(0.4, 1.0, vUv.y));
      gl_FragColor = vec4(color, 1.0);
    }
  `,
});
const bgMesh = new THREE.Mesh(bgGeo, bgMat);
bgMesh.renderOrder = -1;
scene.add(bgMesh);

setLoad(10, 'Background set...');

// ========== MATERIALS ==========
function sm(color, metalness, roughness, extra) {
  return new THREE.MeshStandardMaterial(Object.assign({ color, metalness, roughness }, extra || {}));
}

// Rack metals — bright and metallic
const mRackOuter  = sm(0x3a3a4a, 0.92, 0.18);   // outer frame — polished steel
const mRackInner  = sm(0x2a2a38, 0.88, 0.22);   // inner panels
const mRackRail   = sm(0x4a4a5a, 0.95, 0.12);   // rails — shiny
const mRackBack   = sm(0x222230, 0.85, 0.3);    // back panel
const mDoor       = sm(0x303040, 0.9, 0.2, { side: THREE.DoubleSide });
const mVent       = sm(0x1a1a28, 0.7, 0.4, { side: THREE.DoubleSide });
const mHandle     = sm(0x666680, 0.95, 0.1);    // bright chrome handles
const mScrewHead  = sm(0x888899, 0.95, 0.08);   // screw heads

// Server materials
const mServerBody = sm(0x2e2e40, 0.82, 0.28);
const mFaceplate  = sm(0x3a3a50, 0.8, 0.25);
const mDriveBay   = sm(0x161624, 0.7, 0.45);
const mDriveHandle= sm(0x555568, 0.9, 0.15);

// Brand accent colors (no labels, just the colors)
const mDellBlue   = sm(0x0088dd, 0.55, 0.35);
const mFireRed    = sm(0xdd2200, 0.6, 0.3);
const mFireDark   = sm(0x881100, 0.65, 0.35);
const mCiscoTeal  = sm(0x00aacc, 0.55, 0.35);
const mNetBlue    = sm(0x0088cc, 0.6, 0.3);
const mApcGreen   = sm(0x00bb44, 0.45, 0.4);
const mScreen     = new THREE.MeshBasicMaterial({ color: 0x002a18 });

// Glows
const gGreen  = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
const gBlue   = new THREE.MeshBasicMaterial({ color: 0x00ccff });
const gAmber  = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
const gRed    = new THREE.MeshBasicMaterial({ color: 0xff3355 });
const gWhite  = new THREE.MeshBasicMaterial({ color: 0xddddee });

// Helper builders
function B(p, w,h,d, m, x,y,z) {
  var mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), m);
  mesh.position.set(x,y,z);
  p.add(mesh);
  return mesh;
}
function S(p, r, m, x,y,z) {
  var mesh = new THREE.Mesh(new THREE.SphereGeometry(r,8,8), m);
  mesh.position.set(x,y,z);
  p.add(mesh);
  return mesh;
}
function C(p, rt,rb,h,s, m, x,y,z) {
  var mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,s), m);
  mesh.position.set(x,y,z);
  p.add(mesh);
  return mesh;
}

setLoad(15, 'Materials forged...');

// ========== RACK ==========
const RACK_W = 2.8, RACK_H = 5.2, RACK_D = 1.8;
const FRAME = 0.07;

const rackPivot = new THREE.Group(); // outer group for keyboard spin
scene.add(rackPivot);

const rackGroup = new THREE.Group(); // inner group for bob
rackGroup.position.set(0, -RACK_H/2 + 0.3, 0);
rackPivot.add(rackGroup);

function buildRackFrame() {
  var g = new THREE.Group();

  // ---- Four vertical corner posts (L-shaped extrusions) ----
  for (var xi = -1; xi <= 1; xi += 2) {
    for (var zi = -1; zi <= 1; zi += 2) {
      // Main post
      B(g, FRAME, RACK_H, FRAME, mRackOuter, xi*(RACK_W/2), RACK_H/2, zi*(RACK_D/2));
      // Side flange
      B(g, 0.03, RACK_H, FRAME*1.5, mRackOuter, xi*(RACK_W/2 - 0.04), RACK_H/2, zi*(RACK_D/2));
    }
  }

  // ---- Top & bottom cross members (front, back, sides) ----
  for (var yi = 0; yi <= 1; yi++) {
    var y = yi * RACK_H;
    // Front & back horizontal
    B(g, RACK_W, FRAME, FRAME*0.8, mRackOuter, 0, y, RACK_D/2);
    B(g, RACK_W, FRAME, FRAME*0.8, mRackOuter, 0, y, -RACK_D/2);
    // Side horizontals
    B(g, FRAME*0.8, FRAME, RACK_D, mRackOuter, -RACK_W/2, y, 0);
    B(g, FRAME*0.8, FRAME, RACK_D, mRackOuter,  RACK_W/2, y, 0);
  }

  // ---- Back panel (perforated look — solid with vent strips) ----
  B(g, RACK_W - 0.08, RACK_H - 0.08, 0.02, mRackBack, 0, RACK_H/2, -RACK_D/2 + 0.02);
  // Perforation lines on back
  for (var pv = 0; pv < 20; pv++) {
    B(g, RACK_W*0.85, 0.005, 0.025, mVent, 0, 0.3 + pv*0.25, -RACK_D/2 + 0.015);
  }

  // ---- Side panels (with ventilation cutouts) ----
  for (var side = -1; side <= 1; side += 2) {
    // Solid side panel
    B(g, 0.02, RACK_H - 0.2, RACK_D - 0.15, mRackInner, side*(RACK_W/2 - 0.02), RACK_H/2, 0);
    // Vent pattern on sides
    for (var sv = 0; sv < 6; sv++) {
      B(g, 0.025, 0.005, RACK_D*0.5, mVent, side*(RACK_W/2 - 0.01), RACK_H*0.65 + sv*0.06, 0);
    }
  }

  // ---- Front mounting rails with cage nut holes ----
  for (var rx = -1; rx <= 1; rx += 2) {
    var railX = rx * (RACK_W/2 - 0.12);
    B(g, 0.04, RACK_H - 0.1, 0.04, mRackRail, railX, RACK_H/2, RACK_D/2 - 0.06);
    // Cage nut holes (square cutouts)
    for (var cn = 0; cn < 30; cn++) {
      B(g, 0.012, 0.012, 0.045, mRackBack, railX, 0.15 + cn*0.168, RACK_D/2 - 0.06);
    }
    // Rear rails
    B(g, 0.035, RACK_H - 0.1, 0.035, mRackRail, railX, RACK_H/2, -RACK_D/2 + 0.06);
  }

  // ---- Mid-depth support rails (inside) ----
  for (var mx = -1; mx <= 1; mx += 2) {
    B(g, 0.02, RACK_H - 0.2, 0.02, mRackInner, mx*(RACK_W/2 - 0.12), RACK_H/2, 0);
  }

  // ---- Top panel with fan cutout circles ----
  B(g, RACK_W - 0.1, 0.015, RACK_D - 0.1, mRackInner, 0, RACK_H - 0.01, 0);
  for (var f = 0; f < 3; f++) {
    // Fan rings
    C(g, 0.18, 0.18, 0.006, 32, mVent, -0.6 + f*0.6, RACK_H - 0.008, 0.2);
    C(g, 0.12, 0.12, 0.006, 32, mVent, -0.6 + f*0.6, RACK_H - 0.008, -0.2);
  }

  // ---- Door frame (front) ----
  // Outer door
  B(g, RACK_W - 0.08, RACK_H - 0.08, 0.02, mDoor, 0, RACK_H/2, RACK_D/2 - 0.02);
  // Door vent stripes
  for (var dv = 0; dv < 18; dv++) {
    B(g, RACK_W*0.82, 0.006, 0.02, mVent, 0, 0.35 + dv*0.26, RACK_D/2 - 0.01);
  }

  // Handle
  B(g, 0.06, 0.55, 0.06, mHandle, RACK_W/2 - 0.18, RACK_H/2, RACK_D/2 + 0.02);
  // Handle mount screws
  S(g, 0.02, mScrewHead, RACK_W/2 - 0.18, RACK_H/2 + 0.28, RACK_D/2 + 0.05);
  S(g, 0.02, mScrewHead, RACK_W/2 - 0.18, RACK_H/2 - 0.28, RACK_D/2 + 0.05);

  return g;
}

const rackFrame = buildRackFrame();
rackGroup.add(rackFrame);

setLoad(25, 'Rack assembled...');

// ========== SERVERS ==========
const servers = []; // store to animate pop-in
const serverSlots = []; // y positions for each section

function buildServerUnit(y, height, accentMat, glowMat, labelStyle) {
  var g = new THREE.Group();
  g.position.set(0, y, 0.0);

  // Body
  B(g, RACK_W - 0.35, height, RACK_D - 0.7, mServerBody, 0, 0, 0);

  // Faceplate
  B(g, RACK_W - 0.42, height*0.9, 0.12, mFaceplate, 0, 0, (RACK_D - 0.7)/2 + 0.06);

  // Drive bays (4)
  var bayW = (RACK_W - 0.55) / 4;
  for (var i = 0; i < 4; i++) {
    var x = -((RACK_W - 0.55)/2) + bayW/2 + i*bayW;
    B(g, bayW*0.85, height*0.55, 0.05, mDriveBay, x, -height*0.08, (RACK_D - 0.7)/2 + 0.12);
    // Handle
    B(g, bayW*0.55, 0.04, 0.03, mDriveHandle, x, -height*0.08, (RACK_D - 0.7)/2 + 0.16);
  }

  // Accent strip
  B(g, RACK_W - 0.55, 0.06, 0.03, accentMat, 0, height*0.32, (RACK_D - 0.7)/2 + 0.13);

  // LEDs
  for (var l = 0; l < 3; l++) {
    B(g, 0.03, 0.03, 0.01, glowMat, -RACK_W/2 + 0.38 + l*0.06, -height*0.28, (RACK_D - 0.7)/2 + 0.17);
  }

  // Optional "screen"
  if (labelStyle === 'screen') {
    B(g, 0.5, height*0.28, 0.01, mScreen, RACK_W/2 - 0.68, -height*0.25, (RACK_D - 0.7)/2 + 0.18);
    B(g, 0.5, height*0.02, 0.01, gGreen, RACK_W/2 - 0.68, -height*0.16, (RACK_D - 0.7)/2 + 0.181);
  }

  g.scale.set(0.001, 0.001, 0.001); // start popped down
  return g;
}

// Place servers at different heights (sections correspond to scroll)
const unitHeights = [0.38, 0.42, 0.34, 0.48, 0.36, 0.40];
const unitMats = [
  [mDellBlue, gBlue, 'none'],
  [mCiscoTeal, gGreen, 'screen'],
  [mFireRed, gAmber, 'none'],
  [mNetBlue, gBlue, 'screen'],
  [mApcGreen, gGreen, 'none'],
  [mFireDark, gRed, 'none'],
];

let yCursor = 0.55;
for (let i = 0; i < 6; i++) {
  const h = unitHeights[i];
  const u = buildServerUnit(yCursor, h, unitMats[i][0], unitMats[i][1], unitMats[i][2]);
  rackGroup.add(u);
  servers.push(u);
  serverSlots.push(yCursor);
  yCursor += h + 0.12;
}

setLoad(35, 'Servers mounted...');

// ========== LIGHTS ==========
const ambient = new THREE.AmbientLight(0xffffff, 0.65);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
keyLight.position.set(4, 7, 6);
keyLight.castShadow = true;
keyLight.shadow.mapSize.width = 1024;
keyLight.shadow.mapSize.height = 1024;
keyLight.shadow.camera.near = 1;
keyLight.shadow.camera.far = 30;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 0.6);
fillLight.position.set(-6, 3, 5);
scene.add(fillLight);

const rimLight = new THREE.PointLight(0xffffff, 0.45, 50);
rimLight.position.set(0, 5, -6);
scene.add(rimLight);

setLoad(45, 'Lighting tuned...');

// ========== FLOAT BOB ==========
let t = 0;
function bob() {
  t += 0.01;
  rackGroup.position.y = (-RACK_H/2 + 0.3) + Math.sin(t) * 0.06;
  rackGroup.rotation.y = Math.sin(t * 0.35) * 0.08;
  rackGroup.rotation.x = Math.sin(t * 0.25) * 0.03;
}

// ========== KEYBOARD SPIN ==========
let spinVel = 0;
window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') spinVel += 0.04;
  if (e.key === 'ArrowRight') spinVel -= 0.04;
});

// ========== RESPONSIVE ==========
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ========== SCROLL-BASED EXPERIENCE PANELS ==========
const sections = Array.from(document.querySelectorAll('.server-section'));
const panels = Array.from(document.querySelectorAll('.server-panel'));

function setActivePanel(idx) {
  panels.forEach((p, i) => p.classList.toggle('active', i === idx));
  // Pop server in if exists
  if (servers[idx] && !servers[idx].userData.popped) {
    servers[idx].userData.popped = true;
    gsap.to(servers[idx].scale, { x: 1, y: 1, z: 1, duration: 0.6, ease: "back.out(2.2)" });
  }
}

function setupScroll() {
  if (!window.gsap || !window.ScrollTrigger) return;

  gsap.registerPlugin(ScrollTrigger);

  sections.forEach((sec, idx) => {
    ScrollTrigger.create({
      trigger: sec,
      start: "top center",
      end: "bottom center",
      onEnter: () => setActivePanel(idx),
      onEnterBack: () => setActivePanel(idx),
    });
  });

  // First visible panel
  setActivePanel(0);
}

setLoad(70, 'Scroll interactions armed...');

// ========== SPIN HINT FADE ==========
const spinHint = document.getElementById('spin-hint');
let hintTimer = null;
function showHint() {
  if (!spinHint) return;
  spinHint.style.opacity = '1';
  if (hintTimer) clearTimeout(hintTimer);
  hintTimer = setTimeout(() => { spinHint.style.opacity = '0'; }, 2200);
}
window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') showHint();
});

// ========== RENDER LOOP ==========
function animate() {
  requestAnimationFrame(animate);

  spinVel *= 0.92;
  rackPivot.rotation.y += spinVel;

  bob();

  renderer.render(scene, camera);
}

setLoad(90, 'Rendering...');

setTimeout(() => {
  setLoad(100, 'Ready.');
  setupScroll();
  animate();
}, 250);
