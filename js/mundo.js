// Mundo compartido: lo que los módulos de operaciones necesitan del terreno y la escena. Lo llena main.js (Object.assign) una vez armado el terreno;
// los módulos lo leen como M.H, M.scene, M.OBST... y solo escriben lo que es suyo (M.GATE). Nada de aquí se usa al cargar el módulo, solo dentro de funciones.
export const mundo = {
  scene: null,       // escena de THREE
  H: null,           // H(x, z): cota del terreno
  frame: null,       // frame(s): posición, tangente y derecha de la ruta
  OBST: null,        // equipos detenidos y cables por el piso: { x, z, r }
  GD: null, GX0: 0, GZ0: 0, GNX: 0, GNZ: 0, CELL: 5,      // malla del terreno: código de celda (-1 piso, -2 pila, 0..WR+2 camino, 60 cara) y su geometría
  PLAT7: null,       // meseta de la isla a la cota de la fase 7 (barata para los cables)
  PLAT: null,        // explanada / portón de la ruta: { se, side, D, HL, k }
  PITC: null,        // centro del rajo
  F7EQ: null,        // equipos de la fase 7: palas, pc (PC9000), canchas
  RED52: null,       // canchas de perforación dibujadas (funciones de distancia)
  PIT: null,         // fondo mina: marco y palas p1 / p5
  f7h: null,         // f7h(x, z): cota del piso de la fase 7
  PAD_UP: 16,        // altura de la cancha sobre su piso
  GATE: null,        // portón de la Rampa Sur entre dos postes pasacables (lo deja buildPowerLine)
};
const _look = new THREE.Vector3();
function setWorldPose(mesh, x, z, dx, dz) {
  const y = mundo.H(x, z) + 0.1; mesh.position.set(x, y, z);
  const sl = (mundo.H(x + dx * 3, z + dz * 3) - mundo.H(x - dx * 3, z - dz * 3)) / 6;
  _look.set(x + dx, y + sl, z + dz); mesh.lookAt(_look);
}

export { setWorldPose };
