import { parseInline } from '@/lib/course/markdown';

/**
 * One line of course text with «code», **bold** and link runs. A link opens
 * in a new tab, because it leaves the course. Safe in server and
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
        if (run.kind === 'link') {
          return (
            <a
              key={index}
              href={run.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-deep font-semibold break-words underline underline-offset-2"
            >
              {run.text}
            </a>
          );
        }
        return <span key={index}>{run.text}</span>;
      })}
    </>
  );
}
