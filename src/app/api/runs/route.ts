import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runAnalysis, calculateScores } from '@/lib/ai/providers';
import { getTemplatesForProject } from '@/lib/constants/prompt-templates';

// Types explicites pour éviter les erreurs TypeScript
type ProjectRow = {
  id: string;
  user_id: string;
  name: string;
  website: string | null;
  industry: string | null;
  description: string | null;
  brand_name: string | null;
};

type CompetitorRow = {
  name: string;
  website: string | null;
};

type PromptTemplateRow = {
  id: string;
  prompt_text: string;
};

type RunRow = {
  id: string;
  project_id: string;
  status: string;
};

export async function POST(request: NextRequest) {
  console.log('🚀 Starting run...');
  
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.log('❌ Auth error:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('✅ User authenticated:', user.id);

    // Get request body
    const { projectId } = await request.json();
    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }
    console.log('✅ Project ID:', projectId);

    // Get project
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    // Cast explicite
    const project = projectData as ProjectRow | null;

    if (projectError || !project) {
      console.log('❌ Project error:', projectError);
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    console.log('✅ Project found:', project.name);

    // Get competitors
    const { data: competitorsData } = await supabase
      .from('competitors')
      .select('name, website')
      .eq('project_id', projectId);
    
    const competitors = (competitorsData as CompetitorRow[] | null) || [];

    // Get prompt templates
    const { data: templatesData } = await supabase
      .from('prompt_templates')
      .select('id, prompt_text')
      .eq('project_id', projectId);
    
    const promptTemplates = (templatesData as PromptTemplateRow[] | null) || [];

    // Check if OpenAI API key is configured
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.log('❌ No OpenAI API key');
      return NextResponse.json({ 
        error: 'OpenAI API key not configured. Add OPENAI_API_KEY to your .env.local file.' 
      }, { status: 500 });
    }
    console.log('✅ OpenAI API key found (starts with):', apiKey.substring(0, 10) + '...');

    // Create run record
    const { data: runData, error: runError } = await supabase
      .from('runs')
      .insert({
        project_id: projectId,
        status: 'running',
      })
      .select()
      .single();

    // Cast explicite
    const run = runData as RunRow | null;

    if (runError || !run) {
      console.log('❌ Run creation error:', runError);
      return NextResponse.json({ error: 'Failed to create run' }, { status: 500 });
    }
    console.log('✅ Run created:', run.id);

    // Get prompts (use custom or default)
    let prompts: string[] = [];
    
    // Get competitor names for prompt replacement
    const competitorNames = competitors.map((c) => c.name);
    const competitorsStr = competitorNames.length > 0 ? competitorNames.join(', ') : 'ses concurrents';
    
    if (promptTemplates.length > 0) {
      prompts = promptTemplates.map((t) => t.prompt_text);
      console.log('📝 Using custom prompts:', prompts.length);
    } else {
      // Use default templates, replacing placeholders
      const industry = project.industry || 'logiciels';
      const templates = getTemplatesForProject(industry);
      
      prompts = templates
        .filter(t => t.is_active)
        .map(t => 
          t.prompt_text
            .replace(/{brand}/g, project.name)
            .replace(/{industry}/g, industry)
            .replace(/{competitors}/g, competitorsStr)
            .replace(/{location}/g, 'France')
            .replace(/{website}/g, project.website || project.name)
        );
      console.log('📝 Using default prompts for industry:', industry, '- Count:', prompts.length);
    }

    console.log('📝 Prompts to analyze:', prompts);
    console.log('🏢 Competitors:', competitorNames);

    if (prompts.length === 0) {
      await supabase
        .from('runs')
        .update({
          status: 'failed',
          error_message: 'No prompts available for this project',
        })
        .eq('id', run.id);
      return NextResponse.json({ error: 'Aucun prompt disponible' }, { status: 400 });
    }

    // Run the analysis
    console.log('🤖 Starting AI analysis...');
    const results = await runAnalysis(prompts, project.name, competitorNames);
    console.log('✅ Analysis complete. Results:', results.length);

    if (results.length === 0) {
      await supabase
        .from('runs')
        .update({
          status: 'failed',
          error_message: 'No results returned by AI providers',
        })
        .eq('id', run.id);
      return NextResponse.json({ error: 'Aucun résultat retourné' }, { status: 500 });
    }
    
    // Log each result
    results.forEach((r, i) => {
      console.log(`  Result ${i + 1}: mentioned=${r.mentioned}, error=${r.error || 'none'}`);
      if (r.error) {
        console.log(`    Error details: ${r.error}`);
      }
    });

    // Calculate scores
    const scores = calculateScores(results);
    console.log('📊 Scores calculated:', scores);

    // Save run items
    const runItems = results.map(result => ({
      run_id: run.id,
      // Legacy column names (older schema)
      prompt: result.prompt,
      response: result.response,
      model: result.model,
      provider: result.provider,
      response_time_ms: result.response_time_ms,
      // New schema columns
      prompt_text: result.prompt,
      ai_model: result.model,
      ai_response: result.response,
      brand_mentioned: result.mentioned,
      brand_position: result.position,
      competitors_mentioned: result.competitors_mentioned,
      website_cited: result.sources_cited.length > 0,
      latency_ms: result.response_time_ms,
      error_message: result.error ?? null,
      score_sentiment:
        result.sentiment === 'positive'
          ? 100
          : result.sentiment === 'negative'
            ? 0
            : result.sentiment === 'neutral'
              ? 50
              : null,
    }));

    const { error: itemsError } = await supabase
      .from('run_items')
      .insert(runItems);

    if (itemsError) {
      console.error('❌ Error saving run items:', itemsError);
      await supabase
        .from('runs')
        .update({
          status: 'failed',
          error_message: itemsError.message,
        })
        .eq('id', run.id);
      return NextResponse.json({ error: 'Erreur sauvegarde des résultats' }, { status: 500 });
    } else {
      console.log('✅ Run items saved:', runItems.length);
    }

    // Update run with scores
    const { error: updateError } = await supabase
      .from('runs')
      .update({
        status: 'completed',
        score_overall: scores.overall,
        score_visibility: scores.visibility,
        score_accuracy: scores.accuracy,
        score_sentiment: scores.sentiment,
        total_prompts: prompts.length,
        completed_prompts: results.length,
        completed_at: new Date().toISOString(),
      })
      .eq('id', run.id);

    if (updateError) {
      console.error('❌ Error updating run:', updateError);
    } else {
      console.log('✅ Run updated with scores');
    }

    return NextResponse.json({
      success: true,
      runId: run.id,
      scores,
      resultsCount: results.length,
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An error occurred';
    console.error('❌ Run error:', error);
    return NextResponse.json({ 
      error: errorMessage 
    }, { status: 500 });
  }
}
