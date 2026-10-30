"""Tests for the cartoon-shorts skill.

    python3 -m unittest discover -s tests -v

The static and scaffolding tests need only Python. The pipeline tests (voice, music, render, upload kit) also need
numpy, ffmpeg, Node 22+ and Chrome or Chromium, and are skipped when one is missing. They use the "file" voice
engine with generated tones, so no API key and no network are needed (except Google Fonts in the page).
"""
import json, math, os, re, shutil, struct, subprocess, sys, tempfile, unittest, wave

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PY = sys.executable
STYLES = ['comic', 'anime', 'manga', 'paper', 'painted']


def read(p):
    with open(p, encoding='utf-8') as f:
        return f.read()


def load(p):
    return json.loads(read(p))


def write(p, text):
    with open(p, 'w', encoding='utf-8') as f:
        f.write(text)


def dump(obj, p):
    write(p, json.dumps(obj))


def run(args, cwd=None, env=None, timeout=300):
    return subprocess.run(args, cwd=cwd, env=env, capture_output=True, text=True, timeout=timeout)


def has_numpy():
    try:
        import numpy  # noqa: F401
        return True
    except ImportError:
        return False


def chrome():
    if os.environ.get('CHROME_PATH'):
        return os.environ['CHROME_PATH']
    for p in ('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
              '/Applications/Chromium.app/Contents/MacOS/Chromium'):
        if os.path.exists(p):
            return p
    for name in ('google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'):
        if shutil.which(name):
            return shutil.which(name)
    return None


def node22():
    if not shutil.which('node'):
        return False
    out = run(['node', '-e', 'console.log(process.versions.node.split(".")[0])']).stdout.strip()
    return out.isdigit() and int(out) >= 22


AUDIO_OK = has_numpy() and shutil.which('ffmpeg') and shutil.which('ffprobe')
RENDER_OK = AUDIO_OK and node22() and chrome()


def tone(path, sec=1.0, f=220.0, sr=44100):
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(b''.join(struct.pack('<h', int(8000 * math.sin(2 * math.pi * f * i / sr))) for i in range(int(sec * sr))))


def new_episode(series, name='demo', styles='', voice='file'):
    return run([PY, os.path.join(ROOT, 'scripts', 'new_episode.py'), series, name, '--styles', styles, '--voice', voice])


def frontmatter(text):
    m = re.match(r'---\n(.*?)\n---\n', text, re.S)
    return dict(re.findall(r'^(\w+): (.*)$', m.group(1), re.M)) if m else {}


class Static(unittest.TestCase):
    def test_skill_frontmatter(self):
        fm = frontmatter(read(os.path.join(ROOT, 'SKILL.md')))
        self.assertEqual(fm.get('name'), 'cartoon-shorts')
        self.assertTrue(0 < len(fm.get('description', '')) <= 1024)

    def test_files_named_in_skill_exist(self):
        text = read(os.path.join(ROOT, 'SKILL.md'))
        for rel in sorted(set(re.findall(r'`((?:engine|scripts|references|templates|examples)/[\w./-]+\.\w+)`', text))):
            if '<' not in rel:
                self.assertTrue(os.path.exists(os.path.join(ROOT, rel)), rel)

    def test_every_style_has_guide_image_module_and_example(self):
        module = {'comic': 'toon', 'anime': 'anime', 'manga': 'manga', 'paper': 'paper', 'painted': 'painted'}
        for s in STYLES:
            for rel in (f'references/styles/{s}.md', f'references/styles/{s}.jpg', f'engine/styles/{module[s]}.js',
                        f'examples/{s}/short.json', f'examples/{s}/short.html', f'examples/{s}/scenes.js'):
                self.assertTrue(os.path.exists(os.path.join(ROOT, rel)), rel)

    def test_example_pages_load_only_existing_local_files(self):
        for s in STYLES + ['../templates/episode']:
            d = os.path.join(ROOT, 'examples', s)
            html = read(os.path.join(d, 'short.html'))
            for src in re.findall(r'(?:src|href)="([^"]+)"', html):
                if src.startswith('http') or src == 'timeline.js':
                    continue
                self.assertTrue(os.path.exists(os.path.normpath(os.path.join(d, src))), f'{s}: {src}')

    def test_scripts_are_valid_json(self):
        for s in STYLES:
            cfg = load(os.path.join(ROOT, 'examples', s, 'short.json'))
            self.assertTrue(cfg['lines'])
            for ln in cfg['lines']:
                self.assertRegex(ln['scene'], r'^[a-z0-9_]+$')
        load(os.path.join(ROOT, 'templates', 'episode', 'short.json'))
        load(os.path.join(ROOT, 'templates', 'episode', 'post.json'))

    def test_no_random_or_clock_in_scene_code(self):
        # frames are rendered out of order by parallel workers: scene code must be a pure function of time
        for d in [os.path.join(ROOT, 'examples', s) for s in STYLES] + [os.path.join(ROOT, 'templates', 'episode')]:
            js = read(os.path.join(d, 'scenes.js'))
            self.assertNotRegex(js, r'Math\.random\(|Date\.now\(|performance\.now\(', d)

    def test_chrome_launch_keeps_keychain_flags(self):
        js = read(os.path.join(ROOT, 'engine', 'render.mjs'))
        self.assertIn("'--use-mock-keychain'", js)
        self.assertIn("'--password-store=basic'", js)

    def test_no_dashes_or_hidden_unicode_in_text_files(self):
        bad = re.compile('[%s]' % ''.join(map(chr, [0x2013, 0x2014, *range(0x200b, 0x2010), *range(0x202a, 0x202f), *range(0x2066, 0x206a), 0xfeff])))
        for base, dirs, files in os.walk(ROOT):
            dirs[:] = [d for d in dirs if d not in ('.git', '__pycache__')]
            for f in files:
                if f.endswith(('.md', '.py', '.js', '.mjs', '.css', '.html', '.json', '.yml', '.txt')):
                    p = os.path.join(base, f)
                    self.assertIsNone(bad.search(read(p)), os.path.relpath(p, ROOT))


