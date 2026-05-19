import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveProjectForUser } from '@/lib/projects/get-active-project';

function subtractDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() - days);
  return copy;
}

export function resolveDateWindow(url: string, defaultDays = 30) {
  const { searchParams } = new URL(url);
  const explicitStart = searchParams.get('startDate');
  const explicitEnd = searchParams.get('endDate');
  const rawDays = Number(searchParams.get('days') || defaultDays);
  const days = Number.isFinite(rawDays) && rawDays > 0 ? Math.round(rawDays) : defaultDays;

  if (explicitStart && explicitEnd) {
    return {
      startDate: explicitStart,
      endDate: explicitEnd,
      days,
    };
  }

  const now = new Date();
  const endDate = now.toISOString().slice(0, 10);
  const startDate = subtractDays(now, days - 1).toISOString().slice(0, 10);

  return {
    startDate,
    endDate,
    days,
  };
}

export async function requireActiveProject() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const project = await getActiveProjectForUser(user.id);
  if (!project) {
    return { error: NextResponse.json({ error: 'No active project' }, { status: 400 }) };
  }

  return { user, project };
}
