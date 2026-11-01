import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Prose } from './Prose';

describe('Prose', () => {
  it('renders every block kind with inline code and bold', () => {
    render(
      <Prose
        source={`
          ## Keys and «partitions»

          Use **trip_id** as the key.

          - one
          - two

          ~~~sql
          SELECT 1;
          ~~~

          | Setting | Effect |
          |---|---|
          | acks=all | Durable |

          > [!senior] Say why
          > Tie the key to ordering.
        `}
      />,
    );
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Keys and partitions');
    expect(screen.getByText('trip_id').tagName).toBe('STRONG');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('SELECT 1;')).toBeInTheDocument();
    expect(screen.getByText('SQL')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Setting' })).toBeInTheDocument();
    expect(screen.getByText(/Tie the key to ordering/)).toBeInTheDocument();
  });

  it('leaves out the language label for plain text diagrams', () => {
    render(<Prose source={'~~~text\na -> b\n~~~'} />);
    expect(screen.queryByText('TEXT')).not.toBeInTheDocument();
  });
});
