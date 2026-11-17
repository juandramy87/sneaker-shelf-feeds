// Nike SNKRS (incluye Jordan): feed público de lanzamientos próximos por país.
// Endpoint interno de nike.com/launch; responde sin clave. Fecha buena: launchView.startEntryDate (UTC).
import { pedir, esperar, normalizarSku } from '../util.mjs';
import { PAISES } from '../paises.mjs';

const CANAL_SNKRS = '010794e5-35fe-4e32-aaff-cd2c74f89d61';

// Imagen del lanzamiento: la del carrusel del hilo que lleva el SKU en el nombre; si no, la de la portada.
function imagenDeHilo(o, sku) {
  const urls = [...new Set(JSON.stringify(o.publishedContent || {}).match(/https:\/\/static\.nike\.com\/a\/images\/[^"\\]+?\.(?:png|jpg|jpeg)/gi) || [])];
  const propia = urls.find((u) => u.toLowerCase().includes(sku.toLowerCase()) && /t_prod_ss|w_960/.test(u));
  const portada = o.publishedContent?.properties?.coverCard?.properties?.squarishURL;
  return propia || portada || urls.find((u) => /t_prod_ss/.test(u)) || null;
}

function urlFeed(mercado, idioma, anchor, version) {
  const f = [`marketplace(${mercado})`, `language(${idioma})`, 'upcoming(true)', `channelId(${CANAL_SNKRS})`];
  if (version === 'v3') f.push('exclusiveAccess(true,false)');
  return `https://api.nike.com/product_feed/threads/${version}/?anchor=${anchor}&count=50&${f.map((x) => `filter=${x}`).join('&')}`;
}

async function feedPais(mercado, idioma) {
  const objetos = [];
  for (const version of ['v2', 'v3']) {
    try {
      for (let anchor = 0; anchor < 300; anchor += 50) {
        const d = await pedir(urlFeed(mercado, idioma, anchor, version));
        objetos.push(...(d.objects || []));
        if (!d.pages?.next) break;
        await esperar(800);
      }
      return objetos;
    } catch (e) {
      if (version === 'v3') throw e;
      objetos.length = 0;
    }
  }
  return objetos;
}

export async function nike(log) {
  const salida = [];
  const tallas = {}; // sku → { gtin: talla } para los restocks
  for (const p of PAISES) {
    if (!p.nike) continue;
    const [mercado, idioma] = p.nike;
    try {
      const objetos = await feedPais(mercado, idioma);
      let n = 0;
      for (const o of objetos) {
        for (const pi of o.productInfo || []) {
          const mp = pi.merchProduct || {};
          if (mp.productType !== 'FOOTWEAR') continue;
          const sku = normalizarSku(mp.styleColor);
          const lv = pi.launchView || {};
          if (!sku) continue;
          const fecha = lv.startEntryDate || null;
          const pc = pi.productContent || {};
          const slug = pc.slug || o.publishedContent?.properties?.seo?.slug;
          salida.push({
            fuente: 'nike',
            sku,
            // Nombre limpio («NOCTA Air Modmax», sin «Zapatillas - Hombre»); si el hilo trae varias tallas de la misma
            // zapatilla (adulto, niño, bebé), se añade el subtítulo para distinguirlas.
            nombre: (pc.title && ((o.productInfo || []).filter((x) => x.productContent?.title === pc.title).length > 1 && pc.subtitle ? `${pc.title} · ${pc.subtitle}` : pc.title)) || pc.fullTitle || null,
            marca: /jordan/i.test(pc.fullTitle || '') ? 'Jordan' : 'Nike',
            colorway: pc.colorDescription || null,
            fecha,
            dia: fecha ? null : (mp.commerceStartDate || '').slice(0, 10) || null,
            precio: pi.merchPrice ? { valor: pi.merchPrice.currentPrice ?? pi.merchPrice.fullPrice, moneda: pi.merchPrice.currency } : null,
            metodo: lv.method || null, // LEO = sorteo, DAN = orden de llegada
            paises: [p.codigo],
            tiendas: [{ nombre: 'Nike SNKRS', url: slug ? `https://www.nike.com/${p.codigo === 'us' ? '' : p.codigo + '/'}launch/t/${slug}` : `https://www.nike.com/${p.codigo === 'us' ? '' : p.codigo + '/'}launch`, tipo: lv.method === 'LEO' ? 'sorteo' : lv.method === 'DAN' ? 'llegada' : null, paises: [p.codigo] }],
            url: `https://www.nike.com/${p.codigo === 'us' ? '' : p.codigo + '/'}launch`,
            imagen: imagenDeHilo(o, sku),
            genero: mp.genders || null,
          });
          n++;
          if (p.stock && pi.skus) {
            const g = (tallas[sku] ??= {});
            for (const s of pi.skus) if (s.gtin && s.nikeSize) g[s.gtin] = s.countrySpecifications?.[0]?.localizedSize || s.nikeSize;
          }
        }
      }
      log(`nike ${p.codigo}: ${n}`);
    } catch (e) {
      log(`nike ${p.codigo}: ERROR ${e.message}`);
    }
    await esperar(1500);
  }
  return { avistamientos: salida, tallas };
}
