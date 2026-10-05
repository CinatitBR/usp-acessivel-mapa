import { useState } from 'react';
import { REPORT_ANSWERS, type Report, type ReportAnswer, type ReportDraft, TYPES_FOR } from '../../domain/reports';
import { useAppStore } from '../../state/store';
import { strings } from '../../strings/pt-BR';
import { BottomSheet } from '../../ui/BottomSheet';
import { onCampus } from './place';
import { reportTitle } from './ReportPanel';
import { sendReport } from './send';
import { today } from './today';

const NOTE_MAX = 280;

/** What each answer is called on its button, for the type being reported. */
const answerLabel = (type: NonNullable<ReportDraft['type']>, answer: ReportAnswer) =>
  answer === 'yes' || answer === 'help' || answer === 'no' ? strings.reports.answers[answer] : strings.reports.answers[answer][type as 'elevator' | 'toilet'];

/** Step 1: the place, by a tap on the map or from the device's position. */
function Where() {
  const setReportPlace = useAppStore((state) => state.setReportPlace);
  const flyTo = useAppStore((state) => state.flyTo);
  const [problem, setProblem] = useState<string>();

  const useMyLocation = () => {
    setProblem(undefined);
    if (!('geolocation' in navigator)) return setProblem(strings.route.locationError);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const position: [number, number] = [coords.longitude, coords.latitude];
        if (!onCampus(position)) return setProblem(strings.reports.offCampus);
        setReportPlace({ position, label: strings.route.myLocation, on: 'path' });
        flyTo(position);
      },
      () => setProblem(strings.route.locationError),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  return (
    <>
      <p>{strings.reports.whereHint}</p>
      <button type="button" className="button-tonal report-wide" onClick={useMyLocation}>
        {strings.route.useMyLocation}
      </button>
      {problem && <p className="route-warning" role="alert">{problem}</p>}
    </>
  );
}

/** Step 2: what is wrong, out of the few things that can be wrong at that kind of place. */
function What({ draft }: { draft: ReportDraft }) {
  const setReportType = useAppStore((state) => state.setReportType);
  return (
    <ul className="report-choices" aria-label={strings.reports.what}>
      {TYPES_FOR[draft.place!.on].map((type) => (
        <li key={type}>
          <button type="button" className="report-choice" onClick={() => setReportType(type)}>
            <strong>{strings.reports.types[type]}</strong>
            <span className="muted">{strings.reports.examples[type]}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Step 3: one question, an optional note, and the button that sends. */
function Answer({ draft }: { draft: ReportDraft }) {
  const setReportAnswer = useAppStore((state) => state.setReportAnswer);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string>();
  const { place, type, answer } = draft;
  if (!place || !type) return null;
  const passable = REPORT_ANSWERS[type].includes('yes');

  const send = async () => {
    if (!answer || sending) return;
    setSending(true);
    setProblem(undefined);
    const report: Report = {
      id: `meu-${Date.now().toString(36)}`,
      type,
      answer,
      position: place.position,
      target: place.target,
      since: today(),
      note: note.trim() || undefined,
    };
    const result = await sendReport(report);
    setSending(false);
    if (result.status === 'refused' || result.status === 'too-many') return setProblem(strings.reports.sendProblem[result.status]);
    const { addMyReport, closeReport, showToast } = useAppStore.getState();
    // Once sent it goes by the Worker's id, so it can be told apart from its published self.
    addMyReport({ ...report, ...(result.status === 'sent' && result.id && { id: result.id }), sent: result.status === 'sent' });
    closeReport();
    showToast({ message: strings.reports.sendResult[result.status] });
  };

  return (
    <>
      <h3 className="list-title">{passable ? strings.reports.passableQuestion : strings.reports.stateQuestion}</h3>
      <div className="chips chips-wrap" role="group" aria-label={passable ? strings.reports.passableQuestion : strings.reports.stateQuestion}>
        {REPORT_ANSWERS[type].map((option) => (
          <button key={option} type="button" className="chip chip-choice report-answer" aria-pressed={answer === option} onClick={() => setReportAnswer(option)}>
            {answerLabel(type, option)}
          </button>
        ))}
      </div>
      {noteOpen ? (
        <label className="report-note">
          <span className="muted">{strings.reports.noteLabel}</span>
          <textarea value={note} maxLength={NOTE_MAX} rows={3} autoFocus onChange={(event) => setNote(event.target.value)} />
        </label>
      ) : (
        <button type="button" className="link-row" onClick={() => setNoteOpen(true)}>
          {strings.reports.addNote}
        </button>
      )}
      {answer && (
        <p className="report-summary">
          {[reportTitle({ type, answer }), passable ? answerLabel(type, answer).toLowerCase() : undefined, place.label].filter(Boolean).join(' · ')}
        </p>
      )}
      {problem && <p className="route-warning" role="alert">{problem}</p>}
      <button type="button" className="button report-wide" disabled={!answer || sending} onClick={send}>
        {sending ? strings.reports.sending : strings.reports.send}
      </button>
      <p className="muted">{strings.reports.privacy}</p>
    </>
  );
}

/**
 * Writing a report, one decision per step: where, what, and one question. Each step has a way
 * back, nothing has to be typed, and nothing needs a gesture beyond a tap.
 */
export function ReportFlow({ draft }: { draft: ReportDraft }) {
  const startReport = useAppStore((state) => state.startReport);
  const setReportType = useAppStore((state) => state.setReportType);
  const closeReport = useAppStore((state) => state.closeReport);
  const { place, type, fixed } = draft;
  const step = !place ? 'where' : !type ? 'what' : 'answer';
  const manyTypes = place !== null && TYPES_FOR[place.on].length > 1;

  // From the question back to the types, if there was a choice; from there back to choosing the place.
  const back =
    step === 'answer' && manyTypes
      ? { label: strings.reports.what, onClick: () => setReportType(null) }
      : step !== 'where' && !fixed
        ? { label: strings.reports.where, onClick: () => startReport() }
        : undefined;
  const title = step === 'where' ? strings.reports.where : step === 'what' ? strings.reports.what : strings.reports.types[type!];
  return (
    <BottomSheet title={title} subtitle={place ? place.label : strings.reports.title} icon={place ? 'place' : 'info'} onClose={closeReport} back={back}>
      {step === 'where' && <Where />}
      {step === 'what' && <What draft={draft} />}
      {/* Keyed so a note typed for one place or type is not carried to another. */}
      {step === 'answer' && <Answer key={`${place!.target ?? place!.position.join()}-${type}`} draft={draft} />}
    </BottomSheet>
  );
}
