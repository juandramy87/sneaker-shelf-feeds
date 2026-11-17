# Sneaker Shelf · Feeds

Calendario mundial de lanzamientos de zapatillas y avisos de restock de Nike, generado por GitHub Actions y publicado en GitHub Pages. Lo usa la app Sneaker Shelf.

## Qué se publica (rama `gh-pages`)
- `calendario/<país>.json` y `calendario/<país>.ics`: lanzamientos próximos por país (us, ca, mx, gb, es, fr, de, it, pt, nl, be, pl, se, tr, jp, kr, sg, au, cn).
- `calendario/global.json`: todos juntos, con la lista de países de cada uno.
- `calendario/index.json`: totales por país y estado de cada fuente.
- `restock/<grupo>.json` (eu, us, jp, cn): tallas de Nike/Jordan que han vuelto a estar disponibles en las últimas 72 h.

Cada lanzamiento: `sku`, `nombre`, `marca`, `colorway`, `fecha` (ISO UTC, si hay hora), `dia`, `precio {valor, moneda}`, `metodo` (LEO = sorteo, DAN = orden de llegada), `imagen`, `tiendas [{nombre, url, tipo}]`, `fuentes [{nombre, url}]`.

## Fuentes
Nike SNKRS (feed público por país), Kicksfinder, Le Site de la Sneaker, Sneaker News, SneakerFiles, Sneaker Bar Detroit, Hypebeast y Sneakerjagers. Solo se toman hechos (nombre, código, fecha, precio, enlaces) y siempre se enlaza a la fuente. No se copian textos ni fotos de terceros.

## Cómo funciona
- `Calendario` (cada 3 h): `node src/calendario.mjs publicado`.
- `Restock` (cada 15 min): `node src/restock.mjs publicado`. Vigila los modelos de Nike vistos en el calendario (120 días) y los de `vigilar-manual.json`.
- `publicar.sh` sube `publicado/` a `gh-pages` como un único commit.

## Probar en local
```bash
node src/calendario.mjs publicado
node src/restock.mjs publicado
```
Node 22 o superior, sin dependencias.
