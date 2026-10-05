import { describe, expect, it } from 'vitest';
import { parseAnswered } from './feedback';

describe('parseAnswered', () => {
  it('reads the day of the last answer by report', () => {
    expect(parseAnswered('{"r-1":"2026-10-05","r-2":"2026-10-04"}')).toEqual({ 'r-1': '2026-10-05', 'r-2': '2026-10-04' });
  });

  it('drops what is not a day, and survives a damaged store', () => {
    expect(parseAnswered('{"r-1":"2026-10-05","r-2":7,"r-3":null}')).toEqual({ 'r-1': '2026-10-05' });
    for (const stored of [null, '', '{', '[]', '"text"', 'null']) expect(parseAnswered(stored)).toEqual({});
  });
});
