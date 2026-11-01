import { parseInline } from '@/lib/course/markdown';

/**
 * One line of course text with «code» and **bold** runs. Safe in server and
 * client components: it is plain markup with no state.
 */
export function InlineText({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((run, index) => {
        if (run.kind === 'code') {
          return (
            <code
              key={index}
              className="bg-ink/5 text-brand-deep rounded-box px-1.5 py-0.5 font-mono text-small break-words"
            >
              {run.text}
            </code>
          );
        }
        if (run.kind === 'bold') {
          return (
            <strong key={index} className="font-bold">
              {run.text}
            </strong>
          );
        }
        return <span key={index}>{run.text}</span>;
      })}
    </>
  );
}
