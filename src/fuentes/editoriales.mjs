// Webs editoriales con datos estructurados en sus artículos o páginas de calendario.
// Solo se toman hechos (nombre, SKU, fecha, precio, tiendas) y siempre se guarda el enlace a la fuente.
import { pedir, esperar, normalizarSku, skuEnTexto, limpiarHtml, diaEnIngles, precio, diasAtras } from '../util.mjs';
import { zonasDeRegion } from '../paises.mjs';

const DESDE = () => diasAtras(2);

// Sneaker News: API de WordPress, categoría «Release Dates» (6300), widget «WHERE TO BUY».
export async function sneakernews(log) {
  const salida = [];
  for (let page = 1; page <= 4; page++) {
    const posts = await pedir(`https://sneakernews.com/wp-json/wp/v2/posts?categories=6300&per_page=50&page=${page}&_fields=link,title,date,content`);
    for (const p of posts) {
      const html = p.content?.rendered || '';
      const bloques = html.split(/class="prod-cat-row"/).slice(1);
      for (const b of bloques) {
        const nombre = limpiarHtml((b.match(/<h2>([\s\S]*?)<\/h2>/) || [])[1]);
        const sku = normalizarSku(limpiarHtml((b.match(/SKU:<\/span>\s*<strong>([^<]*)/) || [])[1]));
        const pr = limpiarHtml((b.match(/RETAIL PRICE:<\/span>\s*<strong>([^<]*)/) || [])[1]);
        const fe = limpiarHtml((b.match(/RELEASE DATE:<\/span>\s*<strong>([^<]*)/) || [])[1]);
        const dia = diaEnIngles(fe);
        if (!dia || dia < DESDE()) continue;
        const tiendas = [];
        for (const t of b.split(/class="prod-counrywise-tbl/).slice(1)) {
          const region = limpiarHtml((t.match(/cntry-title">([^<]*)/) || [])[1]);
          const zonas = zonasDeRegion(region);
          for (const fila of t.matchAll(/<a href="([^"]+)" class="release-store"[^>]*>([^<]+)<\/a>\s*<\/td>\s*<td class="release-type">([^<]*)/g)) {
            tiendas.push({ nombre: limpiarHtml(fila[2]), url: fila[1], tipo: /raffle|draw/i.test(fila[3]) ? 'sorteo' : 'llegada', zonas: zonas.length ? zonas : ['us', 'na'] });
          }
        }
        salida.push({ fuente: 'sneakernews', sku, nombre: nombre || limpiarHtml(p.title?.rendered), marca: null, colorway: null, dia, fecha: null, precio: precio(pr, 'USD'), zonas: ['us', 'na', 'ca'], tiendas, url: p.link });
      }
    }
    if (posts.length < 50) break;
    await esperar(800);
  }
  log(`sneakernews: ${salida.length}`);
  return salida;
}

// SneakerFiles: una sola página con todos los próximos lanzamientos.
export async function sneakerfiles(log) {
  const html = await pedir('https://www.sneakerfiles.com/release-dates/', { json: false });
  const salida = [];
  for (const art of html.split(/<article /).slice(1)) {
    const enlace = art.match(/<h3 class="entry-title"><a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    const fe = (art.match(/Release Date:\s*([^<]+)/) || [])[1];
    const dia = diaEnIngles(fe);
    if (!enlace || !dia || dia < DESDE()) continue;
    salida.push({
      fuente: 'sneakerfiles',
      sku: normalizarSku((art.match(/Style Code:\s*([^<]+)/) || [])[1]) || skuEnTexto(enlace[1]),
      nombre: limpiarHtml(enlace[2]),
      marca: null,
      colorway: limpiarHtml((art.match(/Color:\s*([^<]+)/) || [])[1]) || null,
      dia,
      fecha: null,
      precio: precio((art.match(/Price:\s*([^<]+)/) || [])[1], 'USD'),
      zonas: ['us', 'na', 'ca'],
      tiendas: [],
      url: enlace[1],
    });
  }
  log(`sneakerfiles: ${salida.length}`);
  return salida;
}

// Bloques «Color: … Style Code: … Release Date: … Price: …» dentro de un texto (Sneaker Bar Detroit).
function bloquesStyleCode(texto) {
  const res = [];
  const re = /([^.!?]{3,140}?)\s+Color:\s*(.+?)\s+Style Code:\s*([A-Z0-9-]+)\s+Release Date:\s*(.+?)\s+Price:\s*([$€£]?\s?[\d.,]+)/g;
  for (const m of texto.matchAll(re)) res.push({ nombre: m[1].trim(), colorway: m[2].trim(), sku: m[3], fecha: m[4], precio: m[5] });
  return res;
}

export async function sneakerbardetroit(log) {
  const salida = [];
  for (let page = 1; page <= 3; page++) {
    const posts = await pedir(`https://sneakerbardetroit.com/wp-json/wp/v2/posts?per_page=50&page=${page}&_fields=link,title,content`);
    for (const p of posts) {
      for (const b of bloquesStyleCode(limpiarHtml(p.content?.rendered))) {
        const dia = diaEnIngles(b.fecha);
        if (!dia || dia < DESDE()) continue;
        salida.push({ fuente: 'sneakerbardetroit', sku: normalizarSku(b.sku), nombre: b.nombre.replace(/^.*(?:page\.|releases?\.)\s*/i, ''), marca: null, colorway: b.colorway, dia, fecha: null, precio: precio(b.precio, 'USD'), zonas: ['us', 'na', 'ca'], tiendas: [], url: p.link });
      }
    }
    if (posts.length < 50) break;
    await esperar(800);
  }
  log(`sneakerbardetroit: ${salida.length}`);
  return salida;
}

// Hypebeast Footwear (RSS): bloques «Name: … SKU: … MSRP: … Release Date: …». Fecha mundial.
export async function hypebeast(log) {
  const xml = await pedir('https://hypebeast.com/footwear/feed', { json: false });
  const salida = [];
  for (const item of xml.split(/<item>/).slice(1)) {
    const enlace = (item.match(/<link>([^<]+)<\/link>/) || [])[1];
    const texto = limpiarHtml((item.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]>/) || item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]>/) || [])[1]);
    const m = texto.match(/Name:\s*(.+?)\s+(?:Colorway:\s*(.+?)\s+)?SKU:\s*(.+?)\s+(?:MSRP|Price):\s*(.+?)\s+Release Date:\s*(.+?)(?:\s+Where to Buy|$)/i);
    if (!m) continue;
    const dia = diaEnIngles(m[5]);
    if (!dia || dia < DESDE()) continue;
    for (const s of m[3].split(/[,/]/)) {
      salida.push({ fuente: 'hypebeast', sku: normalizarSku(s), nombre: m[1].trim(), marca: null, colorway: m[2]?.trim() || null, dia, fecha: null, precio: precio(m[4], 'USD'), zonas: null, tiendas: [], url: enlace });
    }
  }
  log(`hypebeast: ${salida.length}`);
  return salida;
}

