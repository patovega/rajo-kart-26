// Acceso al DOM: $(id) y el mapa el de los elementos del HUD; coarseMq dice si es pantalla táctil (celular).


const $ = id => document.getElementById(id);
const el = { hud: $('hud'), kmh: $('kmh'), bar: $('barfill'), spd: $('spd'), alt: $('alt'), altmax: $('altmax'), tm: $('tm'), ovk: $('ovk'),
  alerts: $('alerts'), banner: $('banner'), radio: $('radio'), auth: $('auth'), ovStart: $('ovStart'), ovEnd: $('ovEnd') };
const coarseMq = matchMedia('(pointer:coarse)');

export { $, el, coarseMq };
