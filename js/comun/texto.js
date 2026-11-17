// Formato de texto: pad (dos dígitos) y fmt (tiempo m:ss).


const pad = n => String(n).padStart(2, '0');
const fmt = t => Math.floor(t / 60) + ':' + pad(Math.floor(t % 60));

export { pad, fmt };
