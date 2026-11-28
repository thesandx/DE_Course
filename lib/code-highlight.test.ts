import { describe, expect, it } from 'vitest';

import { highlight, highlightLines, type Token } from '@/lib/code-highlight';

function kinds(tokens: readonly Token[]): string {
  return tokens
    .filter((token) => token.type !== 'plain')
    .map((token) => `${token.type}:${token.text}`)
    .join(' ');
}

describe('highlight', () => {
  it('gives back the source exactly when the tokens are joined', () => {
    const sources: [string, 'sql' | 'python'][] = [
      ["SELECT a::date, 'it''s' -- note\nFROM t /* x\ny */ WHERE b <> 2;", 'sql'],
      [
        "@task(retries=3)\ndef f(x: int) -> str:\n    '''doc'''\n    return f\"{x}\" # done\n",
        'python',
      ],
      ['DO $$ BEGIN RAISE NOTICE $q$hi$q$; END $$;', 'sql'],
      ["s = 'unterminated\nnext = 1", 'python'],
    ];
    for (const [source, language] of sources) {
      expect(
        highlight(source, language)
          .map((token) => token.text)
          .join(''),
      ).toBe(source);
    }
  });

  it('marks SQL keywords, functions, strings, numbers and comments', () => {
    expect(
      kinds(highlight("select count(*) AS n FROM t WHERE x = 'a' AND y > 1.5 -- c", 'sql')),
    ).toBe(
      "keyword:select function:count operator:* keyword:AS keyword:FROM keyword:WHERE operator:= string:'a' keyword:AND operator:> number:1.5 comment:-- c",
    );
  });

  it('treats NULL, TRUE and FALSE as constants and a keyword before ( as a keyword', () => {
    expect(kinds(highlight('SELECT NULL, TRUE, left(s, 2) OVER (w)', 'sql'))).toBe(
      'keyword:SELECT constant:NULL constant:TRUE keyword:left number:2 keyword:OVER',
    );
  });

  it('marks Python keywords, definitions, calls, decorators and constants', () => {
    expect(
      kinds(highlight('@flow\ndef run(day):\n    return len(day) is None # x', 'python')),
    ).toBe(
      'decorator:@flow keyword:def function:run keyword:return function:len keyword:is constant:None comment:# x',
    );
  });

  it('keeps a number inside a name as part of the name', () => {
    expect(kinds(highlight('col1 + 2', 'sql'))).toBe('operator:+ number:2');
  });

  it('reads Python strings with prefixes and triple quotes as one token', () => {
    const tokens = highlight('x = rb"\\x00"\ny = """a\nb"""', 'python');
    expect(tokens.filter((token) => token.type === 'string').map((token) => token.text)).toEqual([
      'rb"\\x00"',
      '"""a\nb"""',
    ]);
  });
});

describe('highlightLines', () => {
  it('splits tokens that span lines, so each line renders on its own', () => {
    const lines = highlightLines('a = """x\ny"""\n\nb', 'python');
    expect(lines).toHaveLength(4);
    expect(lines[1]).toEqual([{ type: 'string', text: 'y"""' }]);
    expect(lines[2]).toEqual([]);
  });
});
