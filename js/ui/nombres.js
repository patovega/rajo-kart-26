// Nombre del jugador: limpieza (cleanName), normalización (norm) y filtro (nombreValido): nombre y apellido, sin números, animales, emojis ni lo que diga nombres_prohibidos.json.


const cleanName = v => v.replace(/[|\[\]<>\r\n]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 20);
// Filtro de nombres: nombre y apellido; no puede coincidir con nombres_prohibidos.json; sin palabras de animales (el apellido "León" sí se permite)
let LISTA_NOMBRES = null;      // se carga desde nombres_prohibidos.json al abrir la página
fetch('nombres_prohibidos.json', { cache: 'no-store' }).then(r => r.json()).then(j => { LISTA_NOMBRES = j; }).catch(() => {});
const ANIMALES = ['perro','perra','gato','gata','vaca','toro','cerdo','cerda','chancho','cabra','oveja','caballo','burro','mula','gallina','gallo','pavo','conejo','raton','rata','lobo','zorro','oso','osa','tigre','elefante','jirafa','mono','gorila','cebra','hipopotamo','rinoceronte','ballena','delfin','tiburon','pez','sapo','rana','lagarto','lagartija','cocodrilo','serpiente','culebra','vibora','aguila','buho','paloma','loro','perico','gorrion','pajaro','ardilla','castor','nutria','foca','morsa','pinguino','camello','llama','alpaca','vicuna','pollo','hormiga','abeja','mosca','arana','mariposa','grillo','escarabajo','pulga','piojo','gusano','caracol','zancudo','mosquito','cucaracha','pulpo','calamar','medusa','cangrejo','langosta','tortuga','iguana','camaleon','dragon','topo','erizo','puma','jaguar','pantera','hiena','chacal','coyote','bisonte','bufalo','antilope','ciervo','venado','alce','reno','cuervo','buitre','halcon','gaviota','tucan','pitbull','bulldog'];
const norm = t => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const nombreValido = n => {
  const t = norm(n), palabras = t.split(/[^a-z0-9ñ]+/).filter(Boolean);
  if (t === 'pato') return true;                                                           // excepción: "pato" solo sí se permite (pato carlos, pato carlo, no)
  if (/\d/.test(n)) return false;                                                        // sin números
  if (palabras.length < 2) return false;                                                   // nombre y apellido
  if (t.replace(/\s/g, '').length < 5) return false;                                       // menos de 5 letras
  if (palabras.some(w => ANIMALES.includes(w))) return false;                              // palabras de animales
  if (/\bpato carlos?\b/.test(t)) return false;                                            // "pato" es diminutivo de Patricio: solo se bloquean "pato carlo" y "pato carlos"
  if (/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}️‍]/u.test(n)) return false;         // emojis
  if (/\b(x+d+|x+p+)\b/.test(t)) return false;                                             // xd, xp, xdd...
  if (/(.)\1{3,}/.test(t.replace(/\s/g, ''))) return false;                              // letras repetidas: xxxx, aaaa
  const LN = LISTA_NOMBRES; if (!LN) return true;                                            // lista aún no cargada
  const enLista = (arr) => arr.some(x => t.includes(norm(x)));
  const nombres = Object.values(LN.nombres).flat();
  if (enLista(nombres) || enLista(LN.localidades)) return false;
  const pal = [].concat(...Object.entries(LN.palabras_prohibidas).filter(([k]) => k !== 'exactas').map(([, v]) => v));
  if ((LN.palabras_prohibidas.exactas || []).some(w => palabras.includes(norm(w)))) return false;      // solo palabra completa
  if (pal.some(p => p.includes(' ') || norm(p).length >= 4 ? t.includes(norm(p)) : palabras.includes(norm(p)))) return false;      // 4 letras o más: dentro del nombre; 3 o menos: palabra completa
  const frases = [].concat(...Object.entries(LN.frases_prohibidas).filter(([k]) => k !== 'regex_sugeridas').map(([, v]) => v));
  if (frases.some(f => t.includes(norm(f)))) return false;
  if ((LN.frases_prohibidas.regex_sugeridas || []).some(r => new RegExp(r).test(t))) return false;
  const emo = [].concat(...Object.entries(LN.emoticones_prohibidos).filter(([k, v]) => Array.isArray(v) && !k.startsWith('regex')).map(([, v]) => v));
  const low = n.toLowerCase();
  if (emo.some(e => low.includes(e) || (/^[a-z]+$/.test(e) && palabras.includes(e)))) return false;
  return true;
};

export { cleanName, norm, nombreValido };
