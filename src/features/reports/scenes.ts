import type { ReportType } from '../../domain/reports';
import type { SceneLayer } from '../../map/badgeIcon';

/** The thin dark line around the things in a scene, so they read on red and on amber alike. */
const LINE = '#2b2433';
const LINE_WIDTH = 0.9;
const PAVING = '#8f959b';
/** The sidewalk runs across the head at this angle, as a street does on a map. */
const TILT = 28;

const box = (x: number, y: number, width: number, height: number, radius: number) =>
  `M${x + radius} ${y}h${width - 2 * radius}a${radius} ${radius} 0 0 1 ${radius} ${radius}v${height - 2 * radius}a${radius} ${radius} 0 0 1 ${-radius} ${radius}h${-(width - 2 * radius)}a${radius} ${radius} 0 0 1 ${-radius} ${-radius}v${-(height - 2 * radius)}a${radius} ${radius} 0 0 1 ${radius} ${-radius}z`;

const dot = (x: number, y: number, radius: number) => `M${x - radius} ${y}a${radius} ${radius} 0 1 0 ${2 * radius} 0a${radius} ${radius} 0 1 0 ${-2 * radius} 0z`;

/** Stones in the paving of a sidewalk that runs down the middle of the head. */
const STONES = [dot(19, 6, 1.6), dot(23.5, 12, 1.2), dot(20, 30, 1.4), dot(23, 36, 1.7), dot(21, 21, 1.1), dot(18.5, 14, 0.9), dot(22.5, 27, 0.9)].join(' ');

const STAIRS = 'M9.5 30.5v-6h6v-5.5H22v-5.5h10.5v17z';

/**
 * What each kind of report shows in the head of its pin (42 × 51, head centred on 21, 21): a
 * small drawing in its own colours on the colour of the pin, not a one-colour pictogram.
 */
export const REPORT_SCENES: Record<ReportType, readonly SceneLayer[]> = {
  // A striped barrier on two legs, all of it inside the head.
  blocked: [
    { path: 'M12 22h3v7.3h-3z M27 22h3v7.3h-3z', fill: '#5b6470', stroke: LINE, strokeWidth: LINE_WIDTH },
    { path: box(9, 12.8, 24, 9.5, 1.8), fill: '#ffffff', stroke: LINE, strokeWidth: LINE_WIDTH },
    { path: 'M13 13.8h4.5l-3 7.5H10z M20 13.8h4.5l-3 7.5H17z M27 13.8h4.5l-3 7.5H24z', fill: '#ff7a00' },
  ],
  // A staircase rising to the right, its treads lit, all of it inside the head.
  step: [
    { path: STAIRS, fill: PAVING },
    { path: 'M9.5 24.5h6v2.2h-6z M15.5 19H22v2.2h-6.5z M22 13.5h10.5v2.2H22z', fill: '#ffffff' },
    { path: STAIRS, stroke: LINE, strokeWidth: LINE_WIDTH },
  ],
  // A sidewalk that gets thin in the middle, and two arrows pressing on it; the arrows stay clear of the rim.
  narrow: [
    { path: 'M11-4C11 10 17.5 15 17.5 21S11 32 11 46H31C31 32 24.5 27 24.5 21S31 10 31-4z', fill: PAVING, stroke: '#ffffff', strokeWidth: 1.8, rotate: TILT },
    { path: STONES, fill: '#bcc1c7', rotate: TILT },
    { path: 'M7.5 16.5v9l6.8-4.5z M34.5 16.5v9l-6.8-4.5z', fill: '#ffffff', stroke: LINE, strokeWidth: LINE_WIDTH, rotate: TILT },
  ],
  // An elevator, all of it inside the head: its frame, the display, two doors and the two arrows.
  elevator: [
    { path: box(11.5, 9.5, 19, 23, 1.5), fill: '#6c757d', stroke: LINE, strokeWidth: LINE_WIDTH },
    { path: 'M13.5 15h6.9v16.5h-6.9z M21.6 15h6.9v16.5h-6.9z', fill: '#e9ecef', stroke: LINE, strokeWidth: 0.7 },
    { path: box(16.5, 10.8, 9, 2.6, 0.7), fill: LINE },
    { path: 'M16.95 18.5l2.6 4.2h-5.2z M25.05 28l-2.6-4.2h5.2z', fill: '#1971c2' },
  ],
  // A toilet seen from the side, on the floor.
  toilet: [
    { path: 'M0 34.5h42V44H0z', fill: PAVING },
    { path: box(11, 8.5, 8, 13, 1.4), fill: '#ffffff', stroke: LINE, strokeWidth: LINE_WIDTH },
    { path: 'M11 21.5h20.5a9.5 9.5 0 0 1-6.5 8.8v4.2h-10v-4.7a8 8 0 0 1-4-6.3z', fill: '#ffffff', stroke: LINE, strokeWidth: LINE_WIDTH },
    { path: box(10, 19.8, 22.5, 3, 1.5), fill: '#1c7ed6', stroke: LINE, strokeWidth: LINE_WIDTH },
  ],
};
