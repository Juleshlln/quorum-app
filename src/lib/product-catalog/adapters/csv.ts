/**
 * Adapter CSV : parse un fichier CSV/TSV avec autodetection du séparateur.
 *
 * Mapping souple :
 * - reconnait les colonnes "id / sku / gtin", "title / name / product_name",
 *   "brand", "link / url", "image_link / image", "category / google_product_category",
 *   "price", "availability", "description".
 * - tolère les en-têtes en français : "nom", "marque", "catégorie", "prix", etc.
 * - csvText doit être en UTF-8 (les routes API doivent décoder en amont).
 */

import type { RawProduct } from '../types';
import { trimOrNull } from '../normalize';

const HEADER_ALIASES: Array<{ field: keyof FieldMap; aliases: string[] }> = [
  {
    field: 'external_ref',
    aliases: ['id', 'product_id', 'item_id', 'sku', 'gtin', 'gtin13', 'mpn', 'reference', 'ref', 'référence'],
  },
  {
    field: 'product_name',
    aliases: ['title', 'name', 'product_name', 'nom', 'libellé', 'libelle', 'product_title'],
  },
  {
    field: 'brand_name',
    aliases: ['brand', 'marque', 'manufacturer', 'fabricant'],
  },
  {
    field: 'sku',
    aliases: ['sku', 'reference', 'référence', 'mpn'],
  },
  {
    field: 'product_url',
    aliases: ['link', 'url', 'product_url', 'lien', 'page_url'],
  },
  {
    field: 'image_url',
    aliases: ['image_link', 'image', 'image_url', 'img', 'visual_url'],
  },
  {
    field: 'category_path',
    aliases: ['category', 'categorie', 'catégorie', 'product_type', 'google_product_category', 'breadcrumb'],
  },
  {
    field: 'price',
    aliases: ['price', 'prix', 'price_amount'],
  },
  {
    field: 'currency',
    aliases: ['currency', 'devise', 'price_currency'],
  },
  {
    field: 'availability',
    aliases: ['availability', 'disponibilité', 'disponibilite', 'stock', 'in_stock'],
  },
  {
    field: 'description',
    aliases: ['description', 'descr', 'short_description', 'description_courte'],
  },
];

type FieldMap = {
  external_ref: number;
  product_name: number;
  brand_name: number;
  sku: number;
  product_url: number;
  image_url: number;
  category_path: number;
  price: number;
  currency: number;
  availability: number;
  description: number;
};

export type CsvAdapterArgs = {
  csvText: string;
  /** Si fourni, on impose le séparateur ('comma' | 'semicolon' | 'tab'). Sinon autodétection. */
  delimiter?: 'comma' | 'semicolon' | 'tab';
};

export function collectCsvProducts(args: CsvAdapterArgs): RawProduct[] {
  const text = args.csvText.replace(/^﻿/, ''); // strip BOM
  if (!text.trim()) return [];

  const delimiter = resolveDelimiter(text, args.delimiter);
  const rows = parseCsv(text, delimiter);
  if (rows.length < 2) return [];

  const header = rows[0].map((cell) => cell.trim().toLowerCase());
  const fieldMap = mapHeaderToFields(header);
  if (fieldMap.product_name < 0 && fieldMap.external_ref < 0) {
    throw new Error(
      'Le CSV doit contenir au minimum une colonne "title"/"name" ou "id"/"sku" pour identifier le produit.',
    );
  }

  const products: RawProduct[] = [];
  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (row.length === 0 || row.every((cell) => !cell.trim())) continue;

    const product_name = pick(row, fieldMap.product_name);
    const fallbackRef = pick(row, fieldMap.external_ref) || pick(row, fieldMap.product_url) || product_name;
    const external_ref = trimOrNull(fallbackRef);
    if (!external_ref) continue;
    if (!product_name) continue;

    const price = parseCsvNumber(pick(row, fieldMap.price));

    products.push({
      external_ref,
      product_name,
      brand_name: pick(row, fieldMap.brand_name),
      sku: pick(row, fieldMap.sku),
      product_url: pick(row, fieldMap.product_url),
      image_url: pick(row, fieldMap.image_url),
      description: pick(row, fieldMap.description),
      category_path: pick(row, fieldMap.category_path),
      attributes: {},
      price_amount: price,
      price_currency: pick(row, fieldMap.currency),
      availability: pick(row, fieldMap.availability),
    });
  }
  return products;
}

function pick(row: string[], index: number): string | null {
  if (index < 0 || index >= row.length) return null;
  const value = row[index];
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed.length === 0 ? null : trimmed;
}

function parseCsvNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[^\d,.\-]/g, '').replace(/,/g, '.');
  if (!cleaned) return null;
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

function mapHeaderToFields(header: string[]): FieldMap {
  const map: FieldMap = {
    external_ref: -1,
    product_name: -1,
    brand_name: -1,
    sku: -1,
    product_url: -1,
    image_url: -1,
    category_path: -1,
    price: -1,
    currency: -1,
    availability: -1,
    description: -1,
  };
  for (const { field, aliases } of HEADER_ALIASES) {
    if (map[field] >= 0) continue;
    for (const alias of aliases) {
      const idx = header.indexOf(alias);
      if (idx >= 0) {
        map[field] = idx;
        break;
      }
    }
  }
  return map;
}

function resolveDelimiter(
  text: string,
  hint?: 'comma' | 'semicolon' | 'tab',
): ',' | ';' | '\t' {
  if (hint === 'comma') return ',';
  if (hint === 'semicolon') return ';';
  if (hint === 'tab') return '\t';

  // Auto-détection : on regarde les 5 premières lignes
  const sample = text.split(/\r?\n/).slice(0, 5).join('\n');
  const counts: Record<string, number> = {
    ',': (sample.match(/,/g) || []).length,
    ';': (sample.match(/;/g) || []).length,
    '\t': (sample.match(/\t/g) || []).length,
  };
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return (sorted[0][0] as ',' | ';' | '\t') || ',';
}

/**
 * Parser CSV minimal mais correct (gère les guillemets, échappements ""
 * et les retours à la ligne dans les champs entre guillemets).
 */
function parseCsv(text: string, delimiter: ',' | ';' | '\t'): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      continue;
    }

    if (c === delimiter) {
      row.push(field);
      field = '';
      continue;
    }

    if (c === '\r') continue;
    if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }

    field += c;
  }

  // dernière ligne
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}
