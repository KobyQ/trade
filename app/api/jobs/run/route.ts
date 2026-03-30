import { NextResponse } from 'next/server';
import { env } from '@/config/env';
import { runCoreJobs } from '@/services/job-runner';

export async function POST(req: Request) {
  const auth = req.headers.get('x-job-secret');
  if (auth !== env.JOB_SHARED_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const result = await runCoreJobs();
  return NextResponse.json({ ok: true, result });
}
