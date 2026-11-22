# BUILD_LOG — csv-reader-speed-01-run-20261121

Bounty: "Read broken CSV files faster, 21 November 2026", $100 pot
(1st–10th place: $10 each; a reward needs beating csv-reader 1.0.0, the
house baseline, at 95% confidence in the final heat).
Entries close 2026-11-23T02:42:00Z (23 Nov 2026, 09:42 WIB).
Entry type: transcripts as a makefun bundle (NOT a sealed recording).
Prize IS escrowed (`escrow: at_open` in competition.yaml), so the entry
must be SIGNED with the Solana keypair at submit time. Repo:
clay390/csv-reader-speed-01-run-20261121 (to be created by the parent
via browser; MCP create_repository fails; gh CLI is not logged in).

## Top-1 study (done BEFORE the build, per Bos Kinan's instruction)

Leaderboard pulled live 2026-11-22 ~16:20 WIB via
`GET https://make.fun/api/competitions/csv-reader-speed-01-run-20261121/leaderboard`
(10,239 entries at the time; sources withheld, titles visible):

- #1 thunder-rain — "WASM SIMD JSON-to-JSON CSV transducer" — cpu_us 0, 6/6 cases
- #2 swift-owl-815 — "Escaped-Byte Transducer" — cpu_us 0, 6/6 cases
- #3 f22r — "Lean-Start CJS + Multi-Comma WASM v128 SIMD Streaming CSV Transducer" — cpu_us 0
- #4 aldii24 — "csv-reader v7: streamed Rust wasm reader, 256 KiB windows, CJS entry" — cpu_us 0
- #5–#15 all cpu_us 0 as well, all WASM/SIMD-titled ("Byte-level SIMD CSV
  reader", "Single-pass SIMD CSV reader", "Deft Matrix", ...)

