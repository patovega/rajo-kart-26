// Constantes de diseño de la mina y del juego (ver mine-readme.md). Nada de aquí depende de otro módulo.
export const TAU = Math.PI * 2;
export const PA = 420, PB = 330;             // semiejes del rajo (m)
export const YTOP = 176;                     // cota del borde del rajo (m): 11 bancos de 16 m (altura de banco de la mina)
export const BENCH = 16;                     // altura de cada banco (m): 16 m, como en la mina
export const WR = 19, BLEND = 30;          // semiancho plano del camino (calzada de 38 m: dos CAEX de ida y vuelta, regla 3,5 × ancho del CAEX) y ancho del talud
export const PRET = 17.2;              // pretil a cada lado (34 m libres entre pretiles)
export const LANE = 8.6;               // centro de pista (|u|); u>0 = derecha
export const CRASH_U = PRET - 1.8;     // contacto con berma
export const REQ_RANGE = 55;           // alcance de radio (centro a centro)
export const SPEED_LIMIT = 60;         // km/h
export const CRUISE = 50 / 3.6;        // velocidad de crucero: acelera sola hasta 50 km/h
export const VTOP = 79.95 / 3.6;       // con la flecha arriba llega hasta 80 km/h
export const FOLLOW_DIST = 20;         // m mínimos con el CAEX de adelante (de parachoques a parachoques)
export const PCX = -172.8, PCZ = 45.5, PR = 900;      // (referencia para la cuenca y las cotas de la ruta)
export const FLOOR = -235, FRAD = 0;      // fondo mina (a escala real)
