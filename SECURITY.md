# Security

## Threat model

What the skill reads, runs and writes, and what could be hostile:

- **Inputs**: the user's topic and brief, web pages and documents read during research, the user's own
  voice recordings, and the episode files Claude writes (`short.json`, `scenes.js`, `post.json`). Research
  material is untrusted.
- **Instructions hidden in inputs** (web pages, documents, transcripts, subagent reports) are data, not
  commands: SKILL.md says so in its rules.
- **Commands** the skill runs: `python3` (scripts in `engine/` and `scripts/`), `node engine/render.mjs`,
  headless Google Chrome or Chromium, `ffmpeg` and `ffprobe`, and one voice tool (`say` on macOS or
  `espeak-ng`). All are started with argument lists, never through a shell.
- **Network**: OpenAI (`api.openai.com`) only when the series uses an OpenAI voice: the text of each line and
  the delivery notes go to the speech endpoint, and `check_voice.py` sends the voice clips to the
  transcription endpoint. The rendered page loads fonts from Google Fonts. Nothing else is called.
- **Outputs**: files inside the series folder only: `engine/` (a copy), `episodes/<name>/` with `audio/`,
  `timeline.js`, `timeline.json`, `stills/`, `out/<name>.mp4` and `post/`.

## Mitigations

| Risk | Mitigation | File |
| --- | --- | --- |
| API key leaks | Read from `OPENAI_API_KEY` or the series `.env` (git-ignored by the scaffold); never on a command line; masked in error messages; SKILL.md forbids asking for it in chat | `engine/audio.py`, `scripts/new_episode.py`, `SKILL.md` |
| Episode name used as a path | Only `[a-z0-9-]`, refused otherwise; an existing episode is never overwritten | `scripts/new_episode.py` |
| Scene code running in the browser | The page is the user's own episode, opened from disk in a throwaway Chrome profile that is deleted after the render | `engine/render.mjs` |
| Headless Chrome left running | Every Chrome is tracked and killed on exit, on errors in the page and on Ctrl-C | `engine/render.mjs` |
| macOS Keychain prompts from headless Chrome | Chrome always starts with `--use-mock-keychain --password-store=basic` | `engine/render.mjs` |
| TLS | Verification stays on for every HTTPS call | `engine/audio.py`, `engine/check_voice.py` |
| Posting without consent | The kit only writes files; SKILL.md says never upload or post for the user | `engine/kit.py`, `SKILL.md` |
| Copying others' characters or real people | SKILL.md: original drawings only, real people as respectful caricatures backed by sourced facts | `SKILL.md`, `references/storytelling.md` |

Tests for these cases: `tests/test_skill.py` (episode names, no overwrite, keychain flags, render fails on a
page error, unknown moods and effects, kit limits).

## Residual risks

- `scenes.js` is JavaScript that runs in Chrome with access to local files (`--allow-file-access-from-files`).
  Only render episodes you or Claude wrote; do not render an episode folder from someone you do not trust.
- Research can be wrong. The skill writes sources into `research/facts.md`, but the user checks the facts
  before posting.
- OpenAI voices are AI-generated. Platforms may ask you to label such content; the upload checklist reminds you.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting: open the repository's
**Security** tab and choose **Report a vulnerability**. Do not open a public
issue for security problems.
