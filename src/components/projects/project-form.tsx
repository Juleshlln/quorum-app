'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, X, Globe, Building2, FileText } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Project } from '@/types/database';

interface ProjectFormProps {
  project?: Project;
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

        // Add competitors if any
        if (competitors.length > 0 && newProject) {
          const competitorsData = competitors.map(c => ({
            project_id: newProject.id,
            name: c.name,
            website: c.website || null,
          }));

          const { error: competitorError } = await supabase
            .from('competitors')
            .insert(competitorsData);

          if (competitorError) throw competitorError;
        }

        router.push(`/brand`);
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
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Basic Info */}
      <div className="space-y-6">
        <h3 className="text-sm font-medium text-white uppercase tracking-wider">
          Informations de base
        </h3>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Project Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-zinc-400 mb-2">
              Nom du projet *
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 text-white text-sm rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all placeholder:text-zinc-600"
                placeholder="Ma Startup"
                required
              />
            </div>
          </div>

          {/* Website */}
          <div>
            <label htmlFor="website" className="block text-sm font-medium text-zinc-400 mb-2">
              Site web
            </label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                id="website"
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 text-white text-sm rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all placeholder:text-zinc-600"
                placeholder="https://example.com"
              />
            </div>
          </div>
        </div>

        {/* Industry */}
        <div>
          <label htmlFor="industry" className="block text-sm font-medium text-zinc-400 mb-2">
            Secteur d&apos;activité
          </label>
          <select
            id="industry"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 text-white text-sm rounded-lg px-4 py-3 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all"
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
          <label htmlFor="location" className="block text-sm font-medium text-zinc-400 mb-2">
            Localisation (ville / région)
          </label>
          <input
            id="location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 text-white text-sm rounded-lg px-4 py-3 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all placeholder:text-zinc-600"
            placeholder="Béthune (62)"
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-zinc-400 mb-2">
            Description
          </label>
        <div className="relative">
          <FileText className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full bg-zinc-900 border border-zinc-800 text-white text-sm rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all placeholder:text-zinc-600 resize-none"
            placeholder="Décrivez brièvement votre entreprise et ce qu'elle fait..."
          />
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Utilisée pour contextualiser les prompts suggérés (ex : “primeur local à Béthune, produits frais, circuit court”).
        </p>
      </div>
      </div>

      {/* Keywords */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-white uppercase tracking-wider">
          Mots-clés
        </h3>
        <p className="text-sm text-zinc-500">
          Ces mots-clés servent à affiner les prompts suggérés et mieux capter comment l’IA décrit votre marque.
        </p>

        <div className="flex gap-2">
          <input
            type="text"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
            className="flex-1 bg-zinc-900 border border-zinc-800 text-white text-sm rounded-lg px-4 py-2.5 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all placeholder:text-zinc-600"
            placeholder="Ajouter un mot-clé"
          />
          <button
            type="button"
            onClick={addKeyword}
            className="px-4 py-2.5 bg-zinc-800 text-white text-sm rounded-lg hover:bg-zinc-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {keywords.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {keywords.map((keyword) => (
              <span
                key={keyword}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 text-zinc-300 text-sm rounded-lg"
              >
                {keyword}
                <button
                  type="button"
                  onClick={() => removeKeyword(keyword)}
                  className="text-zinc-500 hover:text-white transition-colors"
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
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-white uppercase tracking-wider">
            Concurrents
          </h3>
          <p className="text-sm text-zinc-500">
            Ajoutez vos principaux concurrents pour les comparer dans les analyses
          </p>

          <div className="flex gap-2">
            <input
              type="text"
              value={competitorName}
              onChange={(e) => setCompetitorName(e.target.value)}
              className="flex-1 bg-zinc-900 border border-zinc-800 text-white text-sm rounded-lg px-4 py-2.5 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all placeholder:text-zinc-600"
              placeholder="Nom du concurrent"
            />
            <input
              type="url"
              value={competitorWebsite}
              onChange={(e) => setCompetitorWebsite(e.target.value)}
              className="flex-1 bg-zinc-900 border border-zinc-800 text-white text-sm rounded-lg px-4 py-2.5 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all placeholder:text-zinc-600"
              placeholder="https://competitor.com"
            />
            <button
              type="button"
              onClick={addCompetitor}
              className="px-4 py-2.5 bg-zinc-800 text-white text-sm rounded-lg hover:bg-zinc-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {competitors.length > 0 && (
            <div className="space-y-2">
              {competitors.map((competitor, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between px-4 py-3 bg-zinc-900/50 border border-zinc-800 rounded-lg"
                >
                  <div>
                    <span className="text-white text-sm font-medium">{competitor.name}</span>
                    {competitor.website && (
                      <span className="text-zinc-500 text-sm ml-2">{competitor.website}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCompetitor(index)}
                    className="text-zinc-500 hover:text-red-400 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Submit */}
      <div className="flex items-center justify-end gap-4 pt-6 border-t border-zinc-800">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-2.5 text-zinc-400 text-sm font-medium hover:text-white transition-colors"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={isLoading || !name.trim()}
          className="px-6 py-2.5 bg-white text-black text-sm font-medium rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