// Sneakerjagers (NL/DE): datos de Next.js en la página de lanzamientos. No trae SKU: se busca en enlaces y títulos.
export async function sneakerjagers(log) {
  const salida = [];
  for (let page = 1; page <= 6; page++) {
    const html = await pedir(`https://www.sneakerjagers.com/de/releases${page > 1 ? `?page=${page}` : ''}`, { json: false });
    const m = html.match(/id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!m) break;
    const pp = JSON.parse(m[1]).props?.pageProps || {};
    const items = Object.values(pp.items || {}).flat();
    for (const it of items) {
      const enlaces = (it.links || []).map((l) => l.url).join(' ');
      const sku = skuEnTexto(`${it.slug || ''} ${enlaces} ${it.title || ''}`);
      if (!sku || it.is_tba) continue;
      salida.push({
        fuente: 'sneakerjagers',
        sku,
        nombre: it.title || null,
        marca: null,
        colorway: null,
        dia: null,
        fecha: it.availability_date ? new Date(it.availability_date).toISOString() : null,
        precio: it.price ? { valor: Number(it.price), moneda: it.currency || 'EUR' } : null,
        zonas: ['eu'],
        tiendas: (it.links || []).filter((l) => l.url).map((l) => ({ nombre: l.program_name || null, url: l.url, tipo: null, zonas: ['eu'] })),
        url: it.slug ? `https://www.sneakerjagers.com/de/r/${it.slug}` : 'https://www.sneakerjagers.com/de/releases',
      });
    }
    if (!pp.hasMorePages) break;
    await esperar(1000);
  }
  log(`sneakerjagers: ${salida.length}`);
  return salida;
}
