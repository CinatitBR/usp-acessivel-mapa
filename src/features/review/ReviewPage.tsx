import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useEffect, useState } from 'react';
import { lastDay } from '../../domain/reports';
import type { Building } from '../../domain/types';
import { loadBuildings } from '../../map/staticData';
import { formatDate, formatTime, strings } from '../../strings/pt-BR';
import { reportTitle } from '../reports/ReportPanel';
import { type Decision, fetchReview, isWrongPassword, type ReviewReport, sendDecision, sendKeep } from './api';

const STORAGE_KEY = 'usp-map:review';
const text = strings.review;

const readPassword = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
};
const storePassword = (password: string) => {
  try {
    if (password) localStorage.setItem(STORAGE_KEY, password);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private browsing: the password is asked again next time.
  }
};

/** The map, opened at the report's spot. */
const mapLink = ([lng, lat]: ReviewReport['position']) => `${import.meta.env.BASE_URL}#19/${lat.toFixed(6)}/${lng.toFixed(6)}`;

function Login({ wrong, onLogin }: { wrong: boolean; onLogin: (password: string) => void }) {
  const [value, setValue] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (value.trim()) onLogin(value.trim());
  };
  return (
    <form className="review-login card" onSubmit={submit}>
      <label>
        <span>{text.password}</span>
        <input type="password" value={value} autoComplete="current-password" autoFocus onChange={(event) => setValue(event.target.value)} />
      </label>
      {wrong && <p className="route-warning" role="alert">{text.wrongPassword}</p>}
      <button type="submit" className="button">{text.enter}</button>
    </form>
  );
}

type CardProps = { report: ReviewReport; buildings: Building[]; busy: boolean; decide: (decision: Decision) => void; keep: () => void };

/** What every card says about its report. */
function Facts({ report, buildings }: Pick<CardProps, 'report' | 'buildings'>) {
  const building = buildings.find((candidate) => candidate.id === report.target);
  const passable = report.answer === 'yes' || report.answer === 'help' || report.answer === 'no';
  const submitted = report.createdAt && formatTime(report.createdAt);
  return (
    <>
      <h3>{reportTitle(report)}</h3>
      <p>
        {passable && <strong>{strings.reports.passable[report.answer as 'yes' | 'help' | 'no']} · </strong>}
        {building?.name ?? report.target ?? strings.reports.mapPoint}
      </p>
      <p className="muted">
        {strings.reports.since} {formatDate(report.since)}
        {submitted && ` ${text.at} ${submitted}`}
      </p>
      <a className="button-tonal review-map-link" href={mapLink(report.position)} target="_blank" rel="noopener">{text.seeOnMap}</a>
      {report.reporterNote && (
        <p className="review-note">
          <span className="muted">{text.reporterNote}</span>
          {report.reporterNote}
        </p>
      )}
    </>
  );
}

/** The two things a reviewer may set: the last day and the note the map shows. */
function Fields({ until, note, onUntil, onNote }: { until: string; note: string; onUntil: (value: string) => void; onNote: (value: string) => void }) {
  return (
    <div className="review-fields">
      <label>
        <span>{text.until}</span>
        <input type="date" value={until} onChange={(event) => onUntil(event.target.value)} />
      </label>
      <label>
        <span>{text.publicNote}</span>
        <textarea value={note} rows={2} maxLength={280} onChange={(event) => onNote(event.target.value)} />
      </label>
    </div>
  );
}

function PendingCard({ report, buildings, busy, decide }: Omit<CardProps, 'keep'>) {
  const [publishing, setPublishing] = useState(false);
  const [until, setUntil] = useState('');
  // The reporter's note is offered as the public one, for the reviewer to edit or clear.
  const [note, setNote] = useState(report.reporterNote ?? '');
  return (
    <li className="review-card card">
      <Facts report={report} buildings={buildings} />
      {publishing && (
        <>
          <Fields until={until} note={note} onUntil={setUntil} onNote={setNote} />
          <p className="muted">{text.untilHint}</p>
        </>
      )}
      <div className="review-actions">
        {publishing ? (
          <>
            <button type="button" className="button" disabled={busy} onClick={() => decide({ status: 'published', until: until || null, publicNote: note })}>
              {text.confirmPublish}
            </button>
            <button type="button" className="button-tonal" disabled={busy} onClick={() => setPublishing(false)}>{text.cancel}</button>
          </>
        ) : (
          <>
            <button type="button" className="button" disabled={busy} onClick={() => setPublishing(true)}>{text.publish}</button>
            <button type="button" className="button-tonal" disabled={busy} onClick={() => decide({ status: 'duplicate' })}>{text.duplicate}</button>
            <button type="button" className="button-tonal" disabled={busy} onClick={() => decide({ status: 'refused' })}>{text.refuse}</button>
          </>
        )}
      </div>
    </li>
  );
}

