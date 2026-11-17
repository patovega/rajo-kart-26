// Estado de la partida: G (modo, tiempos, choque, llegada, tránsito libre), P (la camioneta sobre la ruta: s, u, v, vu, y), keys e inp (entradas), tráfico (trucks, oncs), rocas, OBST (equipos detenidos), la camioneta (pickup) y place() para poner una malla sobre la ruta.
import { LANE } from '../config/diseno.js';
import { buildPickup } from '../modelos/camiones.js';
import { scene } from '../escena.js';
import { H, L, frame } from '../terreno/construir.js';

// Estado de la partida (G): lo que antes eran variables sueltas de main.js. Los módulos del juego y de la interfaz lo leen y escriben como G.mode, G.free, G.arrive...
const G = {
  mode: 'menu',                                   // 'menu' | 'play' | 'win' | 'over'
  tGame: 0, tAnim: 0, overtakes: 0,               // tiempo de la partida, tiempo de animación (no se detiene), adelantamientos
  spawnT: 8, aljT: 0, pickT: 20, rockT: 6,        // temporizadores: próximo CAEX en contra, aljibe, camioneta en contra, roca que cae de un camión
  wrongT: 0, overT: 0,                            // segundos en la pista contraria sin motivo / sobre el límite de velocidad
  beepT: 0, bannerT: 0, skidT: 0, camBeepT: 0, gapBeepT: 0,      // temporizadores de avisos y pitidos
  shake: 0, camSnap: true,                        // sacudida de cámara; la cámara salta a su sitio sin suavizar en el próximo cuadro
  crashSide: 0, crashT: 0, fall: null, crashFall: false, crush: null,      // choque contra el pretil (lado y tiempo), caída al rajo, aplastamiento
  intro: null, arrive: null, free: null,          // salida automática, tramo final hasta el domo, tránsito libre por la fase 7: { x, z, a, gate }
  FREE0: null,                                    // punto de partida del tránsito libre (lo calcula buscarPartidaLibre una vez armado el mundo)
  TEST: false, playerName: '',                    // modo prueba (nombre «federicovega»): sin tráfico, sin límite de velocidad, no se envía al ranking
};
const ganchos = { endGame: (win, msg) => {} };      // la pantalla de fin de partida la instala js/ui/pantallas.js (el juego no importa de la interfaz)
const endGame = (win, msg) => ganchos.endGame(win, msg);      // termina la partida: mode pasa a 'win' u 'over' y se muestra el resultado

const _look = new THREE.Vector3();
function place(mesh, s, u, dir, lat) {
  const f = frame(s), x = f.x + f.rx * u, z = f.z + f.rz * u, y = H(x, z) + 0.1;
  const sl = (H(x + f.tx * 3, z + f.tz * 3) - H(x - f.tx * 3, z - f.tz * 3)) / 6;
  mesh.position.set(x, y, z);
  _look.set(x + dir * f.tx + f.rx * (lat || 0), y + dir * sl, z + dir * f.tz + f.rz * (lat || 0));
  mesh.lookAt(_look);
  return y;
}
const pickup = buildPickup(); scene.add(pickup);
const keys = { up: false, down: false, left: false, right: false };      // flechas / WASD y botones táctiles (las escribe js/ui/teclado.js)
const P = { s: 10, u: -LANE, v: 0, vu: 0, y: 0 };      // la camioneta sobre la ruta: metros recorridos s, posición lateral u (u > 0 = derecha), velocidad v, velocidad lateral vu, cota y
const OBST = [];      // equipos detenidos en las bahías (x, z, radio): en el tránsito libre no se pueden atravesar
const trucks = [], oncs = [], rocks = [], rocasPista = [];
const END_S = L + 205;      // aquí se estaciona la camioneta, frente a la puerta del domo
const inp = { steer: 0, thr: 0, brk: 0, analog: false, src: '' };      // volante, mando, volante en pantalla o celular: giro −1..1, acelerador y freno 0..1 (lo escribe pollInput de js/ui/controles.js)

export { G, P, keys, inp, OBST, trucks, oncs, rocks, rocasPista, pickup, place, END_S, ganchos, endGame };
