// Utilidades comunes: peticiones con reintentos, horas con zona horaria, SKU y textos.
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

export const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// GET con User-Agent de navegador, tiempo límite y reintentos ante 429/5xx.
export async function pedir(url, { json = true, cabeceras = {}, intentos = 3, pausa = 1500 } = {}) {
  let ultimo;
  for (let i = 0; i < intentos; i++) {
    try {
      const r = await fetch(url, {
        headers: { 'user-agent': UA, accept: json ? 'application/json' : '*/*', 'accept-language': 'en-US,en;q=0.9', ...cabeceras },
        signal: AbortSignal.timeout(25000),
      });
      if (r.ok) return json ? await r.json() : await r.text();
      ultimo = new Error(`HTTP ${r.status} ${url}`);
      ultimo.status = r.status;
      if (r.status !== 429 && r.status < 500) throw ultimo;
    } catch (e) {
      ultimo = e;
      if (e.status && e.status !== 429 && e.status < 500) throw e;
    }
    await esperar(pausa * (i + 1));
  }
  throw ultimo;
}

// Normaliza un código de estilo: «ix8180 001» → «IX8180-001».
export function normalizarSku(s) {
  if (!s) return null;
  const t = String(s).toUpperCase().trim().replace(/\s+/g, '-');
  return t.length >= 4 && t.length <= 24 ? t : null;
}

// Busca un código de estilo de Nike/Jordan (AA1234-123) o de otras marcas en un texto.
export function skuEnTexto(texto) {
  if (!texto) return null;
  const nike = String(texto).match(/\b([A-Z]{2}\d{4})[-_ ]?(\d{3})\b/i);
  if (nike) return `${nike[1]}-${nike[2]}`.toUpperCase();
  return null;
}

export function limpiarHtml(s) {
  return String(s ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#8217;|&#039;|&rsquo;|&#x27;/g, "'")
    .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;|&quot;|&#8243;/g, '"')
    .replace(/&#8211;|&#8212;|&ndash;|&mdash;/g, '-')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
}

// Desfase (ms) de una zona horaria en un instante dado.
function desfase(zona, instante) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: zona, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const p = Object.fromEntries(f.formatToParts(instante).map((x) => [x.type, x.value]));
  const comoUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return comoUtc - instante.getTime();
}

// «2026-11-27», «09:00», «Europe/Paris» → ISO en UTC.
export function horaLocalAUtc(dia, hora, zona) {
  const [y, m, d] = dia.split('-').map(Number);
  const [h, mi] = (hora || '00:00').split(':').map(Number);
  const aprox = new Date(Date.UTC(y, m - 1, d, h, mi));
  const t = aprox.getTime() - desfase(zona, aprox);
  return new Date(t - (desfase(zona, new Date(t)) - desfase(zona, aprox))).toISOString();
}

const MESES = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

// «November 21, 2026», «Nov 20, 2026», «November 21st» (+ año de referencia) → «2026-11-21».
export function diaEnIngles(texto, anioRef = new Date().getUTCFullYear()) {
  const m = String(texto || '').match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?/i);
  if (!m) return null;
  const mes = MESES[m[1].toLowerCase()];
  let anio = m[3] ? +m[3] : anioRef;
  if (!m[3]) {
    // Sin año: si la fecha ya pasó hace más de 2 meses, es del año siguiente.
    const hoy = new Date();
    const f = Date.UTC(anio, mes - 1, +m[2]);
    if (f < hoy.getTime() - 60 * 864e5) anio += 1;
  }
  return `${anio}-${String(mes).padStart(2, '0')}-${String(+m[2]).padStart(2, '0')}`;
}

// «$170», «170», «€139,99» → { valor, moneda }.
export function precio(texto, monedaPorDefecto) {
  if (texto == null || texto === '') return null;
  const s = String(texto);
  const n = s.match(/(\d+(?:[.,]\d{1,2})?)/);
  if (!n) return null;
  const valor = Number(n[1].replace(',', '.'));
  if (!valor) return null;
  const moneda = /\$/.test(s) ? 'USD' : /€|eur/i.test(s) ? 'EUR' : /£|gbp/i.test(s) ? 'GBP' : /¥|jpy/i.test(s) ? 'JPY' : monedaPorDefecto || null;
  return { valor, moneda };
}

export const hoyIso = () => new Date().toISOString().slice(0, 10);
export const diasAtras = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