function PublishedCard({ report, buildings, busy, decide, keep }: CardProps) {
  const [until, setUntil] = useState(report.until ?? '');
  const [note, setNote] = useState(report.note ?? '');
  const changed = until !== (report.until ?? '') || note !== (report.note ?? '');
  const last = lastDay(report);
  return (
    <li className="review-card card">
      <Facts report={report} buildings={buildings} />
      <p className="muted">
        {last ? `${text.showsUntil} ${formatDate(last)}` : text.showsAlways}
        {report.confirmed && ` · ${text.confirmedOn} ${formatDate(report.confirmed)}`}
      </p>
      {report.changes && (
        <ul className="review-changes">
          {report.changes.map((change, index) => (
            <li key={index}>
              <strong>{strings.reports.feedback.kinds[change.kind]}</strong> ({formatDate(change.createdAt.slice(0, 10))}){change.note && `: ${change.note}`}
            </li>
          ))}
        </ul>
      )}
      <Fields until={until} note={note} onUntil={setUntil} onNote={setNote} />
      <div className="review-actions">
        <button type="button" className="button" disabled={busy || !changed} onClick={() => decide({ status: 'published', until: until || null, publicNote: note })}>
          {text.save}
        </button>
        <button type="button" className="button-tonal" disabled={busy} onClick={() => decide({ status: 'withdrawn' })}>{text.withdraw}</button>
        {report.changes && <button type="button" className="button-tonal" disabled={busy} onClick={keep}>{text.keep}</button>}
      </div>
    </li>
  );
}

/** For reviewers: the reports waiting to be published, and those on the map. Opened at `?revisar`. */
export function ReviewPage() {
  const [password, setPassword] = useState(readPassword);
  const [wrong, setWrong] = useState(false);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const queryClient = useQueryClient();

  // Names for the places; the page works without them.
  useEffect(() => {
    loadBuildings().then(setBuildings, () => undefined);
  }, []);

  const lists = useQuery({
    queryKey: ['review', password],
    queryFn: ({ signal }) => fetchReview(password, signal),
    enabled: password !== '',
    retry: false,
    refetchInterval: 60_000,
  });
  const decision = useMutation({
    mutationFn: ({ id, ...rest }: Decision & { id: string }) => sendDecision(password, id, rest),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['review'] }),
  });
  const kept = useMutation({
    mutationFn: (id: string) => sendKeep(password, id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['review'] }),
  });

  const logout = (wasWrong = false) => {
    storePassword('');
    setPassword('');
    setWrong(wasWrong);
  };
  const login = (value: string) => {
    storePassword(value);
    setWrong(false);
    setPassword(value);
  };
  // A password the Worker refuses is forgotten, and asked again.
  const refused = isWrongPassword(lists.error) || isWrongPassword(decision.error) || isWrongPassword(kept.error);
  useEffect(() => {
    if (refused) logout(true);
  }, [refused]);

  const card = (report: ReviewReport) => ({
    key: report.id,
    report,
    buildings,
    busy: decision.isPending || kept.isPending,
    decide: (chosen: Decision) => decision.mutate({ id: report.id, ...chosen }),
    keep: () => kept.mutate(report.id),
  });
  // Reports people say have changed come first, in a section of their own.
  const changed = lists.data?.published.filter((report) => report.changes) ?? [];
  const steady = lists.data?.published.filter((report) => !report.changes) ?? [];

  return (
    <main className="review">
      <header className="review-header">
        <h1>{text.title}</h1>
        {password && <button type="button" className="button-tonal" onClick={() => logout()}>{text.leave}</button>}
      </header>
      {!password && <Login wrong={wrong} onLogin={login} />}
      {password && lists.isPending && <p>{strings.loading}</p>}
      {password && lists.isError && !refused && <p className="route-warning" role="alert">{text.loadError}</p>}
      {(decision.isError || kept.isError) && !refused && <p className="route-warning" role="alert">{text.saveError}</p>}
      {lists.data && (
        <>
          <section aria-labelledby="review-pending">
            <h2 id="review-pending">{text.pending} ({lists.data.pending.length})</h2>
            {lists.data.pending.length === 0 && <p className="muted">{text.nonePending}</p>}
            <ul className="review-list">{lists.data.pending.map((report) => <PendingCard {...card(report)} />)}</ul>
          </section>
          {changed.length > 0 && (
            <section aria-labelledby="review-changes">
              <h2 id="review-changes">{text.changes} ({changed.length})</h2>
              <ul className="review-list">{changed.map((report) => <PublishedCard {...card(report)} />)}</ul>
            </section>
          )}
          <section aria-labelledby="review-published">
            <h2 id="review-published">{text.published} ({steady.length})</h2>
            <ul className="review-list">{steady.map((report) => <PublishedCard {...card(report)} />)}</ul>
          </section>
        </>
      )}
    </main>
  );
}
