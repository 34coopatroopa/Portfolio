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
  setTimeout(function() { loadingScreen.style.display = 'none'; }, 800);
}, 5000);

// ========== SCENE ==========
const canvas = document.getElementById('three-canvas');
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 0.5, 9);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.8;

setLoad(5, 'Renderer online...');

// ========== GRADIENT BACKGROUND ==========
// Create a large background plane with a vertical gradient shader
const bgGeo = new THREE.PlaneGeometry(2, 2);
const bgMat = new THREE.ShaderMaterial({
  depthWrite: false,
  uniforms: {
    uColor1: { value: new THREE.Color(0x1a2d4a) }, // soft navy top
    uColor2: { value: new THREE.Color(0x1a3a42) }, // calm teal mid
    uColor3: { value: new THREE.Color(0x2a1845) }, // gentle purple bottom
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
  // Fan grille circles on top (ring geometry)
  for (var fi = -1; fi <= 1; fi++) {
    var fanRing = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.15, 20), mRackBack);
    fanRing.rotation.x = -Math.PI/2;
    fanRing.position.set(fi * 0.4, RACK_H + 0.001, -0.1);
    g.add(fanRing);
  }

  // ---- Bottom panel ----
  B(g, RACK_W - 0.05, 0.025, RACK_D - 0.05, mRackOuter, 0, 0, 0);

  // ---- Caster wheels ----
  for (var cx = -1; cx <= 1; cx += 2) {
    for (var cz = -1; cz <= 1; cz += 2) {
      // Wheel bracket
      B(g, 0.04, 0.06, 0.04, mHandle, cx*(RACK_W/2 - 0.12), -0.04, cz*(RACK_D/2 - 0.12));
      // Wheel
      var wheel = C(g, 0.035, 0.035, 0.02, 12, mRackBack, cx*(RACK_W/2 - 0.12), -0.07, cz*(RACK_D/2 - 0.12));
      wheel.rotation.z = Math.PI/2;
    }
  }

  return g;
}

rackGroup.add(buildRackFrame());
setLoad(30, 'Rack frame welded...');

// ---- Doors ----
// Pivots at the outer edges of the rack, front face
var doorLPivot = new THREE.Group();
doorLPivot.position.set(-RACK_W/2, 0, RACK_D/2);
rackGroup.add(doorLPivot);

var doorRPivot = new THREE.Group();
doorRPivot.position.set(RACK_W/2, 0, RACK_D/2);
rackGroup.add(doorRPivot);

function buildDoor(side) {
  // side: 1 = left door (extends rightward from left hinge)
  //       -1 = right door (extends leftward from right hinge)
  var d = new THREE.Group();
  var pw = RACK_W / 2;

  // Main door panel — thin sheet metal
  B(d, pw, RACK_H - 0.06, 0.015, mDoor, side * pw / 2, RACK_H / 2, 0);

  // Outer frame border (thin trim around door edge)
  B(d, pw + 0.01, 0.03, 0.02, mRackOuter, side * pw / 2, RACK_H - 0.03, 0);  // top
  B(d, pw + 0.01, 0.03, 0.02, mRackOuter, side * pw / 2, 0.03, 0);           // bottom
  B(d, 0.03, RACK_H - 0.06, 0.02, mRackOuter, side * pw, RACK_H / 2, 0);     // outer edge
  B(d, 0.03, RACK_H - 0.06, 0.02, mRackOuter, 0, RACK_H / 2, 0);             // hinge edge

  // Handle — vertical bar with rounded ends, positioned near the free edge
  var handleX = side * (pw - 0.08);
  B(d, 0.02, 0.6, 0.035, mHandle, handleX, RACK_H / 2, 0.02);
  // Handle standoffs (small mounts top and bottom)
  B(d, 0.035, 0.03, 0.02, mScrewHead, handleX, RACK_H / 2 + 0.3, 0.01);
  B(d, 0.035, 0.03, 0.02, mScrewHead, handleX, RACK_H / 2 - 0.3, 0.01);

  // Perforated ventilation pattern — grid of small holes
  // Creates the characteristic hex-perf look of real rack doors
  var perfStartY = 0.2;
  var perfEndY = RACK_H - 0.2;
  var perfW = pw * 0.65;
  var holeSpacingX = 0.06;
  var holeSpacingY = 0.07;
  var cols = Math.floor(perfW / holeSpacingX);
  var rows = Math.floor((perfEndY - perfStartY) / holeSpacingY);

  for (var row = 0; row < rows; row++) {
    for (var col = 0; col < cols; col++) {
      // Offset every other row for hex pattern
      var offsetX = (row % 2) * (holeSpacingX / 2);
      var hx = side * (pw / 2) - side * (perfW / 2) + side * (col * holeSpacingX + offsetX);
      var hy = perfStartY + row * holeSpacingY;
      // Small circular hole (tiny sphere cut-out illusion — dark dot)
      S(d, 0.012, mVent, hx, hy, 0.01);
    }
  }

  // Lock mechanism near bottom
  B(d, 0.04, 0.06, 0.015, mScrewHead, handleX, RACK_H * 0.3, 0.015);
  // Keyhole
  S(d, 0.008, mRackBack, handleX, RACK_H * 0.3, 0.025);

  return d;
}

