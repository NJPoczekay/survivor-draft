# Design Decisions

## Purpose and Audience

This file is for maintainers editing the Survivor draft MVP.  
It documents current implementation decisions, why they exist, and what to revisit if a future change touches those areas.

## Decision Index

| ID | Decision | Status | Code References |
| --- | --- | --- | --- |
| DD-001 | Static-only architecture with local JSON fetch | Accepted | `loadPlayers` in `app.js`, `data/players.json` |
| DD-002 | Exactly two teams are hardcoded | Accepted | `state.teamNames`, team DOM bindings in `app.js`, `index.html` |
| DD-003 | Snake draft order derived from `pickNumber` | Accepted | `computeCurrentTeamIndex` in `app.js` |
| DD-004 | 90-second timer with auto-skip and reset on turn transitions | Accepted | `DEFAULT_TIMER_SECONDS`, `startTimer`, `advanceTurnBySkip`, `pickPlayer`, `undoLastPick` in `app.js` |
| DD-005 | Undo applies only to the last pick action | Accepted | `history` shape, `undoLastPick` in `app.js` |
| DD-006 | Player data schema is strict and validated at startup | Accepted | `validatePlayers` in `app.js`, `data/players.json` |
| DD-007 | Undo restores players to original pool order | Accepted | `originalIndexById`, `insertPlayerBackInOrder`, `init` in `app.js` |
| DD-008 | Reset and completion semantics are explicit | Accepted | `finishDraft`, `resetDraft`, `isDraftComplete` in `app.js` |
| DD-009 | Deployment model assumes static hosting | Accepted | `README.md` run/deploy assumptions, no backend files |

## DD-001: Static-only architecture (no backend)

### Context
The MVP must be built and edited quickly, with minimal operational overhead.

### Decision
Use a static HTML/CSS/JS app and load player data from `data/players.json` via `fetch`.

### Consequences
- Hosting is simple and free-friendly (any static host).
- No auth, persistence, or server state exists.
- File-open via `file://` can fail JSON fetch in many browsers; local server is expected.

### If You Change This
- If adding backend APIs, define a data contract boundary and keep client-side fallback behavior explicit.
- If adding persistence, decide whether local-only (`localStorage`) or multi-user server state is the source of truth.

### Code References
- `/Users/nathan/Documents/code/survivor-draft/app.js` (`loadPlayers`, `init`)
- `/Users/nathan/Documents/code/survivor-draft/data/players.json`

## DD-002: Exactly two teams are hardcoded

### Context
Product scope was explicitly for two people with minimal complexity.

### Decision
Keep team state and UI fixed to two teams (`Team 1`, `Team 2`) and two roster panels.

### Consequences
- Simpler state and rendering logic.
- Snake computation is specialized to two-team rounds.
- UI and event bindings assume exactly two name inputs and two roster containers.

### If You Change This
- Replace fixed arrays and indexes with dynamic team collections.
- Rebuild panel rendering from data instead of fixed DOM IDs.
- Rewrite snake order computation for `N` teams.

### Code References
- `/Users/nathan/Documents/code/survivor-draft/app.js` (`state.teamNames`, `renderTeams`, `handleTeamNameInput`)
- `/Users/nathan/Documents/code/survivor-draft/index.html` (`team1Name`, `team2Name`, `team1Roster`, `team2Roster`)

## DD-003: Snake order is computed from `pickNumber`

### Context
A deterministic snake flow is required without storing full turn history.

### Decision
Derive the active team via:
- `round = Math.floor(pickNumber / 2)`
- `slot = pickNumber % 2`
- even rounds use `[0,1]`, odd rounds use `[1,0]`

### Consequences
- Turn ownership can be recomputed from a single integer.
- Undo can restore turn correctness by restoring `pickNumber`.

### If You Change This
- If adding custom first-pick rules or more teams, replace `computeCurrentTeamIndex` and retest all turn transitions.
- Keep turn derivation deterministic so undo/reset remain reliable.

### Code References
- `/Users/nathan/Documents/code/survivor-draft/app.js` (`computeCurrentTeamIndex`, `startDraft`, `pickPlayer`, `advanceTurnBySkip`, `undoLastPick`)

## DD-004: Timer semantics (90s, auto-skip, reset points)

### Context
Draft pacing is part of the MVP behavior.

### Decision
- Default timer is `90` seconds.
- Timer starts when draft starts.
- At `0`, the active turn is auto-skipped.
- Timer resets after start, successful pick, timeout skip, and undo.

### Consequences
- Turn flow continues even if users do not click.
- Undo provides a clean re-entry point with full time.

### If You Change This
- If implementing pause/resume or per-team clocks, document new ownership rules.
- If removing auto-skip, define explicit timeout UX and blocked-state handling.

