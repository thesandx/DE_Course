import { Fragment } from 'react';

import { type Block, type Inline, type ListBlock, parseNote } from '@/lib/notes/markdown';
import { cn } from '@/lib/utils';

export interface NoteViewProps {
  /** The note's Markdown. */
  markdown: string;
  className?: string;
}

function InlineNodes({ nodes }: { nodes: readonly Inline[] }) {
  return (
    <>
      {nodes.map((node, index) => {
        switch (node.type) {
          case 'text':
            return <Fragment key={index}>{node.text}</Fragment>;
          case 'break':
            return <br key={index} />;
          case 'code':
            return <code key={index}>{node.text}</code>;
          case 'bold':
            return (
              <strong key={index}>
                <InlineNodes nodes={node.children} />
              </strong>
            );
          case 'italic':
            return (
              <em key={index}>
                <InlineNodes nodes={node.children} />
              </em>
            );
          case 'underline':
            return (
              <u key={index}>
                <InlineNodes nodes={node.children} />
              </u>
            );
          case 'strike':
            return (
              <s key={index}>
                <InlineNodes nodes={node.children} />
              </s>
            );
          case 'mark':
            return (
              <mark key={index} data-color={node.color}>
                <InlineNodes nodes={node.children} />
              </mark>
            );
        }
      })}
    </>
  );
}

function List({ list }: { list: ListBlock }) {
  const items = list.items.map((item, index) => (
    <li key={index} {...(list.style === 'check' && { 'data-checked': String(item.checked) })}>
      {list.style === 'check' && (
        <span className="sr-only">{item.checked ? 'Done: ' : 'To do: '}</span>
      )}
      <InlineNodes nodes={item.content} />
      {item.children !== null && <List list={item.children} />}
    </li>
  ));
  if (list.style === 'number') return <ol>{items}</ol>;
  return list.style === 'check' ? <ul data-type="check">{items}</ul> : <ul>{items}</ul>;
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case 'heading': {
      const content = <InlineNodes nodes={block.content} />;
      if (block.level === 1) return <h2>{content}</h2>;
      return block.level === 2 ? <h3>{content}</h3> : <h4>{content}</h4>;
    }
    case 'paragraph':
      return (
        <p>
          <InlineNodes nodes={block.content} />
        </p>
      );
    case 'quote':
      return (
        <blockquote>
          <InlineNodes nodes={block.content} />
        </blockquote>
      );
    case 'code':
      return <pre data-lang={block.language}>{block.text}</pre>;
    case 'rule':
      return <hr />;
    case 'list':
      return <List list={block} />;
  }
}

/**
 * A note, read only: the notes page and Pip's suggested version. The same
 * `.note-doc` styles as the editor, so a note looks the same everywhere.
 * React escapes every character, so a note can show only the tags here.
 */
export function NoteView({ markdown, className }: NoteViewProps) {
  const blocks = parseNote(markdown);
  return (
    <div className={cn('note-doc text-body text-ink min-w-0', className)}>
      {blocks.map((block, index) => (
        <BlockView key={index} block={block} />
      ))}
    </div>
  );
}
