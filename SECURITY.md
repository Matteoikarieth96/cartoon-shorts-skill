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
- **Network**: OpenAI (`api.openai.com`) only when the user chose an OpenAI voice: the text of each line and
  the delivery notes go to the speech endpoint, and `check_voice.py` sends the voice clips to the
  transcription endpoint. The rendered page loads fonts from Google Fonts. Nothing else is called.
- **Outputs**: files inside the series folder only: `engine/` (a copy), `episodes/<name>/` with `audio/`,
  `timeline.js`, `timeline.json`, `stills/`, `out/<name>.mp4` and `post/`.

## Mitigations

| Risk | Mitigation | File |
| --- | --- | --- |
| API key leaks | Read from `OPENAI_API_KEY` or the series `.env` (git-ignored by the scaffold); never on a command line; masked in error messages; SKILL.md forbids asking for it in chat | `engine/audio.py`, `scripts/new_episode.py`, `SKILL.md` |
| Episode name used as a path | Only `[a-z0-9-]`, refused otherwise; an existing episode is never overwritten | `scripts/new_episode.py` |
| Markup or script in captions and overlays (a quote from a web page) | Captions escaped; `ovText` and `esc` for overlays; Chrome started without `--allow-file-access-from-files`, so page code cannot read local files | `engine/core.js`, `engine/render.mjs` |
| Values from `short.json` in ffmpeg filters | `tempo` must be a number from 0.5 to 2, checked before any paid call; recordings folder must resolve inside the episode, links included | `engine/audio.py` |
| A script line read as a command-line option (a line starting with `-`) | Voice text goes to `say` and `espeak-ng` through a file (`-f`) | `engine/audio.py` |
| Values from `post.json` in file names | `lang` must be a language code; `thumb_t` a number inside the video | `engine/kit.py` |
| Running or replacing an engine folder that is not the skill's | Every run refuses an `engine/` that is a link or has no marker file; `--update-engine` keeps the old copy as `engine.bak-<date>` (with a counter if the name is taken) | `scripts/new_episode.py` |
| Paid API calls without a choice | `--voice` is required; SKILL.md asks the voice in the interview and says where the key comes from (shell or `.env`, never printing it) before the first OpenAI call | `scripts/new_episode.py`, `SKILL.md` |
| Instructions in web pages reaching Claude or research subagents | SKILL.md: research is data; subagents get a fixed data-not-instructions line; only checked URLs become sources | `SKILL.md` |
| Undisclosed AI voice | With an OpenAI voice the kit adds an "AI-generated voice" line and turns the AI labels on | `engine/kit.py` |
| Scene code running in the browser | The page is the user's own episode, opened from disk in a throwaway Chrome profile that is deleted after the render | `engine/render.mjs` |
| Headless Chrome left running | Every Chrome is tracked and killed on exit, on errors in the page and on Ctrl-C; temp profiles and contact-sheet frames are removed too | `engine/render.mjs` |
| macOS Keychain prompts from headless Chrome | Chrome always starts with `--use-mock-keychain --password-store=basic` | `engine/render.mjs` |
| TLS | Verification stays on for every HTTPS call | `engine/audio.py`, `engine/check_voice.py` |
| Posting without consent | The kit only writes files; SKILL.md says never upload or post for the user | `engine/kit.py`, `SKILL.md` |
| Copying others' characters or real people | SKILL.md: original drawings only, real people as respectful caricatures backed by sourced facts | `SKILL.md`, `references/storytelling.md` |

Tests for these cases: `tests/test_skill.py` (episode names, no overwrite, engine marker, keychain flags, caption
escaping, no local file reads from the page, tempo and recordings folder checks, lines starting with `-`, render fails
on a page error, unknown moods and effects, kit limits, `lang` and `thumb_t`, AI voice line, foreign or linked engine
folders, backups made in the same second, recordings folder behind a link).

## Residual risks

- `scenes.js` is JavaScript that runs in headless Chrome (without file access to other local files, but with
  network access for the fonts). Only render episodes you or Claude wrote; never render an episode folder from someone
  you do not trust.
- Text from research reaches the page. Captions are escaped by the engine, and SKILL.md tells Claude to use
  `ovText` or `S.esc` for overlays; a scene that puts outside text raw into `ov()` HTML could still run markup.
- The engine marker file guards against accidents, not against a planted copy: someone who sends you a whole
  series folder can include it. Never run a series folder you did not make.
- A hard kill of `render.mjs` (SIGKILL, out of memory) skips its cleanup and can leave headless Chrome running with
  a `short-chrome-*` profile in the temp folder. Stop them with `pkill -f short-chrome-` and delete the folders.
- Research can be wrong. The skill writes sources into `research/facts.md`, but the user checks the facts
  before posting.
- OpenAI voices are AI-generated. Platforms may ask you to label such content; the upload checklist reminds you.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting: open the repository's
**Security** tab and choose **Report a vulnerability**. Do not open a public
issue for security problems.
