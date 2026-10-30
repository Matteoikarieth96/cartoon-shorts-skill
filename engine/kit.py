"""Upload kit for one episode: texts and files for YouTube Shorts, TikTok and Instagram Reels.

    python3 engine/kit.py episodes/<name>

Reads episodes/<name>/post.json and timeline.json, writes episodes/<name>/post/:
  youtube/   title.txt, description.txt, tags.txt, captions.<lang>.srt, thumbnail.jpg (2160 x 3840)
  tiktok/    caption.txt, cover.jpg
  instagram/ caption.txt, cover.jpg
  checklist.md   what to set on each platform, with the limits checked

post.json keys:
  title          YouTube title (max 100 characters, a #hashtag or two at the end is fine)
  hook           one short line that opens the TikTok and Instagram captions (defaults to the title without hashtags)
  social         optional paragraph after the hook in the TikTok and Instagram captions
  description    list of lines for the YouTube description
  sources        list of "what: url" strings, printed under a "Sources" heading (leave empty if the video has no facts)
  disclaimer     optional last paragraph (e.g. "Fan-made animation. Not affiliated with ...")
  hashtags       3 to 5 tags without '#'; the first ones matter most
  tags           YouTube tags (max 500 characters in all)
  lang           language code of the captions, default "en"
  labels         optional dict to translate the fixed words: {"sources": "Sources"}
  thumb_t        second of the video to use as thumbnail and cover (render it without captions)
  category       YouTube category to suggest, default "Entertainment"
  ai_label       mark the video as AI-generated or altered content; default: true with an OpenAI voice, else false
  ai_voice_note  false to leave out the "AI-generated voice" line an OpenAI voice adds (only if you disclose it elsewhere)
  ai_voice_line  wording of that line

Refuses text the platforms reject or that reads badly: < or > in YouTube text, a title over 100 characters,
a YouTube description over 5000, tags over 500, captions over 2200, more than 5 hashtags (Instagram's limit), a lang that is not a language code, a thumb_t outside the video.
"""
import json, os, re, subprocess, sys

root = os.path.abspath(sys.argv[1])
home = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cfg = json.load(open(os.path.join(root, 'post.json')))
tl = json.load(open(os.path.join(root, 'timeline.json')))
short = json.load(open(os.path.join(root, 'short.json')))
say = [ln['say'] for ln in short['lines']]
lang = cfg.get('lang', 'en')
if not re.fullmatch(r'[a-z]{2,3}(-[A-Za-z0-9]{2,8})?', str(lang)):
    sys.exit(f'lang must be a language code like "en" or "pt-BR", got {lang!r}')
thumb_t = cfg.get('thumb_t', 1)
if isinstance(thumb_t, bool) or not isinstance(thumb_t, (int, float)) or not 0 <= thumb_t <= tl['total']:
    sys.exit(f'thumb_t must be a number of seconds inside the video, got {thumb_t!r}')
# an OpenAI voice is AI-generated: OpenAI's usage policies ask creators to tell listeners, and platforms label it
ai_voice = (short.get('voice') or {}).get('engine') == 'openai'
ai = cfg.get('ai_label', ai_voice)
lab = {'sources': 'Sources', **cfg.get('labels', {})}
out = os.path.join(root, 'post')
for d in ('youtube', 'tiktok', 'instagram'):
    os.makedirs(os.path.join(out, d), exist_ok=True)

tags_h = ['#' + h.lstrip('#') for h in cfg.get('hashtags', [])]
title = cfg['title']
desc = '\n'.join(cfg.get('description', []))
if cfg.get('sources'):
    desc += f"\n\n{lab['sources']}:\n" + '\n'.join('- ' + s for s in cfg['sources'])
if cfg.get('disclaimer'):
    desc += '\n\n' + cfg['disclaimer']
if ai_voice and cfg.get('ai_voice_note', True):
    desc += '\n\n' + cfg.get('ai_voice_line', 'Voice-over: AI-generated (text to speech).')
desc += '\n\n' + ' '.join(tags_h)
yt_tags = ', '.join(cfg.get('tags', []))
hook = cfg.get('hook', re.sub(r'\s*#\S+', '', title).strip())
social = hook + ('\n\n' + cfg['social'] if cfg.get('social') else '') + ('\n\n' + cfg.get('ai_voice_line', 'AI voice-over.') if ai_voice and cfg.get('ai_voice_note', True) else '') + '\n\n' + ' '.join(tags_h)

checks = [('YouTube title', title, 100), ('YouTube description', desc, 5000), ('YouTube tags', yt_tags, 500),
          ('TikTok caption', social, 2200), ('Instagram caption', social, 2200)]
