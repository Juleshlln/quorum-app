import OpenAI from 'openai';

// Types
export interface AIProvider {
  id: string;
  name: string;
  model: string;
  available: boolean;
}

export interface AIQueryResult {
  provider: string;
  model: string;
  prompt: string;
  response: string;
  mentioned: boolean;
  position: number | null;
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  competitors_mentioned: string[];
  sources_cited: string[];
  response_time_ms: number;
  error?: string;
}

// Available AI providers
export const AI_PROVIDERS: AIProvider[] = [
  { id: 'openai', name: 'ChatGPT', model: 'gpt-4o', available: true },
  { id: 'anthropic', name: 'Claude', model: 'claude-3-haiku', available: false }, // Future
  { id: 'google', name: 'Gemini', model: 'gemini-pro', available: false }, // Future
  { id: 'perplexity', name: 'Perplexity', model: 'pplx-7b', available: false }, // Future
];

// Initialize OpenAI client
function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  console.log('🔑 Creating OpenAI client with key:', apiKey.substring(0, 15) + '...');
  return new OpenAI({ apiKey });
}

// Query OpenAI
export async function queryOpenAI(
  prompt: string,
  brandName: string,
  competitors: string[] = [],
  context: string = ''
): Promise<AIQueryResult> {
  const startTime = Date.now();
  console.log(`\n🤖 Querying OpenAI for prompt: "${prompt.substring(0, 50)}..."`);
  
  try {
    const openai = getOpenAIClient();
    
    console.log('📤 Sending request to OpenAI...');
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: [
            'You are a helpful assistant. Answer questions naturally and thoroughly. When recommending products or services, be specific about names and features.',
            context ? `Context: ${context}` : ''
          ].filter(Boolean).join('\n')
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 1200,
      temperature: 0,
      top_p: 1,
    });

    const response = completion.choices[0]?.message?.content || '';
    const responseTime = Date.now() - startTime;
    
    console.log(`📥 Response received in ${responseTime}ms`);
    console.log(`📝 Response preview: "${response.substring(0, 100)}..."`);

    // Analyze the response
    const analysis = analyzeResponse(response, brandName, competitors);
    console.log(`📊 Analysis: mentioned=${analysis.mentioned}, position=${analysis.position}, sentiment=${analysis.sentiment}`);

    return {
      provider: 'openai',
      model: 'gpt-4o',
      prompt,
      response,
      mentioned: analysis.mentioned,
      position: analysis.position,
      sentiment: analysis.sentiment,
      competitors_mentioned: analysis.competitorsMentioned,
      sources_cited: analysis.sourcesCited,
      response_time_ms: responseTime,
    };
  } catch (error: any) {
    console.error('❌ OpenAI Error:', error.message);
    console.error('❌ Error details:', JSON.stringify(error, null, 2));
    
    return {
      provider: 'openai',
      model: 'gpt-4o-mini',
      prompt,
      response: '',
      mentioned: false,
      position: null,
      sentiment: null,
      competitors_mentioned: [],
      sources_cited: [],
      response_time_ms: Date.now() - startTime,
      error: error.message || 'Unknown error',
    };
  }
}

