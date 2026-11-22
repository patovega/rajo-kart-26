// Mundo compartido: lo que los módulos de operaciones necesitan del terreno y la escena. Lo llena main.js (Object.assign) una vez armado el terreno;
// los módulos lo leen como M.H, M.scene, M.OBST... y solo escriben lo que es suyo (M.GATE). Nada de aquí se usa al cargar el módulo, solo dentro de funciones.
export const mundo = {
  scene: null,       // escena de THREE
  H: null,           // H(x, z): cota del terreno
  inPit: null,       // inPit(x, z): ¿está dentro del rajo (y no en la superficie)?
  frame: null,       // frame(s): posición, tangente y derecha de la ruta
  L: 0,              // largo de la ruta (m): el portal «SUPERFICIE»
  CAEX_LANE: null,   // carril solo CAEX: { on, a, b, u }
  OBST: null,        // equipos detenidos y cables por el piso: { x, z, r }
  GD: null, GR: null, GX0: 0, GZ0: 0, GNX: 0, GNZ: 0, CELL: 4,      // malla del terreno: código de celda (-1 piso, 0..WR+2 camino, si no distancia a la ruta), GR = 1 en los caminos interiores, y su geometría
  PLAT: null,        // explanada / portón de la ruta: { se, side, D, HL, k }
  PITC: null,        // centro del rajo
  GATE: null,        // portón de la Rampa Sur entre dos postes pasacables (lo deja buildPowerLine)
};
const _look = new THREE.Vector3();
function setWorldPose(mesh, x, z, dx, dz) {
  const y = mundo.H(x, z) + 0.1; mesh.position.set(x, y, z);
  const sl = (mundo.H(x + dx * 3, z + dz * 3) - mundo.H(x - dx * 3, z - dz * 3)) / 6;
  _look.set(x + dx, y + sl, z + dz); mesh.lookAt(_look);
}

export { setWorldPose };
