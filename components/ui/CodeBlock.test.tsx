import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CodeBlock } from './CodeBlock';

describe('CodeBlock', () => {
  it('colours SQL and captions it with the language', () => {
    render(<CodeBlock code="SELECT 1 -- one" lang="sql" />);
    expect(screen.getByText('SQL')).toBeInTheDocument();
    expect(screen.getByText('SELECT')).toHaveClass('text-code-keyword');
    expect(screen.getByText('-- one')).toHaveClass('text-code-comment');
  });

  it('colours PySpark as Python', () => {
    render(<CodeBlock code="df = spark.range(3)" lang="pyspark" />);
    expect(screen.getByText('PYSPARK')).toBeInTheDocument();
    expect(screen.getByText('3')).toHaveClass('text-code-number');
  });

  it('shows other languages as plain text, and takes a title', () => {
    const { container } = render(<CodeBlock code="a -> b" lang="text" title="Flow" />);
    expect(screen.getByText('Flow')).toBeInTheDocument();
    expect(container.querySelector('code')?.textContent).toBe('a -> b');
    expect(container.querySelector('code span')).toBeNull();
  });

  it('has no caption for plain text without a title', () => {
    const { container } = render(<CodeBlock code="plain" lang="text" />);
    expect(container.querySelector('figcaption')?.textContent).toBe('');
  });
});
