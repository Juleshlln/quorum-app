import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ProjectForm } from '@/components/projects/project-form';

export const metadata = {
  title: 'Nouveau projet',
};

export default function NewProjectPage() {
  return (
    <div className="max-w-3xl mx-auto">
      {/* Back link */}
      <Link
        href="/projects"
        className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour aux projets
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Nouveau projet</h1>
        <p className="text-zinc-400 mt-1">
          Configurez votre marque pour commencer à analyser sa visibilité dans les IA.
        </p>
      </div>

      {/* Form */}
      <div className="rounded-xl border border-white/10 bg-zinc-900/20 p-6 md:p-8">
        <ProjectForm mode="create" />
      </div>
    </div>
  );
}
