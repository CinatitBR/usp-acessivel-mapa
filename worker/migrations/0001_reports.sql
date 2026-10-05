-- Reports made by people on the map, and what others say about them later.
-- Nothing about the sender is stored: no address, no device id.

CREATE TABLE reports (
  id          TEXT PRIMARY KEY,                 -- r-xxxxxxxx, made by the Worker
  type        TEXT NOT NULL,                    -- blocked | step | narrow | elevator | toilet
  answer      TEXT NOT NULL,                    -- yes | help | no | broken | closed | missing
  lng         REAL NOT NULL,
  lat         REAL NOT NULL,
  target      TEXT,                             -- id of the building or accessibility point
  note        TEXT,                             -- as the reporter wrote it; never served publicly
  public_note TEXT,                             -- what the reviewer chose to publish
  since       TEXT NOT NULL,                    -- ISO date in São Paulo
  until       TEXT,                             -- ISO date, set by a reviewer
  status      TEXT NOT NULL DEFAULT 'pending',  -- pending | published | refused | duplicate
  created_at  TEXT NOT NULL,                    -- ISO timestamp
  reviewed_at TEXT
);
CREATE INDEX reports_status ON reports (status);

CREATE TABLE report_feedback (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id  TEXT NOT NULL REFERENCES reports (id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,                     -- still | resolved | different
  note       TEXT,                              -- never served publicly
  created_at TEXT NOT NULL,
  handled_at TEXT                               -- set when a reviewer has dealt with it
);
CREATE INDEX report_feedback_report ON report_feedback (report_id);