doorLPivot.add(buildDoor(1));
doorRPivot.add(buildDoor(-1));
setLoad(40, 'Doors hung...');

// ========== SERVER UNITS (inside rack) ==========
var SERVER_POSITIONS = []; // y positions for each U
var SERVER_COUNT = 6;
var serverGroups = [];

// Server slot heights and types
// Rack populated bottom-to-top: UPS(2U), Storage(2U), Cisco(1U), FireEye(1U), PatchPanel(1U), Dell(2U)
var serverSlots = [
  { uHeight: 2, builder: buildDell,     idx: 0 },  // top
  { uHeight: 1, builder: buildPatch,    idx: 1 },
  { uHeight: 1, builder: buildFireEye2, idx: 2 },
  { uHeight: 1, builder: buildCisco2,   idx: 3 },
  { uHeight: 2, builder: buildStorage2, idx: 4 },
  { uHeight: 2, builder: buildUPS2,     idx: 5 },  // bottom
];

var U_HEIGHT = 0.44;
var U_GAP = 0.04;
var yStart = 0.25;

// Build each server and place it in the rack
for (var si = serverSlots.length - 1; si >= 0; si--) {
  var slot = serverSlots[si];
  var h = slot.uHeight * U_HEIGHT;
  var server = slot.builder(h);
  var yPos = yStart + h/2;

  server.position.set(0, yPos, RACK_D/2 - 0.5);
  server.userData.restZ = RACK_D/2 - 0.5;
  server.userData.popZ  = RACK_D/2 + 0.15; // popped out past the front of the rack
  server.userData.index = slot.idx;

  rackGroup.add(server);
  serverGroups[slot.idx] = server;
  SERVER_POSITIONS[slot.idx] = yPos;

  yStart += h + U_GAP;
}

// ---- Server Builders (no labels — visual identity only) ----

function buildDell(h) {
  var g = new THREE.Group();
  var W = RACK_W - 0.35, D = 0.9;
  B(g, W, h, D, mServerBody, 0,0,0);
  // Faceplate
  B(g, W+0.005, h-0.02, 0.015, mFaceplate, 0,0,D/2+0.007);
  // Dell-signature blue accent bar across top
  B(g, W+0.008, 0.018, 0.02, mDellBlue, 0, h/2-0.015, D/2+0.01);
  // iDRAC quick-access (small blue rectangle left)
  B(g, 0.12, 0.07, 0.008, mDellBlue, -W/2+0.14, 0.02, D/2+0.02);
  // 12 drive bays (2x6)
  for (var r = 0; r < 2; r++) {
    for (var c = 0; c < 6; c++) {
      B(g, 0.12, 0.13, 0.01, mDriveBay, -0.15+c*0.155, -0.04+r*0.18, D/2+0.02);
      B(g, 0.08, 0.008, 0.004, mDriveHandle, -0.15+c*0.155, 0.02+r*0.18, D/2+0.028);
    }
  }
  // LEDs
  S(g,0.013,gGreen, -W/2+0.05, 0.06, D/2+0.025);
  S(g,0.013,gAmber, -W/2+0.05, 0.02, D/2+0.025);
  S(g,0.013,gGreen, -W/2+0.05,-0.02, D/2+0.025);
  // Power button
  C(g,0.015,0.015,0.006,10,mHandle, W/2-0.08, h/2-0.04, D/2+0.025).rotation.x=Math.PI/2;
  // USB ports
  B(g, 0.04,0.015,0.01, mRackBack, -W/2+0.35,-0.06,D/2+0.025);
  B(g, 0.04,0.015,0.01, mRackBack, -W/2+0.42,-0.06,D/2+0.025);
  // Mounting screws
  for (var sx = -1; sx <= 1; sx+=2) {
    C(g,0.006,0.006,0.003,8,mScrewHead, sx*(W/2+0.01), h/2-0.03, D/2+0.02).rotation.x=Math.PI/2;
    C(g,0.006,0.006,0.003,8,mScrewHead, sx*(W/2+0.01),-h/2+0.03, D/2+0.02).rotation.x=Math.PI/2;
  }
  return g;
}

