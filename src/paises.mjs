// Países con feed propio. «nike» es [marketplace, idioma] del feed SNKRS (null si Nike no publica ahí).
// «stock» es el merchGroup de Nike para los restocks. «zonas» agrupa a los países que comparten fuentes.
export const PAISES = [
  { codigo: 'us', nombre: 'United States', moneda: 'USD', huso: 'America/New_York', nike: ['US', 'en'], stock: 'US', zonas: ['us', 'na'] },
  { codigo: 'ca', nombre: 'Canada', moneda: 'CAD', huso: 'America/Toronto', nike: null, stock: 'US', zonas: ['ca', 'na'] },
  { codigo: 'mx', nombre: 'México', moneda: 'MXN', huso: 'America/Mexico_City', nike: ['MX', 'es-419'], stock: 'US', zonas: ['mx'] },
  { codigo: 'gb', nombre: 'United Kingdom', moneda: 'GBP', huso: 'Europe/London', nike: ['GB', 'en-GB'], stock: 'EU', zonas: ['gb', 'eu'] },
  { codigo: 'es', nombre: 'España', moneda: 'EUR', huso: 'Europe/Madrid', nike: ['ES', 'es-ES'], stock: 'EU', zonas: ['eu'] },
  { codigo: 'fr', nombre: 'France', moneda: 'EUR', huso: 'Europe/Paris', nike: ['FR', 'fr'], stock: 'EU', zonas: ['eu', 'fr'] },
  { codigo: 'de', nombre: 'Deutschland', moneda: 'EUR', huso: 'Europe/Berlin', nike: ['DE', 'de'], stock: 'EU', zonas: ['eu'] },
  { codigo: 'it', nombre: 'Italia', moneda: 'EUR', huso: 'Europe/Rome', nike: ['IT', 'it'], stock: 'EU', zonas: ['eu'] },
  { codigo: 'pt', nombre: 'Portugal', moneda: 'EUR', huso: 'Europe/Lisbon', nike: ['PT', 'pt-PT'], stock: 'EU', zonas: ['eu'] },
  { codigo: 'nl', nombre: 'Nederland', moneda: 'EUR', huso: 'Europe/Amsterdam', nike: ['NL', 'nl'], stock: 'EU', zonas: ['eu'] },
  { codigo: 'be', nombre: 'Belgique', moneda: 'EUR', huso: 'Europe/Brussels', nike: ['BE', 'fr'], stock: 'EU', zonas: ['eu'] },
  { codigo: 'pl', nombre: 'Polska', moneda: 'PLN', huso: 'Europe/Warsaw', nike: ['PL', 'pl'], stock: 'EU', zonas: ['eu'] },
  { codigo: 'se', nombre: 'Sverige', moneda: 'SEK', huso: 'Europe/Stockholm', nike: ['SE', 'en-GB'], stock: 'EU', zonas: ['eu'] },
  { codigo: 'tr', nombre: 'Türkiye', moneda: 'TRY', huso: 'Europe/Istanbul', nike: ['TR', 'tr'], stock: null, zonas: [] },
  { codigo: 'jp', nombre: '日本', moneda: 'JPY', huso: 'Asia/Tokyo', nike: ['JP', 'ja'], stock: 'JP', zonas: ['asia', 'jp'] },
  { codigo: 'kr', nombre: '대한민국', moneda: 'KRW', huso: 'Asia/Seoul', nike: ['KR', 'ko'], stock: null, zonas: ['asia'] },
  { codigo: 'sg', nombre: 'Singapore', moneda: 'SGD', huso: 'Asia/Singapore', nike: ['SG', 'en-GB'], stock: null, zonas: ['asia'] },
  { codigo: 'au', nombre: 'Australia', moneda: 'AUD', huso: 'Australia/Sydney', nike: ['AU', 'en-GB'], stock: null, zonas: ['au'] },
  { codigo: 'cn', nombre: '中国', moneda: 'CNY', huso: 'Asia/Shanghai', nike: ['CN', 'zh-Hans'], stock: 'CN', zonas: ['asia', 'cn'] },
];

// Fuentes de terceros sin país concreto: a qué zonas aplican.
export const ZONAS_FUENTE = {
  kicksfinder: null, // trae regiones propias por lanzamiento
  lesitedelasneaker: ['eu', 'gb'],
  sneakerjagers: ['eu', 'gb'],
  sneakernews: ['us', 'na', 'ca'],
  sneakerfiles: ['us', 'na', 'ca'],
  sneakerbardetroit: ['us', 'na', 'ca'],
  hypebeast: null, // fecha mundial
};

// Región de Kicksfinder («US», «Europe», «Asia», «UK», «Canada»…) → zonas.
export function zonasDeRegion(region) {
  const r = String(region || '').toLowerCase();
  const z = [];
  if (/\bus\b|united states|usa|north america/.test(r)) z.push('us', 'na');
  if (/canada/.test(r)) z.push('ca', 'na');
  if (/europe|\beu\b/.test(r)) z.push('eu', 'gb');
  if (/\buk\b|united kingdom|britain/.test(r)) z.push('gb');
  if (/asia/.test(r)) z.push('asia');
  if (/japan/.test(r)) z.push('jp', 'asia');
  if (/china/.test(r)) z.push('cn');
  if (/australia/.test(r)) z.push('au');
  if (/mexico/.test(r)) z.push('mx');
  if (/global|worldwide/.test(r)) z.push('us', 'na', 'ca', 'eu', 'gb', 'asia', 'au', 'mx', 'jp', 'cn');
  return z;
}
