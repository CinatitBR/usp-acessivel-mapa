import { strings } from '../../strings/pt-BR';

const TIME_ZONE = 'America/Sao_Paulo';
const clock = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TIME_ZONE });
const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE });
const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: TIME_ZONE });

const date = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: TIME_ZONE });

const DAY_MS = 24 * 60 * 60 * 1000;
/** São Paulo keeps UTC−3 all year: Brazil has had no daylight saving time since 2019. */
const UTC_OFFSET = '-03:00';

/** `14:05`, on the São Paulo clock. */
export const formatClock = (time: number): string => clock.format(time);

/** The clock time, with the day before it when that is not today: `14:05`, `amanhã, 14:05`, `qua., 14/10, 14:05`. */
export function dayClock(time: number, now: number): string {
  const day = dayKey.format(time);
  if (day === dayKey.format(now)) return clock.format(time);
  return `${day === dayKey.format(now + DAY_MS) ? strings.transit.tomorrow : date.format(time)}, ${clock.format(time)}`;
}

/** The value of a `datetime-local` field for a moment, read on the São Paulo clock: `2026-10-08T14:05`. */
export const toDateTimeField = (time: number): string => `${dayKey.format(time)}T${clock.format(time)}`;

/** The moment a `datetime-local` field holds, or null while it is empty or half typed. */
export function fromDateTimeField(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return null;
  const time = Date.parse(`${value.slice(0, 16)}:00${UTC_OFFSET}`);
  return Number.isFinite(time) ? time : null;
}

/**
 * How to show an arrival: a countdown while it is under an hour away, the
 * clock time (with the day, when it is not today) beyond that. A timetable
 * entry 18 hours ahead should not read "1079 min".
 */
export function arrivalLabels(time: number, now: number): { primary: string; secondary: string } {
  const minutes = Math.round((time - now) / 60_000);
  const at = clock.format(time);
  if (minutes < 1) return { primary: strings.transit.now, secondary: at };
  if (minutes < 60) return { primary: `${minutes} ${strings.transit.minutes}`, secondary: at };

  const day = dayKey.format(time);
  const secondary =
    day === dayKey.format(now)
      ? strings.transit.today
      : day === dayKey.format(now + DAY_MS)
        ? strings.transit.tomorrow
        : weekday.format(time);
  return { primary: at, secondary };
}