for name, text, limit in checks:
    if len(text) > limit:
        sys.exit(f'{name} too long: {len(text)} > {limit}')
for name, text in (('YouTube title', title), ('YouTube description', desc)):
    if re.search('[<>]', text):
        sys.exit(f'{name} has < or > (YouTube Studio rejects them)')
if len(tags_h) > 5:
    sys.exit(f'{len(tags_h)} hashtags: use 3 to 5 (Instagram now accepts at most 5 per post)')


def w(rel, text):
    open(os.path.join(out, rel), 'w').write(text.rstrip() + '\n')


w('youtube/title.txt', title)
w('youtube/description.txt', desc)
w('youtube/tags.txt', yt_tags)
w('tiktok/caption.txt', social)
w('instagram/caption.txt', social)


def ts(x):
    h, r = divmod(x, 3600)
    m, s = divmod(r, 60)
    return f'{int(h):02d}:{int(m):02d}:{int(s):02d},{int(round((s - int(s)) * 1000)):03d}'


srt = []
for k, ln in enumerate(tl['lines']):
    text = (ln.get('cap') or say[k]).replace('*', '')
    end = min(ln['t'] + ln['d'] + .4, tl['lines'][k + 1]['t'] if k + 1 < len(tl['lines']) else tl['total'])
    srt.append(f"{len(srt) + 1}\n{ts(ln['t'])} --> {ts(end)}\n{text}\n")
w(f'youtube/captions.{lang}.srt', '\n'.join(srt))

# thumbnail and covers: one still at 2x without the burned-in captions
t = str(thumb_t)
env = dict(os.environ, DSF='2', HIDE='#cap')
subprocess.run(['node', os.path.join(home, 'engine', 'render.mjs'), root, 'still', t], check=True, env=env, stdout=subprocess.DEVNULL)
still = os.path.join(root, 'stills', f't{t}.png')
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', still, '-q:v', '2', os.path.join(out, 'youtube', 'thumbnail.jpg')], check=True)
for d in ('tiktok', 'instagram'):
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', still, '-vf', 'scale=1080:1920', '-q:v', '2', os.path.join(out, d, 'cover.jpg')], check=True)

mp4 = os.path.join(root, 'out', os.path.basename(root) + '.mp4')
try:
    dur = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4], stderr=subprocess.DEVNULL).decode())
except Exception:          # no video yet, or one still being written
    dur = tl['total']
md = f"""# Upload checklist: {title}

Video: `out/{os.path.basename(mp4)}` ({dur:.1f} s, 1080 x 1920, 9:16). The same file goes to all three platforms.

## YouTube Shorts
- Title ({len(title)}/100): `youtube/title.txt`
- Description ({len(desc)}/5000): `youtube/description.txt`
- Tags ({len(yt_tags)}/500): `youtube/tags.txt`
- Thumbnail: `youtube/thumbnail.jpg` (a custom Shorts thumbnail is set from YouTube Studio on desktop)
- Subtitles: upload `youtube/captions.{lang}.srt`
- Category: {cfg.get('category', 'Entertainment')}
- Audience: decide "made for kids" on purpose. Animation, bright colours and simple stories count towards "made for kids"
  under YouTube's rules (COPPA), and a wrong answer can bring penalties; see YouTube Help, "Determining if your content is made for kids"
- Altered or synthetic content: {'Yes (AI voice)' if ai else 'No for a stylised cartoon with a recorded or plainly robotic voice; Yes if it shows realistic people or an AI or cloned voice'}
- Paid promotion: tick it if a brand paid for or gave anything for this video

## TikTok
- Caption ({len(social)}/2200): `tiktok/caption.txt`
- Cover: pick the frame or upload `tiktok/cover.jpg`
- AI-generated content label: {'on (AI voice)' if ai else 'turn it on if the video has an AI voice or shows realistic people'}
- Branded content toggle: on if a brand paid for or gave anything for this video

## Instagram Reels
- Caption ({len(social)}/2200, {len(tags_h)}/5 hashtags): `instagram/caption.txt`
- Cover: `instagram/cover.jpg`; check the 3:4 crop in the profile grid (about the centre 1080 x 1440 of the frame)
- AI info label: {'on (AI voice)' if ai else 'as for TikTok'}
- Paid partnership label: on if a brand paid for or gave anything for this video

## Before posting
- Watch the whole video once with sound.
- Every fact on screen or in the voice has a source{' (listed in the description)' if cfg.get('sources') else ''}.
- Music and sound effects are synthesized by the engine, so there is nothing to license. Anything you added yourself needs its licence.
"""
w('checklist.md', md)
print('kit:', out)
print(title)
print(f'{len(desc)} chars of description, {len(srt)} captions')
