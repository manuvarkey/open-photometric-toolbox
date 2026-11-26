<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import * as THREE from "three";
import { createCandelaSampler } from "../core/photometricSampling";
import type { PhotometricData } from "../core/types";

const props = withDefaults(
  defineProps<{
    data: PhotometricData | null;
    wireframe?: boolean;
    showAxes?: boolean;
    showRings?: boolean;
  }>(),
  {
    wireframe: false,
    showAxes: true,
    showRings: true,
  }
);

const canvasContainer = ref<HTMLDivElement>();
let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let animationFrameId = 0;
let meshGroup: THREE.Group | null = null;
let gridGroup: THREE.Group | null = null;

// Orbit controls state
let isDragging = false;
let isPanning = false;
let prevMouseX = 0;
let prevMouseY = 0;
let spherical = { radius: 14, theta: Math.PI / 4, phi: Math.PI / 6 };
let target = new THREE.Vector3(0, 0, 0);

function initThree() {
  if (!canvasContainer.value) return;

  const width = canvasContainer.value.clientWidth;
  const height = canvasContainer.value.clientHeight;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x18181f);

  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  updateCamera();

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  canvasContainer.value.appendChild(renderer.domElement);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
  scene.add(ambientLight);

  const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight1.position.set(10, 20, 15);
  scene.add(dirLight1);

  const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
  dirLight2.position.set(-10, -20, -15);
  scene.add(dirLight2);

  meshGroup = new THREE.Group();
  scene.add(meshGroup);

  gridGroup = new THREE.Group();
  scene.add(gridGroup);

  setupInteractions();
  rebuildGrid();
  rebuildMesh();

  function animate() {
    animationFrameId = requestAnimationFrame(animate);
    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }
  }
  animate();
}

function updateCamera() {
  if (!camera) return;
  const x = target.x + spherical.radius * Math.sin(spherical.theta) * Math.cos(spherical.phi);
  const y = target.y + spherical.radius * Math.cos(spherical.theta);
  const z = target.z + spherical.radius * Math.sin(spherical.theta) * Math.sin(spherical.phi);
  camera.position.set(x, y, z);
  camera.lookAt(target);
}

// False-color turbo heatmap calculation
function getHeatmapColor(t: number): THREE.Color {
  // t is 0.0 to 1.0
  const clamped = Math.max(0, Math.min(1, t));
  const r = Math.sin(clamped * Math.PI * 1.5 - Math.PI * 0.5) * 0.5 + 0.5;
  const g = Math.sin(clamped * Math.PI);
  const b = Math.cos(clamped * Math.PI * 0.8) * 0.5 + 0.5;
  return new THREE.Color(r, g, b);
}