function buildPatch(h) {
  var g = new THREE.Group();
  var W = RACK_W - 0.35, D = 0.3;
  B(g, W, h, D, mFaceplate, 0,0,0);
  // 48 ports (2 rows of 24) — the signature look
  for (var row = 0; row < 2; row++) {
    for (var col = 0; col < 24; col++) {
      B(g, 0.028, 0.033, 0.01, mRackBack, -W/2+0.1+col*0.093, 0.04-row*0.075, D/2+0.01);
      // Random link lights
      if (Math.random() > 0.35) {
        var lm = [gGreen,gGreen,gBlue,gAmber,gGreen][Math.floor(Math.random()*5)];
        S(g, 0.006, lm, -W/2+0.1+col*0.093, 0.065-row*0.075, D/2+0.02);
      }
    }
  }
  // Number strip (thin white bar across top)
  B(g, W*0.88, 0.012, 0.003, gWhite, 0, h/2-0.02, D/2+0.015);
  // Mounting ears
  for (var ex = -1; ex <= 1; ex+=2) {
    B(g, 0.06, h+0.01, 0.02, mHandle, ex*(W/2+0.03), 0, D/2-0.01);
    C(g,0.006,0.006,0.003,8,mScrewHead, ex*(W/2+0.03), 0.04, D/2+0.005).rotation.x=Math.PI/2;
    C(g,0.006,0.006,0.003,8,mScrewHead, ex*(W/2+0.03),-0.04, D/2+0.005).rotation.x=Math.PI/2;
  }
  return g;
}

function buildFireEye2(h) {
  var g = new THREE.Group();
  var W = RACK_W - 0.35, D = 0.85;
  // Dark body with red tint
  B(g, W, h, D, mFireDark, 0,0,0);
  B(g, W+0.005, h-0.01, 0.012, mServerBody, 0,0,D/2+0.006);
  // Signature red accent lines (top + bottom of faceplate)
  B(g, W+0.008, 0.014, 0.015, mFireRed, 0, h/2-0.01, D/2+0.01);
  B(g, W+0.008, 0.008, 0.015, mFireRed, 0,-h/2+0.005, D/2+0.01);
  // "Eye" indicator — concentric circle (ring + glowing center)
  var ring = new THREE.Mesh(new THREE.RingGeometry(0.025,0.038,16), mFireRed);
  ring.position.set(-W/2+0.15, 0, D/2+0.02);
  g.add(ring);
  S(g, 0.014, gRed, -W/2+0.15, 0, D/2+0.025);
  // Status LEDs
  S(g,0.009,gGreen, -W/2+0.32, 0.03, D/2+0.02);
  S(g,0.009,gGreen, -W/2+0.37, 0.03, D/2+0.02);
  S(g,0.009,gAmber, -W/2+0.42, 0.03, D/2+0.02);
  S(g,0.009,gRed,   -W/2+0.47, 0.03, D/2+0.02);
  // 8 copper ports
  for (var p = 0; p < 8; p++) {
    B(g, 0.04,0.035,0.01, mRackBack, -0.05+p*0.1,-0.02,D/2+0.015);
  }
  // 4 SFP+ cages (taller, metallic)
  for (var s = 0; s < 4; s++) {
    B(g, 0.045,0.03,0.014, mHandle, W/2-0.28+s*0.075,-0.02,D/2+0.015);
  }
  return g;
}

