"""Start a new episode of a cartoon-shorts series.

    python3 scripts/new_episode.py <series folder> <episode-name> --voice openai|say|espeak|file [--styles painted,toon]

Creates <series>/engine (a copy of this skill's engine, so later skill updates never break a finished episode) the
first time, then <series>/episodes/<episode-name>/ from templates/episode with the chosen style modules switched on.
Run it again with --update-engine to refresh the series' engine copy from the skill (only with the user's yes:
the old copy is kept as engine.bak-<date>, and only a copy made by this script is ever replaced).
"""
import argparse, json, os, re, shutil, sys, time

SKILL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STYLES = ['toon', 'fx', 'anime', 'manga', 'paper', 'painted']
NEEDS = {'paper': ['toon'], 'manga': ['anime'], 'fx': []}

ap = argparse.ArgumentParser()
ap.add_argument('series')
ap.add_argument('episode')
ap.add_argument('--styles', default='', help='comma list of ' + ', '.join(STYLES) + ' (empty = text and shapes only)')
ap.add_argument('--voice', required=True, choices=['openai', 'say', 'espeak', 'file'],
                help='openai costs money and sends the script to OpenAI: only when the user chose it')
ap.add_argument('--update-engine', action='store_true')
a = ap.parse_args()

if not re.fullmatch(r'[a-z0-9][a-z0-9-]*', a.episode):
    sys.exit('episode name: lowercase letters, digits and dashes only')
series = os.path.abspath(os.path.expanduser(a.series))
eng = os.path.join(series, 'engine')
MARK = '.cartoon-shorts-engine'      # written into every engine copy: only those are ever replaced
if a.update_engine or not os.path.isdir(eng):
    if os.path.isdir(eng):
        if not os.path.exists(os.path.join(eng, MARK)):
            sys.exit(f'{eng} was not made by this skill: not touching it. Pick another series folder.')
        bak = eng + '.bak-' + time.strftime('%Y%m%d-%H%M%S')
        os.rename(eng, bak)               # kept, never deleted: older episodes may need the old engine
        print('old engine kept as', bak)
    shutil.copytree(os.path.join(SKILL, 'engine'), eng, ignore=shutil.ignore_patterns('__pycache__'))
    open(os.path.join(eng, MARK), 'w').write('engine copy made by scripts/new_episode.py\n')
    print('engine copied to', eng)
for f, text in (('.gitignore', '.env\nepisodes/*/audio/\nepisodes/*/out/\nepisodes/*/stills/\nepisodes/*/post/\n'),
                ('.env.example', 'OPENAI_API_KEY=\n')):
    p = os.path.join(series, f)
    if not os.path.exists(p):
        open(p, 'w').write(text)

ep = os.path.join(series, 'episodes', a.episode)
if os.path.exists(ep):
    sys.exit(f'{ep} already exists')
shutil.copytree(os.path.join(SKILL, 'templates', 'episode'), ep)
for sub in ('research', 'stills', 'out'):
    os.makedirs(os.path.join(ep, sub), exist_ok=True)

# style modules: switch on the chosen ones (and what they need), in the order of STYLES
want = set()
for s in filter(None, a.styles.split(',')):
    s = s.strip()
    if s == 'comic':
        s = 'toon'
    if s not in STYLES:
        sys.exit(f'unknown style {s}: use comic, anime, manga, paper or painted (leave --styles out for kinetic text)')
    want |= {s, *NEEDS.get(s, [])}
    if s == 'toon':
        want.add('fx')
html_p = os.path.join(ep, 'short.html')
html = open(html_p).read()
tags = ''.join(f'<script src="../../engine/styles/{s}.js"></script>\n' for s in STYLES if s in want)
html = re.sub(r'<!-- STYLE MODULES:.*?-->\n', tags, html, flags=re.S)
html = html.replace('<title>Episode</title>', f'<title>{a.episode}</title>')
open(html_p, 'w').write(html)

cfg_p = os.path.join(ep, 'short.json')
cfg = json.load(open(cfg_p))
cfg['title'] = a.episode
if a.voice != 'openai':
    cfg['voice'] = {'say': {'engine': 'say', 'voice': 'Samantha', 'rate': 185}, 'espeak': {'engine': 'espeak', 'voice': 'en-us', 'rate': 165},
                    'file': {'engine': 'file', 'dir': 'rec'}}[a.voice]
json.dump(cfg, open(cfg_p, 'w'), indent=1, ensure_ascii=False)
print('episode:', ep)
print('styles:', ', '.join(s for s in STYLES if s in want) or 'none (text and shapes)')
