'use client';

import { useState } from 'react';

import { CopyButton } from '@/components/gcp/CopyButton';
import type { CheatGroup, RosettaRow } from '@/types/k8s';

export interface CheatsheetProps {
  rosetta: readonly RosettaRow[];
  groups: readonly CheatGroup[];
}

/**
 * The cheatsheet: Docker commands beside their Kubernetes match, then the
 * kubectl commands of the labs, grouped by job. The search box filters both
 * as the learner types.
 */
export function Cheatsheet({ rosetta, groups }: CheatsheetProps) {
  const [query, setQuery] = useState('');
  const term = query.trim().toLowerCase();
  const hit = (...texts: readonly string[]): boolean =>
    term === '' || texts.join(' ').toLowerCase().includes(term);

  const rows = rosetta.filter((row) => hit(row.docker, row.kubernetes, row.note));
  const shown = groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => hit(group.group, item.command, item.does)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <label className="bg-surface border-line rounded-pill shadow-card focus-within:border-line-strong flex min-h-12 items-center gap-3 border px-5">
        <span className="sr-only">Search the cheatsheet</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search: logs, rollout, secret, port-forward"
          className="text-body placeholder:text-ink-faint min-w-0 flex-1 bg-transparent outline-none"
        />
      </label>

      {rows.length > 0 && (
        <section aria-labelledby="rosetta-heading" className="flex flex-col gap-3">
          <h2 id="rosetta-heading" className="text-title">
            Docker to Kubernetes
          </h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {rows.map((row) => (
              <li
                key={row.docker}
                className="bg-surface border-line rounded-card shadow-card flex min-w-0 flex-col gap-2 border p-4"
              >
                <p className="flex flex-col gap-0.5">
                  <span className="eyebrow text-ink-faint">Docker</span>
                  <code className="text-small font-mono break-words">{row.docker}</code>
                </p>
                <p className="flex flex-col gap-0.5">
                  <span className="eyebrow text-brand-deep">Kubernetes</span>
                  <code className="text-small text-brand-deep font-mono font-semibold break-words">
                    {row.kubernetes}
                  </code>
                </p>
                {row.note !== '' && <p className="text-small text-ink-soft">{row.note}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {shown.map((group) => (
        <section
          key={group.group}
          aria-label={group.group}
          className="bg-surface border-line rounded-card shadow-card flex flex-col gap-1 border p-5"
        >
          <h2 className="text-heading pb-2">{group.group}</h2>
          <ul className="flex flex-col">
            {group.items.map((item) => (
              <li
                key={item.command}
                className="border-line flex min-w-0 items-center gap-3 border-t py-2"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <code className="text-small font-mono font-semibold break-words">
                    {item.command}
                  </code>
                  <span className="text-small text-ink-soft">{item.does}</span>
                </span>
                <span className="bg-night-deep rounded-input shrink-0">
                  <CopyButton text={item.command} label={item.command} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {rows.length === 0 && shown.length === 0 && (
        <p className="text-body text-ink-soft">Nothing matches “{query.trim()}”.</p>
      )}
    </div>
  );
}