function rebuildMesh() {
  if (!meshGroup || !props.data) return;

  // Clear existing mesh
  while (meshGroup.children.length > 0) {
    const child = meshGroup.children[0] as THREE.Mesh;
    child.geometry?.dispose();
    if (Array.isArray(child.material)) {
      child.material.forEach((m) => m.dispose());
    } else {
      child.material?.dispose();
    }
    meshGroup.remove(child);
  }

  const data = props.data;
  const sample = createCandelaSampler(data);
  const vAngles = Array.from({length:73}, (_,i) => i*2.5);
  const hAngles = Array.from({length:73}, (_,i) => i*5);
  const candela = hAngles.map(h => vAngles.map(v => sample(v,h)));

  const maxVal = Math.max(1, data.calculated.maxCandela.intensity);
  const scale = 5.0; // Visual radius units

  const numH = hAngles.length;
  const numV = vAngles.length;

  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  // Generate vertices
  for (let h = 0; h < numH; h++) {
    const phi = (hAngles[h] * Math.PI) / 180;
    for (let v = 0; v < numV; v++) {
      const theta = (vAngles[v] * Math.PI) / 180;
      const intensity = candela[h][v];
      const norm = intensity / maxVal;
      const r = norm * scale;

      // Type C coordinate mapping:
      // theta = 0 (nadir) points straight down (-Y)
      // theta = 90 points out into horizontal plane
      // theta = 180 points straight up (+Y)
      const x = r * Math.sin(theta) * Math.cos(phi);
      const z = r * Math.sin(theta) * Math.sin(phi);
      const y = -r * Math.cos(theta); // Nadir down

      positions.push(x, y, z);

      const color = getHeatmapColor(norm);
      colors.push(color.r, color.g, color.b);
    }
  }

  // Generate triangle faces
  for (let h = 0; h < numH - 1; h++) {
    for (let v = 0; v < numV - 1; v++) {
      const i0 = h * numV + v;
      const i1 = i0 + 1;
      const i2 = (h + 1) * numV + v;
      const i3 = i2 + 1;

      // Two triangles per quad
      indices.push(i0, i2, i1);
      indices.push(i1, i2, i3);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    wireframe: props.wireframe,
    side: THREE.DoubleSide,
    roughness: 0.35,
    metalness: 0.1,
  });

  const mesh = new THREE.Mesh(geometry, material);
  meshGroup.add(mesh);

  // Fixture source sphere at origin
  const sourceGeom = new THREE.SphereGeometry(0.12, 16, 16);
  const sourceMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
  const sourceMesh = new THREE.Mesh(sourceGeom, sourceMat);
  meshGroup.add(sourceMesh);
}

function rebuildGrid() {
  if (!gridGroup) return;

  while (gridGroup.children.length > 0) {
    const child = gridGroup.children[0] as THREE.Line;
    child.geometry?.dispose();
    gridGroup.remove(child);
  }

  if (!props.showRings) return;

  const ringRadius = 5.0;
  const segments = 64;

  // Equator / Horizontal 90-degree plane ring
  const circleGeom = new THREE.BufferGeometry();
  const circlePositions: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const theta = (i * Math.PI * 2) / segments;
    circlePositions.push(Math.cos(theta) * ringRadius, 0, Math.sin(theta) * ringRadius);
  }
  circleGeom.setAttribute("position", new THREE.Float32BufferAttribute(circlePositions, 3));
  const ringMat = new THREE.LineBasicMaterial({ color: 0x474750, transparent: true, opacity: 0.6 });
  const hRing = new THREE.Line(circleGeom, ringMat);
  gridGroup.add(hRing);

  // Cardinal direction axes
  if (props.showAxes) {
    const axesGeom = new THREE.BufferGeometry();
    axesGeom.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [
          -ringRadius * 1.2, 0, 0, ringRadius * 1.2, 0, 0, // X: 0 - 180 deg
          0, -ringRadius * 1.2, 0, 0, ringRadius * 0.4, 0, // Y: Nadir
          0, 0, -ringRadius * 1.2, 0, 0, ringRadius * 1.2, // Z: 90 - 270 deg
        ],
        3
      )
    );
    const axesMat = new THREE.LineBasicMaterial({ color: 0x606070, transparent: true, opacity: 0.5 });
    gridGroup.add(new THREE.LineSegments(axesGeom, axesMat));
  }
}

let resizeObserver: ResizeObserver | undefined;
function stopDragging() {
  isDragging = false;
  isPanning = false;
}

