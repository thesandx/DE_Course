import { NextResponse } from 'next/server';

import { getLab } from '@/lib/course/gcp/catalog';

/**
 * `GET /api/lab-files/<station>/<file>` — a sample file of a GCP lab, as a
 * download. The files are part of the course content, so they are public
 * like every other read, and the response is the same for every caller.
 */

const TYPES: Readonly<Record<string, string>> = {
  csv: 'text/csv',
  json: 'application/json',
  jsonl: 'application/x-ndjson',
  py: 'text/x-python',
  yaml: 'application/yaml',
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ station: string; file: string }> },
): Promise<NextResponse> {
  const { station, file } = await params;
  const found = getLab(station)?.files.find((item) => item.name === file);
  if (found === undefined) {
    return NextResponse.json({ error: 'not_found', message: 'No such lab file' }, { status: 404 });
  }
  const extension = found.name.split('.').pop() ?? '';
  return new NextResponse(`${found.content}\n`, {
    headers: {
      'content-type': `${TYPES[extension] ?? 'text/plain'}; charset=utf-8`,
      'content-disposition': `attachment; filename="${found.name}"`,
      'cache-control': 'public, max-age=3600',
    },
  });
}
