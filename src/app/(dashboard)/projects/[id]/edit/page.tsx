import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { ProjectForm } from '@/components/projects/project-form';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase
    .from('projects')
    .select('name')
    .eq('id', id)
    .single();
  
  return {
    title: project ? `Modifier ${project.name}` : 'Modifier le projet',
  };
}

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !project) {
    notFound();
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Back link */}
      <Link
        href={`/projects/${project.id}`}
        className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour au projet
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Modifier le projet</h1>
        <p className="text-zinc-400 mt-1">
          Mettez à jour les informations de votre projet.
        </p>
      </div>

      {/* Form */}
      <div className="rounded-xl border border-white/10 bg-zinc-900/20 p-6 md:p-8">
        <ProjectForm project={project} mode="edit" />
      </div>
    </div>
  );
}
