import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { CodeLanguage } from '@/lib/code-highlight';

import { CodeEditor } from './CodeEditor';

interface HarnessProps {
  initial: string;
  language: CodeLanguage;
  onRun?: () => void;
  onSubmit?: () => void;
}

/** A parent that owns the value, as the runnable editor does. */
function Harness({ initial, language, onRun, onSubmit }: HarnessProps) {
  const [value, setValue] = useState(initial);
  return (
    <CodeEditor
      value={value}
      onChange={setValue}
      language={language}
      label="Editor"
      {...(onRun !== undefined ? { onRun } : {})}
      {...(onSubmit !== undefined ? { onSubmit } : {})}
    />
  );
}

function editor(initial: string, language: CodeLanguage = 'python', caret?: [number, number]) {
  render(<Harness initial={initial} language={language} />);
  const area = screen.getByRole('textbox', { name: 'Editor' }) as HTMLTextAreaElement;
  const [start, end] = caret ?? [initial.length, initial.length];
  area.setSelectionRange(start, end);
  return area;
}

describe('CodeEditor', () => {
  it('indents with Tab and dedents with Shift+Tab', () => {
    const area = editor('x = 1', 'python', [0, 0]);
    fireEvent.keyDown(area, { key: 'Tab' });
    expect(area).toHaveValue('    x = 1');
    fireEvent.keyDown(area, { key: 'Tab', shiftKey: true });
    expect(area).toHaveValue('x = 1');
  });

  it('indents every selected line by the language unit', () => {
    const area = editor('SELECT a\nFROM t', 'sql', [0, 15]);
    fireEvent.keyDown(area, { key: 'Tab' });
    expect(area).toHaveValue('  SELECT a\n  FROM t');
  });

  it('keeps the indentation on Enter, and indents after a colon', () => {
    const area = editor('def f():');
    fireEvent.keyDown(area, { key: 'Enter' });
    expect(area).toHaveValue('def f():\n    ');
  });

  it('steps back out after a return', () => {
    const area = editor('def f():\n    return 1');
    fireEvent.keyDown(area, { key: 'Enter' });
    expect(area).toHaveValue('def f():\n    return 1\n');
  });

  it('indents after an open bracket', () => {
    const area = editor('SELECT count(', 'sql');
    fireEvent.keyDown(area, { key: 'Enter' });
    expect(area).toHaveValue('SELECT count(\n  ');
  });

  it('toggles a comment with Ctrl+/', () => {
    const area = editor('SELECT 1\nFROM t', 'sql', [0, 3]);
    fireEvent.keyDown(area, { key: '/', ctrlKey: true });
    expect(area).toHaveValue('-- SELECT 1\nFROM t');
    area.setSelectionRange(0, 3);
    fireEvent.keyDown(area, { key: '/', metaKey: true });
    expect(area).toHaveValue('SELECT 1\nFROM t');
  });

  it('deletes back to the previous indent stop', () => {
    const area = editor('      x', 'python', [6, 6]);
    fireEvent.keyDown(area, { key: 'Backspace' });
    expect(area).toHaveValue('    x');
  });

  it('runs with Ctrl+Enter and submits with Ctrl+Shift+Enter', () => {
    const onRun = vi.fn();
    const onSubmit = vi.fn();
    render(<Harness initial="" language="sql" onRun={onRun} onSubmit={onSubmit} />);
    const area = screen.getByRole('textbox', { name: 'Editor' });
    fireEvent.keyDown(area, { key: 'Enter', ctrlKey: true });
    fireEvent.keyDown(area, { key: 'Enter', metaKey: true, shiftKey: true });
    expect(onRun).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(area).toHaveValue('');
  });

  it('lets Esc, then Tab, leave the editor', () => {
    const area = editor('x', 'python', [0, 0]);
    fireEvent.keyDown(area, { key: 'Escape' });
    // Not prevented: the browser moves focus on.
    expect(fireEvent.keyDown(area, { key: 'Tab' })).toBe(true);
    expect(area).toHaveValue('x');
    // The next Tab indents again.
    expect(fireEvent.keyDown(area, { key: 'Tab' })).toBe(false);
  });

  it('colours the code, marks the error line and fills to the minimum height', () => {
    const { container } = render(
      <CodeEditor
        value={'SELECT 1\nFRM t'}
        onChange={() => undefined}
        language="sql"
        label="SQL editor"
        errorLine={2}
        minLines={5}
      />,
    );
    const lines = container.querySelectorAll('.code-editor-line');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toHaveAttribute('data-error', 'true');
    expect(lines[0]).not.toHaveAttribute('data-error');
    expect(container.querySelectorAll('.code-editor-filler')).toHaveLength(3);
    expect(screen.getByText('SELECT')).toHaveClass('text-code-keyword');
    expect(screen.getByRole('textbox', { name: 'SQL editor' })).toHaveAttribute(
      'spellcheck',
      'false',
    );
  });
});