function buildCisco2(h) {
  var g = new THREE.Group();
  var W = RACK_W - 0.35, D = 0.75;
  B(g, W, h, D, mServerBody, 0,0,0);
  B(g, W+0.005, h-0.01, 0.012, mFaceplate, 0,0,D/2+0.006);
  // Cisco teal accent stripe (left portion of faceplate)
  B(g, 0.4, 0.012, 0.015, mCiscoTeal, -W/2+0.28, h/2-0.012, D/2+0.012);
  // Cisco-style logo area (small teal rectangle)
  B(g, 0.16, 0.05, 0.004, mCiscoTeal, -W/2+0.14, 0.015, D/2+0.02);
  // Small LCD status screen
  B(g, 0.22, 0.07, 0.004, mScreen, -W/2+0.45, 0, D/2+0.02);
  B(g, 0.16,0.005,0.001, gGreen, -W/2+0.45, 0.015, D/2+0.024);
  B(g, 0.12,0.005,0.001, gGreen, -W/2+0.44,-0.015, D/2+0.024);
  // LEDs: PWR, STS, ACT, VPN
  S(g,0.009,gGreen, -W/2+0.7, 0.05, D/2+0.02);
  S(g,0.009,gGreen, -W/2+0.75,0.05, D/2+0.02);
  S(g,0.009,gAmber, -W/2+0.8, 0.05, D/2+0.02);
  S(g,0.009,gBlue,  -W/2+0.85,0.05, D/2+0.02);
  // 8 GigE ports with link lights
  for (var p = 0; p < 8; p++) {
    B(g, 0.04,0.035,0.01, mRackBack, 0.04+p*0.085,-0.03,D/2+0.015);
    if (Math.random()>0.3) S(g,0.005,gGreen, 0.04+p*0.085,0.0,D/2+0.025);
  }
  // Console port (teal — the signature Cisco rollover cable port)
  B(g, 0.035,0.025,0.012, mCiscoTeal, W/2-0.06, 0.04, D/2+0.015);
  // Mounting ears
  for (var ex=-1;ex<=1;ex+=2) B(g,0.05,h+0.005,0.02,mHandle,ex*(W/2+0.025),0,D/2-0.01);
  return g;
}

function buildStorage2(h) {
  var g = new THREE.Group();
  var W = RACK_W - 0.35, D = 0.9;
  B(g, W, h, D, mServerBody, 0,0,0);
  B(g, W+0.005, h-0.02, 0.015, mFaceplate, 0,0,D/2+0.007);
  // Blue accent (NetApp style)
  B(g, W+0.008, 0.015, 0.018, mNetBlue, 0, h/2-0.014, D/2+0.012);
  // Dense drive bays (4x6 = 24 bays) — the signature wall of drives
  for (var r = 0; r < 4; r++) {
    for (var c = 0; c < 6; c++) {
      B(g, 0.12, 0.065, 0.01, mDriveBay, -W/2+0.18+c*0.155, h/2-0.06-r*0.09, D/2+0.02);
      B(g, 0.08, 0.006, 0.003, mDriveHandle, -W/2+0.18+c*0.155, h/2-0.03-r*0.09, D/2+0.028);
      // Drive activity LED
      if (Math.random()>0.25) {
        var dm = Math.random()>0.6 ? gAmber : gGreen;
        S(g, 0.004, dm, -W/2+0.24+c*0.155, h/2-0.06-r*0.09, D/2+0.028);
      }
    }
  }
  // Status LEDs cluster (right side)
  S(g,0.012,gGreen, W/2-0.08, 0.08, D/2+0.025);
  S(g,0.012,gGreen, W/2-0.08, 0.04, D/2+0.025);
  S(g,0.012,gAmber, W/2-0.08, 0.00, D/2+0.025);
  // Controller label (blue stripe)
  B(g, 0.1,0.04,0.004, mNetBlue, W/2-0.1,-h/2+0.04, D/2+0.02);
  return g;
}