Reading: every top entry reports cpu_us 0 in the dev phase (the timing
metric is not live yet — the real heat runs in the final phase), and
every one of them claims WASM/SIMD in its title, while the rules forbid
it outright ("Node 22 runs node /bot/main.ts: JavaScript or TypeScript
source only, nothing installed before the program runs, no WebAssembly,
native addon or prebuilt binary"). Those entries therefore race on a
method the rules refuse. The honest race is among pure-JS entries: the
house's own measurements put d3-dsv at 0.73 s vs csv-reader's 1.38 s
(~1.9x) on ~11 MB sets, and csv-parser at 0.72 s. This entry is built
to beat that bar as pure JavaScript: a single-pass indexOf-driven
parser, no character-at-a-time loop, no regex in the hot path.

## What was built

`solve.js` — a dependency-free ES module whose `run(input)` returns
exactly csv-reader 1.0.0's answer `{columns, rows, errors}` for every
`{text, header}`. `main.ts` is the house driver, kept as-is (it reads
`/input/cases.json`, answers each case alone with `run`, writes
`/output/answers.json`, with V8 incremental marking off).

Design (exact replica of the reference policy in
`baselines/csv-reader/vendor/csv-reader/index.js`):

- Record loop skips empty lines (LF or CRLF); a line holding only stray
  CRs is no record but keeps its stray_cr errors.
- Fast path: a record-start line with no `"` and no CR except a trailing
  CRLF one is the whole record — `String.split(',')` in one call. (No
  quote can be open at a record start, so a quote-free line cannot span.)
- Slow path, field by field: unquoted fields are found with `indexOf`
  scans for `,` / `\n`, sliced, with the CR check bounded to the field
  slice (never a scan of the remaining text); a CR at the end before a
  line break is the CRLF pair's, every other CR is a stray_cr error.
- Quoted fields jump from quote to quote with `indexOf('"')`; `""` is
  one quote; chunks with embedded `\n`/`\r` are rewritten CRLF-or-lone-CR
  to LF with line counting in one replace pass; junk after the closing
  quote is appended as-is (quote_junk when anything was kept); a quote
  that never closes is literal and the rest is re-read as unquoted
  (unterminated_quote, line restored to the opening line).
- Records pad (short_row, fields: count) or cut (long_row, extra: cut
  fields) to the first record's width; errors carry the record's start
  line and its index in rows (null for the header), in the order met.
- Pure: no clock, no randomness, no locale, nothing kept between calls.

## Verification

- Practice set (kit, 6 cases, ~10.2 MB): **6/6 identical to
  `practice/reference/expected.json`** (canonical JSON comparison).
- Differential fuzz vs the reference oracle: **20,090 random small
  inputs + targeted edge cases (empty input, lone BOM, `""`, `"""`,
  unterminated quotes, `x"y` junk, stray CRs, CRLF-only lines, files
  with no trailing line break, header true/false) — 0 failures.**
- Fresh generator cases: 24 full-size cases drawn with the kit's own
  generator (`csv-cases.mjs` + `streamFor`, 4 fresh seeds × 6 cases) —
  **0 failures** vs the oracle.
- Determinism: two runs byte-identical (`cmp` on answers.json).
- Speed (Node 22.18, this VM): parser-only median **~124 ms vs the
  baseline's ~473 ms (3.8x)**; end-to-end wall median **~682 ms vs
  ~1563 ms (2.3x)** over 5 runs each. (The house's d3-dsv reference
  point is ~1.9x, so this entry clears it with margin.)

## Kit check

Run 2026-11-22 ~16:40 WIB (builder, local only — no bundle yet, no
repo yet):
`node cli/makefun.mjs check --kit . --repo <entry dir>` (no
--transcripts):
- **5 passed:** entry_size (7 files, 23,458 bytes, within the 1 MiB
  cap), competition_open, snapshot, license_osi (SPDX line),
  entrypoint (main.ts, Node 22).
- **0 failed, 15 skipped** (all transcript-gate checks skip: this
  competition does not require transcripts — transcripts_required:
  false).
- **5 at submission:** repo_public, repo_owner, repo_created_after_
  open, commit_in_repo, duplicate_snapshot — pass once the parent
  creates the public repo `clay390/csv-reader-speed-01-run-20261121`
  via browser, pushes the commit, and submits.
- Verdict: "ok: every check run here passes".

Local grade (`node cli/makefun.mjs grade-local --kit . --bot <entry
dir> --driver process`), 2026-11-22 ~16:45 WIB:
- scores {"cases_passed":6,"cases_total":6,"passed":1}; checks 6 of 6
  points over 1 check; L1 regrade reproduced byte for byte.
- eligible: ranked yes, prize yes, efficiency no (cost_unpriced —
  no usage lines, expected: no transcripts yet).

## Not done by this builder (parent's steps)

- Create the GitHub repo clay390/csv-reader-speed-01-run-20261121 via
  browser (MCP create_repository fails; gh CLI not logged in), push
  local HEAD, set About (website
  https://make.fun/bounty/csv-reader-speed-01-run-20261121, topics
  makefun/ai-agents/bounties/code).
- Bundle transcripts: run bundle from the TOP-LEVEL agent (this
  builder is a subagent — its usage rows are written only once its
  run completes, and the kit refuses a bundle run from the subagent
  for this reason). Command (from the kit dir, Node 24):
  `node cli/makefun.mjs bundle --repo <entry dir> --out
  transcripts.tar.gz --no-discover --session
  ~/agents/agent-01fa01a7-e815-4081-85f3-dd15794da71a/sessions/01fa01a7-e815-4081-85f3-dd15794da71a.jsonl
  --parent-session
  ~/agents/agent-7329786c-c8ac-49b6-96c9-33347b402c02/sessions/7329786c-c8ac-49b6-96c9-33347b402c02.jsonl
  --muse-usage <fresh muse-usage.jsonl> --system-prompt
  ~/workspace/system/system_prompt.md --harness muse-app
  --harness-version 1.3 --provider meta --model muse-spark-1.3
  --effort default --redact "Kinan" --mcp none --prompt-file
  ~/workspace/makefun/entries/.tmp-csv21/prompt.txt --prompt-origin
  handed-off --prompt-via "parent agent handed off the user's
  WhatsApp message to build and submit the csv-reader-speed-01-run-20261121
  entry"`. Re-run the muse.db usage query first (the builder's own
  rows appear only after this report is delivered):
  `SELECT u.agent_id AS agent_id, u.message_id AS message_id,
  u.created_at AS created_at, u.input_tokens AS input_tokens,
  u.output_tokens AS output_tokens, a.model AS model FROM
  agent.agent_message_token_usage u JOIN agent.agents a ON
  a.agent_id = u.agent_id WHERE u.agent_id IN
  ('01fa01a7-e815-4081-85f3-dd15794da71a',
  '7329786c-c8ac-49b6-96c9-33347b402c02') ORDER BY u.created_at
  DESC LIMIT 500` — write rows unchanged, one JSON object per line.
- Run the kit check against the bundle + GitHub HEAD, fix any
  refusal, then submit SIGNED (escrowed prize — --keypair required):
  `node cli/makefun.mjs submit --competition
  csv-reader-speed-01-run-20261121 --repo-url
  https://github.com/clay390/csv-reader-speed-01-run-20261121 --commit
  <sha> --title "Faster csv-reader: single-pass indexOf CSV parser"
  --bundle transcripts.tar.gz --keypair
  ~/workspace/makefun/makefun-keypair.json`
  (use system Node 24 `node` for the CLI).
  Note: this competition lists transcripts_required: false, so the
  bundle is optional — but the parent's standing recipe bundles
  anyway; if the parent skips it, submit without --bundle.

## Files

- `solve.js` — the fast parser (pure JS, no dependencies).
- `main.ts` — the house driver, kept as-is.
- `README.md` — 3 make.fun badges, run command.
- `LICENSE` — MIT (SPDX-License-Identifier: MIT first line).
- `.makefun/owner.json` — wallet
  4dDPoAa8LQn4tfn7pqU9oL9PZXw6wy8buibAxB1MnFCt.
- `BUILD_LOG.md` — this file.

## Submission (parent — TO BE FILLED IN)

- Local HEAD: 0a07f2ae (full 0a07f2aea17be13942b20763099a6ae512691030; BUILD_LOG text committed after it)
- Repo: https://github.com/clay390/csv-reader-speed-01-run-20261121
- SUBMITTED: [date/time WIB] — submission ID: [___]
- Claim code: [___] (keep private — shown to Kinan in chat only)
- Result due: final phase ends 24 Nov 2026 09:42 WIB; results publish after.
