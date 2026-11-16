// Arma el terreno en orden: cada módulo corre sus pasos (paso('…')) al cargarse, así que el orden de estas líneas es el orden de armado:
// ruta → malla de alturas → fondo mina y fase 7 → malla 3D (necesita la escena) → camino. main.js importa de aquí lo que necesita del terreno.
export * from './ruta.js';
export * from './alturas.js';
export * from './fases.js';
export * from './malla3d.js';
export * from './camino.js';
