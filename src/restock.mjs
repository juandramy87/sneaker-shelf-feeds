// Restocks de Nike/Jordan talla a talla, cada 15–30 min.
// Lee datos/vigilar.json (lo genera el calendario) y vigilar-manual.json (modelos populares añadidos a mano),
// consulta deliver/available_gtins/v3 por modelo y grupo (US, EU, JP, CN) y compara con la pasada anterior.
// Uso: node src/restock.mjs <carpeta de salida>
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pedir, esperar, hoyIso } from './util.mjs';

const SALIDA = process.argv[2] || 'publicado';
const GRUPOS = ['EU', 'US', 'JP', 'CN'];
const MAX_POR_GRUPO = Number(process.env.MAX_POR_GRUPO || 160); // límite de consultas por grupo y pasada
const HORAS_EVENTOS = 72;
const disponible = (nivel) => nivel && nivel !== 'OOS';

const leer = async (ruta, porDefecto) => { try { return JSON.parse(await readFile(ruta, 'utf8')); } catch { return porDefecto; } };

async function main() {
  await mkdir(join(SALIDA, 'restock'), { recursive: true });
  const vigilar = { ...(await leer(join(SALIDA, 'datos', 'vigilar.json'), {})), ...(await leer('vigilar-manual.json', {})) };
  const tallas = await leer(join(SALIDA, 'datos', 'tallas.json'), {});
  const skus = Object.keys(vigilar).filter((s) => /^[A-Z]{2}\d{4}-\d{3}$/.test(s));
  const ahora = new Date().toISOString();
  const resumen = { actualizado: ahora, modelos: skus.length, grupos: {} };

  for (const grupo of GRUPOS) {
    const ruta = join(SALIDA, 'restock', `stock-${grupo.toLowerCase()}.json`);
    const anterior = await leer(ruta, { modelos: {}, cursor: 0 });
    const eventosRuta = join(SALIDA, 'restock', `${grupo.toLowerCase()}.json`);
    const previos = await leer(eventosRuta, { eventos: [] });
    const limite = new Date(Date.now() - HORAS_EVENTOS * 3600e3).toISOString();
    const eventos = previos.eventos.filter((e) => e.hora >= limite);
    const modelos = { ...anterior.modelos };
    // Rotación: si hay más modelos que el límite, cada pasada sigue donde lo dejó la anterior.
    const inicio = skus.length > MAX_POR_GRUPO ? (anterior.cursor || 0) % skus.length : 0;
    const tanda = skus.length > MAX_POR_GRUPO ? [...skus.slice(inicio), ...skus.slice(0, inicio)].slice(0, MAX_POR_GRUPO) : skus;
    let ok = 0, errores = 0, seguidos = 0;
    for (const sku of tanda) {
      try {
        const d = await pedir(`https://api.nike.com/deliver/available_gtins/v3?filter=styleColor(${sku})&filter=merchGroup(${grupo})`, { intentos: 2 });
        seguidos = 0;
        ok++;
        const ahoraNiveles = {};
        for (const o of d.objects || []) ahoraNiveles[o.gtin] = o.level || (o.available ? 'AVAILABLE' : 'OOS');
        const antes = modelos[sku]?.niveles;
        if (antes && Object.keys(ahoraNiveles).length) {
          const vuelven = Object.entries(ahoraNiveles).filter(([g, n]) => disponible(n) && !disponible(antes[g])).map(([g, n]) => ({ talla: tallas[sku]?.[g] || null, gtin: g, nivel: n }));
          const nadaAntes = !Object.values(antes).some(disponible);
          const lanzamiento = vigilar[sku]?.lanzamiento;
          const esLanzamiento = lanzamiento && Math.abs(new Date(lanzamiento).getTime() - Date.now()) < 36 * 3600e3;
          if (vuelven.length) {
            eventos.push({ sku, nombre: vigilar[sku]?.nombre || null, tipo: esLanzamiento ? 'lanzamiento' : nadaAntes ? 'restock' : 'tallas', tallas: vuelven, hora: ahora });
          }
        }
        if (Object.keys(ahoraNiveles).length) modelos[sku] = { niveles: ahoraNiveles, visto: ahora };
      } catch (e) {
        if (e.status === 404) { seguidos = 0; await esperar(200); continue; } // no se vende en ese grupo
        errores++;
        seguidos++;
        if (seguidos >= 6) { console.log(`${grupo}: 6 errores seguidos (${e.message}); paro este grupo`); break; }
      }
      await esperar(350);
    }
    for (const sku of Object.keys(modelos)) if (!vigilar[sku]) delete modelos[sku];
    await writeFile(ruta, JSON.stringify({ actualizado: ahora, cursor: (inicio + tanda.length) % Math.max(skus.length, 1), modelos }));
    eventos.sort((a, b) => b.hora.localeCompare(a.hora));
    await writeFile(eventosRuta, JSON.stringify({ version: 1, grupo, actualizado: ahora, eventos }));
    resumen.grupos[grupo] = { consultados: ok, errores, eventos72h: eventos.length };
    console.log(`${grupo}: ${ok} consultados, ${errores} errores, ${eventos.length} eventos en 72 h`);
  }
  await writeFile(join(SALIDA, 'restock', 'index.json'), JSON.stringify(resumen, null, 1));
  console.log(`hecho ${hoyIso()}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
