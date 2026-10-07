/**
 * The reports the slides need, as SQL for the suite's own database. Dates are relative to
 * `today` (an ISO date in São Paulo), so a temporary report has never expired when the suite runs.
 */

/** A passage reported as blocked on the usual step-free way of slide S18, across the Praça do Relógio, which the route goes around. */
export const BLOCKED = { id: 'j-bloqueio', position: [-46.724538, -23.5607] as const };

const quote = (value: string | null) => (value === null ? 'NULL' : `'${value.replaceAll("'", "''")}'`);

export function seedSql(today: string): string {
  const at = (time: string) => `${today}T${time}:00.000Z`;
  type Row = { id: string; type: string; answer: string; position: readonly [number, number]; target?: string; note?: string; publicNote?: string; status: 'pending' | 'published'; time: string };
  const rows: Row[] = [
    {
      ...BLOCKED,
      type: 'blocked',
      answer: 'no',
      note: 'Tapume da obra fecha a calçada inteira',
      publicNote: 'Obra na calçada: tapume fecha a passagem.',
      status: 'published',
      time: '11:40',
    },
    // An elevator of the FAU building, which someone has since said was fixed.
    { id: 'j-elevador', type: 'elevator', answer: 'broken', position: [-46.729941, -23.560127], target: 'way/158966879', publicNote: 'Elevador parado desde segunda-feira.', status: 'published', time: '12:05' },
    { id: 'j-degrau', type: 'step', answer: 'help', position: [-46.72612, -23.55921], note: 'Guia alta na travessia em frente ao ponto', status: 'pending', time: '13:20' },
    { id: 'j-calcada', type: 'narrow', answer: 'no', position: [-46.73102, -23.55871], status: 'pending', time: '14:10' },
  ];
  const reports = rows.map(
    (row) =>
      `INSERT INTO reports (id, type, answer, lng, lat, target, note, public_note, since, status, created_at, reviewed_at) VALUES (${[
        quote(row.id),
        quote(row.type),
        quote(row.answer),
        row.position[0],
        row.position[1],
        quote(row.target ?? null),
        quote(row.note ?? null),
        quote(row.publicNote ?? null),
        quote(today),
        quote(row.status),
        quote(at(row.time)),
        row.status === 'published' ? quote(at(row.time)) : 'NULL',
      ].join(', ')});`,
  );
  const feedback = `INSERT INTO report_feedback (report_id, kind, note, created_at) VALUES ('j-elevador', 'resolved', 'Voltou a funcionar hoje cedo', ${quote(at('15:30'))});`;
  return [...reports, feedback].join('\n');
}
