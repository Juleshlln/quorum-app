'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, X, Globe, Building2, FileText } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
type ProjectFormProject = {
  id?: string;
  name: string;
  website: string | null;
  industry: string | null;
  description: string | null;
  location: string | null;
  keywords: string[] | null;
};

interface ProjectFormProps {
  project?: ProjectFormProject;
  mode: 'create' | 'edit';
}

export function ProjectForm({ project, mode }: ProjectFormProps) {
  const router = useRouter();
  const supabase = createClient();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState(project?.name || '');
  const [website, setWebsite] = useState(project?.website || '');
  const [industry, setIndustry] = useState(project?.industry || '');
  const [description, setDescription] = useState(project?.description || '');
  const [location, setLocation] = useState(project?.location || '');
  const [keywords, setKeywords] = useState<string[]>(project?.keywords || []);
  const [keywordInput, setKeywordInput] = useState('');

  // Competitors
  const [competitors, setCompetitors] = useState<{ name: string; website: string }[]>([]);
  const [competitorName, setCompetitorName] = useState('');
  const [competitorWebsite, setCompetitorWebsite] = useState('');
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Array<{
    id?: string;
    name: string;
    website?: string | null;
    description?: string | null;
    confidence?: number | null;
    method?: string | null;
    evidence?: Array<{ url?: string }>;
    selected: boolean;
  }>>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isSavingSuggestions, setIsSavingSuggestions] = useState(false);
  const activeProjectId = createdProjectId || project?.id || null;

  const runDetection = async (projectId: string) => {
    setIsDetecting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/competitors/detect`, {
        method: 'POST',
      });
      const data = await res.json();
      const list = Array.isArray(data?.suggestions) ? data.suggestions : [];
      const formatted = list.map((s: any) => ({
        id: s.id,
        name: s.name,
        website: s.website || null,
        description: s.description || null,
        confidence: s.confidence ?? null,
        method: s.method || null,
        evidence: s.evidence || [],
        selected: true,
      }));
      setSuggestions(formatted);
    } catch {
      // ignore
    } finally {
      setIsDetecting(false);
    }
  };

  const runConcurrentsDetection = async (projectId: string) => {
    try {
      await fetch(`/api/projects/${projectId}/concurrents/detect`, { method: 'POST' });
    } catch {
      // ignore
    }
  };

  const addKeyword = () => {
    if (keywordInput.trim() && !keywords.includes(keywordInput.trim())) {
      setKeywords([...keywords, keywordInput.trim()]);
      setKeywordInput('');
    }
  };

  const removeKeyword = (keyword: string) => {
    setKeywords(keywords.filter(k => k !== keyword));
  };

  const addCompetitor = () => {
    if (competitorName.trim()) {
      setCompetitors([...competitors, { 
        name: competitorName.trim(), 
        website: competitorWebsite.trim() 
      }]);
      setCompetitorName('');
      setCompetitorWebsite('');
    }
  };

  const removeCompetitor = (index: number) => {
    setCompetitors(competitors.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setError('Vous devez être connecté');
        return;
      }

      if (mode === 'create') {
        const { data: existingProjects } = await supabase
          .from('projects')
          .select('id')
          .eq('user_id', user.id)
          .limit(1);

        if ((existingProjects || []).length > 0) {
          setError('Vous avez déjà une marque active. Modifiez-la depuis Brand settings.');
          return;
        }

        // Create project
        const { data: newProject, error: projectError } = await supabase
          .from('projects')
          .insert({
            user_id: user.id,
            name,
            website: website || null,
            industry: industry || null,
            description: description || null,
            location: location || null,
            keywords: keywords.length > 0 ? keywords : null,
          })
          .select()
          .single();

        if (projectError) throw projectError;

        if (newProject) {
          await supabase
            .from('profiles')
            .update({ active_project_id: newProject.id })
            .eq('id', user.id);
        }

        if (newProject) {
          setCreatedProjectId(newProject.id);
          await runDetection(newProject.id);
          await runConcurrentsDetection(newProject.id);

          // Save manual competitors immediately (if any)
          if (competitors.length > 0) {
            const competitorsData = competitors.map(c => ({
              project_id: newProject.id,
              name: c.name,
              website: c.website || null,
            }));
            await supabase.from('competitors').insert(competitorsData);
          }
        }

        return;
      } else if (mode === 'edit' && project) {
        // Update project
        const { error: updateError } = await supabase
          .from('projects')
          .update({
            name,
            website: website || null,
            industry: industry || null,
            description: description || null,
            location: location || null,
            keywords: keywords.length > 0 ? keywords : null,
          })
          .eq('id', project.id);

        if (updateError) throw updateError;

        if (!project?.id) {
          throw new Error('Projet introuvable');
        }
        await runConcurrentsDetection(project.id);
        router.push(`/brand`);
      }

      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      {/* Basic Info */}
      <div className="quorum-panel-strong space-y-6 p-6">
        <h3 className="quorum-kicker">
          Informations de base
        </h3>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Project Name */}
          <div>
            <label htmlFor="name" className="quorum-label">
              Nom du projet *
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 quorum-text-subtle" />
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="quorum-input-with-icon"
                placeholder="Ma Startup"
                required
              />
            </div>
          </div>

          {/* Website */}
          <div>
            <label htmlFor="website" className="quorum-label">
              Site web
            </label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 quorum-text-subtle" />
              <input
                id="website"
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="quorum-input-with-icon"
                placeholder="https://example.com"
              />
            </div>
          </div>
        </div>

        {/* Industry */}
        <div>
          <label htmlFor="industry" className="quorum-label">
            Secteur d&apos;activité
          </label>
          <select
            id="industry"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="quorum-select"
          >
            <option value="">Sélectionner un secteur</option>
            <option value="saas">SaaS / Logiciel</option>
            <option value="ecommerce">E-commerce</option>
            <option value="finance">Finance / Fintech</option>
            <option value="health">Santé / Healthtech</option>
            <option value="education">Éducation / Edtech</option>
            <option value="marketing">Marketing / Publicité</option>
            <option value="media">Média / Contenu</option>
            <option value="retail">Retail / Commerce</option>
            <option value="real-estate">Immobilier</option>
            <option value="travel">Voyage / Tourisme</option>
            <option value="food">Alimentation / Foodtech</option>
            <option value="other">Autre</option>
          </select>
        </div>

        {/* Location */}
        <div>
          <label htmlFor="location" className="quorum-label">
            Localisation (ville / région)
          </label>
          <input
            id="location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="quorum-input"
            placeholder="Béthune (62)"
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="quorum-label">
            Description
          </label>
        <div className="relative">
          <FileText className="absolute left-3 top-3 h-4 w-4 quorum-text-subtle" />
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="quorum-textarea pl-10"
            placeholder="Décrivez brièvement votre entreprise et ce qu'elle fait..."
          />
        </div>
        <p className="mt-2 text-xs quorum-text-subtle">
          Utilisée pour contextualiser les prompts suggérés (ex : “primeur local à Béthune, produits frais, circuit court”).
        </p>
      </div>
      </div>

      {/* Keywords */}
      <div className="quorum-panel space-y-4 p-6">
        <h3 className="quorum-kicker">
          Mots-clés
        </h3>
        <p className="text-sm quorum-text-muted">
          Ces mots-clés servent à affiner les prompts suggérés et mieux capter comment l’IA décrit votre marque.
        </p>

        <div className="flex gap-2">
          <input
            type="text"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
            className="quorum-input flex-1"
            placeholder="Ajouter un mot-clé"
          />
          <button
            type="button"
            onClick={addKeyword}
            className="quorum-btn-secondary px-4"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {keywords.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {keywords.map((keyword) => (
              <span
                key={keyword}
                className="inline-flex items-center gap-1.5 rounded-full border quorum-border-default quorum-surface px-3 py-1.5 text-sm quorum-text-primary"
              >
                {keyword}
                <button
                  type="button"
                  onClick={() => removeKeyword(keyword)}
                  className="quorum-text-subtle transition-colors hover:quorum-text-primary"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Competitors */}
      {mode === 'create' && (
        <div className="quorum-panel space-y-4 p-6">
          <h3 className="quorum-kicker">
            Concurrents
          </h3>
          <p className="text-sm quorum-text-muted">
            Ajoutez vos principaux concurrents pour les comparer dans les analyses
          </p>

          <div className="flex gap-2">
            <input
              type="text"
              value={competitorName}
              onChange={(e) => setCompetitorName(e.target.value)}
              className="quorum-input flex-1"
              placeholder="Nom du concurrent"
            />
            <input
              type="url"
              value={competitorWebsite}
              onChange={(e) => setCompetitorWebsite(e.target.value)}
              className="quorum-input flex-1"
              placeholder="https://competitor.com"
            />
            <button
              type="button"
              onClick={addCompetitor}
              className="quorum-btn-secondary px-4"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {competitors.length > 0 && (
            <div className="space-y-2">
              {competitors.map((competitor, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-2xl border quorum-border-default quorum-surface-strong px-4 py-3"
                >
                  <div>
                    <span className="quorum-text-primary text-sm font-medium">{competitor.name}</span>
                    {competitor.website && (
                      <span className="ml-2 text-sm quorum-text-subtle">{competitor.website}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCompetitor(index)}
                    className="quorum-text-subtle transition-colors hover:text-red-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {(createdProjectId || mode === 'edit') && (
        <div className="quorum-panel-strong p-6 space-y-4">
          <h3 className="quorum-kicker">
            Concurrents suggérés
          </h3>
          {mode === 'edit' && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => activeProjectId && runDetection(activeProjectId)}
                className="quorum-btn-secondary"
              >
                Lancer la détection
              </button>
            </div>
          )}
          {isDetecting && (
            <p className="text-sm quorum-text-muted">Détection en cours...</p>
          )}
          {!isDetecting && suggestions.length === 0 && (
            <p className="text-sm quorum-text-muted">Aucune suggestion trouvée.</p>
          )}
          {!isDetecting && suggestions.length > 0 && (
            <div className="space-y-3">
              {suggestions.map((s, idx) => (
                <div key={`${s.name}-${idx}`} className="flex items-start gap-3 rounded-2xl border quorum-border-default quorum-surface-strong p-3">
                  <input
                    type="checkbox"
                    checked={s.selected}
                    onChange={(e) => {
                      const next = [...suggestions];
                      next[idx] = { ...s, selected: e.target.checked };
                      setSuggestions(next);
                    }}
                  />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <input
                        value={s.name}
                        onChange={(e) => {
                          const next = [...suggestions];
                          next[idx] = { ...s, name: e.target.value };
                          setSuggestions(next);
                        }}
                        className="quorum-input w-full px-3 py-2"
                      />
                      <span className="text-xs quorum-text-subtle">
                        {s.confidence ? `${Math.round(s.confidence * 100)}%` : '—'}
                      </span>
                    </div>
                    <input
                      value={s.website || ''}
                        onChange={(e) => {
                          const next = [...suggestions];
                          next[idx] = { ...s, website: e.target.value };
                          setSuggestions(next);
                        }}
                      className="quorum-input w-full px-3 py-2 text-xs"
                      placeholder="https://competitor.com"
                    />
                    {s.description && (
                      <p className="text-xs quorum-text-muted">{s.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={async () => {
                if (!activeProjectId) return;
                setIsSavingSuggestions(true);
                const accepted = suggestions.filter((s) => s.selected);
                const suggestionIds = accepted.map((s) => s.id).filter(Boolean);
                await fetch(`/api/projects/${activeProjectId}/competitors/confirm`, {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ accepted, suggestionIds }),
                });
                setIsSavingSuggestions(false);
                if (mode === 'create') router.push('/brand');
              }}
              className="quorum-btn-primary"
              disabled={isSavingSuggestions}
            >
              {isSavingSuggestions ? 'Enregistrement...' : 'Enregistrer les concurrents'}
            </button>
            <button
              type="button"
              onClick={() => mode === 'create' ? router.push('/brand') : null}
              className="quorum-btn-secondary"
            >
              Ignorer
            </button>
          </div>
        </div>
      )}

      {/* Submit */}
      <div className="flex items-center justify-end gap-4 border-t quorum-border-default pt-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="quorum-btn-ghost"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={isLoading || !name.trim()}
          className="quorum-btn-primary"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {mode === 'create' ? 'Création...' : 'Enregistrement...'}
            </>
          ) : (
            mode === 'create' ? 'Créer le projet' : 'Enregistrer'
          )}
        </button>
      </div>
    </form>
  );
}
