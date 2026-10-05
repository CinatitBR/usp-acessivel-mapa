import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FeedbackKind, Report } from '../../domain/reports';
import { strings } from '../../strings/pt-BR';
import { answeredToday, rememberAnswer, sendFeedback } from './feedback';
import { today } from './today';

const text = strings.reports.feedback;
const NOTE_MAX = 280;

/**
 * "Continua assim" and "Mudou" under a published report. "Mudou" asks one more thing, whether
 * it was resolved or is different now, with an optional note. One answer per report a day.
 */
export function ReportFeedback({ report }: { report: Report }) {
  const queryClient = useQueryClient();
  const [done, setDone] = useState(() => answeredToday(report.id, today()));
  const [asking, setAsking] = useState(false);
  const [change, setChange] = useState<Exclude<FeedbackKind, 'still'>>();
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string>();

  const send = async (kind: FeedbackKind) => {
    if (sending) return;
    setSending(true);
    setProblem(undefined);
    const result = await sendFeedback(report.id, kind, kind === 'still' ? undefined : note);
    setSending(false);
    if (result === 'too-many' || result === 'failed') return setProblem(text.problem[result]);
    setDone(true);
    if (result !== 'sent') return;
    rememberAnswer(report.id, today());
    // Shown at once as the server will give it. Asking the server again now would bring back
    // the list the browser still keeps for a minute, and undo this.
    queryClient.setQueryData<Report[]>(['reports'], (reports) =>
      reports?.map((other) =>
        other.id !== report.id ? other : kind === 'still' ? { ...other, confirmed: today(), changed: false } : { ...other, changed: true },
      ),
    );
  };

  if (done) return <p className="report-summary" role="status">{text.thanks}</p>;
  return (
    <div className="report-feedback">
      {asking ? (
        <>
          <h3 className="list-title">{text.question}</h3>
          <div className="chips chips-wrap" role="group" aria-label={text.question}>
            {(['resolved', 'different'] as const).map((kind) => (
              <button key={kind} type="button" className="chip chip-choice report-answer" aria-pressed={change === kind} onClick={() => setChange(kind)}>
                {text.kinds[kind]}
              </button>
            ))}
          </div>
          <label className="report-note">
            <span className="muted">{strings.reports.noteLabel}</span>
            <textarea value={note} maxLength={NOTE_MAX} rows={2} onChange={(event) => setNote(event.target.value)} />
          </label>
          {problem && <p className="route-warning" role="alert">{problem}</p>}
          <div className="report-feedback-buttons">
            <button type="button" className="button" disabled={!change || sending} onClick={() => change && send(change)}>
              {sending ? strings.reports.sending : strings.reports.send}
            </button>
            <button type="button" className="button-tonal" disabled={sending} onClick={() => setAsking(false)}>
              {strings.review.cancel}
            </button>
          </div>
        </>
      ) : (
        <>
          {problem && <p className="route-warning" role="alert">{problem}</p>}
          <div className="report-feedback-buttons">
            <button type="button" className="button-tonal" disabled={sending} onClick={() => send('still')}>
              {text.still}
            </button>
            <button type="button" className="button-tonal" disabled={sending} onClick={() => setAsking(true)}>
              {text.changed}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