### Code References
- `/Users/nathan/Documents/code/survivor-draft/app.js` (`DEFAULT_TIMER_SECONDS`, `startTimer`, `resetTurnTimer`, `advanceTurnBySkip`, `pickPlayer`, `undoLastPick`)

## DD-005: Undo is pick-only and last-action only

### Context
MVP needs error recovery without complex timeline management.

### Decision
`history` stores only pick actions. Undo pops one pick and reverts roster/pool/turn to the prior state.

### Consequences
- Simple mental model and implementation.
- Timeout skips are not undoable because they are not logged in `history`.

### If You Change This
- To support undoing skips, record skip actions with enough context to reverse turn state.
- For multi-step undo/redo, define a full action log contract and invariant checks.

### Code References
- `/Users/nathan/Documents/code/survivor-draft/app.js` (`state.history`, `pickPlayer`, `undoLastPick`)

## DD-006: Player data schema and validation are strict

### Context
Bad data should fail fast at startup, not during draft interaction.

### Decision
Require each player to include `id`, `name`, `tribe`, and `tribeColor`.  
Require `id` to match lowercase kebab-case normalization.

### Consequences
- Startup fails visibly if data is malformed.
- IDs remain stable keys for selection and undo logic.

### If You Change This
- If adding fields (e.g., season, image URL), update `validatePlayers` and rendering logic together.
- If relaxing ID format, verify all selector and map lookups still work.

### Code References
- `/Users/nathan/Documents/code/survivor-draft/app.js` (`validatePlayers`, `slugify`)
- `/Users/nathan/Documents/code/survivor-draft/data/players.json`

## DD-007: Undo reinsert preserves original pool order

### Context
After undo, pool order should remain deterministic and consistent with initial data order.

### Decision
Store original index per player in `originalIndexById` and reinsert by index comparison, not append.

### Consequences
- Undo does not scramble available player ordering.
- Data file order becomes behaviorally significant.

### If You Change This
- If introducing sorting/filtering UI, decide whether undo restores global canonical order or current sort order.
- Document ordering rules clearly to avoid confusion during edits.

### Code References
- `/Users/nathan/Documents/code/survivor-draft/app.js` (`originalIndexById`, `insertPlayerBackInOrder`, `init`)

## DD-008: Reset and completion behavior are explicit

### Context
Users need clear end-of-draft and restart behavior.

### Decision
- Draft completion occurs when `availablePlayers.length === 0`.
- Completion stops timer and marks draft as not started.
- Reset clears picks/history/turn progress, restores full pool, and keeps team names.

### Consequences
- Restarting a draft does not erase custom team names.
- Completion state is deterministic and based on pool exhaustion only.

### If You Change This
- If adding multiple rounds or bench picks, redefine completion criteria.
- If adding full “new game” behavior, decide whether team names should be cleared.

### Code References
- `/Users/nathan/Documents/code/survivor-draft/app.js` (`isDraftComplete`, `finishDraft`, `resetDraft`)

## DD-009: Deployment assumes static hosting

### Context
The app has no backend requirements and should deploy quickly/free.

### Decision
Treat the project as static assets deployable to services like Cloudflare Pages/GitHub Pages.

### Consequences
- Zero server runtime cost for typical usage.
- Build settings remain simple (no framework build step required).

### If You Change This
- If adding server-side features, deployment target and costs will change.
- Keep static compatibility unless there is a clear product need for backend behavior.

### Code References
- `/Users/nathan/Documents/code/survivor-draft/README.md`
- `/Users/nathan/Documents/code/survivor-draft/index.html`
- `/Users/nathan/Documents/code/survivor-draft/app.js`

## Safe Extension Guide

### Add More Than Two Teams
- Update state shape from fixed 2-length arrays to dynamic team objects.
- Replace fixed team DOM IDs with generated sections.
- Replace `computeCurrentTeamIndex` with a generic snake algorithm for `N` teams.
- Revisit undo payload to carry dynamic team identifiers.

### Persist Draft State
- Choose single source of truth (`localStorage` or backend).
- Persist `pickNumber`, drafted rosters, available pool, and timer state.
- Add versioning to saved state so schema changes do not break loads.

### Change Timer Behavior
- Revisit `startTimer`, `advanceTurnBySkip`, and `undoLastPick` together.
- Define whether timeout should skip, pause, or auto-pick.
- Ensure UI status text and control disable logic still match behavior.

### Swap Data Source
- Keep `players.json` schema compatibility or add a mapping layer.
- If pulling remote data, add fetch failure/retry and fallback behavior.
- Keep validation strict so malformed data fails early and predictably.

## Maintenance Rules for Future PRs

- Add new decisions with the next ID (`DD-010`, `DD-011`, ...); do not renumber existing records.
- Update this file in the same PR whenever behavior contracts or data contracts change.
- Keep each decision implementation-accurate; avoid documenting roadmap ideas as current behavior.
