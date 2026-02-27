import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const cronHeader = request.headers.get('x-vercel-cron');
  const authHeader = request.headers.get('authorization');
  const secret = authHeader?.replace('Bearer ', '');

  const envSecretSet = Boolean(process.env.CRON_SECRET);
  const isVercelCron = cronHeader === '1';
  const isValidSecret = envSecretSet && secret === process.env.CRON_SECRET;

  return NextResponse.json({
    authenticated: isVercelCron || isValidSecret,
    auth_method: isVercelCron ? 'vercel-cron' : isValidSecret ? 'bearer-token' : 'none',
    env_secret_set: envSecretSet,
    timestamp: new Date().toISOString(),
  });
}
