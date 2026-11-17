// Genera el calendario mundial: lee todas las fuentes, junta por SKU y escribe un JSON y un .ics por país.
// Uso: node src/calendario.mjs <carpeta de salida>
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PAISES } from './paises.mjs';
import { nike, imagenNike } from './fuentes/nike.mjs';
import { kicksfinder } from './fuentes/kicksfinder.mjs';
import { lesitedelasneaker } from './fuentes/lesitedelasneaker.mjs';
import { sneakernews, sneakerfiles, sneakerbardetroit, hypebeast, sneakerjagers } from './fuentes/editoriales.mjs';
import { diasAtras, hoyIso } from './util.mjs';

const SALIDA = process.argv[2] || 'publicado';
const PRIORIDAD = ['nike', 'kicksfinder', 'lesitedelasneaker', 'sneakerjagers', 'sneakernews', 'sneakerfiles', 'sneakerbardetroit', 'hypebeast'];
const NOMBRES = {
  nike: 'Nike SNKRS', kicksfinder: 'Kicksfinder', lesitedelasneaker: 'Le Site de la Sneaker', sneakerjagers: 'Sneakerjagers',
  sneakernews: 'Sneaker News', sneakerfiles: 'SneakerFiles', sneakerbardetroit: 'Sneaker Bar Detroit', hypebeast: 'Hypebeast',
};

const registro = [];
const log = (m) => { registro.push(m); console.log(m); };

async function ejecutar(nombre, fn, estado) {
  const t = Date.now();
  try {
    const r = await fn(log);
    const lista = Array.isArray(r) ? r : r.avistamientos;
    estado[nombre] = { ok: true, elementos: lista.length, segundos: Math.round((Date.now() - t) / 1000) };
    return r;
  } catch (e) {
    estado[nombre] = { ok: false, error: String(e.message || e).slice(0, 200), segundos: Math.round((Date.now() - t) / 1000) };
    log(`${nombre}: ERROR ${e.message}`);
    return [];
  }
}

const aplica = (a, pais) => {
  if (a.paises) return a.paises.includes(pais.codigo);
  if (a.zonas == null) return true;
  return a.zonas.some((z) => pais.zonas.includes(z));
};
const tiendaAplica = (t, pais) => (t.paises ? t.paises.includes(pais.codigo) : !t.zonas || t.zonas.some((z) => pais.zonas.includes(z)));
const orden = (a) => { const i = PRIORIDAD.indexOf(a.fuente); return i < 0 ? 99 : i; };
const diaDe = (x) => (x.fecha ? x.fecha.slice(0, 10) : x.dia);

function fusionar(grupo, pais) {
  const g = [...grupo].sort((a, b) => orden(a) - orden(b));
  const primero = (campo) => g.find((x) => x[campo])?.[campo] ?? null;
  // Fecha: la de la fuente de más prioridad con hora; si no, la de una tienda del país; si no, el día.
  let fecha = g.find((x) => x.fecha)?.fecha ?? null;
  if (!fecha) for (const x of g) for (const t of x.tiendas || []) if (!fecha && t.fecha && tiendaAplica(t, pais)) fecha = t.fecha;
  const dia = fecha ? fecha.slice(0, 10) : primero('dia');
  const precioLocal = g.find((x) => x.precio?.moneda === pais.moneda)?.precio;
  const tiendas = [];
  const vistas = new Set();
  for (const x of g) for (const t of x.tiendas || []) {
    if (!t.url || !tiendaAplica(t, pais) || vistas.has(t.url)) continue;
    vistas.add(t.url);
    tiendas.push({ nombre: t.nombre || null, url: t.url, tipo: t.tipo || null, ...(t.fecha ? { fecha: t.fecha } : {}) });
  }
  const sku = g[0].sku;
  const marca = primero('marca') || adivinarMarca(primero('nombre'));
  return {
    sku,
    nombre: primero('nombre'),
    marca,
    colorway: primero('colorway'),
    fecha, // ISO UTC si se conoce la hora
    dia, // AAAA-MM-DD
    precio: precioLocal || primero('precio'),
    metodo: g.find((x) => x.metodo)?.metodo ?? null,
    imagen: g.find((x) => x.imagen)?.imagen ?? (sku && /nike|jordan/i.test(marca || '') ? imagenNike(sku) : null),
    tiendas,
    fuentes: [...new Map(g.map((x) => [x.fuente, { nombre: NOMBRES[x.fuente] || x.fuente, url: x.url }])).values()],
  };
}