function buildUPS2(h) {
  var g = new THREE.Group();
  var W = RACK_W - 0.35, D = 0.85;
  B(g, W, h, D, mServerBody, 0,0,0);
  B(g, W+0.005, h-0.02, 0.015, mFaceplate, 0,0,D/2+0.007);
  // APC green accent bar
  B(g, W*0.5, 0.012, 0.018, mApcGreen, -W/4+0.05, h/2-0.012, D/2+0.012);
  // LCD display
  B(g, 0.35, 0.15, 0.005, mScreen, -W/2+0.35, 0.04, D/2+0.02);
  // LCD content lines
  B(g, 0.25,0.008,0.001, gGreen, -W/2+0.35, 0.09, D/2+0.026);
  B(g, 0.18,0.008,0.001, gGreen, -W/2+0.33, 0.06, D/2+0.026);
  B(g, 0.22,0.008,0.001, gGreen, -W/2+0.34, 0.03, D/2+0.026);
  // Battery level bars
  for (var b = 0; b < 5; b++) {
    B(g, 0.018,0.018,0.002, b<4?gGreen:gAmber, -W/2+0.22+b*0.03,-0.02,D/2+0.026);
  }
  // Nav buttons (4 small circles)
  for (var btn = 0; btn < 4; btn++) {
    C(g,0.01,0.01,0.005,10,mHandle, -W/2+0.65+btn*0.045,0.04,D/2+0.025).rotation.x=Math.PI/2;
  }
  // Big green power button
  C(g,0.02,0.02,0.008,14,mApcGreen, -W/2+0.65,-0.04,D/2+0.025).rotation.x=Math.PI/2;
  // Output receptacles (right half — 2x3 NEMA outlets)
  for (var r = 0; r < 2; r++) {
    for (var c = 0; c < 3; c++) {
      B(g, 0.06,0.045,0.01, mRackBack, W/2-0.4+c*0.11, 0.04-r*0.1, D/2+0.015);
      // Outlet slot holes
      B(g, 0.008,0.025,0.012, mDriveBay, W/2-0.41+c*0.11, 0.04-r*0.1, D/2+0.022);
      B(g, 0.008,0.025,0.012, mDriveBay, W/2-0.39+c*0.11, 0.04-r*0.1, D/2+0.022);
    }
  }
  // Status LEDs
  S(g,0.012,gGreen, W/2-0.08, 0.06, D/2+0.022);
  S(g,0.012,gGreen, W/2-0.08, 0.02, D/2+0.022);
  return g;
}

setLoad(65, 'Servers racked...');

// ========== LIGHTING ==========
scene.add(new THREE.AmbientLight(0x445566, 1.0));
var hemi = new THREE.HemisphereLight(0x6688bb, 0x223344, 0.7);
scene.add(hemi);

var key = new THREE.DirectionalLight(0xeeeeff, 1.2);
key.position.set(4, 5, 7);
key.castShadow = true;
key.shadow.mapSize.set(2048,2048);
scene.add(key);

var fill = new THREE.DirectionalLight(0x4488cc, 0.6);
fill.position.set(-5, 3, 4);
scene.add(fill);

var front = new THREE.DirectionalLight(0xccccee, 0.4);
front.position.set(0, 1, 8);
scene.add(front);

var rim = new THREE.DirectionalLight(0xff8844, 0.3);
rim.position.set(0, 3, -5);
scene.add(rim);

var spot = new THREE.SpotLight(0x44ddff, 1.0, 15, Math.PI/4, 0.5, 0.8);
spot.position.set(0, 5, 6);
spot.castShadow = true;
scene.add(spot);
scene.add(spot.target);

var underGlow = new THREE.PointLight(0x00ff88, 0.4, 8);
underGlow.position.set(0, -3, 2);
scene.add(underGlow);

var rearGlow = new THREE.PointLight(0x2266ff, 0.4, 8);
rearGlow.position.set(0, 1, -3);
scene.add(rearGlow);

// Side fills
var leftFill = new THREE.PointLight(0x5577aa, 0.4, 10);
leftFill.position.set(-4, 1, 3);
scene.add(leftFill);

var rightFill = new THREE.PointLight(0x5577aa, 0.4, 10);
rightFill.position.set(4, 1, 3);
scene.add(rightFill);

setLoad(80, 'Lights rigged...');

