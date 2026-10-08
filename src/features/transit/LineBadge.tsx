import { type CSSProperties, useEffect, useState } from 'react';
import { loadLineColors } from '../../map/staticData';
import { strings } from '../../strings/pt-BR';
import { Icon } from '../../ui/Icon';

/** A line's own colours from its timetable feed, as `#rrggbb`. */
export type LineColor = { color: string; textColor?: string };

/** Dark or light text for a line colour that came without a text colour of its own. */
function readableOn(color: string): string {
  const [red, green, blue] = [1, 3, 5].map((start) => parseInt(color.slice(start, start + 2), 16));
  return (red! * 299 + green! * 587 + blue! * 114) / 1000 > 150 ? 'var(--text)' : 'var(--on-inverse)';
}

/** The inline style that puts a badge in a line's colours; nothing for a line without them, which keeps the dark badge. */
export const lineStyle = (line: LineColor | undefined): CSSProperties | undefined =>
  line ? { background: line.color, color: line.textColor ?? readableOn(line.color) } : undefined;

/**
 * The colours of the lines that call at the campus stops (public/data/line-colors.json). Empty until
 * the file arrives, and if it does not: the badges are then dark, as a line without colours is.
 */
export function useLineColors(): ReadonlyMap<string, LineColor> {
  const [colors, setColors] = useState<ReadonlyMap<string, LineColor>>(NO_COLORS);
  useEffect(() => {
    let cancelled = false;
    loadLineColors().then((loaded) => !cancelled && setColors(loaded), () => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return colors;
}
const NO_COLORS: ReadonlyMap<string, LineColor> = new Map();

type Props = { line: string; vehicle: 'bus' | 'rail'; colors?: LineColor | undefined };

/** The line of a ride as riders know it, on the line's own colour when the timetable gives one. */
export function LineBadge({ line, vehicle, colors }: Props) {
  return (
    <span className="line-badge" style={lineStyle(colors)}>
      <Icon name={vehicle === 'bus' ? 'bus' : 'train'} size={16} />
      <span className="visually-hidden">{strings.transit.vehicles[vehicle]} </span>
      {line}
    </span>
  );
}
