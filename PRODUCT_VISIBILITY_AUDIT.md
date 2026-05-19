# Audit – Rubrique « Visibilité produit »

> **Statut :** Étape 1 (audit lecture seule) + Étape 2 (diagnostic).
> Aucune ligne de code de la rubrique n'a été modifiée par cet audit.
> **Date :** 2026-05-18.
> **Périmètre :** Tout l'arbre `product-visibility` (pages, components, API routes, lib, migrations) ainsi que les points de jonction avec le pipeline monitoring partagé.

---

## 0. TL;DR

| Sévérité | Sujet | Fichier |
|---|---|---|
| 🔴 **Bloquant** | Pipeline `manual-run` exécute **tous les prompts actifs** du projet (pas seulement les prompts produit) | [run-monitoring.ts:267-299](src/lib/monitoring/run-monitoring.ts) + [manual-run/route.ts:144](src/app/api/product-visibility/manual-run/route.ts) |
| 🔴 **Bloquant** | **4 formules différentes** se cachent derrière l'unique label « score de visibilité » | [service.ts:676,774,927,2717](src/lib/product-visibility/service.ts) |
| 🔴 **Bloquant** | Pas de seuil de fiabilité minimum : 1 mention isolée → KPI à **90,0 %** sans avertissement | [service.ts:2700-2718](src/lib/product-visibility/service.ts) |
| 🟠 **Important** | `confidence_score` **codé en dur à 0.95** sur chaque mention détectée → la colonne est inutilisable | [service.ts:353](src/lib/product-visibility/service.ts) |
| 🟠 **Important** | « Dernière analyse » lit le plus récent `monitoring_runs` du projet, sans filtre produit | [service.ts:599-605](src/lib/product-visibility/service.ts) |
| 🟠 **Important** | `accuracy_score` (fiabilité 89,5 %) calculé sans filtre confiance ni minimum d'échantillon | [service.ts:1059-1066](src/lib/product-visibility/service.ts) |
| 🟡 **Moyen** | Découpage « tendance » fait par **index** au lieu de **date** | [service.ts:727,875](src/lib/product-visibility/service.ts) |
| 🟡 **Moyen** | Aucun test unitaire sur les calculs KPI (`format.ts`, `service.ts`) | – |
| 🟡 **Moyen** | Tables `monitoring_prompt_competitors` / `monitoring_prompt_engines` créées (mig. 031) jamais lues | [031_product_prompt_foundation.sql](supabase/migrations/031_product_prompt_foundation.sql) |
| 🟢 **Bon** | Aucune donnée mockée ou aléatoire détectée (`Math.random`, `faker`, etc. → 0 occurrence) | – |
| 🟢 **Bon** | États vides correctement gérés (4 étapes d'onboarding, messages explicites) | [overview-dashboard.tsx:96-164](src/components/product-visibility/overview-dashboard.tsx) |
| 🟢 **Bon** | `normalizeScore` + `formatPercent` gèrent proprement 0-1 ↔ 0-100 et `null` | [format.ts:24-37](src/lib/product-visibility/format.ts) |

L'origine des « 90,0 % » et « 89,5 % » qui ont déclenché cet audit est **mathématique, pas hardcodée** (cf. §3). Mais le calcul est trompeur : sur **1 mention** sans concurrent, la formule produit **90,0 %** présenté comme une mesure fiable.

---

## 1. Fichiers audités

### Pages (`src/app/(dashboard)/product-visibility/`)
- [page.tsx](src/app/(dashboard)/product-visibility/page.tsx) — Vue d'ensemble
- [products/page.tsx](src/app/(dashboard)/product-visibility/products/page.tsx) + [[id]/page.tsx](src/app/(dashboard)/product-visibility/products/[id]/page.tsx)
- [categories/page.tsx](src/app/(dashboard)/product-visibility/categories/page.tsx) + [[id]/page.tsx](src/app/(dashboard)/product-visibility/categories/[id]/page.tsx)
- [prompts/page.tsx](src/app/(dashboard)/product-visibility/prompts/page.tsx) — Requêtes IA
- [results/page.tsx](src/app/(dashboard)/product-visibility/results/page.tsx)
- [recommendations/page.tsx](src/app/(dashboard)/product-visibility/recommendations/page.tsx)
- [sources/page.tsx](src/app/(dashboard)/product-visibility/sources/page.tsx)
- [attributes/page.tsx](src/app/(dashboard)/product-visibility/attributes/page.tsx)

### Components (`src/components/product-visibility/`)
[overview-dashboard.tsx](src/components/product-visibility/overview-dashboard.tsx), [product-form.tsx](src/components/product-visibility/product-form.tsx), [prompts-actions.tsx](src/components/product-visibility/prompts-actions.tsx), [quick-actions.tsx](src/components/product-visibility/quick-actions.tsx), [recommendations-actions.tsx](src/components/product-visibility/recommendations-actions.tsx), [section-nav.tsx](src/components/product-visibility/section-nav.tsx), [sources-manager.tsx](src/components/product-visibility/sources-manager.tsx).

### API (`src/app/api/product-visibility/`)
- [overview/route.ts](src/app/api/product-visibility/overview/route.ts)
- [products/route.ts](src/app/api/product-visibility/products/route.ts), [products/[id]/route.ts](src/app/api/product-visibility/products/[id]/route.ts)
- [categories/route.ts](src/app/api/product-visibility/categories/route.ts), [categories/[id]/route.ts](src/app/api/product-visibility/categories/[id]/route.ts)
- [attributes/route.ts](src/app/api/product-visibility/attributes/route.ts)
- [results/route.ts](src/app/api/product-visibility/results/route.ts)
- [recommendations/route.ts](src/app/api/product-visibility/recommendations/route.ts)
- [generate-prompts/route.ts](src/app/api/product-visibility/generate-prompts/route.ts)
- [generate-recommendations/route.ts](src/app/api/product-visibility/generate-recommendations/route.ts)
- [manual-run/route.ts](src/app/api/product-visibility/manual-run/route.ts)
- [catalog-sources/*](src/app/api/product-visibility/catalog-sources)

### Lib (`src/lib/product-visibility/`)
[service.ts](src/lib/product-visibility/service.ts) (3 075 lignes — couche service centrale), [parser.ts](src/lib/product-visibility/parser.ts), [prompt-generation.ts](src/lib/product-visibility/prompt-generation.ts), [prompt-types.ts](src/lib/product-visibility/prompt-types.ts), [request.ts](src/lib/product-visibility/request.ts), [format.ts](src/lib/product-visibility/format.ts).

### Migrations Supabase
- [025_product_visibility_monitoring.sql](supabase/migrations/025_product_visibility_monitoring.sql) — schéma de base
- [027_product_catalog_sources.sql](supabase/migrations/027_product_catalog_sources.sql) — import catalogues
- [030_product_visibility_detected_entities.sql](supabase/migrations/030_product_visibility_detected_entities.sql) — `detected_product_name`, `detected_brand_name`, `confidence_score`
- [031_product_prompt_foundation.sql](supabase/migrations/031_product_prompt_foundation.sql) — `scope`, `prompt_origin`, `lifecycle_status`, tables `monitoring_prompt_products/competitors/engines`

---

## 2. Modèle de données utilisé

Tables réellement consommées par la rubrique :

| Table | Rôle | Colonnes critiques utilisées |
|---|---|---|
| `product_categories` | Univers d'achat suivi | `id`, `name`, `priority`, `status`, `business_intent` |
| `products` | Produits suivis (client + concurrents) | `id`, `category_id`, `is_owned_product`, `brand_name`, `competitor_brand`, `attributes` |
| `product_visibility_results` | Une **ligne par mention détectée** (post-parsing) | `product_id`, `category_id`, `mention_count`, `rank_position`, `visibility_score`, `accuracy_score`, `sentiment_score`, `sources_detected`, `confidence_score`, `is_owned_product` |
| `product_recommendations` | Recommandations stockées | `product_id`, `category_id`, `priority`, `expected_impact`, `effort`, `source_reason` |
| `monitoring_prompts` | Requêtes IA (partagées avec Radar) | `prompt_origin`, `scope`, `category_id`, `buying_intent`, `is_active` |
| `monitoring_prompt_products` | Lien M:N prompt ↔ produit | `prompt_id`, `product_id`, `is_primary` |
| `monitoring_runs` | Runs d'analyse (**partagés** avec Radar) | `id`, `status`, `finished_at`, `created_at` |
| `product_catalog_sources` / `product_catalog_imports` | Imports catalogue | `kind`, `config`, `status` |

**Schéma propre.** RLS posée, FK cohérentes. Mais deux tables introduites par mig. 031 sont **non lues** par la rubrique : `monitoring_prompt_competitors`, `monitoring_prompt_engines`.

---

## 3. Diagnostic des KPI

### 3.1 « Score de visibilité produit » (Overview)

**Formule actuelle** ([service.ts:2700-2718](src/lib/product-visibility/service.ts)) :

```ts
function computeVisibilityScore({ ownedMentions, competitorMentions, averageOwnedRanking, ownedSourceCoverage }) {
  const total = ownedMentions + competitorMentions;
  if (total <= 0) return null;
  const ownedShare    = ownedMentions / total;                                // 0-1
  const rankingBonus  = averageOwnedRanking ? clamp((10 - Math.min(r,10))/9, 0, 1) : 0;
  const sourceBonus   = ownedSourceCoverage !== null ? clamp(cov/100, 0, 1) : 0;
  return round(ownedShare * 70 + rankingBonus * 20 + sourceBonus * 10, 1);   // 0-100
}
```

**D'où viennent les 90,0 %** : 1 mention client, 0 concurrent, position #1, pas de couverture sources renseignée →
`1 × 70 + 1 × 20 + 0 × 10 = 90,0`.

**Problèmes** :
- 🔴 Aucun **plancher d'échantillon** : la formule tourne dès qu'il existe ≥ 1 mention.
- 🔴 La formule **mélange trois dimensions** (part de voix + position + sources) sous un seul label, sans documentation visible côté UI. L'utilisateur lit « part de vos produits » ([overview-dashboard.tsx:259](src/components/product-visibility/overview-dashboard.tsx)) → c'est faux, c'est un composite pondéré.
- 🔴 `rankingBonus` est nul si `averageOwnedRanking = null`, mais vaut 1 si position=1. Le score peut donc **chuter de 90 → 70** simplement parce qu'aucun rang n'a été extrait, sans que les performances réelles aient changé.
- 🟠 `sourceBonus` est nul si `ownedSourceCoverage = null` (cas où il n'y a aucune réponse à mesurer). Mêmes 30 % au-dessus.

### 3.2 Quatre formules pour le même label « visibility_score »

| Endroit | Formule | Échelle | Sémantique réelle |
|---|---|---|---|
| Overview KPI ([2717](src/lib/product-visibility/service.ts)) | `0.7·share + 0.2·rank + 0.1·source` × 100 | 0-100 | Composite |
| Top produits chart, fiche produit ([774](src/lib/product-visibility/service.ts)) | `mentions × 10 + (owned ? 10 : 0)` | clamp 0-100 | **Compte de mentions arbitraire** |
| Détail catégorie ([927](src/lib/product-visibility/service.ts)) | `(owned / total) × 100` | 0-100 | Part de voix pure |
| Tendance journalière ([676](src/lib/product-visibility/service.ts)) | `(owned / total) × 100` | 0-100 | Part de voix pure |

Conséquence concrète : un produit avec 5 mentions affichera **60 %** dans le top-produits (Overview, [overview-dashboard.tsx:550](src/components/product-visibility/overview-dashboard.tsx)) et la fiche produit, mais la courbe de tendance du même jour pourra afficher **100 %** (1 mention client / 1 mention totale). Mêmes données, deux résultats différents, même UI.

### 3.3 « Mentions de vos produits / concurrentes »

**Définition appliquée** : 1 mention = 1 ligne `product_visibility_results` avec `mention_count` (généralement = 1 ; cf. [service.ts:355](src/lib/product-visibility/service.ts) où c'est hardcodé). Donc en pratique = **nombre de lignes** détectées.

- ✅ Calcul OK : somme directe sur la fenêtre temporelle.
- 🟠 Le `mention_count = 1` codé en dur ([service.ts:355](src/lib/product-visibility/service.ts)) ignore le cas où un produit est cité plusieurs fois dans une même réponse IA. Le parser, lui, peut en compter plusieurs ; cette information est perdue à l'insertion.

### 3.4 Position moyenne

**Définition appliquée** : moyenne de `rank_position` sur les lignes `is_owned_product=true` qui ont une position non nulle ([service.ts:1033-1036](src/lib/product-visibility/service.ts)).

- ✅ Les produits non cités ne biaisent pas la moyenne.
- 🔴 **Pas de minimum d'échantillon.** « #1 » peut venir d'une seule réponse IA.
- 🟠 Lecture d'une fenêtre par jour : si plusieurs runs tombent dans la fenêtre, la moyenne est pondérée par la fréquence d'exécution et non par l'importance des prompts.

### 3.5 Couverture des sources IA

**Définition appliquée** ([service.ts:1038-1041](src/lib/product-visibility/service.ts)) : `(résultats avec sources_detected non vides) / (résultats totaux) × 100`.

- ✅ Calcul transparent.
- 🟠 Ne distingue pas `sources observées` vs `probables` vs `fallback`. Cf. la mémoire projet sur les citations (`is_fallback` sur `citations` n'est pas répliquée côté `product_visibility_results`).

### 3.6 Produits à forte opportunité

**Formule** ([service.ts:986-990](src/lib/product-visibility/service.ts)) :

```ts
opportunityScore = clamp(
  (60 - product.visibility_score)
  + max(0, 8 - (avgPosition || 8)) * 4
  + max(0, -sentiment * 8),
  0, 100
)
```

→ produit à opportunité si `opportunity_score >= 70`.

- 🔴 Le score dépend du `visibility_score` per-produit (formule §3.2 ligne 774, donc `mentions × 10`). Un produit avec 0 mention a `visibility_score = 0`, donc opportunity = `60 - 0 = 60` → **pas marqué** comme opportunité (seuil 70). Inverse du résultat attendu.
- 🟠 `max(0, -sentiment * 8)` : si `sentiment = 0` (cas où on n'a pas mesuré), le terme est nul. OK mais à documenter.

### 3.7 Fiabilité des informations (89,5 %)

**Définition appliquée** ([service.ts:1059-1066](src/lib/product-visibility/service.ts)) :

```ts
const accuracyRows = results.filter(row => row.accuracy_score !== null);
productAccuracyScore = mean(accuracyRows.map(r => r.accuracy_score <= 1 ? r.accuracy_score * 100 : r.accuracy_score));
```

- 🟠 `accuracy_score` provient du parser IA ([parser.ts](src/lib/product-visibility/parser.ts) via `parsed.accuracy_score`). C'est donc l'IA qui **note sa propre fiabilité** — c'est un signal faible et non audité.
- 🟠 Aucun filtre sur `confidence_score` minimum (lui-même hardcodé à 0.95, cf. point suivant).
- 🟠 Aucun seuil d'échantillon : 1 réponse à 0,895 → KPI affiché à 89,5 %.

### 3.8 `confidence_score` hardcodé

[service.ts:353](src/lib/product-visibility/service.ts) :
```ts
confidence_score: 0.95,  // figé pour toute mention détectée
```
La colonne `confidence_score` créée par la migration 030 est **inutilisable en l'état** : tout vaut 0,95. Aucun filtrage de KPI ne peut s'appuyer dessus.

---

## 4. Tabs : sources de vérité

| Onglet | Page | Route API | Fonction service | Fenêtre |
|---|---|---|---|---|
| Vue d'ensemble | [page.tsx](src/app/(dashboard)/product-visibility/page.tsx) | `/overview` | `getProductVisibilityOverviewStandard` | `30d` par défaut, `7d`/`90d` via query |
| Produits | products/page.tsx | `/products` + `/products/[id]` | `getProductVisibilityProducts`, `getProductVisibilityProductDetail` | idem |
| Catégories | categories/page.tsx | `/categories` + `/categories/[id]` | `getProductVisibilityCategories`, `getProductVisibilityCategoryDetail` | idem |
| Requêtes IA | prompts/page.tsx | `/generate-prompts` | `generateProductVisibilityPrompts` (génération seule) | – |
| Résultats | results/page.tsx | `/results` | `getProductVisibilityResults` | idem |
| Recommandations | recommendations/page.tsx | `/recommendations`, `/generate-recommendations` | `getProductVisibilityRecommendations`, `generateProductVisibilityRecommendations` | idem |
| Sources | sources/page.tsx | `/catalog-sources/*` | `getProductCatalogSources` | – |
| Attributs | attributes/page.tsx | `/attributes` | `getProductVisibilityAttributes` | idem |

✅ **Tous les onglets lisent le même `loadVisibilityDataset`** ([service.ts:564](src/lib/product-visibility/service.ts)) → une seule fenêtre, une seule requête de résultats.
🔴 **Mais** ils recalculent chacun leurs KPI avec des formules locales : `computeProductStats` (l.774, formule arbitraire) est appelé depuis 6 endroits ([1014, 1181, 1324, 1482, …](src/lib/product-visibility/service.ts)) avec des paramètres différents. Aucun cache, aucune source de vérité unique.

---

## 5. Pipeline d'analyse — la rupture de chaîne principale

**Action utilisateur** : `POST /api/product-visibility/manual-run`.

1. `countActiveProductVisibilityPrompts` ([route.ts:35-80](src/app/api/product-visibility/manual-run/route.ts)) :
   - cherche les prompts `prompt_origin = 'product_visibility' AND is_active = true`,
   - sinon fallback sur `monitoring_prompt_products`.
   ✅ scope correct **pour le comptage**.

2. `createMonitoringRun` + `executeMonitoringRun` ([route.ts:135-147](src/app/api/product-visibility/manual-run/route.ts)) → délègue au pipeline générique [`src/lib/monitoring/run-orchestrator.ts`](src/lib/monitoring/run-orchestrator.ts).

3. Dans `runMonitoringForProject` ([run-monitoring.ts:267-299](src/lib/monitoring/run-monitoring.ts)) :
   ```ts
   await supabase.from('monitoring_prompts')
     .select('id, prompt_text, ..., is_active')
     .eq('project_id', projectId);
   // pas de filtre prompt_origin, pas de filtre via monitoring_prompt_products
   ```
   🔴 **Le run exécute tous les prompts actifs du projet**, y compris ceux qui appartiennent à Radar IA, Brand monitoring, etc. Conséquences :
   - Surcoût API OpenAI (factures multipliées sur les projets matures).
   - Les réponses sont parsées comme « product visibility » même quand le prompt n'a rien à voir avec un produit. `backfillProductVisibilityResultsForRun` ([service.ts:381+](src/lib/product-visibility/service.ts)) supprime puis ré-insère par `prompt_run_id` → résultats pollués.
   - L'utilisateur lance « Lancer l'analyse Visibilité produit » et déclenche un run global.

4. `backfillProductVisibilityResultsForRun` lit toutes les `monitoring_responses` du run et tente d'extraire des mentions. Si le prompt ne mentionne aucun produit → ligne `mention_count=0` insérée (fallback, [service.ts:363-378](src/lib/product-visibility/service.ts)) qui sera **comptée dans le dénominateur** de `ai_citation_coverage` et `product_accuracy_score`.

5. `getProductVisibilityOverviewStandard` lit `latestRun = monitoring_runs ORDER BY created_at DESC LIMIT 1` ([service.ts:599-605](src/lib/product-visibility/service.ts)). 🔴 Pas de filtre : un run Radar IA déclenché par un cron 5 min après votre run produit fera afficher « Dernière analyse : il y a 5 min » même si ce run n'a généré aucune donnée produit.

---

## 6. Recommandations : audit rapide

[service.ts:2380-2449](src/lib/product-visibility/service.ts) (`generateProductVisibilityRecommendations`) :
- ✅ S'appuie sur des **signaux réels** : `visibility_score < 45`, écart owned/competitor, attributs manquants, sources owned absentes.
- 🟠 Le seuil 45 dépend du `visibility_score` per-produit (formule §3.2 ligne 774). Avec la formule `mentions×10`, un produit cité 4 fois est sous 45 — alors qu'il est peut-être leader sur sa niche.
- 🟠 Champ `priority` rempli en heuristique (haut/moyen/bas) sans score d'impact normalisé. Pas de champ `confidence` exposé à l'UI.
- 🟢 Pas d'appel LLM dans la génération (génération déterministe).

---

## 7. États vides & qualité UX

- ✅ 4 stages d'onboarding (`no_products`, `products_without_prompts`, `ready_without_analysis`, `analysis_without_results`) — [service.ts:2687-2698](src/lib/product-visibility/service.ts).
- ✅ Composant `EmptyHint` ([overview-dashboard.tsx:96-164](src/components/product-visibility/overview-dashboard.tsx)) avec CTAs.
- ✅ `formatPercent(null) → "—"` ([format.ts:33-37](src/lib/product-visibility/format.ts)).
- 🟠 Mais **dès qu'il y a 1 ligne de résultat**, le module passe en mode « has_data » et **affiche les KPI sans avertir de la faiblesse de l'échantillon**. C'est l'origine perçue du « tableau de bord trompeur ».

---

## 8. Inconsistances de normalisation

- ✅ `normalizeScore` gère 0-1 ↔ 0-100 ([format.ts:24-30](src/lib/product-visibility/format.ts)). Test rapide : `0.5 → 50`, `75 → 75`, `1 → 100`, `null → null`.
- 🟠 Cas limite : `visibility_score = 1.0` (formule overview retournant 1.0 sur une seule mention) sera normalisé en 100. Or 1.0 peut aussi venir de la formule trend (`(1/1)*100 = 100` déjà). Confusion possible si une nouvelle formule renvoie un float ≤ 1.
- 🟠 [service.ts:1062](src/lib/product-visibility/service.ts) re-normalise `accuracy_score` manuellement (`<=1 ? ×100 : value`) — duplication de logique. À unifier sur `normalizeScore`.

---

## 9. Tests / build

- Pas de framework de test global configuré (un seul fichier : [prompt-generation.test.ts](src/lib/product-visibility/prompt-generation.test.ts)).
- Aucun test pour `service.ts`, `format.ts`, `parser.ts`.
- `package.json` : `npm run lint`, `npm run build` disponibles. Pas de `typecheck` ni `test` dédié pour la rubrique.

---

## 10. Définitions cibles proposées

Avant toute correction, j'aimerais valider avec toi ces définitions :

| KPI | Définition cible | Formule cible | Seuil minimum |
|---|---|---|---|
| **product_visibility_score** | Part de voix de tes produits parmi les mentions produit pertinentes | `owned_mentions / (owned + competitor + alternative) × 100` | ≥ 5 réponses IA exploitables, sinon « Donnée insuffisante » |
| **owned_product_mentions** | Nombre de lignes `is_owned_product=true & mention_count > 0` sur la période | somme directe | – |
| **competitor_product_mentions** | Symétrique côté concurrents | somme directe | – |
| **average_product_ranking** | Rang moyen de tes produits **quand ils sont cités** | `mean(rank_position WHERE is_owned & rank_position IS NOT NULL)` | ≥ 5 occurrences avec rang, sinon « — » |
| **ai_citation_coverage** | Part des réponses IA avec ≥ 1 source explicite non-fallback | `responses_with_real_sources / total_responses × 100` | ≥ 5 réponses, sinon « Donnée insuffisante » |
| **high_opportunity_products** | Produits suivis dont l'opportunité dépasse 70 (formule revue : combine gap concurrent + absence + sources manquantes) | Cf. §3.6 corrigé | – |
| **product_accuracy_score** | « Fiabilité » des infos produit. **Soit on a un vrai signal mesurable, soit on retire le KPI.** | À discuter (cf. plan §11) | – |

**Convention de stockage interne :** 0-100. **Affichage :** `formatPercent` (qui supporte 0-1 par sécurité).

---

## 11. Plan de correction priorisé

### P0 — Bloquant (corrige les chiffres trompeurs)

1. **Unifier `visibility_score`** sur une seule formule (« part de voix »). Documenter en commentaire en tête de fonction. Supprimer la formule `mentions × 10` ([service.ts:774](src/lib/product-visibility/service.ts)) ou la renommer explicitement `product_prominence_index` si elle reste utile pour le tri.
2. **Filtrer le pipeline `manual-run`** sur les prompts produit uniquement. Modifier `run-monitoring.ts` pour accepter un paramètre `promptScope: 'all' | 'product_visibility'` et l'utiliser dans la requête `monitoring_prompts`. Ou bien créer un orchestrateur dédié `runProductVisibilityForProject`.
3. **Ajouter un seuil minimum d'échantillon** (`MIN_SAMPLE = 5` ou config). En dessous : retourner `null` côté service + afficher « Donnée insuffisante » côté UI (les helpers `formatPercent(null)` le font déjà).

### P1 — Important

4. **Filtrer `latestRun`** par `pipeline = 'product_visibility'` ou par existence d'au moins 1 ligne `product_visibility_results.run_id = run.id`.
5. **Retirer `confidence_score: 0.95` hardcodé** ([service.ts:353](src/lib/product-visibility/service.ts)). Calculer une confiance réelle (cohérence parser ⇄ produit suivi ⇄ source) ou supprimer la colonne du dashboard.
6. **Ré-évaluer `product_accuracy_score`** : soit on définit un vrai signal (présence de prix exact, attributs cohérents, source owned) et on l'expose, soit on remplace le KPI par « Part owned vs tiers » plus honnête.
7. **Préserver `mention_count` du parser** au lieu de le forcer à 1 ([service.ts:355](src/lib/product-visibility/service.ts)).

### P2 — Hygiène

8. **Découpage tendance par date, pas par index** ([service.ts:727, 875](src/lib/product-visibility/service.ts)) : `previous = results filter created_at < window.midDate` au lieu de `index < midpoint`.
9. **Centraliser les calculs** dans `src/lib/product-visibility/metrics.ts` (déjà partiellement le rôle de `service.ts`, mais le fichier mélange queries, calculs, et CRUD sur 3 075 lignes — à découper).
10. **Tests** : créer `src/lib/product-visibility/metrics.test.ts` avec des fixtures (0 mention, 1 mention, échantillons faibles, sentiment null, etc.).
11. **Supprimer ou utiliser** `monitoring_prompt_competitors` / `monitoring_prompt_engines` (migration 031).
12. **Types** : créer `src/lib/product-visibility/types.ts` et exposer `ProductVisibilityKpi`, `ProductVisibilityPeriod`, `ProductMention`, etc. — actuellement noyés dans `service.ts`.

### P3 — Produit (à valider avec toi)

13. Ajouter un badge « confiance faible » dans la carte KPI quand `sample_size < threshold`.
14. Afficher la **taille d'échantillon** (« basé sur 12 réponses IA sur 30 jours ») sous chaque KPI agrégé.
15. Distinguer dans l'UI résultats `prompt_origin = product_visibility` vs résultats hérités (avant le fix du pipeline).

---

## 12. Incohérences restantes (décision produit nécessaire)

- **Le KPI « Fiabilité des informations » a-t-il un sens en l'état actuel des données ?** Aujourd'hui `accuracy_score` = auto-note IA, non audité. Décision : (a) supprimer le KPI tant qu'on n'a pas de signal, (b) le renommer « Confiance auto-déclarée IA » + ajouter un disclaimer, (c) refonte avec un vrai calcul.
- **Comportement attendu de « Lancer l'analyse »** : déclencher seulement les prompts liés produit, ou tous les prompts du projet (l'utilisateur n'a alors qu'un seul bouton « run » global) ? La rubrique « Visibilité produit » suggère un scope produit, mais l'orchestrateur actuel est global.
- **Politique d'agrégation multi-modèles IA** : un même prompt joué sur ChatGPT + Gemini + Claude → 3 lignes de résultats. Aujourd'hui, ces 3 lignes sont sommées dans `mentions`. Voulez-vous une moyenne par prompt, ou un comptage brut ?

---

## 13. Checklist de validation manuelle

À effectuer **après** corrections P0+P1 :

- [ ] Sur un projet **sans produit** : KPI = « — », onboarding stage = `no_products`.
- [ ] Sur un projet avec **1 produit, 0 run** : stage = `ready_without_analysis`, pas de KPI affiché.
- [ ] Sur un projet avec **1 mention isolée** : score visibilité = « Donnée insuffisante » (ne plus afficher 90,0 %).
- [ ] « Lancer l'analyse Visibilité produit » ne déclenche **pas** les prompts Radar IA généraux.
- [ ] « Dernière analyse » remonte le dernier run **produit**, pas n'importe quel run.
- [ ] Score top-produit affiché = score produit affiché dans la fiche produit (même formule des deux côtés).
- [ ] Trend journalière et catégories utilisent la même formule de part de voix.
- [ ] `npm run lint` + `npm run build` passent.
- [ ] `confidence_score` n'est plus à 0,95 partout (vérifier en DB).

---

## 14. Commandes utiles (pour la phase de correction)

```bash
npm run lint
npm run build
# Pas de npm run test ni typecheck dédié — à ajouter
```

---

---

## 15. Phase d'implémentation (P0 + P1) — appliquée

Corrections livrées dans cette session :

| Ref | Correction | Fichier(s) |
|---|---|---|
| P0.1 | Formule per-produit `mentions × 10` remplacée par **part de voix** `mentions / total × 100`. Cohérent avec trend + catégorie. | [service.ts:680-800](src/lib/product-visibility/service.ts) |
| P0.1 bis | Formule d'opportunité ré-étalonnée pour la nouvelle sémantique (`(100 - share) × 0.7 + ...`). | [service.ts:986-1000](src/lib/product-visibility/service.ts) |
| P0.2 | Pipeline `manual-run` filtré sur prompts produit uniquement via `promptIds` propagé jusqu'à `runMonitoringForProject`. `resolveProductVisibilityPromptIds` remplace `countActiveProductVisibilityPrompts`. | [manual-run/route.ts](src/app/api/product-visibility/manual-run/route.ts), [run-orchestrator.ts](src/lib/monitoring/run-orchestrator.ts), [run-monitoring.ts](src/lib/monitoring/run-monitoring.ts) |
| P0.3 | Ajout d'un bloc `reliability: { sample_size, confidence_level: 'high'|'low'|'none', min_sample }` au contrat API. Constante `PRODUCT_VISIBILITY_MIN_SAMPLE = 5`. Badge UI ambre « Échantillon faible » affiché quand confiance basse. | [service.ts:101-105, 2640-2700](src/lib/product-visibility/service.ts), [overview-dashboard.tsx:295-315](src/components/product-visibility/overview-dashboard.tsx) |
| P1.4 | `latestRun` lit désormais le dernier `monitoring_run` qui a **au moins une ligne `product_visibility_results`**, via jointure inner sur la table. | [service.ts:2785-2800](src/lib/product-visibility/service.ts) |
| P1.5 | `confidence_score: 0.95` hardcodé remplacé par `parsed.accuracy_score` (normalisé 0-1) ou `null` si absent. | [service.ts:350-356](src/lib/product-visibility/service.ts) |
| P1.6 | KPI « Fiabilité des informations » retiré du contrat `ProductVisibilityOverviewStandard` (kpis + deltas) et de la carte UI. Le calcul interne reste (utilisé par les recommandations). | [service.ts:2619-2640](src/lib/product-visibility/service.ts), [overview-dashboard.tsx:295-315](src/components/product-visibility/overview-dashboard.tsx) |

### Points abandonnés/différés

- **P1.7 (mention_count = 1)** : finalement non corrigé car le parser émet **1 `ParsedProductMention` par produit par réponse** (`product_id` est déjà déduplicateur). La valeur `1` est donc cohérente avec le modèle « 1 mention = 1 produit qui apparaît dans 1 réponse IA ». Si à l'avenir on veut compter les répétitions intra-réponse, il faudra exposer un compteur dans `ParsedProductMention.match_count`.
- **P2/P3** (découpage trend par date, centralisation `metrics.ts`, tests unitaires, suppression migrations 031 inutilisées) : pas dans le scope P0+P1, à traiter dans une itération suivante.

### Validation

- `npx tsc --noEmit -p tsconfig.json` : **0 nouvelle erreur** sur les 5 fichiers modifiés (les erreurs visibles dans la sortie sont antérieures : Next 15 PageProps, exports manquants dans `start-run-button` — sans rapport).
- `npx vitest run src/lib/product-visibility/` : 5 tests existants OK.
- `npx next lint` : configuration ESLint 9 absente dans le repo (erreur tooling pré-existante, pas liée à ces changements).
- **Vérification UI en navigateur** : non effectuée. Le dashboard requiert un user authentifié + un projet actif avec données seedées ; sans ces pré-requis l'écran affiche l'onboarding au lieu des KPI modifiés. Je recommande au reviewer de :
  1. ouvrir `/product-visibility` connecté avec le projet Manutan,
  2. vérifier l'absence de la carte « Fiabilité des informations »,
  3. forcer un état faible échantillon (< 5 résultats) pour voir le badge ambre,
  4. lancer « Lancer l'analyse » et confirmer dans les logs que seuls des prompts `prompt_origin='product_visibility'` (ou liés à `monitoring_prompt_products`) sont exécutés.

### Impact à attendre côté KPI

Sur le projet Manutan, **les chiffres affichés vont changer** après ces corrections :
- Le « 90,0 % » fantôme tombera à la vraie part de voix (`owned / (owned + competitor) × 100`, sans bonus position ni source).
- Le « 89,5 % » (Fiabilité) **disparaît** de l'écran.
- Le top-produits passe d'une échelle `mentions × 10` à une part de voix réelle. Un produit qui était à 60 % parce qu'il avait 6 mentions affichera désormais sa part réelle (e.g. 12 % s'il y a 50 mentions au total).
- « Produits à forte opportunité » : remontée probable (le seuil étant maintenant atteignable pour des produits à faible part de voix).
- « Dernière analyse » : peut reculer dans le temps si le dernier run global Radar IA n'avait aucun résultat produit.

Ces écarts sont **attendus** : ils traduisent le passage d'une mesure ambiguë à une mesure honnête.

---

*Fin de l'audit + phase 1 d'implémentation.*