// ========== PARTICLES ==========
var ptCount = 300;
var ptGeo = new THREE.BufferGeometry();
var ptPos = new Float32Array(ptCount*3);
var ptSpd = [];
for (var i = 0; i < ptCount; i++) {
  ptPos[i*3]   = (Math.random()-0.5)*50;
  ptPos[i*3+1] = (Math.random()-0.5)*25;
  ptPos[i*3+2] = (Math.random()-0.5)*30;
  ptSpd.push({x:(Math.random()-0.5)*0.002, y:(Math.random()-0.5)*0.001, z:(Math.random()-0.5)*0.002});
}
ptGeo.setAttribute('position', new THREE.BufferAttribute(ptPos,3));
scene.add(new THREE.Points(ptGeo, new THREE.PointsMaterial({color:0x4488cc, size:0.02, transparent:true, opacity:0.2, sizeAttenuation:true})));

setLoad(90, 'Atmosphere deployed...');

// ========== KEYBOARD SPIN ==========
var spinTarget = 0;    // target Y rotation
var spinCurrent = 0;   // current Y rotation
var SPIN_SPEED = 0.06; // radians per keypress
var spinHintEl = document.getElementById('spin-hint');
var spinHintVisible = false;

window.addEventListener('keydown', function(e) {
  if (e.key === 'ArrowLeft')  spinTarget -= SPIN_SPEED;
  if (e.key === 'ArrowRight') spinTarget += SPIN_SPEED;
});

// ========== SCROLL STATE ==========
gsap.registerPlugin(ScrollTrigger);

var state = {
  doorProgress: 0,
  activeServer: -1,
  sectionProgress: [0,0,0,0,0,0],
  rackVisible: 0,
};

// Hero fade
var heroEl = document.getElementById('hero');
ScrollTrigger.create({
  trigger: '#rack-intro',
  start: 'top bottom',
  end: 'top 20%',
  scrub: 1,
  onUpdate: function(s) {
    heroEl.style.opacity = 1 - s.progress;
    heroEl.style.transform = 'translateY(' + (-s.progress*80) + 'px)';
  }
});

// Rack appear + doors open
ScrollTrigger.create({
  trigger: '#rack-intro',
  start: 'top 80%',
  end: 'bottom top',
  scrub: 1.5,
  onUpdate: function(s) {
    state.doorProgress = s.progress;
    state.rackVisible = Math.min(1, s.progress * 3);
  }
});

// Per-server
for (var si2 = 0; si2 < 6; si2++) {
  (function(idx) {
    ScrollTrigger.create({
      trigger: '#section-' + idx,
      start: 'top 60%',
      end: 'bottom 40%',
      onEnter: function() { state.activeServer = idx; },
      onEnterBack: function() { state.activeServer = idx; },
      onLeave: function() { if (state.activeServer === idx) state.activeServer = -1; },
      onLeaveBack: function() { if (state.activeServer === idx) state.activeServer = -1; },
    });
    ScrollTrigger.create({
      trigger: '#section-' + idx,
      start: 'top bottom',
      end: 'bottom top',
      scrub: 1,
      onUpdate: function(s) { state.sectionProgress[idx] = s.progress; }
    });
  })(si2);
}

// Panel elements
var panels = [];
for (var pi = 0; pi < 6; pi++) panels.push(document.getElementById('panel-' + pi));

