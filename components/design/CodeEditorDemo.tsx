'use client';

import { useState } from 'react';

import { CodeEditor } from '@/components/ui/CodeEditor';

const START = `SELECT city, COUNT(*) AS trips
FROM trips
WHERE trip_date >= DATE '2026-11-01'
GROUP BY city
ORDER BY trips DESC;`;

/**
 * A `CodeEditor` on `/design`. A client island because the editor is
 * controlled: its text lives in this parent.
 */
export function CodeEditorDemo() {
  const [code, setCode] = useState(START);
  return (
    <div className="flex flex-col gap-2">
      <CodeEditor value={code} onChange={setCode} language="sql" label="SQL editor" minLines={6} />
      <p className="text-small text-ink-soft">
        {code.split('\n').length} lines. Tab indents, and Esc then Tab leaves the editor.
      </p>
    </div>
  );
}