class Scaffold(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.series = os.path.join(self.tmp, 'my series')

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def test_new_episode_files_and_styles(self):
        r = new_episode(self.series, 'first-ep', 'manga,comic')
        self.assertEqual(r.returncode, 0, r.stderr)
        ep = os.path.join(self.series, 'episodes', 'first-ep')
        for f in ('short.json', 'short.html', 'scenes.js', 'post.json'):
            self.assertTrue(os.path.exists(os.path.join(ep, f)), f)
        self.assertTrue(os.path.exists(os.path.join(self.series, 'engine', 'render.mjs')))
        self.assertIn('.env', read(os.path.join(self.series, '.gitignore')).split())
        html = read(os.path.join(ep, 'short.html'))
        loaded = re.findall(r'engine/styles/(\w+)\.js', html)
        self.assertEqual(loaded, ['toon', 'fx', 'anime', 'manga'])  # manga needs anime, comic needs toon and fx
        cfg = load(os.path.join(ep, 'short.json'))
        self.assertEqual(cfg['voice']['engine'], 'file')

    def test_bad_episode_names_are_refused(self):
        for name in ('../escape', 'Upper', 'a b', '-dash', 'x/y'):
            r = new_episode(self.series, name)
            self.assertNotEqual(r.returncode, 0, name)
        self.assertFalse(os.path.exists(os.path.join(self.tmp, 'escape')))

    def test_unknown_style_is_refused(self):
        r = new_episode(self.series, 'ep', 'watercolour')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('unknown style', r.stderr)

    def test_existing_episode_is_not_overwritten(self):
        self.assertEqual(new_episode(self.series, 'ep').returncode, 0)
        p = os.path.join(self.series, 'episodes', 'ep', 'scenes.js')
        write(p, '// mine')
        r = new_episode(self.series, 'ep')
        self.assertNotEqual(r.returncode, 0)
        self.assertEqual(read(p), '// mine')

    def test_existing_env_files_are_kept(self):
        os.makedirs(self.series)
        write(os.path.join(self.series, '.gitignore'), 'custom\n')
        self.assertEqual(new_episode(self.series, 'ep').returncode, 0)
        self.assertEqual(read(os.path.join(self.series, '.gitignore')), 'custom\n')


@unittest.skipUnless(AUDIO_OK, 'needs numpy, ffmpeg and ffprobe')
class Pipeline(unittest.TestCase):
    """One episode from the template: voice (own recordings), music, timeline, mix, then render and kit."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp()
        cls.series = os.path.join(cls.tmp, 'series')
        assert new_episode(cls.series, 'demo').returncode == 0
        cls.ep = os.path.join(cls.series, 'episodes', 'demo')
        n = len(load(os.path.join(cls.ep, 'short.json'))['lines'])
        os.makedirs(os.path.join(cls.ep, 'rec'))
        for i in range(n):
            tone(os.path.join(cls.ep, 'rec', f'line_{i:02d}.wav'), 0.8 + 0.1 * i, 200 + 40 * i)
        cls.audio = run([PY, os.path.join(cls.series, 'engine', 'audio.py'), cls.ep])

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp)

    def test_audio_and_timeline(self):
        self.assertEqual(self.audio.returncode, 0, self.audio.stderr + self.audio.stdout)
        tl = load(os.path.join(self.ep, 'timeline.json'))
        self.assertEqual(len(tl['lines']), 4)
        starts = [ln['t'] for ln in tl['lines']]
        self.assertEqual(starts, sorted(starts))
        self.assertGreater(tl['total'], starts[-1])
        self.assertTrue(read(os.path.join(self.ep, 'timeline.js')).strip())
        self.assertNotIn('WARNING', self.audio.stdout)  # the recordings were used, not the fallback voice

    def test_unknown_mood_and_effect_are_errors(self):
        for key, entry, word in (('score', [['0', 'disco', 1.0]], 'disco'), ('sfx', [['0', 'laser', 0.5]], 'laser')):
            d = os.path.join(self.tmp, 'bad-' + key)
            shutil.copytree(self.ep, d)
            cfg = load(os.path.join(d, 'short.json'))
            cfg[key] = entry
            dump(cfg, os.path.join(d, 'short.json'))
            r = run([PY, os.path.join(self.series, 'engine', 'audio.py'), d])
            self.assertNotEqual(r.returncode, 0, key)
            self.assertIn(word, r.stderr + r.stdout)

    @unittest.skipUnless(RENDER_OK, 'needs Node 22+ and Chrome or Chromium')
    def test_render_still_and_kit(self):
        self.assertEqual(self.audio.returncode, 0)
        r = run(['node', os.path.join(self.series, 'engine', 'render.mjs'), self.ep, 'still', '1'])
        self.assertEqual(r.returncode, 0, r.stderr + r.stdout)
        png = os.path.join(self.ep, 'stills', 't1.png')
        with open(png, 'rb') as f:
            head = f.read(24)
        self.assertEqual(head[:8], b'\x89PNG\r\n\x1a\n')
        self.assertEqual(struct.unpack('>II', head[16:24]), (1080, 1920))

        post = load(os.path.join(self.ep, 'post.json'))
        post.update(title='Three seconds #shorts', hashtags=['shorts', 'animation'], thumb_t=1)
        dump(post, os.path.join(self.ep, 'post.json'))
        r = run([PY, os.path.join(self.series, 'engine', 'kit.py'), self.ep])
        self.assertEqual(r.returncode, 0, r.stderr + r.stdout)
        for rel in ('youtube/title.txt', 'youtube/description.txt', 'youtube/captions.en.srt', 'youtube/thumbnail.jpg',
                    'tiktok/caption.txt', 'tiktok/cover.jpg', 'instagram/cover.jpg', 'checklist.md'):
            self.assertTrue(os.path.getsize(os.path.join(self.ep, 'post', rel)) > 0, rel)

    @unittest.skipUnless(RENDER_OK, 'needs Node 22+ and Chrome or Chromium')
    def test_page_error_fails_the_render(self):
        self.assertEqual(self.audio.returncode, 0)
        d = os.path.join(self.tmp, 'broken')
        shutil.copytree(self.ep, d)
        write(os.path.join(d, 'scenes.js'), "window.buildEpisode = () => { throw new Error('boom'); };\n")
        r = run(['node', os.path.join(self.series, 'engine', 'render.mjs'), d, 'still', '1'], timeout=120)
        self.assertNotEqual(r.returncode, 0)

    def test_kit_refuses_long_title(self):
        self.assertEqual(self.audio.returncode, 0)
        d = os.path.join(self.tmp, 'long-title')
        shutil.copytree(self.ep, d)
        post = load(os.path.join(d, 'post.json'))
        post['title'] = 'x' * 101
        dump(post, os.path.join(d, 'post.json'))
        r = run([PY, os.path.join(self.series, 'engine', 'kit.py'), d])
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('too long', r.stderr)


if __name__ == '__main__':
    unittest.main()
