// Grilla de alturas real del rajo (terreno_dwg.bin, la escribe pruebas/plano/exporta_dwg.py): Uint16 en decímetros sobre 1000 m, filas de norte a sur.
// Se carga con un await de nivel superior: los módulos que la importan (el terreno) esperan a que esté antes de armarse.
const resp = await fetch(new URL('./terreno_dwg.bin', import.meta.url));
if (!resp.ok) throw new Error('No se pudo cargar terreno_dwg.bin: ' + resp.status);
const GRID16 = new Uint16Array(await resp.arrayBuffer());

export { GRID16 };