function setupInteractions() {
  const el = canvasContainer.value;
  if (!el) return;

  el.addEventListener("mousedown", (e) => {
    if (e.button === 0) isDragging = true;
    if (e.button === 2) isPanning = true;
    prevMouseX = e.clientX;
    prevMouseY = e.clientY;
  });

  window.addEventListener("mouseup", stopDragging);

  el.addEventListener("contextmenu", (e) => e.preventDefault());

  el.addEventListener("mousemove", (e) => {
    const deltaX = e.clientX - prevMouseX;
    const deltaY = e.clientY - prevMouseY;
    prevMouseX = e.clientX;
    prevMouseY = e.clientY;

    if (isDragging) {
      spherical.phi += deltaX * 0.008;
      spherical.theta = Math.max(0.01, Math.min(Math.PI - 0.01, spherical.theta - deltaY * 0.008));
      updateCamera();
    } else if (isPanning) {
      const panSpeed = 0.012;
      target.x -= deltaX * panSpeed;
      target.y += deltaY * panSpeed;
      updateCamera();
    }
  });

  el.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      spherical.radius = Math.max(2, Math.min(40, spherical.radius + e.deltaY * 0.015));
      updateCamera();
    },
    { passive: false }
  );

  resizeObserver = new ResizeObserver(() => {
    if (!canvasContainer.value || !renderer || !camera) return;
    const w = canvasContainer.value.clientWidth;
    const h = canvasContainer.value.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
  resizeObserver.observe(el);
}

function resetView() {
  spherical = { radius: 14, theta: Math.PI / 4, phi: Math.PI / 6 };
  target = new THREE.Vector3(0, 0, 0);
  updateCamera();
}

defineExpose({ resetView });

watch(() => props.data, () => {
  rebuildMesh();
});

watch(() => props.wireframe, () => {
  rebuildMesh();
});

watch(() => [props.showAxes, props.showRings], () => {
  rebuildGrid();
});

onMounted(() => {
  initThree();
});

onBeforeUnmount(() => {
  cancelAnimationFrame(animationFrameId);
  resizeObserver?.disconnect();
  window.removeEventListener("mouseup", stopDragging);
  scene?.traverse(object => {
    const mesh = object as THREE.Mesh;
    mesh.geometry?.dispose();
    const materials = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : [];
    materials.forEach(material => material.dispose());
  });
  renderer?.dispose();
});
</script>

<template>
  <div class="photometric-3d-wrapper">
    <div ref="canvasContainer" class="three-canvas"></div>
    <div class="viewport-overlay-controls">
      <button class="overlay-btn" aria-label="Reset View" title="Reset View" @click="resetView">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8 M3 3v5h5" />
        </svg>
      </button>
    </div>
    <!-- Heatmap scale legend -->
    <div class="heatmap-legend">
      <div class="legend-bar"></div>
      <div class="legend-labels">
        <span>{{ Math.round(data?.calculated.maxCandela.intensity ?? 0) }} cd</span>
        <span>{{ Math.round((data?.calculated.maxCandela.intensity ?? 0) / 2) }} cd</span>
        <span>0 cd</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.photometric-3d-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.three-canvas {
  width: 100%;
  height: 100%;
}

.viewport-overlay-controls {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  z-index: 10;
}

.overlay-btn {
  width: 32px;
  height: 32px;
  background: var(--raised, #33333c);
  border: 1px solid var(--line, #474750);
  border-radius: var(--control-radius, 4px);
  color: var(--text, #edebe8);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
}

.overlay-btn:hover {
  background: var(--panel, #3b3b45);
  border-color: var(--accent, #fbbf24);
  color: var(--accent, #fbbf24);
}

.heatmap-legend {
  position: absolute;
  bottom: 16px;
  left: 16px;
  background: color-mix(in srgb, var(--well, #26262d) 85%, transparent);
  border: 1px solid var(--line, #474750);
  border-radius: var(--control-radius, 4px);
  padding: 8px 10px;
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: var(--text-size-caption);
  color: var(--muted, #bebdbd);
  backdrop-filter: blur(4px);
  z-index: 10;
}

.legend-bar {
  width: 10px;
  height: 70px;
  border-radius: 2px;
  background: linear-gradient(to bottom, #d946ef, #ef4444, #eab308, #22c55e, #3b82f6, #06b6d4);
}

.legend-labels {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 70px;
  font-family: var(--ui-font-family);
  font-variant-numeric: tabular-nums;
}
</style>
