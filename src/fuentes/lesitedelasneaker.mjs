// Le Site de la Sneaker (Francia): API REST de WordPress, tipo «sneakers_shoes», 17.000+ fichas.
// La API no filtra por fecha de salida: se pagina por fecha de modificación y se filtra aquí.
import { pedir, esperar, normalizarSku, horaLocalAUtc, diasAtras, limpiarHtml, precio } from '../util.mjs';

const BASE = 'https://www.lesitedelasneaker.com/wp-json/wp/v2/sneakers_shoes';

export async function lesitedelasneaker(log) {
  const desde = diasAtras(2);
  const limite = diasAtras(150);
  const salida = [];
  for (let page = 1; page <= 12; page++) {
    const d = await pedir(`${BASE}?per_page=100&page=${page}&orderby=modified&order=desc&_fields=id,link,title,modified,acf`);
    if (!Array.isArray(d) || !d.length) break;
    for (const x of d) {
      const a = x.acf || {};
      const m = String(a.date || '').match(/^(\d{4})\/(\d{2})\/(\d{2})(?:\s+(\d{2}:\d{2}))?/);
      if (!m) continue;
      const dia = `${m[1]}-${m[2]}-${m[3]}`;
      if (dia < desde) continue;
      const tiendas = [];
      for (const g of a.repeater_stockists || []) {
        if (/marketplace/i.test(g.group_name || '')) continue; // reventa, no lanzamiento
        for (const t of g.repeater_stockist || []) {
          if (!t.url) continue;
          tiendas.push({ nombre: t.stockist ? `#${t.stockist}` : null, url: t.url, tipo: null, zonas: ['eu'], dia: null });
        }
      }
      salida.push({
        fuente: 'lesitedelasneaker',
        sku: normalizarSku(a['sku-produit']),
        nombre: limpiarHtml(x.title?.rendered) || null,
        marca: null,
        colorway: a.colorway || null,
        dia: m[4] ? null : dia,
        fecha: m[4] ? horaLocalAUtc(dia, m[4], 'Europe/Paris') : null,
        precio: precio(a.price, 'EUR'),
        zonas: ['eu', 'gb'],
        tiendas,
        url: x.link,
      });
    }
    if (d.every((x) => (x.modified || '').slice(0, 10) < limite)) break;
    await esperar(700);
  }
  // Nombres de las tiendas (taxonomía «stockist»), de 100 en 100.
  const ids = [...new Set(salida.flatMap((x) => x.tiendas.map((t) => t.nombre).filter((n) => n?.startsWith('#')).map((n) => n.slice(1))))];
  const nombres = {};
  for (let i = 0; i < ids.length; i += 100) {
    try {
      const d = await pedir(`https://www.lesitedelasneaker.com/wp-json/wp/v2/stockist?include=${ids.slice(i, i + 100).join(',')}&per_page=100&_fields=id,name`);
      for (const t of d) nombres[t.id] = limpiarHtml(t.name);
    } catch (e) { log(`lesitedelasneaker tiendas: ${e.message}`); }
  }
  for (const x of salida) for (const t of x.tiendas) if (t.nombre?.startsWith('#')) t.nombre = nombres[t.nombre.slice(1)] || null;
  log(`lesitedelasneaker: ${salida.length}`);
  return salida;
}
