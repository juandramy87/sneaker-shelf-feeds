// Calendario desde el vigilante (Worker de Cloudflare, ver Sneaker Shelf/vigilante/servidor): descarga los
// calendario/<país>.json y .ics y el index.json que ya publica él, los comprueba y los deja en la carpeta de salida.
// Así la app sigue leyendo la misma dirección de GitHub Pages. Si algo no cuadra, sale con error y la acción usa el
// calendario antiguo (src/calendario.mjs) como respaldo.
// Uso: node src/desde-vigilante.mjs <carpeta de salida>
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const VIGILANTE = 'https://vigilante.vigilante-ss.workers.dev/calendario';
const SALIDA = process.argv[2] || 'publicado';
const PAISES = ['us', 'ca', 'mx', 'gb', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'be', 'pl', 'se', 'tr', 'jp', 'kr', 'sg', 'au', 'cn'];
const MAX_HORAS = 3; // un calendario más viejo que esto es que el vigilante se ha parado

async function pedir(ruta) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(`${VIGILANTE}/${ruta}`, { signal: AbortSignal.timeout(20000) });
      if (r.ok) return await r.text();
      if (r.status < 500) throw new Error(`HTTP ${r.status} en ${ruta}`);
    } catch (e) {
      if (i === 2) throw e;
    }
    await new Promise((r) => setTimeout(r, 3000 * (i + 1)));
  }
}

async function totalAnterior(pais) {
  try { return JSON.parse(await readFile(join(SALIDA, 'calendario', `${pais}.json`), 'utf8')).total ?? 0; } catch { return 0; }
}

const docs = {};
const ics = {};
for (const pais of PAISES) {
  const texto = await pedir(`${pais}.json`);
  const d = JSON.parse(texto);
  if (d.version !== 1 || d.pais !== pais || !Array.isArray(d.lanzamientos) || d.total !== d.lanzamientos.length) throw new Error(`${pais}.json no tiene el formato esperado`);
  const horas = (Date.now() - Date.parse(d.actualizado)) / 3.6e6;
  if (!(horas < MAX_HORAS)) throw new Error(`${pais}.json tiene ${horas.toFixed(1)} h`);
  const antes = await totalAnterior(pais);
  // Una caída brusca (menos de la mitad que lo publicado) huele a fallo de fuentes: mejor el respaldo.
  if (antes >= 10 && d.total < antes / 2) throw new Error(`${pais}: ${d.total} lanzamientos frente a ${antes} publicados`);
  docs[pais] = texto;
  ics[pais] = await pedir(`${pais}.ics`);
  if (!ics[pais].startsWith('BEGIN:VCALENDAR')) throw new Error(`${pais}.ics no es un calendario`);
}
const indice = JSON.parse(await pedir('index.json'));

await mkdir(join(SALIDA, 'calendario'), { recursive: true });
const mundial = new Map();
for (const pais of PAISES) {
  await writeFile(join(SALIDA, 'calendario', `${pais}.json`), docs[pais]);
  await writeFile(join(SALIDA, 'calendario', `${pais}.ics`), ics[pais]);
  for (const { tiendas, ...l } of JSON.parse(docs[pais]).lanzamientos) {
    const k = l.sku || `${l.nombre}:${l.dia}`;
    const m = mundial.get(k) || { ...l, paises: [] };
    m.paises.push(pais);
    mundial.set(k, m);
  }
  console.log(`→ ${pais}: ${JSON.parse(docs[pais]).total} lanzamientos`);
}
const global = [...mundial.values()].sort((a, b) => (a.fecha || `${a.dia}T23:59`).localeCompare(b.fecha || `${b.dia}T23:59`));
await writeFile(join(SALIDA, 'calendario', 'global.json'), JSON.stringify({ version: 1, actualizado: new Date().toISOString(), total: global.length, lanzamientos: global }));
await writeFile(join(SALIDA, 'calendario', 'index.json'), JSON.stringify({ ...indice, origen: 'vigilante' }, null, 1));
await writeFile(join(SALIDA, 'estado-calendario.txt'), `Desde el vigilante (${VIGILANTE}) ${new Date().toISOString()}\n`);