function adivinarMarca(nombre) {
  const n = String(nombre || '').toLowerCase();
  for (const [m, re] of [['Jordan', /jordan/], ['Nike', /nike|air max|air force|dunk|kobe|lebron|kd \d|sb /], ['adidas', /adidas|yeezy|samba|gazelle|campus|superstar/], ['New Balance', /new balance|\bnb\b/], ['ASICS', /asics|gel-/], ['Puma', /puma/], ['Converse', /converse|chuck/], ['Vans', /vans/], ['Reebok', /reebok/], ['Salomon', /salomon/], ['HOKA', /hoka/], ['On', /\bon running|cloud/], ['Saucony', /saucony/]]) if (re.test(n)) return m;
  return null;
}

function ics(pais, lista) {
  const esc = (s) => String(s || '').replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
  const ahora = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lineas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Sneaker Shelf//Lanzamientos//ES', `X-WR-CALNAME:Sneaker releases ${pais.codigo.toUpperCase()}`, 'CALSCALE:GREGORIAN'];
  for (const l of lista) {
    if (!l.dia) continue;
    lineas.push('BEGIN:VEVENT', `UID:${(l.sku || l.nombre || '').replace(/\W/g, '')}-${pais.codigo}@sneakershelf`, `DTSTAMP:${ahora}`);
    if (l.fecha) {
      const ini = l.fecha.replace(/[-:]/g, '').replace(/\.\d+/, '');
      const fin = new Date(new Date(l.fecha).getTime() + 30 * 60000).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
      lineas.push(`DTSTART:${ini}`, `DTEND:${fin}`);
    } else lineas.push(`DTSTART;VALUE=DATE:${l.dia.replace(/-/g, '')}`);
    lineas.push(`SUMMARY:${esc(l.nombre)}${l.sku ? esc(` (${l.sku})`) : ''}`);
    const desc = [l.colorway, l.precio ? `${l.precio.valor} ${l.precio.moneda}` : null, ...l.tiendas.slice(0, 5).map((t) => `${t.nombre || 'Tienda'}: ${t.url}`)].filter(Boolean).join('\n');
    if (desc) lineas.push(`DESCRIPTION:${esc(desc)}`);
    if (l.tiendas[0]) lineas.push(`URL:${l.tiendas[0].url}`);
    lineas.push('END:VEVENT');
  }
  lineas.push('END:VCALENDAR');
  return lineas.map((x) => (x.length > 74 ? x.match(/.{1,74}/g).join('\r\n ') : x)).join('\r\n') + '\r\n';
}

