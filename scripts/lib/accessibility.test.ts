import { describe, expect, it } from 'vitest';
import { classifyAccessFeature, reservedParking } from './accessibility';

describe('reservedParking', () => {
  it('reads counts and yes/no', () => {
    expect(reservedParking({ 'capacity:disabled': '4' })).toBe(4);
    expect(reservedParking({ 'capacity:disabled': 'yes' })).toBe(1);
    expect(reservedParking({ 'capacity:disabled': 'no' })).toBe(0);
  });

  it('is undefined when missing or unreadable', () => {
    expect(reservedParking({})).toBeUndefined();
    expect(reservedParking({ 'capacity:disabled': 'some' })).toBeUndefined();
  });
});

describe('classifyAccessFeature', () => {
  it('always includes elevators, kerbs and steps', () => {
    expect(classifyAccessFeature({ highway: 'elevator' })).toEqual({ kind: 'elevator', status: 'yes' });
    expect(classifyAccessFeature({ kerb: 'lowered' })).toEqual({ kind: 'kerb', status: 'yes' });
    expect(classifyAccessFeature({ kerb: 'raised' })).toEqual({ kind: 'kerb', status: 'no' });
    expect(classifyAccessFeature({ highway: 'steps' })).toEqual({ kind: 'steps', status: 'no' });
  });

  it('turns steps with a wheelchair ramp into a ramp', () => {
    expect(classifyAccessFeature({ highway: 'steps', 'ramp:wheelchair': 'yes' })).toEqual({ kind: 'ramp', status: 'yes' });
    expect(classifyAccessFeature({ highway: 'steps', ramp: 'yes' })).toEqual({ kind: 'steps', status: 'partial' });
    expect(classifyAccessFeature({ highway: 'steps', ramp: 'no' })).toEqual({ kind: 'steps', status: 'no' });
  });

  it('includes entrances and toilets only when their accessibility is recorded', () => {
    expect(classifyAccessFeature({ entrance: 'main' })).toBeUndefined();
    expect(classifyAccessFeature({ entrance: 'main', wheelchair: 'limited' })).toEqual({ kind: 'entrance', status: 'partial' });
    expect(classifyAccessFeature({ amenity: 'toilets' })).toBeUndefined();
    expect(classifyAccessFeature({ amenity: 'toilets', wheelchair: 'designated' })).toEqual({ kind: 'toilet', status: 'yes' });
    expect(classifyAccessFeature({ amenity: 'toilets', 'toilets:wheelchair': 'no' })).toEqual({ kind: 'toilet', status: 'no' });
  });

  it('includes parking with a reserved-space count', () => {
    expect(classifyAccessFeature({ amenity: 'parking' })).toBeUndefined();
    expect(classifyAccessFeature({ amenity: 'parking', 'capacity:disabled': '2' })).toEqual({ kind: 'parking', status: 'yes' });
    expect(classifyAccessFeature({ amenity: 'parking', 'capacity:disabled': 'no' })).toEqual({ kind: 'parking', status: 'no' });
    expect(classifyAccessFeature({ amenity: 'parking_space', parking_space: 'disabled' })).toEqual({ kind: 'parking', status: 'yes' });
  });

  it('uses the kind given by the curated overlay, with a sensible default status', () => {
    expect(classifyAccessFeature({ kind: 'ramp' })).toEqual({ kind: 'ramp', status: 'yes' });
    expect(classifyAccessFeature({ kind: 'entrance' })).toEqual({ kind: 'entrance', status: 'unknown' });
    expect(classifyAccessFeature({ kind: 'toilet', wheelchair: 'no' })).toEqual({ kind: 'toilet', status: 'no' });
  });

  it('ignores everything else', () => {
    expect(classifyAccessFeature({ building: 'yes', wheelchair: 'yes' })).toBeUndefined();
    expect(classifyAccessFeature({ amenity: 'bench' })).toBeUndefined();
    expect(classifyAccessFeature({ kind: 'bench' })).toBeUndefined();
  });
});
