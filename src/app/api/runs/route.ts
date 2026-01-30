import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runAnalysis, calculateScores } from '@/lib/ai/providers';
import { getTemplatesForProject } from '@/lib/constants/prompt-templates';

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

    // Get project with competitors
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select(`
        *,
        competitors (name, website),
        prompt_templates (id, prompt_text)
      `)
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      console.log('❌ Project error:', projectError);
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    console.log('✅ Project found:', project.name);

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
    const { data: run, error: runError } = await supabase
      .from('runs')
      .insert({
        project_id: projectId,
        status: 'running',
      })
      .select()
      .single();

    if (runError || !run) {
      console.log('❌ Run creation error:', runError);
      return NextResponse.json({ error: 'Failed to create run' }, { status: 500 });
    }
    console.log('✅ Run created:', run.id);

    // Get prompts (use custom or default)
    let prompts: string[] = [];
    
    // Get competitor names for prompt replacement
    const competitorNames = project.competitors?.map((c: any) => c.name) || [];
    const competitorsStr = competitorNames.length > 0 ? competitorNames.join(', ') : 'ses concurrents';
    
    if (project.prompt_templates && project.prompt_templates.length > 0) {
      prompts = project.prompt_templates.map((t: any) => t.prompt_text);
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

    // Run the analysis
    console.log('🤖 Starting AI analysis...');
    const results = await runAnalysis(prompts, project.name, competitorNames);
    console.log('✅ Analysis complete. Results:', results.length);
    
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
      provider: result.provider,
      model: result.model,
      prompt: result.prompt,
      response: result.response,
      brand_mentioned: result.mentioned,
      position: result.position,
      sentiment: result.sentiment,
      competitors_mentioned: result.competitors_mentioned,
      sources_cited: result.sources_cited,
      response_time_ms: result.response_time_ms,
    }));

    const { error: itemsError } = await supabase
      .from('run_items')
      .insert(runItems);

    if (itemsError) {
      console.error('❌ Error saving run items:', itemsError);
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

  } catch (error: any) {
    console.error('❌ Run error:', error);
    return NextResponse.json({ 
      error: error.message || 'An error occurred' 
    }, { status: 500 });
  }
}
