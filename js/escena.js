// Escena de THREE: canvas, renderer, cielo, cámara, luces y ajuste al tamaño de la ventana.
import { paso } from './comun/pasos.js';

/* ───────────── Escena ───────────── */
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
paso('cielo: textura degradada', () => {
  const c = document.createElement('canvas'); c.width = 2; c.height = 256;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#2f78c0'); gr.addColorStop(.5, '#8ec1e6'); gr.addColorStop(1, '#e3d3b6');
  g.fillStyle = gr; g.fillRect(0, 0, 2, 256);
  scene.background = new THREE.CanvasTexture(c);
});
scene.fog = new THREE.FogExp2(0xdccdb0, 0.0011);
const camera = new THREE.PerspectiveCamera(62, 1, 0.5, 3200);
scene.add(new THREE.HemisphereLight(0xfff2dd, 0x7a5a3a, 0.9));
const sun = new THREE.DirectionalLight(0xffffff, 0.85); sun.position.set(-120, 200, 80); scene.add(sun);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.fov = w / h < 1 ? 78 : 62; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize); resize();

export { renderer, scene, camera, sun, resize };