async function main() {
  const estado = {};
  const r = await Promise.all([
    ejecutar('nike', nike, estado),
    ejecutar('kicksfinder', kicksfinder, estado),
    ejecutar('lesitedelasneaker', lesitedelasneaker, estado),
    ejecutar('sneakernews', sneakernews, estado),
    ejecutar('sneakerfiles', sneakerfiles, estado),
    ejecutar('sneakerbardetroit', sneakerbardetroit, estado),
    ejecutar('hypebeast', hypebeast, estado),
    ejecutar('sneakerjagers', sneakerjagers, estado),
  ]);
  const [rNike, ...resto] = r;
  const todos = [...(rNike.avistamientos || []), ...resto.flat()];
  const desde = diasAtras(1);
  const hasta = new Date(Date.now() + 400 * 864e5).toISOString().slice(0, 10);
  const validos = todos.filter((a) => a.nombre && (a.sku || a.fuente !== 'hypebeast') && (diaDe(a) ? diaDe(a) >= desde && diaDe(a) <= hasta : !!a.mes));

  await mkdir(join(SALIDA, 'calendario'), { recursive: true });
  await mkdir(join(SALIDA, 'datos'), { recursive: true });
  const indice = [];
  const mundial = new Map();
  for (const pais of PAISES) {
    const grupos = new Map();
    for (const a of validos) {
      if (!aplica(a, pais)) continue;
      const clave = a.sku || `${a.fuente}:${a.nombre.toLowerCase()}:${diaDe(a)}`;
      (grupos.get(clave) || grupos.set(clave, []).get(clave)).push(a);
    }
    const lista = [...grupos.values()].map((g) => fusionar(g, pais)).filter((l) => l.dia).sort((a, b) => (a.fecha || `${a.dia}T23:59`).localeCompare(b.fecha || `${b.dia}T23:59`));
    for (const l of lista) {
      const k = l.sku || `${l.nombre}:${l.dia}`;
      const m = mundial.get(k) || { ...l, paises: [] };
      m.paises.push(pais.codigo);
      mundial.set(k, m);
    }
    const doc = { version: 1, pais: pais.codigo, nombre: pais.nombre, moneda: pais.moneda, huso: pais.huso, actualizado: new Date().toISOString(), total: lista.length, lanzamientos: lista };
    await writeFile(join(SALIDA, 'calendario', `${pais.codigo}.json`), JSON.stringify(doc));
    await writeFile(join(SALIDA, 'calendario', `${pais.codigo}.ics`), ics(pais, lista));
    indice.push({ pais: pais.codigo, nombre: pais.nombre, total: lista.length });
    log(`→ ${pais.codigo}: ${lista.length} lanzamientos`);
  }
  const global = [...mundial.values()].map(({ tiendas, ...x }) => x).sort((a, b) => (a.fecha || `${a.dia}T23:59`).localeCompare(b.fecha || `${b.dia}T23:59`));
  await writeFile(join(SALIDA, 'calendario', 'global.json'), JSON.stringify({ version: 1, actualizado: new Date().toISOString(), total: global.length, lanzamientos: global }));

  // Modelos de Nike que vigila el restock: todo lo visto en los últimos 120 días (se acumula entre ejecuciones).
  let vigilar = {};
  try { vigilar = JSON.parse(await readFile(join(SALIDA, 'datos', 'vigilar.json'), 'utf8')); } catch {}
  const limite = diasAtras(120);
  for (const a of rNike.avistamientos || []) {
    const v = (vigilar[a.sku] ??= { nombre: a.nombre, visto: hoyIso(), lanzamiento: diaDe(a) });
    v.visto = hoyIso();
    v.lanzamiento = diaDe(a) || v.lanzamiento;
    v.nombre = v.nombre || a.nombre;
  }
  for (const [sku, v] of Object.entries(vigilar)) if (v.visto < limite) delete vigilar[sku];
  await writeFile(join(SALIDA, 'datos', 'vigilar.json'), JSON.stringify(vigilar));
  let tallas = {};
  try { tallas = JSON.parse(await readFile(join(SALIDA, 'datos', 'tallas.json'), 'utf8')); } catch {}
  for (const [sku, t] of Object.entries(rNike.tallas || {})) tallas[sku] = { ...(tallas[sku] || {}), ...t };
  for (const sku of Object.keys(tallas)) if (!vigilar[sku]) delete tallas[sku];
  await writeFile(join(SALIDA, 'datos', 'tallas.json'), JSON.stringify(tallas));

  await writeFile(join(SALIDA, 'calendario', 'index.json'), JSON.stringify({ version: 1, actualizado: new Date().toISOString(), paises: indice, fuentes: estado }, null, 1));
  await writeFile(join(SALIDA, 'estado-calendario.txt'), registro.join('\n') + '\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