// Analyze AI response for brand mentions
function analyzeResponse(
  response: string,
  brandName: string,
  competitors: string[]
): {
  mentioned: boolean;
  position: number | null;
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  competitorsMentioned: string[];
  sourcesCited: string[];
} {
  const lowerResponse = response.toLowerCase();
  const lowerBrand = brandName.toLowerCase();

  // Check if brand is mentioned
  const mentioned = lowerResponse.includes(lowerBrand);

  // Find position (which recommendation number)
  let position: number | null = null;
  if (mentioned) {
    // Try to find numbered lists (1., 2., etc.)
    const lines = response.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      if (line.includes(lowerBrand)) {
        // Check if it's in a numbered list
        const match = lines[i].match(/^(\d+)[.\)]/);
        if (match) {
          position = parseInt(match[1]);
          break;
        }
        // If not in numbered list, estimate position
        position = i + 1;
        break;
      }
    }
  }

  // Simple sentiment analysis
  let sentiment: 'positive' | 'neutral' | 'negative' | null = null;
  if (mentioned) {
    // Find the sentence containing the brand
    const sentences = response.split(/[.!?]+/);
    const brandSentence = sentences.find(s => s.toLowerCase().includes(lowerBrand));
    
    if (brandSentence) {
      const positiveWords = ['best', 'excellent', 'great', 'recommend', 'top', 'leading', 'popular', 'trusted', 'reliable', 'innovative'];
      const negativeWords = ['worst', 'bad', 'avoid', 'poor', 'limited', 'expensive', 'difficult', 'complex', 'issues'];
      
      const lowerSentence = brandSentence.toLowerCase();
      const hasPositive = positiveWords.some(word => lowerSentence.includes(word));
      const hasNegative = negativeWords.some(word => lowerSentence.includes(word));
      
      if (hasPositive && !hasNegative) sentiment = 'positive';
      else if (hasNegative && !hasPositive) sentiment = 'negative';
      else sentiment = 'neutral';
    }
  }

  // Check for competitor mentions
  const competitorsMentioned = competitors.filter(comp => 
    lowerResponse.includes(comp.toLowerCase())
  );

  // Extract cited sources (URLs)
  const urlRegex = /https?:\/\/[^\s)]+/g;
  const sourcesCited = response.match(urlRegex) || [];

  return {
    mentioned,
    position,
    sentiment,
    competitorsMentioned,
    sourcesCited,
  };
}

// Run analysis with all available providers
export async function runAnalysis(
  prompts: string[],
  brandName: string,
  competitors: string[] = [],
  context: string = ''
): Promise<AIQueryResult[]> {
  const results: AIQueryResult[] = [];

  for (const prompt of prompts) {
    // For now, only OpenAI is available
    const result = await queryOpenAI(prompt, brandName, competitors, context);
    results.push(result);
    
    // Small delay between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return results;
}

// Calculate overall scores from results
export function calculateScores(results: AIQueryResult[]): {
  visibility: number;
  accuracy: number;
  sentiment: number;
  overall: number;
} {
  if (results.length === 0) {
    return { visibility: 0, accuracy: 0, sentiment: 0, overall: 0 };
  }

  const validResults = results.filter(r => !r.error);
  if (validResults.length === 0) {
    return { visibility: 0, accuracy: 0, sentiment: 0, overall: 0 };
  }

  // Visibility: percentage of queries where brand was mentioned
  const mentionedCount = validResults.filter(r => r.mentioned).length;
  const visibility = Math.round((mentionedCount / validResults.length) * 100);

  // Position score: average position when mentioned (lower is better, convert to 0-100)
  const positionResults = validResults.filter(r => r.position !== null);
  let positionScore = 50; // Default
  if (positionResults.length > 0) {
    const avgPosition = positionResults.reduce((sum, r) => sum + (r.position || 0), 0) / positionResults.length;
    // Position 1 = 100, Position 5 = 50, Position 10+ = 0
    positionScore = Math.max(0, Math.round(100 - (avgPosition - 1) * 12.5));
  }

  // Sentiment score: positive = 100, neutral = 50, negative = 0
  const sentimentResults = validResults.filter(r => r.sentiment !== null);
  let sentimentScore = 50;
  if (sentimentResults.length > 0) {
    const sentimentValues: number[] = sentimentResults.map(r => {
      if (r.sentiment === 'positive') return 100;
      if (r.sentiment === 'negative') return 0;
      return 50;
    });
    sentimentScore = Math.round(sentimentValues.reduce((a, b) => a + b, 0) / sentimentValues.length);
  }

  // Overall score: weighted average
  const overall = Math.round(
    visibility * 0.4 +      // 40% weight on visibility
    positionScore * 0.3 +   // 30% weight on position
    sentimentScore * 0.3    // 30% weight on sentiment
  );

  return {
    visibility,
    accuracy: positionScore, // Using position as "accuracy" proxy
    sentiment: sentimentScore,
    overall,
  };
}
