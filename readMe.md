Generates Map PMT from a template markdown file

# Installation
Requires `npm` and `node` (can download from https://nodejs.org/en/download)

1. Download and Enter Directory in a terminal
2. Run `npm install`

## Cloud data sync
- On startup, `npm run build`, `npm run match`, `npm run series`, and `npm run complete` now try to sync `data/heroes.json`, `data/players.json`, and `data/teams.json` from gist `5c84643574b1016cf8dd70eb7c309fc8` using Octokit.
- Pull sync is additive/non-destructive: local-only entries are kept, and cloud data is merged in.
- If cloud sync fails, local files are used as fallback.
- If any local JSON file is missing or invalid, it is replaced with empty JSON (`{}`).
- You can manually pull cloud data at any time with `npm run sync:pull`.

### Push local data back to gist (only if you have permissions)
1. Create `.env` in the project root (you can copy `.env.example`).
2. Add values:
	- `GIST_EDIT_KEY=...` (GitHub fine-grained or classic token that can edit gists)
	- Optional: `GITHUB_GIST_ID=5c84643574b1016cf8dd70eb7c309fc8` (only needed if you want a different gist)
3. Run `npm run sync:push`.

Token scope notes:
- For classic personal access tokens, include `gist` scope.
- For fine-grained tokens, grant gist write access for your account.

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