// ========== ANIMATION LOOP ==========
var clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  var elapsed = clock.getElapsedTime();

  // Particles
  var pa = ptGeo.attributes.position.array;
  for (var i = 0; i < ptCount; i++) {
    pa[i*3]+=ptSpd[i].x; pa[i*3+1]+=ptSpd[i].y; pa[i*3+2]+=ptSpd[i].z;
    if (Math.abs(pa[i*3])>25) ptSpd[i].x*=-1;
    if (Math.abs(pa[i*3+1])>12) ptSpd[i].y*=-1;
    if (Math.abs(pa[i*3+2])>15) ptSpd[i].z*=-1;
  }
  ptGeo.attributes.position.needsUpdate = true;

  // Keyboard spin (smooth interpolation)
  spinCurrent += (spinTarget - spinCurrent) * 0.06;
  rackPivot.rotation.y = spinCurrent;

  // Show spin hint once rack is visible
  if (state.rackVisible > 0.5 && !spinHintVisible) {
    spinHintVisible = true;
    spinHintEl.style.opacity = '1';
  }

  // Floating bob for entire rack
  var bob = Math.sin(elapsed * 0.6) * 0.06;
  var tiltX = Math.sin(elapsed * 0.4) * 0.008;
  var tiltZ = Math.cos(elapsed * 0.35) * 0.005;
  rackGroup.position.y = -RACK_H/2 + 0.3 + bob;
  rackGroup.rotation.x = tiltX;
  rackGroup.rotation.z = tiltZ;

  // Rack visibility
  rackGroup.visible = state.rackVisible > 0.05 || state.doorProgress > 0;

  // Doors — open fully in first 30% of scroll, gone by 50%
  var doorOpenAmt = Math.min(1, state.doorProgress / 0.3);
  var doorEased = 1 - Math.pow(1 - doorOpenAmt, 2); // ease out quad
  // Left door swings outward to the left, right swings outward to the right
  doorLPivot.rotation.y = -doorEased * Math.PI * 0.48;
  doorRPivot.rotation.y = doorEased * Math.PI * 0.48;
  // Disappear quickly after opening
  var doorFade = state.doorProgress > 0.3 ? Math.max(0, 1 - (state.doorProgress - 0.3) / 0.2) : 1;
  doorLPivot.visible = doorFade > 0.01;
  doorRPivot.visible = doorFade > 0.01;

  // Camera — swing from straight-on to ~30 degree angle as doors open
  // Start: straight on (x=0, z=12)
  // End: angled view (x=4.5, z=7) — roughly 30 degrees off-center
  var viewT = Math.min(1, state.rackVisible);
  var viewEased = viewT < 0.5 ? 2*viewT*viewT : 1 - Math.pow(-2*viewT+2,2)/2; // ease in-out quad

  var camTargetX = THREE.MathUtils.lerp(0, 4.5, viewEased);
  var camTargetY = THREE.MathUtils.lerp(1.5, 0.8, viewEased);
  var camTargetZ = THREE.MathUtils.lerp(12, 7.5, viewEased);

  // If a server is active, adjust Y to look at it
  if (state.activeServer >= 0) {
    var activeY = SERVER_POSITIONS[state.activeServer];
    var worldY = activeY + rackGroup.position.y;
    camTargetY = THREE.MathUtils.lerp(camTargetY, worldY * 0.35 + 0.4, 0.35);
  }

  camera.position.x += (camTargetX - camera.position.x) * 0.05;
  camera.position.y += (camTargetY - camera.position.y) * 0.05;
  camera.position.z += (camTargetZ - camera.position.z) * 0.05;

  // Look at the center of the rack
  var lookY = rackGroup.position.y + RACK_H * 0.45;
  camera.lookAt(0, lookY, 0);

  // Server pop-out
  serverGroups.forEach(function(server, idx) {
    if (!server) return;
    var isActive = state.activeServer === idx;
    var targetZ = isActive ? server.userData.popZ : server.userData.restZ;
    server.position.z += (targetZ - server.position.z) * 0.08;

    // Subtle glow on active server via emissive-like brightness
    // (we change the spotlight target to it)
    if (isActive) {
      spot.target.position.set(
        server.position.x,
        server.position.y + rackGroup.position.y,
        server.position.z
      );
    }
  });

  // Spot intensity based on active
  spot.intensity = state.activeServer >= 0 ? 1.5 : 0.8;

  // Panels
  panels.forEach(function(panel, idx) {
    if (!panel) return;
    var isActive = state.activeServer === idx;
    var prog = state.sectionProgress[idx];
    if (isActive && prog > 0.15 && prog < 0.85) {
      panel.classList.add('active');
    } else {
      panel.classList.remove('active');
    }
  });

  renderer.render(scene, camera);
}

// ========== RESIZE ==========
window.addEventListener('resize', function() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  ScrollTrigger.refresh();
});

// ========== TYPEWRITER ==========
var tagEl = document.getElementById('tagline-text');
var tagTxt = 'HCI engineer. Cyber security student. Building infrastructure that never sleeps.';
var tci = 0;
function tw() {
  if (tci < tagTxt.length) { tagEl.textContent += tagTxt.charAt(tci); tci++; setTimeout(tw,35); }
}
setTimeout(tw, 1500);
gsap.from('#hero > div', { opacity:0, y:50, duration:1.5, ease:'power3.out', delay:1.2 });

// ========== LAUNCH ==========
setLoad(100, 'Systems online.');
setTimeout(function() {
  loadingScreen.classList.add('hidden');
  setTimeout(function() { loadingScreen.style.display = 'none'; }, 800);
}, 800);

animate();
