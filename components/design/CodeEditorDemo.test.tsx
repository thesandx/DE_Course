import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CodeEditorDemo } from './CodeEditorDemo';

describe('CodeEditorDemo', () => {
  it('keeps what the learner types', () => {
    render(<CodeEditorDemo />);
    const editor = screen.getByRole('textbox', { name: 'SQL editor' });
    expect(screen.getByText(/^5 lines\./)).toBeInTheDocument();
    fireEvent.change(editor, { target: { value: 'SELECT 1;' } });
    expect(editor).toHaveValue('SELECT 1;');
    expect(screen.getByText(/^1 lines\./)).toBeInTheDocument();
  });
});
