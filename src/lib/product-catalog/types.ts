/**
 * Types communs aux connecteurs de catalogue produits.
 *
 * Chaque adapter (sitemap, CSV, Shopify, WooCommerce) produit un flux de
 * `RawProduct` que l'orchestrateur normalise puis upsert dans `products`.
 */

export type CatalogSourceKind = 'sitemap' | 'csv' | 'shopify' | 'woocommerce';

export type CatalogSourceStatus = 'active' | 'paused' | 'error';

export type CatalogImportStatus = 'running' | 'success' | 'partial' | 'failed';

/** Produit brut extrait par un adapter, avant normalisation/upsert. */
export type RawProduct = {
  /** Identifiant stable côté source (URL canonique, GTIN, ID Shopify, etc.). */
  external_ref: string;
  product_name: string;
  brand_name?: string | null;
  product_url?: string | null;
  sku?: string | null;
  image_url?: string | null;
  description?: string | null;
  /** Chemin de catégorie de la source ("Outils > Coupe > Cisailles"). */
  category_path?: string | null;
  /** Catégorie déjà résolue (UUID), prend le pas sur category_path. */
  category_id?: string | null;
  attributes?: Record<string, unknown>;
  target_keywords?: string[];
  price_amount?: number | null;
  price_currency?: string | null;
  /** "in_stock" / "out_of_stock" / "preorder" / autre. */
  availability?: string | null;
  /** Marqueur d'erreur d'extraction non bloquante (le produit est skip). */
  _skip_reason?: string;
};

/** Erreur d'import ligne par ligne, persistée dans product_catalog_imports.errors. */
export type ImportError = {
  external_ref?: string | null;
  product_name?: string | null;
  message: string;
  stage: 'fetch' | 'parse' | 'normalize' | 'upsert';
};

/** Synthèse renvoyée par l'orchestrateur à la fin d'un run de sync. */
export type ImportSummary = {
  source_id: string;
  status: CatalogImportStatus;
  inserted: number;
  updated: number;
  skipped: number;
  errors: ImportError[];
  started_at: string;
  finished_at: string;
  duration_ms: number;
};

/** Configuration brute d'une source (telle que stockée en DB en JSONB). */
export type CatalogSourceConfig = {
  // Sitemap
  homepage_url?: string;
  sitemap_url?: string | null;
  max_pages?: number;
  url_include?: string[];
  url_exclude?: string[];
  brand_default?: string | null;
  is_owned?: boolean;
  // Shopify
  shop_domain?: string;
  shopify_access_token?: string;
  // WooCommerce
  site_url?: string;
  consumer_key?: string;
  consumer_secret?: string;
};

export type CatalogSourceRow = {
  id: string;
  project_id: string;
  kind: CatalogSourceKind;
  name: string;
  config: CatalogSourceConfig;
  default_category_id: string | null;
  status: CatalogSourceStatus;
  last_synced_at: string | null;
  last_error: string | null;
  last_item_count: number;
  created_at: string;
  updated_at: string;
};

/** Vue publique d'une source — credentials redactés. */
export type CatalogSourcePublic = Omit<CatalogSourceRow, 'config'> & {
  config_summary: {
    homepage_url?: string;
    sitemap_url?: string | null;
    max_pages?: number;
    shop_domain?: string;
    site_url?: string;
    has_credentials: boolean;
    brand_default?: string | null;
    is_owned?: boolean;
  };
};
