// garden3d.js — real-time 3D garden hub.
//
// Loaded dynamically by main.js. If WebGL is unavailable, or this module fails to
// import for any reason, main.js keeps the 2D canvas and nothing breaks.
//
// Plants are built from primitives rather than loaded models: it keeps the whole
// thing self-contained, and with proper lighting and soft shadows the shapes read
// well. Every plant rebuilds when its growth stage changes.

import * as THREE from '../../vendor/three.module.js';
import { OrbitControls } from '../../vendor/OrbitControls.js';
import { SPECIES, MAX_STAGE } from '../data/config.js';

const COL = {
  soilTop: 0x6B4A2C,
  soilDeep: 0x38251A,
  grass: 0x4E8F3E,
  sky: 0x1A3227,
};

// stage -> overall scale of the plant
const GROW = [0.20, 0.36, 0.56, 0.78, 0.92, 1.0];

export function initGarden3D(canvas, { plots, onSelect }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COL.sky);
  scene.fog = new THREE.Fog(COL.sky, 18, 46);

  const camera = new THREE.PerspectiveCamera(38, 2.5, 0.1, 100);
  camera.position.set(0, 6.2, 13.5);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = 8;
  controls.maxDistance = 20;
  controls.minPolarAngle = 0.35;
  controls.maxPolarAngle = 1.35;      // never let the camera go under the mound
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.35;
  controls.target.set(0, 1.4, 0);

  /* ---------------- lighting ---------------- */

  scene.add(new THREE.HemisphereLight(0xBFE8FF, 0x3A2A1A, 0.85));
  scene.add(new THREE.AmbientLight(0xffffff, 0.18));

  const sun = new THREE.DirectionalLight(0xFFE9B0, 2.4);
  sun.position.set(7, 11, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 40;
  sun.shadow.camera.left = -12;
  sun.shadow.camera.right = 12;
  sun.shadow.camera.top = 12;
  sun.shadow.camera.bottom = -12;
  sun.shadow.bias = -0.0012;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);

  // cool rim light so silhouettes separate from the background
  const rim = new THREE.DirectionalLight(0x7FD0FF, 0.5);
  rim.position.set(-8, 4, -6);
  scene.add(rim);

  // visible sun disc
  const disc = new THREE.Mesh(
    new THREE.SphereGeometry(1.1, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xFFD86B })
  );
  disc.position.set(9, 9.5, -6);
  scene.add(disc);
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(2.0, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xFFC93C, transparent: true, opacity: 0.16 })
  );
  glow.position.copy(disc.position);
  scene.add(glow);

  /* ---------------- the mound ---------------- */

  // A lathe profile gives a proper domed mound with a soft skirt, rather than a
  // hemisphere sitting on a plane with a visible seam.
  const profile = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const r = 7.2 * Math.pow(1 - t, 0.55);
    const y = 2.1 * Math.pow(t, 0.85) * -1 + 2.1;
    profile.push(new THREE.Vector2(Math.max(0.001, r), y - 2.1));
  }
  profile.reverse();
  const mound = new THREE.Mesh(
    new THREE.LatheGeometry(profile, 96),
    new THREE.MeshStandardMaterial({ color: COL.soilTop, roughness: 0.98, metalness: 0 })
  );
  mound.position.y = 2.1;
  mound.receiveShadow = true;
  mound.castShadow = true;
  scene.add(mound);

  // grass cap over the crown
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(7.24, 96, 48, 0, Math.PI * 2, 0, 0.62),
    new THREE.MeshStandardMaterial({ color: COL.grass, roughness: 0.95, flatShading: false })
  );
  cap.position.y = -5.1;
  cap.receiveShadow = true;
  scene.add(cap);

  // ground shadow catcher
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(22, 64),
    new THREE.MeshStandardMaterial({ color: 0x182C21, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  scene.add(ground);

  // scatter grass tufts on the crown
  const tuftGeo = new THREE.ConeGeometry(0.055, 0.42, 4);
  const tuftMat = new THREE.MeshStandardMaterial({ color: 0x6FCB52, roughness: 0.9 });
  for (let i = 0; i < 260; i++) {
    const a = Math.random() * Math.PI * 2;
    const rad = Math.sqrt(Math.random()) * 6.7;
    const p = surfacePoint(a, rad);
    const t = new THREE.Mesh(tuftGeo, tuftMat);
    t.position.set(p.x, p.y + 0.16, p.z);
    t.rotation.z = (Math.random() - 0.5) * 0.5;
    t.rotation.y = Math.random() * Math.PI;
    t.scale.setScalar(0.7 + Math.random() * 0.8);
    t.castShadow = true;
    scene.add(t);
  }

  // height of the dome at a given radius, so plants sit on the curve
  function surfacePoint(angle, radius) {
    const r = Math.min(radius, 7.19);
    const y = 2.1 * Math.sqrt(Math.max(0, 1 - (r / 7.2) ** 2));
    return { x: Math.cos(angle) * r, y, z: Math.sin(angle) * r };
  }

  /* ---------------- pollen motes ---------------- */

  const moteCount = 160;
  const motePos = new Float32Array(moteCount * 3);
  for (let i = 0; i < moteCount; i++) {
    motePos[i * 3] = (Math.random() - 0.5) * 16;
    motePos[i * 3 + 1] = Math.random() * 7;
    motePos[i * 3 + 2] = (Math.random() - 0.5) * 16;
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({
    color: 0xFFD86B, size: 0.075, transparent: true, opacity: 0.65, depthWrite: false,
  }));
  scene.add(motes);

  /* ---------------- plants ---------------- */

  const mat = (hex, rough = 0.75) => new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: 0 });

  function buildLeaf(color, len) {
    const g = new THREE.SphereGeometry(0.5, 12, 8);
    g.scale(len, 0.10, len * 0.55);
    const m = new THREE.Mesh(g, mat(color, 0.65));
    m.castShadow = true;
    return m;
  }

  function buildBloom(petalHex, open) {
    const grp = new THREE.Group();
    if (!open) {
      const bud = new THREE.Mesh(new THREE.SphereGeometry(0.20, 14, 12), mat(0x5FB544, 0.7));
      bud.scale.set(1, 1.5, 1);
      bud.castShadow = true;
      grp.add(bud);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), mat(petalHex, 0.6));
      tip.position.y = 0.20;
      grp.add(tip);
      return grp;
    }
    const petalGeo = new THREE.SphereGeometry(0.5, 12, 8);
    petalGeo.scale(0.42, 0.07, 0.24);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const p = new THREE.Mesh(petalGeo, mat(petalHex, 0.55));
      p.position.set(Math.cos(a) * 0.30, 0, Math.sin(a) * 0.30);
      p.rotation.y = -a;
      p.rotation.z = -0.30;
      p.castShadow = true;
      grp.add(p);
    }
    const centre = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), mat(0x8A5A38, 0.9));
    centre.scale.y = 0.6;
    centre.castShadow = true;
    grp.add(centre);
    return grp;
  }

  function buildPlant(speciesId, stage) {
    const sp = SPECIES[speciesId];
    const grp = new THREE.Group();
    const s = GROW[stage] ?? GROW[0];
    const leafHex = parseInt(sp.leaf.slice(1), 16);
    const stemHex = parseInt(sp.stem.slice(1), 16);
    const petalHex = parseInt(sp.petal.slice(1), 16);

    if (sp.form === 'succulent') {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 20, 16), mat(stemHex, 0.85));
      body.scale.set(1, 1.25, 1);
      body.position.y = 0.62;
      body.castShadow = true;
      grp.add(body);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.3, 5), mat(0x2F7A3E, 0.9));
        rib.position.set(Math.cos(a) * 0.5, 0.62, Math.sin(a) * 0.5);
        grp.add(rib);
      }
      if (stage >= 4) {
        const b = buildBloom(petalHex, stage >= 5);
        b.position.y = 1.42;
        grp.add(b);
      }
    } else if (sp.form === 'tree') {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 1.9, 10), mat(stemHex, 0.95));
      trunk.position.y = 0.95;
      trunk.castShadow = true;
      grp.add(trunk);
      const blobs = 2 + stage;
      for (let i = 0; i < blobs; i++) {
        const a = (i / blobs) * Math.PI * 2;
        const c = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 12), mat(leafHex, 0.8));
        c.position.set(Math.cos(a) * 0.52, 2.0 + Math.sin(i * 2.1) * 0.28, Math.sin(a) * 0.52);
        c.castShadow = true;
        grp.add(c);
      }
      if (stage >= 4) {
        for (let i = 0; i < 3; i++) {
          const b = buildBloom(petalHex, stage >= 5);
          b.scale.setScalar(0.55);
          b.position.set(Math.cos(i * 2.1) * 0.6, 2.5, Math.sin(i * 2.1) * 0.6);
          grp.add(b);
        }
      }
    } else if (sp.form === 'fern') {
      const fronds = 3 + stage;
      for (let i = 0; i < fronds; i++) {
        const a = (i / fronds) * Math.PI * 2;
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.045, 1.5, 6), mat(stemHex, 0.85));
        stalk.position.set(Math.cos(a) * 0.28, 0.72, Math.sin(a) * 0.28);
        stalk.rotation.z = Math.cos(a) * -0.4;
        stalk.rotation.x = Math.sin(a) * 0.4;
        stalk.castShadow = true;
        grp.add(stalk);
        for (let j = 1; j <= 4; j++) {
          const l = buildLeaf(leafHex, 0.30 - j * 0.045);
          l.position.set(Math.cos(a) * (0.28 + j * 0.10), 0.55 + j * 0.26, Math.sin(a) * (0.28 + j * 0.10));
          l.rotation.y = -a;
          grp.add(l);
        }
      }
    } else {
      const h = 0.9 + stage * 0.28;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.085, h, 8), mat(stemHex, 0.8));
      stem.position.y = h / 2;
      stem.castShadow = true;
      grp.add(stem);
      const pairs = [1, 1, 2, 3, 3, 3][stage];
      const len = [0.16, 0.24, 0.34, 0.44, 0.46, 0.48][stage];
      for (let i = 0; i < pairs; i++) {
        const y = h * (0.30 + (i * 0.52) / Math.max(1, pairs));
        for (const side of [0, Math.PI]) {
          const l = buildLeaf(leafHex, len);
          l.position.set(Math.cos(side) * len * 0.7, y, Math.sin(side) * len * 0.7);
          l.rotation.y = -side;
          l.rotation.z = side ? 0.22 : -0.22;
          grp.add(l);
        }
      }
      if (stage >= 4) {
        const b = buildBloom(petalHex, stage >= 5);
        b.position.y = h + 0.1;
        grp.add(b);
        if (sp.form === 'shrub' && stage >= 5) {
          for (const off of [-0.45, 0.45]) {
            const b2 = buildBloom(petalHex, true);
            b2.scale.setScalar(0.7);
            b2.position.set(off, h * 0.7, off * 0.4);
            grp.add(b2);
          }
        }
      }
    }

    grp.scale.setScalar(s * 1.15);
    return grp;
  }

  /* ---------------- plots ---------------- */

  const plotGroups = [];
  const rings = [];
  const n = plots.length;
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    const p = surfacePoint(angle, 4.3);
    const holder = new THREE.Group();
    holder.position.set(p.x, p.y, p.z);
    holder.userData.plotIndex = i;
    scene.add(holder);
    plotGroups.push({ holder, mesh: null, stage: -1, species: null, angle });

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.95, 0.045, 8, 40),
      new THREE.MeshBasicMaterial({ color: 0x8BE06A, transparent: true, opacity: 0 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(p.x, p.y + 0.06, p.z);
    scene.add(ring);
    rings.push(ring);

    // a bare soil patch marks every plot, planted or not
    const patch = new THREE.Mesh(
      new THREE.CircleGeometry(0.85, 32),
      new THREE.MeshStandardMaterial({ color: 0x4A3220, roughness: 1 })
    );
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(p.x, p.y + 0.03, p.z);
    patch.receiveShadow = true;
    scene.add(patch);
  }

  /* ---------------- interaction ---------------- */

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let selected = -1;
  let downAt = null;

  canvas.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt) return;
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
    downAt = null;
    if (moved > 8) return;                  // that was an orbit drag, not a tap
    const r = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(scene.children, true);
    for (const h of hits) {
      let o = h.object;
      while (o && o.userData.plotIndex === undefined) o = o.parent;
      if (o) { onSelect(o.userData.plotIndex); return; }
    }
    // tapping bare ground: pick whichever plot is nearest the hit point
    const grd = hits.find((h) => h.object === ground || h.object === mound || h.object === cap);
    if (grd) {
      let best = 0, bd = 1e9;
      plotGroups.forEach((g, i) => {
        const d = g.holder.position.distanceTo(grd.point);
        if (d < bd) { bd = d; best = i; }
      });
      if (bd < 3.2) onSelect(best);
    }
  });

  /* ---------------- frame loop ---------------- */

  const clock = new THREE.Clock();
  let running = true;

  function resize() {
    const w = canvas.clientWidth || 960;
    const h = canvas.clientHeight || 380;
    if (canvas.width !== w * renderer.getPixelRatio() || canvas.height !== h * renderer.getPixelRatio()) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }

  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    const t = clock.getElapsedTime();
    resize();

    // sway
    plotGroups.forEach((g, i) => {
      if (!g.mesh) return;
      g.mesh.rotation.z = Math.sin(t * 1.1 + i * 1.3) * 0.035;
      g.mesh.rotation.x = Math.cos(t * 0.9 + i) * 0.025;
    });

    rings.forEach((r, i) => {
      const want = i === selected ? 0.85 : 0;
      r.material.opacity += (want - r.material.opacity) * 0.12;
      r.scale.setScalar(1 + Math.sin(t * 3) * 0.03 * (i === selected ? 1 : 0));
    });

    const pos = motes.geometry.attributes.position;
    for (let i = 0; i < moteCount; i++) {
      let y = pos.getY(i) + 0.0045 + Math.sin(t + i) * 0.0015;
      if (y > 7.5) y = 0.2;
      pos.setY(i, y);
      pos.setX(i, pos.getX(i) + Math.sin(t * 0.6 + i) * 0.0025);
    }
    pos.needsUpdate = true;

    glow.scale.setScalar(1 + Math.sin(t * 1.4) * 0.05);
    controls.update();
    renderer.render(scene, camera);
  }
  frame();

  /* ---------------- public API ---------------- */

  return {
    /** Rebuild any plant whose stage or species changed. */
    sync(state, selectedIndex) {
      selected = selectedIndex ?? -1;
      state.plots.forEach((plot, i) => {
        const g = plotGroups[i];
        if (!g) return;
        const stage = plot.unlocked ? plot.stage : -1;
        if (g.stage === stage && g.species === plot.species) return;
        if (g.mesh) { g.holder.remove(g.mesh); disposeTree(g.mesh); }
        g.mesh = plot.unlocked ? buildPlant(plot.species, plot.stage) : null;
        if (g.mesh) g.holder.add(g.mesh);
        g.stage = stage;
        g.species = plot.species;
      });
    },
    focus(i) {
      const g = plotGroups[i];
      if (g) controls.target.lerp(new THREE.Vector3(g.holder.position.x, 1.2, g.holder.position.z), 0.6);
    },
    setAutoRotate(on) { controls.autoRotate = on; },
    destroy() { running = false; controls.dispose(); renderer.dispose(); },
  };
}

function disposeTree(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
      else o.material.dispose();
    }
  });
}

export { MAX_STAGE };
