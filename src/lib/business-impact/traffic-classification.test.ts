import { describe, expect, it } from 'vitest';
import { classifyTrafficSource } from '@/lib/business-impact/traffic-classification';

describe('classifyTrafficSource', () => {
  it('detects observed AI traffic from source and medium patterns', () => {
    expect(classifyTrafficSource({ source: 'chatgpt.com', medium: 'referral' })).toEqual({
      classification: 'ai_observed',
      matchedSource: 'chatgpt',
    });
  });

  it('marks empty direct traffic as unknown', () => {
    expect(classifyTrafficSource({ source: '(direct)', medium: '(none)' })).toEqual({
      classification: 'unknown',
      matchedSource: null,
    });
  });

  it('keeps non-AI traffic separate from observed AI', () => {
    expect(classifyTrafficSource({ source: 'google', medium: 'organic' })).toEqual({
      classification: 'non_ai',
      matchedSource: null,
    });
  });

  it('does NOT flag regular Bing organic traffic as AI', () => {
    expect(classifyTrafficSource({ source: 'bing', medium: 'organic' })).toEqual({
      classification: 'non_ai',
      matchedSource: null,
    });
  });

  it('detects Bing Chat traffic correctly', () => {
    expect(classifyTrafficSource({ source: 'chat.bing', medium: 'referral' })).toEqual({
      classification: 'ai_observed',
      matchedSource: 'bing',
    });
  });

  it('does NOT flag the word "you" as you.com AI traffic', () => {
    expect(classifyTrafficSource({ source: 'you', medium: 'referral' })).toEqual({
      classification: 'non_ai',
      matchedSource: null,
    });
  });

  it('detects you.com correctly', () => {
    expect(classifyTrafficSource({ source: 'you.com', medium: 'referral' })).toEqual({
      classification: 'ai_observed',
      matchedSource: 'you.com',
    });
  });

  it('does NOT flag "duck" alone as AI traffic', () => {
    expect(classifyTrafficSource({ source: 'duck', medium: 'referral' })).toEqual({
      classification: 'non_ai',
      matchedSource: null,
    });
  });

  it('detects duck.ai correctly', () => {
    expect(classifyTrafficSource({ source: 'duck.ai', medium: 'referral' })).toEqual({
      classification: 'ai_observed',
      matchedSource: 'duck.ai',
    });
  });
});
