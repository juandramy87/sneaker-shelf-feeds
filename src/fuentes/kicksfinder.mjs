// Kicksfinder (base de datos de Sneaker News): API abierta de su web, todas las marcas, tiendas por región y hora.
// Listado: /api/products (ordenado por fecha, primero lo próximo). Detalle: /api/product/<slug>.
import { pedir, esperar, normalizarSku, horaLocalAUtc, hoyIso, diasAtras, precio } from '../util.mjs';
import { zonasDeRegion } from '../paises.mjs';

const BASE = 'https://admin.kicksfinder.com/api';
const MAX_DETALLES = 450;

export async function kicksfinder(log) {
  const desde = diasAtras(2);
  const lista = [];
  for (let page = 1; page <= 15; page++) {
    const d = await pedir(`${BASE}/products?perpage=100&page=${page}`);
    const datos = d.result?.data?.data || [];
    if (!datos.length) break;
    lista.push(...datos);
    const fechas = datos.map((x) => x.releaseDate).filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f) && !f.endsWith('-00'));
    if (fechas.length && fechas.every((f) => f < desde)) break;
    await esperar(600);
  }
  const proximos = lista.filter((x) => x.is_past_release !== '1' && (x.releaseDate || '') >= desde.slice(0, 7));
  const salida = [];
  let detalles = 0;
  for (const p of proximos) {
    const sku = normalizarSku(p.sku);
    const base = {
      fuente: 'kicksfinder',
      sku,
      nombre: (p.full_name || p.product_name || '').trim() || null,
      marca: p.brand_name === 'Jordan Brand' ? 'Jordan' : p.brand_name || null,
      colorway: null,
      dia: /-00$/.test(p.releaseDate || '') ? null : p.releaseDate || null,
      mes: /-00$/.test(p.releaseDate || '') ? (p.releaseDate || '').slice(0, 7) : null,
      fecha: null,
      precio: precio(p.price, 'USD'),
      zonas: [...new Set((p.show_regions || '').split('/').flatMap((r) => zonasDeRegion(r.trim())))],
      tiendas: [],
      url: `https://kicksfinder.com/${p.slug}`,
    };
    if (!base.zonas.length) base.zonas = ['us', 'na'];
    if (detalles < MAX_DETALLES && base.dia && base.dia >= hoyIso()) {
      try {
        const det = (await pedir(`${BASE}/product/${p.slug}`)).result?.product;
        detalles++;
        base.colorway = det?.color_text || null;
        for (const s of det?.sizes || []) {
          for (const reg of s.product_regions_rereleases || []) {
            const zonas = zonasDeRegion(reg.region);
            for (const t of reg.product_stockists || []) {
              const [dia, hora] = String(t.release_date || '').split(' ');
              const fecha = dia && hora && t.time && t.default_time_zone ? horaLocalAUtc(dia, hora.slice(0, 5), t.default_time_zone) : null;
              base.tiendas.push({ nombre: t.name, url: t.link, tipo: tipoLanzamiento(t.release_type), zonas, fecha, dia: dia || null });
            }
          }
          if (!base.sku && s.style_id) base.sku = normalizarSku(s.style_id);
        }
        const [dia, hora] = String(det?.current_release || '').split(' ');
        if (dia && hora && det?.current_time_zone && det?.current_display_release_time) base.fecha = horaLocalAUtc(dia, hora.slice(0, 5), det.current_time_zone);
        await esperar(350);
      } catch (e) {
        log(`kicksfinder detalle ${p.slug}: ${e.message}`);
      }
    }
    salida.push(base);
  }
  log(`kicksfinder: ${salida.length} próximos (${detalles} con detalle)`);
  return salida;
}

function tipoLanzamiento(t) {
  const s = String(t || '').toLowerCase();
  if (/raffle|draw/.test(s)) return 'sorteo';
  if (/fcfs|first come|standard|online/.test(s)) return 'llegada';
  if (/in.?store/.test(s)) return 'tienda';
  return s || null;
}
