import { describe, expect, it } from 'vitest';
import type { LngLat } from '../../src/domain/types';
import { distanceMeters, parseCsv, parseCsvLine, simplifyLine } from './gtfs';

describe('parseCsvLine', () => {
  it('splits plain and quoted fields', () => {
    expect(parseCsvLine('1211351,"Av. Dr. Vital Brasil, 334","Ref.: Metrô Butantã",-23.57,-46.70')).toEqual([
      '1211351', 'Av. Dr. Vital Brasil, 334', 'Ref.: Metrô Butantã', '-23.57', '-46.70',
    ]);
  });

  it('handles escaped quotes and empty fields', () => {
    expect(parseCsvLine('"a ""b"" c",,"",d')).toEqual(['a "b" c', '', '', 'd']);
  });
});

describe('parseCsv', () => {
  const text = '﻿"route_id","name"\r\n"8082-10","Cid. Universitária"\r\n"1012-10","Outra"\r\n';

  it('keys rows by the header and ignores the BOM and blank lines', () => {
    expect(parseCsv(text)).toEqual([
      { route_id: '8082-10', name: 'Cid. Universitária' },
      { route_id: '1012-10', name: 'Outra' },
    ]);
  });

  it('filters raw lines before parsing', () => {
    expect(parseCsv(text, (line) => line.startsWith('"8082'))).toHaveLength(1);
  });
});

describe('distanceMeters', () => {
  it('is about 111 m per 0.001° of latitude', () => {
    expect(distanceMeters([-46.73, -23.56], [-46.73, -23.561])).toBeCloseTo(111.2, 0);
  });
});

describe('simplifyLine', () => {
  const line: LngLat[] = [
    [-46.73, -23.56],
    [-46.7295, -23.560001], // 0.1 m off a straight line
    [-46.729, -23.56],
    [-46.729, -23.559], // a real corner
    [-46.7285, -23.559],
  ];

  it('drops points within the tolerance and keeps corners and ends', () => {
    expect(simplifyLine(line, 2)).toEqual([line[0], line[2], line[3], line[4]]);
  });

  it('returns short lines unchanged', () => {
    expect(simplifyLine(line.slice(0, 2), 2)).toEqual(line.slice(0, 2));
  });
});
