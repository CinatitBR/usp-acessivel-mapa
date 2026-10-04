import { strings } from '../../strings/pt-BR';

const TIME_ZONE = 'America/Sao_Paulo';
const clock = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TIME_ZONE });
const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE });
const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: TIME_ZONE });

const DAY_MS = 24 * 60 * 60 * 1000;

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
