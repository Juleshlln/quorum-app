import { describe, expect, it } from 'vitest';
import { generateProductPrompts, validateProductPromptQuality } from '@/lib/product-visibility/prompt-generation';

const MANUTAN_CONTEXT = {
  brandName: 'Manutan',
  productName: 'Transpalette manuel',
  category: 'Matériel de manutention',
  useCase: 'Déplacer des palettes en entrepôt',
  targetCustomer: 'PME industrielles, responsables achats, logisticiens',
  attributes: ['charge 2500 kg', 'usage professionnel', 'livraison rapide'],
  competitors: ['Raja', 'Seton', 'Bruneau'],
} as const;

describe('generateProductPrompts', () => {
  it('generates a structured product prompt mix for the Manutan test case', () => {
    const prompts = generateProductPrompts(MANUTAN_CONTEXT);

    expect(prompts).toHaveLength(8);
    expect(prompts.every((prompt) => prompt.text && prompt.scope && prompt.intent && prompt.rationale)).toBe(true);
    expect(prompts.every((prompt) => prompt.qualityStatus === 'valid')).toBe(true);

    expect(prompts.some((prompt) => prompt.text.includes('Quel transpalette manuel choisir'))).toBe(true);
    expect(prompts.some((prompt) => prompt.text.includes('Où acheter un transpalette manuel avec charge 2500 kg'))).toBe(true);
    expect(prompts.some((prompt) => prompt.text.includes('Compare les meilleurs sites'))).toBe(true);
    expect(prompts.some((prompt) => prompt.text.includes('Manutan, Raja, Seton'))).toBe(true);
    expect(prompts.some((prompt) => prompt.text.includes('Manutan est-il un fournisseur fiable'))).toBe(true);

    const brandedCount = prompts.filter((prompt) => prompt.text.includes('Manutan')).length;
    expect(brandedCount).toBe(2);
    expect(prompts.filter((prompt) => prompt.scope === 'competitive')).toHaveLength(2);
    expect(prompts.map((prompt) => prompt.intent)).toEqual(
      expect.arrayContaining(['discovery', 'purchase', 'category', 'comparison', 'use_case', 'specification', 'brand']),
    );
  });

  it('generates buyer-oriented prompts for a Master Lock padlock without copying the product sheet', () => {
    const prompts = generateProductPrompts({
      brandName: 'Master Lock',
      productName: 'Cadenas à combinaison et clé de secours',
      category: 'Sécurité',
      description: 'Le cadenas reste utilisable même en cas d’oubli de la combinaison grâce à la clé de secours.',
      attributes: [
        'combinaison à 4 chiffres',
        'plus de 10000 combinaisons possibles',
        'anse en acier',
        'résistance contre la coupe et le sciage',
        'Le cadenas reste utilisable même en cas d’oubli de la combinaison grâce à la clé de secours. Le système de sécurité à combinaison à 4 chiffres offre plus de 10000 combinaisons possibles.',
      ],
      competitors: ['Amazon Business', 'Bruneau'],
    });

    expect(prompts).toHaveLength(8);
    expect(prompts.every((prompt) => prompt.qualityStatus === 'valid')).toBe(true);
    expect(prompts.some((prompt) => prompt.text.includes('sécuriser un casier, une réserve ou un accès professionnel'))).toBe(true);
    expect(prompts.some((prompt) => prompt.text.includes('plusieurs salariés doivent partager un accès sans gérer de clés'))).toBe(true);
    expect(prompts.some((prompt) => prompt.text.includes('à combinaison 4 chiffres'))).toBe(true);
    expect(prompts.some((prompt) => prompt.text.includes('fournisseurs de sécurité'))).toBe(false);
    expect(prompts.some((prompt) => prompt.text.includes('Le cadenas reste utilisable même en cas d’oubli'))).toBe(false);
  });
});

describe('validateProductPromptQuality', () => {
  it('flags weak generic prompts', () => {
    expect(validateProductPromptQuality('Quel est le meilleur fournisseur ?', MANUTAN_CONTEXT)).toBe('too_generic');
    expect(validateProductPromptQuality('Quel est le meilleur produit ?', MANUTAN_CONTEXT)).toBe('too_generic');
  });

  it('flags biased branded prompts', () => {
    expect(
      validateProductPromptQuality('Pourquoi Manutan est-il le meilleur fournisseur de transpalettes ?', MANUTAN_CONTEXT),
    ).toBe('too_biased');
  });

  it('flags missing product context', () => {
    expect(validateProductPromptQuality('Quels sont les meilleurs sites e-commerce BtoB ?', MANUTAN_CONTEXT)).toBe(
      'missing_product_context',
    );
  });
});
