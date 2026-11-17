// Catálogo propio de zapatillas (para buscar en el móvil sin servidor ni pckt): Kicksfinder (≈38.000, con foto) y
// Le Site de la Sneaker (≈17.000, nombre completo con colorway y precio de salida en €), juntos por SKU.
// Formato compacto (filas): [sku, nombre, marca, colorway, año, precio de salida €, foto]. La foto de Kicksfinder va
// sin su prefijo común (FOTO_KF) para ocupar menos.
// Uso: node src/catalogo.mjs <carpeta de salida>
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pedir, esperar, normalizarSku, limpiarHtml } from './util.mjs';
import { fotoKicksfinder } from './fuentes/kicksfinder.mjs';

const SALIDA = process.argv[2] || 'publicado';
const FOTO_KF = 'https://s3.amazonaws.com/images.kicksfinder.com/products/thumbs/';
const marcaBonita = (m) => (m === 'Jordan Brand' ? 'Jordan' : m || '');

async function kicksfinder() {
  const filas = new Map();
  for (let page = 1; page <= 600; page++) {
    let d;
    try { d = await pedir(`https://admin.kicksfinder.com/api/products?perpage=100&page=${page}`); } catch (e) { console.log(`kicksfinder página ${page}: ${e.message}`); break; }
    const lista = d.result?.data?.data || [];
    if (!lista.length) break;
    for (const p of lista) {
      const sku = normalizarSku(p.sku);
      if (!sku || sku.length < 5) continue;
      const nombre = [String(p.full_name || p.product_name || '').trim(), String(p.product_nickname || '').trim()].filter(Boolean).join(' ');
      const foto = fotoKicksfinder(p.product_thumbnail);
      filas.set(sku, {
        sku, nombre, marca: marcaBonita(p.brand_name), colorway: '', anio: Number(p.releaseYear) || 0, retail: 0,
        foto: foto?.startsWith(FOTO_KF) ? foto.slice(FOTO_KF.length) : foto,
      });
    }
    if (page % 50 === 0) console.log(`kicksfinder: página ${page}, ${filas.size} modelos`);
    await esperar(250);
  }
  console.log(`kicksfinder: ${filas.size}`);
  return filas;
}

async function lesitedelasneaker() {
  const filas = new Map();
  for (let page = 1; page <= 400; page++) {
    let d;
    try { d = await pedir(`https://www.lesitedelasneaker.com/wp-json/wp/v2/sneakers_shoes?per_page=100&page=${page}&_fields=title,acf.sku-produit,acf.colorway,acf.date,acf.price`, { intentos: 2 }); } catch (e) { if (e.status === 400) break; console.log(`lsdls página ${page}: ${e.message}`); break; }
    if (!Array.isArray(d) || !d.length) break;
    for (const x of d) {
      const a = x.acf || {};
      const sku = normalizarSku(a['sku-produit']);
      if (!sku || sku.length < 5) continue;
      filas.set(sku, {
        nombre: limpiarHtml(x.title?.rendered).replace(/[«»]/g, '"').replace(/\s+/g, ' ').trim(),
        colorway: String(a.colorway || '').trim(),
        anio: Number(String(a.date || '').slice(0, 4)) || 0,
        retail: Number(String(a.price || '').replace(',', '.')) || 0,
      });
    }
    if (page % 40 === 0) console.log(`lsdls: página ${page}, ${filas.size} modelos`);
    await esperar(400);
  }
  console.log(`lesitedelasneaker: ${filas.size}`);
  return filas;
}

const MARCAS = [['Jordan', /jordan/i], ['Nike', /nike|dunk|air max|air force/i], ['adidas', /adidas|yeezy|samba|gazelle|campus/i], ['New Balance', /new balance/i], ['ASICS', /asics|gel-/i], ['Puma', /puma/i], ['Converse', /converse/i], ['Vans', /vans/i], ['Reebok', /reebok/i], ['Salomon', /salomon/i], ['HOKA', /hoka/i], ['Saucony', /saucony/i], ['On', /\bon running|cloudmonster|cloudtilt/i]];
const marcaDe = (nombre) => MARCAS.find(([, re]) => re.test(nombre))?.[0] || nombre.split(' ')[0];

async function main() {
  const [kf, ls] = await Promise.all([kicksfinder(), lesitedelasneaker()]);
  const todos = new Map(kf);
  for (const [sku, l] of ls) {
    const k = todos.get(sku);
    // Nombre: el de Le Site de la Sneaker, que lleva el colorway o el apodo («Panda», «Bred»…).
    if (k) todos.set(sku, { ...k, nombre: l.nombre || k.nombre, colorway: l.colorway, anio: k.anio || l.anio, retail: l.retail });
    else todos.set(sku, { sku, nombre: l.nombre, marca: marcaDe(l.nombre), colorway: l.colorway, anio: l.anio, retail: l.retail, foto: null });
  }
  const filas = [...todos.values()]
    .filter((m) => m.nombre)
    .sort((a, b) => b.anio - a.anio)
    .map((m) => [m.sku, m.nombre, m.marca, m.colorway, m.anio, m.retail, m.foto || '']);
  await mkdir(join(SALIDA, 'catalogo'), { recursive: true });
  const cuerpo = JSON.stringify({ version: 1, actualizado: new Date().toISOString(), fotoKf: FOTO_KF, columnas: ['sku', 'nombre', 'marca', 'colorway', 'anio', 'retail', 'foto'], modelos: filas });
  // Si una fuente ha fallado y el catálogo sale mucho más pequeño, no se publica (se queda el anterior).
  if (filas.length < 20000) { console.log(`catálogo demasiado pequeño (${filas.length}): no se publica`); process.exitCode = 1; return; }
  await writeFile(join(SALIDA, 'catalogo', 'catalogo.json'), cuerpo);
  await writeFile(join(SALIDA, 'catalogo', 'version.json'), JSON.stringify({ version: new Date().toISOString().slice(0, 10), total: filas.length, bytes: cuerpo.length }));
  console.log(`catálogo: ${filas.length} modelos, ${(cuerpo.length / 1e6).toFixed(1)} MB`);
}

main().catch((e) => { console.error(e); process.exit(1); });
