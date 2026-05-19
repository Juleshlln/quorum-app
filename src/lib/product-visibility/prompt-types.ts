export type PromptScope =
  | 'brand'
  | 'category'
  | 'product'
  | 'competitive';

export type PromptIntent =
  | 'discovery'
  | 'comparison'
  | 'purchase'
  | 'use_case'
  | 'specification'
  | 'brand'
  | 'category'
  | 'competitive';

export type PromptQualityStatus =
  | 'valid'
  | 'needs_review'
  | 'too_generic'
  | 'too_biased'
  | 'missing_product_context';

export type PromptLifecycleStatus =
  | 'draft'
  | 'validated'
  | 'active'
  | 'paused'
  | 'archived';

export type PromptOrigin =
  | 'radar'
  | 'product_visibility'
  | 'offer_visibility'
  | 'manual'
  | 'generated';

export type AiEngine =
  | 'chatgpt'
  | 'claude'
  | 'gemini'
  | 'perplexity'
  | 'llama'
  | 'grok'
  | 'deepseek'
  | 'openai'
  | 'anthropic'
  | 'google';
