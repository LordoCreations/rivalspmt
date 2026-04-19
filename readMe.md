Generates Map PMT from a template markdown file

# Installation
Requires `npm` and `node` (can download from https://nodejs.org/en/download)

1. Download and Enter Directory in a terminal
2. Run `npm install`

# Instructions for use
1. Run `npm run build`
2. Choose lazy naming in console
3. Enter match replay ID in console
4. Both modes check aliases from `data/players.json` and `data/teams.json` first
5. Lazy naming on: unknown player aliases are auto-written with cleaned IGN as canonical name and unknown team aliases are auto-written with team name as canonical name
6. Lazy naming off: unknown player/team aliases prompt for canonical name, then save the alias mapping
7. Copy from terminal or `output/output.md`

Team aliases in `data/teams.json` use the same format as player aliases: `"Team Name": ["aliases"]`.
Default alias behavior is just the canonical team name.

## Series mode
1. Run `npm run series` for maps-only output, or `npm run complete` to include the series header markdown
2. Choose lazy naming in console
3. Enter the series length as best of # (for example: `5`)
4. Enter replay IDs in map order
5. If lazy naming is off (`n` or `N`), unknown player/team aliases will prompt for canonical names and then save them
6. If a map is a draw (equal score), enter another replay ID for the same map number
7. Leave a replay ID as `esc` stop early and skip remaining maps
8. `npm run complete` writes a filled header (from `templates/headertemplate.md`) followed by all maps in order to `output/output.md`
9. `npm run series` writes map sections only to `output/output.md`

markdown can be pasted via "Markdown Mode"