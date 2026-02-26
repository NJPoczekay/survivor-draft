# Survivor 50 Fantasy Draft (2 Teams)

Local, dependency-free snake draft app for two teams.

## Features

- Two editable team names.
- Survivor 50 player pool in center, color-coded by starting tribe.
- Click to draft players into team rosters while preserving pick order.
- 2-team snake order (`Team 1, Team 2, Team 2, Team 1, ...`).
- 90-second pick timer that auto-skips when time expires.
- Undo last pick.
- Reset draft while preserving team names.

## Run

Because the app reads `data/players.json`, run it with a local static server from this folder:

```bash
python3 -m http.server
```

Then open:

`http://localhost:8000`

## Data Source

Seed contestants and tribes come from:

- https://en.wikipedia.org/wiki/Survivor_50:_In_the_Hands_of_the_Fans

Tribe colors used:

- `Vatu`: `#2E8B57`
- `Kalo`: `#C0392B`
- `Cila`: `#D4AC0D`

## Files

- `index.html`: structure + controls
- `styles.css`: layout + responsive styling
- `app.js`: state management + draft/timer/undo logic
- `data/players.json`: player list and tribe metadata
