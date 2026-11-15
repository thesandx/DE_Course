import { InlineText } from '@/components/course/InlineText';
import { CodeBlock } from '@/components/gcp/CodeBlock';
import type { K8sFile } from '@/types/k8s';

export interface ManifestFileProps {
  file: K8sFile;
}

function FileBody({ file }: ManifestFileProps) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <CodeBlock label={file.name} code={file.code} />
      {file.notes.length > 0 && (
        <ol className="flex flex-col gap-2">
          {file.notes.map(([line, note], index) => (
            <li key={line} className="text-small flex items-start gap-3">
              <span
                aria-hidden="true"
                className="bg-ink text-on-ink rounded-box text-micro mt-0.5 inline-grid size-5 shrink-0 place-items-center font-mono font-semibold"
              >
                {index + 1}
              </span>
              <span className="min-w-0">
                <code className="bg-ink/5 text-brand-deep rounded-box px-1.5 py-0.5 font-mono break-words">
                  {line}
                </code>{' '}
                <span className="text-ink-soft">
                  <InlineText text={note} />
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/**
 * A file of the lesson, such as a manifest, with a note for each line that
 * matters. A long file opens closed, so the lesson stays easy to scan.
 */
export function ManifestFile({ file }: ManifestFileProps) {
  const lines = file.code.split('\n').length;
  if (file.collapsed !== true) return <FileBody file={file} />;
  return (
    <details className="border-line rounded-card group border">
      <summary className="text-body hover:bg-sunken rounded-card flex min-h-11 cursor-pointer items-center justify-between gap-3 px-4 py-2 font-semibold">
        <span className="min-w-0 font-mono break-words">{file.name}</span>
        <span className="text-small text-ink-soft shrink-0 font-normal">{lines} lines</span>
      </summary>
      <div className="p-3 pt-1">
        <FileBody file={file} />
      </div>
    </details>
  );
}
