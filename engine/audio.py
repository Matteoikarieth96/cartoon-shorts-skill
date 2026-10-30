"""Soundtrack of one cartoon-shorts episode: voice-over, timeline, scored music, sound effects, ambience, final mix.

    python3 engine/audio.py episodes/<name>

Reads episodes/<name>/short.json, writes into that folder:
  audio/line_*.wav   one clip per narration line, cached by text and voice settings
                     (engines: openai = gpt-4o-mini-tts, say = macOS voices, espeak = espeak-ng, file = your own recordings)
  timeline.json/js   when each scene and line starts (the page keys every animation to it)
  audio/music.wav    the score (one mood per section, "score" in short.json) plus the ambience beds ("amb"), ducked under the voice
  audio/fx.wav       one-shot sound effects ("sfx")
  audio/mix.wav      voice + ducked music + effects, normalised to -14 LUFS

Everything is synthesized with numpy (no scipy): filters and reverb run in the frequency domain.
"""
import hashlib, json, os, re, ssl, subprocess, sys, urllib.error, urllib.request, wave
import numpy as np

SR = 44100
HOME = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
root = sys.argv[1] if len(sys.argv) > 1 else '.'
os.chdir(root)
cfg = json.load(open('short.json'))
os.makedirs('audio', exist_ok=True)
END = cfg.get('end_hold', 2.0)
LEAD, GAP, SCENE_GAP = cfg.get('lead', .1), cfg.get('gap', .14), cfg.get('scene_gap', .25)
import platform, shutil
# offline fallback: a macOS voice on a Mac, espeak-ng elsewhere
MAC = {'engine': 'say', 'voice': 'Samantha', 'rate': 185} if platform.system() == 'Darwin' else {'engine': 'espeak', 'voice': 'en-us', 'rate': 165}
VOICE = cfg.get('voice', MAC)
FALLBACK = cfg.get('fallback', MAC)


# ---------------------------------------------------------------- voice
def openai_key():
    if os.environ.get('OPENAI_API_KEY'):
        return os.environ['OPENAI_API_KEY']
    p = os.path.join(HOME, '.env')
    if os.path.exists(p):
        for line in open(p):
            if line.startswith('OPENAI_API_KEY='):
                return line.split('=', 1)[1].strip().strip('"').strip("'")
    return None


def fetch_openai(spec, text, raw):
    key = openai_key()
    if not key:
        raise RuntimeError('no OPENAI_API_KEY')
    body = {'model': spec.get('model', 'gpt-4o-mini-tts'), 'voice': spec.get('voice', 'onyx'), 'input': text, 'response_format': 'wav'}
    if spec.get('instructions'):
        body['instructions'] = spec['instructions']
    req = urllib.request.Request('https://api.openai.com/v1/audio/speech', data=json.dumps(body).encode(), method='POST',
                                 headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'})
    ctx = ssl.create_default_context(cafile='/etc/ssl/cert.pem') if os.path.exists('/etc/ssl/cert.pem') else None
    last = None
    for _ in range(3):
        try:
            with urllib.request.urlopen(req, timeout=120, context=ctx) as r:
                open(raw, 'wb').write(r.read())
                return
        except urllib.error.HTTPError as e:
            last = RuntimeError(f'OpenAI TTS {e.code}: ' + e.read().decode(errors='replace')[:200].replace(key, '[key]'))
            if e.code < 500:
                break
        except Exception as e:      # timeouts, resets: retry
            last = e
    raise last


def synth(spec, text, path, i=0):
    if spec['engine'] == 'file':
        # your own recordings: rec/line_00.wav (or .m4a/.mp3/.aiff), one file per line, silence trimmed like the TTS clips
        rec = spec.get('dir', 'rec')
        src = next((os.path.join(rec, f'line_{i:02d}{ext}') for ext in ('.wav', '.m4a', '.mp3', '.aiff', '.flac') if os.path.exists(os.path.join(rec, f'line_{i:02d}{ext}'))), None)
        if not src:
            raise RuntimeError(f'missing recording {rec}/line_{i:02d}.wav')
        trim = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02'
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', src, '-af', f"{trim},areverse,{trim},areverse,atempo={spec.get('tempo', 1.0)},aresample={SR}", '-ac', '1', path], check=True)
        return
    if spec['engine'] == 'say' and not shutil.which('say'):
        # macOS voice asked for on another system: use espeak-ng instead of failing
        spec = {'engine': 'espeak', 'voice': 'en-us', 'rate': spec.get('rate', 165)}
    if spec['engine'] == 'espeak':
        tmp = path + '.raw.wav'
        subprocess.run(['espeak-ng', '-v', spec.get('voice', 'en-us'), '-s', str(spec.get('rate', 165)), '-w', tmp, text], check=True)
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', tmp, '-af', f'aresample={SR}', '-ac', '1', path], check=True)
        os.remove(tmp)
        return
    if spec['engine'] == 'say':
        subprocess.run(['say', '-v', spec['voice'], '-r', str(spec.get('rate', 185)), '-o', path, '--file-format=WAVE',
                        f'--data-format=LEI16@{SR}', text], check=True)
        return
    raw = 'audio/raw_' + hashlib.sha1((json.dumps({k: v for k, v in spec.items() if k != 'tempo'}, sort_keys=True) + '|' + text).encode()).hexdigest()[:12] + '.wav'
    if not os.path.exists(raw):
        fetch_openai(spec, text, raw)
    trim = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02'
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', raw, '-af',
                    f"{trim},areverse,{trim},areverse,atempo={spec.get('tempo', 1.0)},aresample={SR}", '-ac', '1', path], check=True)


def line_spec(base, ln):
    """A line may override the delivery: "inst" replaces the instructions, "tempo" the speed."""
    s = dict(base)
    if s['engine'] == 'openai':
        if ln.get('inst'):
            s['instructions'] = ln['inst']
        if ln.get('tempo'):
            s['tempo'] = ln['tempo']
    return s


def voice_lines(base):
    out = []
    for i, ln in enumerate(cfg['lines']):
        spec = line_spec(base, ln)
        stamp = ''
        if spec['engine'] == 'file':
            rec = spec.get('dir', 'rec')
            stamp = '|'.join(str(os.path.getmtime(os.path.join(rec, f))) for f in sorted(os.listdir(rec)) if f.startswith(f'line_{i:02d}.')) if os.path.isdir(rec) else ''
        key = hashlib.sha1((json.dumps(spec, sort_keys=True) + '|' + ln['say'] + stamp).encode()).hexdigest()[:12]
        p = f'audio/line_{i:02d}_{key}.wav'
        if not os.path.exists(p):
            for old in [f for f in os.listdir('audio') if f.startswith(f'line_{i:02d}_')]:
                os.remove(os.path.join('audio', old))
            synth(spec, ln['say'], p, i)
        out.append(p)
    return out


try:
    files = voice_lines(VOICE)
    used = VOICE
except Exception as e:
    print(f"WARNING: {VOICE['engine']} voice failed ({e}); using {FALLBACK['engine']} {FALLBACK.get('voice')}")
    files = voice_lines(FALLBACK)
    used = FALLBACK


def dur(p):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p]).decode())


lines, t, prev_scene = [], LEAD, None
for i, ln in enumerate(cfg['lines']):
    p = files[i]
    if prev_scene is not None:
        t += GAP + (SCENE_GAP if ln['scene'] != prev_scene else 0) + ln.get('pause', 0)
    d = dur(p)
    lines.append({'i': i, 'scene': ln['scene'], 't': round(t, 3), 'd': round(d, 3), 'cap': ln.get('cap', ln['say']), 'file': p})
    t += d + ln.get('after', 0)
    prev_scene = ln['scene']
total = round(t + END, 3)

scenes = []
for k, ln in enumerate(lines):
    if not scenes or scenes[-1]['id'] != ln['scene']:
        prev_end = lines[k - 1]['t'] + lines[k - 1]['d'] if k else 0
        lead_in = cfg.get('cut_lead', {}).get(ln['scene'], .4)
        scenes.append({'id': ln['scene'], 'start': 0.0 if not scenes else round(prev_end + lead_in * (ln['t'] - prev_end), 3)})
for a, b in zip(scenes, scenes[1:] + [{'start': total}]):
    a['end'] = b['start']
sceneById = {s['id']: s for s in scenes}
tl = {'voice': f"{used['engine']}:{used.get('voice')}", 'total': total, 'scenes': scenes,
      'lines': [{k: v for k, v in ln.items() if k != 'file'} for ln in lines]}
json.dump(tl, open('timeline.json', 'w'), indent=1)
open('timeline.js', 'w').write('window.TIMELINE = ' + json.dumps(tl) + ';\n')


def T(expr):
    """'L5', 'L5+0.4', 'L5e-0.2', 'L5%60', 'S2', scene id ('block', 'block+1.2', 'blocke' = its end) or a number."""
    s = str(expr).strip()
    m = re.fullmatch(r'L(\d+)(e|%[\d.]+)?([+-][\d.]+)?', s)
    if m:
        n, end, off = int(m.group(1)), m.group(2) or '', float(m.group(3) or 0)
        frac = 1 if end == 'e' else float(end[1:]) / 100 if end else 0
        return lines[n]['t'] + lines[n]['d'] * frac + off
    m = re.fullmatch(r'S(\d+)([+-][\d.]+)?', s)
    if m:
        return scenes[int(m.group(1))]['start'] + float(m.group(2) or 0)
    m = re.fullmatch(r'([a-z][a-z0-9_]*)([+-][\d.]+)?', s)
    if m:
        name, off = m.group(1), float(m.group(2) or 0)
        if name in sceneById:
            return sceneById[name]['start'] + off
        if name.endswith('e') and name[:-1] in sceneById:
            return sceneById[name[:-1]]['end'] + off
        raise ValueError('unknown time ' + s)
    return float(s)


# ---------------------------------------------------------------- dsp helpers
N = int(total * SR) + SR
rng = np.random.default_rng(7)


def put(buf, at, x, g=1.0):
    i = int(round(at * SR))
    if i >= len(buf) or i + len(x) <= 0:
        return
    if i < 0:
        x, i = x[-i:], 0
    x = x[:len(buf) - i]
    buf[i:i + len(x)] += x * g


def band(x, lo=None, hi=None, soft=.5):
    """Band-pass in the frequency domain; edges roll off over `soft` octaves."""
    n = len(x)
    if n < 8:
        return x
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR) + 1e-9
    g = np.ones_like(f)
    if lo:
        g *= np.clip((np.log2(f / lo) / soft) + 1, 0, 1)
    if hi:
        g *= np.clip(1 - (np.log2(f / hi) / soft), 0, 1)
    return np.fft.irfft(X * g, n)


def reverb(x, sec=2.4, wet=.3, hi=5000, pre=.02):
    n = int(sec * SR)
    tt = np.arange(n) / SR
    ir = rng.standard_normal(n) * np.exp(-tt * 6.9 / sec)
    ir = band(ir, 200, hi)
    ir[:int(pre * SR)] = 0
    ir /= np.sqrt(np.sum(ir ** 2)) + 1e-9
    L = len(x) + n
    size = 1 << (L - 1).bit_length()
    y = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[:len(x)]
    return x * (1 - wet) + y * wet * 3.2


def env(n, a=.01, d=None, r=.05, sustain=True):
    tt = np.arange(n) / SR
    e = np.minimum(1, tt / max(a, 1e-4))
    if d:
        e = e * np.exp(-tt / d)
    if r and sustain:
        e = e * np.clip((n / SR - tt) / r, 0, 1)
    return e


mid = lambda m: 440 * 2 ** ((m - 69) / 12)


def osc(f, sec, harm=(1,), detune=0.0, phase=None):
    tt = np.arange(int(sec * SR)) / SR
    x = np.zeros_like(tt)
    for k, h in enumerate(harm):
        if h:
            x += h * np.sin(2 * np.pi * f * (k + 1) * (1 + detune) * tt + (phase or 0) * (k + 1))
    return x


def saw(f, sec, n=10, detune=0.0):
    return osc(f, sec, harm=[1 / k for k in range(1, n + 1)], detune=detune)


def piano(m, sec=2.2, vel=1.0):
    f = mid(m)
    n = int(sec * SR)
    tt = np.arange(n) / SR
    x = np.zeros(n)
    for k, h in enumerate((1, .55, .3, .18, .1, .06, .04)):
        fk = f * (k + 1) * (1 + .0004 * k * k)
        x += h * np.sin(2 * np.pi * fk * tt) * np.exp(-tt * (1.2 + k * .9) * (f / 440) ** .3)
    x *= np.minimum(1, tt / .004) * np.clip((sec - tt) / .08, 0, 1)
    return x * vel


def pad(ms, sec, bright=1.0, a=.6):
    x = np.zeros(int(sec * SR))
    for m in ms:
        for dt in (-.004, 0, .005):
            x += saw(mid(m), sec, n=8, detune=dt) * .33
    x *= env(len(x), a=a, r=.5)
    return band(x, 80, 900 + 2600 * bright, soft=1.2)


def strings_note(m, sec, a=.05, bright=1.0):
    x = sum(saw(mid(m), sec, n=9, detune=d) for d in (-.003, .0035)) * .5
    x *= env(len(x), a=a, r=.12)
    tt = np.arange(len(x)) / SR
    x *= 1 + .08 * np.sin(2 * np.pi * 5.2 * tt)
    return band(x, 120, 2500 * bright, soft=1)


def brass(ms, sec, a=.05):
    x = np.zeros(int(sec * SR))
    for m in ms:
        x += saw(mid(m), sec, n=14) * .3
    tt = np.arange(len(x)) / SR
    x *= np.minimum(1, tt / a) * (.55 + .45 * np.exp(-tt / .35)) * np.clip((sec - tt) / .25, 0, 1)
    return band(x, 90, 2200, soft=1)


def kick(g=1.0, f0=120, f1=42, dec=.32):
    n = int(.5 * SR)
    tt = np.arange(n) / SR
    fr = f1 + (f0 - f1) * np.exp(-tt / .035)
    x = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-tt / dec)
    x[:int(.004 * SR)] += rng.uniform(-1, 1, int(.004 * SR)) * .6
    return x * g


def snare(g=1.0, dec=.16):
    n = int(.35 * SR)
    tt = np.arange(n) / SR
    noise = band(rng.uniform(-1, 1, n), 900, 9000) * np.exp(-tt / dec)
    body = np.sin(2 * np.pi * 190 * tt) * np.exp(-tt / .05) * .6
    return (noise * 1.4 + body) * g


def clap(g=1.0):
    n = int(.3 * SR)
    x = np.zeros(n)
    for k, off in enumerate((0, .011, .023, .032)):
        seg = band(rng.uniform(-1, 1, n), 1000, 6000) * np.exp(-np.arange(n) / SR / (.012 if k < 3 else .12))
        put(x, off, seg[:n - int(off * SR)], 1)
    return x * g * .9


def hat(g=1.0, dec=.035):
    n = int(.15 * SR)
    return band(rng.uniform(-1, 1, n), 6500, None) * np.exp(-np.arange(n) / SR / dec) * g


def taiko(g=1.0, f=62):
    n = int(1.2 * SR)
    tt = np.arange(n) / SR
    fr = f + 40 * np.exp(-tt / .03)
    x = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-tt / .45)
    x += band(rng.uniform(-1, 1, n), 60, 900) * np.exp(-tt / .06) * .8
    return x * g


def sub808(m, sec, g=1.0):
    n = int(sec * SR)
    tt = np.arange(n) / SR
    f = mid(m)
    fr = f * (1 + .6 * np.exp(-tt / .03))
    x = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-tt / max(.3, sec * .6))
    x = np.tanh(x * 1.6) * np.clip((sec - tt) / .05, 0, 1)
    return x * g


def cymbal(g=1.0, dec=1.6):
    n = int(dec * 2.2 * SR)
    tt = np.arange(n) / SR
    return band(rng.uniform(-1, 1, n), 4000, 15000) * np.exp(-tt / dec) * g


def heartbeat(g=1.0):
    n = int(.6 * SR)
    tt = np.arange(n) / SR
    beat = lambda: np.sin(2 * np.pi * (48 + 30 * np.exp(-tt / .02)) * tt) * np.exp(-tt / .07)
    x = beat()
    put(x, .26, beat()[:n - int(.26 * SR)] * .75)
    return band(x, 25, 300) * g


def riser(sec, g=1.0):
    n = int(sec * SR)
    tt = np.arange(n) / SR
    k = tt / sec
    noise = rng.uniform(-1, 1, n)
    lo = band(noise, 300, 1500) * (1 - k)
    hiB = band(noise, 2500, 9000) * k
    tone = np.sin(2 * np.pi * np.cumsum(200 + 900 * k ** 2) / SR) * .25
    return (lo * .5 + hiB * .8 + tone) * k ** 2 * g


# ---------------------------------------------------------------- the score
CH = {  # chords as MIDI notes (root first)
    'Dm': [50, 53, 57], 'Bb': [46, 50, 53], 'F': [41, 45, 48], 'C': [48, 52, 55], 'Gm': [43, 46, 50], 'A': [45, 49, 52],
    'D': [50, 54, 57], 'Bm': [47, 50, 54], 'G': [43, 47, 50], 'Am': [45, 48, 52], 'Eb': [51, 55, 58],
}
music = np.zeros(N)


MOODS = ['tense', 'sad', 'warm', 'home', 'tears', 'promise', 'rise', 'groove', 'drop', 'epic', 'slowmo', 'triumph', 'end', 'waltz', 'silence']


def section(t0, t1, mood, energy=1.0):
    """Render one mood between t0 and t1 into its own buffer, with a short tail."""
    sec = t1 - t0
    tail = 1.2
    x = np.zeros(int((sec + tail) * SR) + 1)
    if mood == 'tense':
        bpm = 120
        B = 60 / bpm
        put(x, 0, band(osc(mid(26), sec + .6, harm=(1, .6, .3, .2, .1)) * env(int((sec + .6) * SR), a=.6, r=.6), 20, 400) * .35)
        tr = (strings_note(69, sec, a=.8) + strings_note(70, sec, a=.8) * .7)
        tt = np.arange(len(tr)) / SR
        put(x, 0, tr * (.5 + .5 * np.sin(2 * np.pi * 11 * tt)) * .1)
        k = 0
        while k * B < sec:
            put(x, k * B, hat(.25, .012))                      # the game clock ticking
            k += 1
        hb = 0
        while hb < sec - .3:
            put(x, hb, heartbeat(.9))
            hb += .86
        put(x, max(0, sec - 2.2), riser(2.2, .35))
    elif mood in ('sad', 'warm', 'home', 'tears', 'promise'):
        prog = {'sad': ['Dm', 'Bb', 'F', 'C'], 'warm': ['F', 'C', 'Dm', 'Bb'], 'home': ['Bb', 'F', 'C', 'Dm'],
                'tears': ['D', 'Bm', 'G', 'A'], 'promise': ['G', 'D', 'Bm', 'A']}[mood]
        bpm = {'sad': 76, 'warm': 82, 'home': 80, 'tears': 72, 'promise': 76}[mood]
        B = 60 / bpm
        bar = 4 * B
        nb = int(sec / bar) + 1
        for b in range(nb):
            c = CH[prog[b % 4]]
            t = b * bar
            put(x, t, pad([n + 12 for n in c], bar + .6, bright=.5 if mood == 'sad' else .8, a=.5), .07 if mood != 'tears' else .1)
            put(x, t, piano(c[0] - 12, bar + .5, .5), .5)        # low root
            arp = [c[0] + 12, c[1] + 12, c[2] + 12, c[1] + 24, c[2] + 12, c[1] + 12, c[0] + 24, c[2] + 12]
            for k, m in enumerate(arp):
                put(x, t + k * B / 2, piano(m, 1.6, .55 if k % 2 == 0 else .4), .16)
            if mood in ('tears', 'promise', 'home'):
                put(x, t, strings_note(c[0] + 24, bar + .3, a=.6, bright=.7), .06 * energy)
        if mood in ('tears', 'promise'):
            # a simple melody on top (D major), one phrase per four bars
            mel = [(0, 78, 1.5), (1.5, 76, .5), (2, 74, 2), (4, 74, 1), (5, 76, 1), (6, 78, 2), (8, 79, 1.5), (9.5, 78, .5), (10, 74, 2),
                   (12, 73, 1), (13, 74, 1), (14, 76, 2)]
            for rep in range(int(sec / (16 * B)) + 1):
                for (o, m, d) in mel:
                    at = rep * 16 * B + o * B
                    if at < sec:
                        put(x, at, piano(m, d * B + 1.2, .8), .22)
    elif mood in ('rise', 'groove'):
        bpm = 92 if mood == 'rise' else 104
        B = 60 / bpm
        bar = 4 * B
        prog = ['Dm', 'Bb', 'F', 'C'] if mood == 'rise' else ['F', 'Am', 'Bb', 'C']
        nb = int(sec / bar) + 1
        for b in range(nb):
            c = CH[prog[b % 4]]
            t = b * bar
            put(x, t, pad([n + 12 for n in c], bar + .3, bright=1, a=.08), .06)
            put(x, t, sub808(c[0] - 12, bar * .9), .45)
            for k in (0, 1.5, 2.5) if mood == 'rise' else (0, 1, 2, 3):
                put(x, t + k * B, kick(.9))
            for k in (1, 3):
                put(x, t + k * B, clap(.5))
            for k in range(8):
                put(x, t + k * B / 2 + (.03 if k % 2 else 0), hat(.22 if k % 2 else .3))
            for k in (0, 1.5, 3) if mood == 'rise' else (0, .5, 1.5, 2, 3):
                for m in c:
                    put(x, t + k * B, piano(m + 24, .5, .5), .1)
    elif mood == 'drop':
        put(x, 0, kick(1.2, 90, 30, .9))
        put(x, 0, brass([38, 50, 53, 57], min(sec, 3.0) + .4, a=.02), .32)
        if sec > 2.2:
            put(x, 2.2, brass([34, 46, 50, 53], sec - 2.2 + .5, a=.4), .3)
        roll = band(rng.uniform(-1, 1, int(sec * SR)), 40, 300)
        tt = np.arange(len(roll)) / SR
        put(x, 0, roll * (.3 + .7 * tt / max(sec, .1)) * (.6 + .4 * np.sin(2 * np.pi * 14 * tt)), .35)
    elif mood == 'epic':
        bpm = 100
        B = 60 / bpm
        bar = 4 * B
        prog = ['Dm', 'Bb', 'Gm', 'A']
        nb = int(sec / bar) + 1
        for b in range(nb):
            c = CH[prog[b % 4]]
            t = b * bar
            grow = min(1, .55 + .45 * t / max(sec, 1))
            put(x, t, brass([c[0]] + [n + 12 for n in c], bar * .55, a=.03), .22 * grow)
            put(x, t, pad([n + 12 for n in c], bar + .2, bright=.9, a=.2), .06)
            ost = [c[0] + 12, c[0] + 12, c[1] + 12, c[0] + 12, c[2] + 12, c[0] + 12, c[1] + 12, c[0] + 12] * 2
            for k, m in enumerate(ost):
                put(x, t + k * B / 4, strings_note(m, B / 4 * .9, a=.005, bright=1.2), .12 * grow)
            for k in (0, 1.5, 2, 3, 3.5):
                put(x, t + k * B, taiko(.9 * grow))
            put(x, t + 1 * B, snare(.4 * grow, .1))
            put(x, t + 3 * B, snare(.4 * grow, .1))
        put(x, max(0, sec - 2.5), riser(2.5, .5))
    elif mood == 'slowmo':
        put(x, 0, band(osc(mid(26), sec + .6, harm=(1, .5, .25)) * env(int((sec + .6) * SR), a=.3, r=.5), 20, 300) * .45)
        hb = 0
        while hb < sec - .2:
            put(x, hb, heartbeat(1.3))
            hb += 1.0
        rv = riser(sec, .55)
        put(x, 0, rv)
    elif mood == 'triumph':
        bpm = 100
        B = 60 / bpm
        bar = 4 * B
        prog = ['D', 'A', 'Bm', 'G']
        nb = int(sec / bar) + 1
        put(x, 0, cymbal(.6, 2.2))
        for b in range(nb):
            c = CH[prog[b % 4]]
            t = b * bar
            put(x, t, brass([c[0]] + [n + 12 for n in c] + [c[0] + 24], bar * .9, a=.02), .26)
            put(x, t, pad([n + 12 for n in c] + [c[0] + 24], bar + .3, bright=1.2, a=.05), .09)
            put(x, t, sub808(c[0] - 12, bar * .9), .35)
            for k in range(4):
                put(x, t + k * B, kick(.9))
                put(x, t + k * B + B / 2, hat(.3))
            for k in (1, 3):
                put(x, t + k * B, snare(.6))
            for k in range(8):
                put(x, t + k * B / 2, strings_note(c[k % 3] + 24, B / 2 * .9, a=.01), .07)
    elif mood == 'end':
        c = CH['D']
        put(x, 0, kick(1.1, 100, 35, .7))
        put(x, 0, cymbal(.5, 2.5))
        put(x, 0, brass([c[0]] + [n + 12 for n in c] + [c[0] + 24], sec + .5, a=.02), .26)
        put(x, 0, pad([n + 12 for n in c] + [c[0] + 24], sec + .8, bright=1, a=.1), .1)
    elif mood == 'waltz':
        # kitchen waltz in 3/4: piano oom-pah-pah, a mandolin-like tremolo melody, soft strings (energy scales the strings)
        bpm = 138
        B = 60 / bpm
        bar = 3 * B
        prog = ['F', 'Dm', 'Bb', 'C']
        mel = [(0, 72, 1.5), (1.5, 74, .5), (2, 72, 1), (3, 69, 2), (5, 65, 1), (6, 70, 1.5), (7.5, 72, .5), (8, 74, 1), (9, 72, 3),
               (12, 77, 1.5), (13.5, 76, .5), (14, 74, 1), (15, 72, 1), (16, 69, 1), (17, 74, 1), (18, 70, 1), (19, 74, 1), (20, 72, 1),
               (21, 67, 1), (22, 72, 2)]
        nb = int(sec / bar) + 1
        for b in range(nb):
            c = CH[prog[b % 4]]
            t = b * bar
            put(x, t, piano(c[0] - 12, bar, .7), .42)
            for k in (1, 2):
                for m in c:
                    put(x, t + k * B, piano(m + 12, B * .9, .45), .09)
            put(x, t, strings_note(c[0] + 24, bar + .2, a=.25, bright=.8), .035 * energy)
            put(x, t, strings_note(c[2] + 12, bar + .2, a=.25, bright=.8), .03 * energy)
        for rep in range(int(sec / (24 * B)) + 1):
            for (o, m, d) in mel:
                at = rep * 24 * B + o * B
                if at >= sec:
                    continue
                if d >= 1:      # long notes as a mandolin tremolo
                    q = 0
                    while q < d * B - .02:
                        put(x, at + q, piano(m + 12, .16, .5 if q == 0 else .32), .11)
                        q += 1 / 11
                else:
                    put(x, at, piano(m + 12, .3, .55), .12)
    elif mood == 'silence':
        pass
    else:
        raise ValueError(f'unknown mood {mood!r}: use one of {MOODS}')
    # fade the tail out quickly so sections butt-join without clicks
    n1 = int(sec * SR)
    fo = int(.18 * SR)
    x[n1:n1 + fo] *= np.linspace(1, 0, len(x[n1:n1 + fo]))
    x[n1 + fo:] = 0
    x[:int(.01 * SR)] *= np.linspace(0, 1, int(.01 * SR))
    put(music, t0, x * energy)


score = cfg.get('score', [])
for k, item in enumerate(score):
    at, mood = item[0], item[1]
    energy = item[2] if len(item) > 2 else 1.0
    t0 = T(at)
    t1 = T(score[k + 1][0]) if k + 1 < len(score) else total
    section(t0, t1, mood, energy)
music = reverb(music, 2.2, .22)
fo = int(1.2 * SR)
music[int(total * SR) - fo:int(total * SR)] *= np.linspace(1, 0, fo)
music[int(total * SR):] = 0

# ---------------------------------------------------------------- effects and ambience
fx = np.zeros(N)
amb = np.zeros(N)


def whoosh(sec=.45, up=True, g=1.0):
    n = int(sec * SR)
    k = np.arange(n) / n
    noise = rng.uniform(-1, 1, n)
    lo, hi_ = band(noise, 200, 1200), band(noise, 1500, 7000)
    shape = np.sin(np.pi * k) ** 1.5 if up else np.exp(-k * 4)
    return (lo * (1 - k) + hi_ * k) * shape * g


def impact(g=1.0):
    n = int(2.6 * SR)
    tt = np.arange(n) / SR
    fr = 30 + 70 * np.exp(-tt / .12)
    x = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-tt / .9) * 1.2
    x += band(rng.uniform(-1, 1, n), 80, 5000) * np.exp(-tt / .12) * .9
    x += band(rng.uniform(-1, 1, n), 3000, 12000) * np.exp(-tt / .5) * .25
    return reverb(np.tanh(x * 1.4), 2.8, .35) * g


def hit(g=1.0):
    n = int(.6 * SR)
    tt = np.arange(n) / SR
    x = np.sin(2 * np.pi * np.cumsum(60 + 110 * np.exp(-tt / .03)) / SR) * np.exp(-tt / .2)
    x += band(rng.uniform(-1, 1, n), 500, 6000) * np.exp(-tt / .04) * .7
    return np.tanh(x * 1.3) * g


def swish(g=1.0):
    n = int(.5 * SR)
    tt = np.arange(n) / SR
    x = band(rng.uniform(-1, 1, n), 2500, 9000) * np.minimum(1, tt / .05) * np.exp(-tt / .12)
    x += band(rng.uniform(-1, 1, n), 600, 2500) * np.exp(-tt / .05) * .3
    return x * g


def bounce(g=1.0):
    n = int(.25 * SR)
    tt = np.arange(n) / SR
    x = np.sin(2 * np.pi * np.cumsum(90 + 140 * np.exp(-tt / .01)) / SR) * np.exp(-tt / .06)
    x += band(rng.uniform(-1, 1, n), 400, 3000) * np.exp(-tt / .008) * .5
    return x * g


def squeak(g=1.0):
    n = int(.14 * SR)
    tt = np.arange(n) / SR
    f = 2200 + 500 * np.sin(2 * np.pi * 28 * tt) + 900 * tt / .14
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * tt / .14) * .5 * g


def buzzer(g=1.0, sec=1.1):
    n = int(sec * SR)
    tt = np.arange(n) / SR
    x = np.sign(np.sin(2 * np.pi * 220 * tt)) * .5 + np.sign(np.sin(2 * np.pi * 277 * tt)) * .4
    return band(x, 150, 3500) * np.minimum(1, tt / .01) * np.clip((sec - tt) / .05, 0, 1) * .5 * g


def rewind(sec=1.6, g=1.0):
    n = int(sec * SR)
    tt = np.arange(n) / SR
    k = tt / sec
    f = 300 + 2600 * k ** 1.5 + 140 * np.sin(2 * np.pi * 9 * tt)
    warble = np.sin(2 * np.pi * np.cumsum(f) / SR) * .35 + np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR) * .2
    hiss = band(rng.uniform(-1, 1, n), 2000, 9000) * .35
    clicks = np.zeros(n)
    for c in rng.uniform(0, sec, 24):
        put(clicks, c, np.array([.9, -.6, .3]))
    x = (warble + hiss) * np.minimum(1, tt / .05) * np.clip((sec - tt) / .06, 0, 1) + clicks * .4
    return x * g


def tapestop(sec=.7, g=1.0):
    n = int(sec * SR)
    tt = np.arange(n) / SR
    f = 220 * (1 - tt / sec) ** 2 + 20
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * (1 - tt / sec) * .7 * g


def flash(g=1.0):
    n = int(.9 * SR)
    tt = np.arange(n) / SR
    pop = band(rng.uniform(-1, 1, n), 1500, 10000) * np.exp(-tt / .015)
    whine = np.sin(2 * np.pi * np.cumsum(3000 + 4000 * tt) / SR) * np.exp(-tt / .35) * .08
    return (pop + whine) * g


def typewriter(count=12, rate=11, g=1.0):
    x = np.zeros(int((count / rate + .5) * SR))
    for k in range(count):
        n = int(.05 * SR)
        tt = np.arange(n) / SR
        c = band(rng.uniform(-1, 1, n), 1500, 7000) * np.exp(-tt / .006) + np.sin(2 * np.pi * 180 * tt) * np.exp(-tt / .01) * .5
        put(x, k / rate + rng.uniform(0, .02), c, .8 + rng.uniform(0, .3))
    return x * g


def bell(g=1.0, f=880, sec=2.5):
    n = int(sec * SR)
    tt = np.arange(n) / SR
    x = sum(a * np.sin(2 * np.pi * f * r * tt) * np.exp(-tt / (d)) for r, a, d in ((1, 1, 1.2), (2.76, .5, .6), (5.4, .3, .3), (8.9, .15, .15)))
    return x * np.minimum(1, tt / .002) * .4 * g


def schoolbell(g=1.0, sec=1.6):
    n = int(sec * SR)
    tt = np.arange(n) / SR
    strike = (np.sin(2 * np.pi * 24 * tt) > 0).astype(float)
    x = sum(a * np.sin(2 * np.pi * f * tt) for f, a in ((1200, 1), (2650, .5), (4100, .25)))
    return x * (.55 + .45 * strike) * np.minimum(1, tt / .01) * np.clip((sec - tt) / .1, 0, 1) * .25 * g


def sparkle(g=1.0):
    x = np.zeros(int(1.4 * SR))
    for k, m in enumerate((88, 91, 95, 100, 103)):
        put(x, k * .06, bell(1, mid(m), 1.0), .35)
    return x * g


def fire(sec=3.0, g=1.0):
    n = int(sec * SR)
    tt = np.arange(n) / SR
    roar = band(rng.uniform(-1, 1, n), 60, 700) * (.6 + .4 * np.sin(2 * np.pi * .7 * tt + 1))
    crack = np.zeros(n)
    for c in rng.uniform(0, sec, int(sec * 22)):
        put(crack, c, band(rng.uniform(-1, 1, 300), 1500, 8000) * np.exp(-np.arange(300) / 40), rng.uniform(.3, 1))
    return (roar * .7 + crack * .6) * np.minimum(1, tt / .3) * np.clip((sec - tt) / .5, 0, 1) * g


def crowd(sec, level=1.0, excite=0.0):
    """Arena crowd: a murmur, or a roar when excite is high (claps and whistles on top)."""
    n = int(sec * SR)
    tt = np.arange(n) / SR
    noise = rng.standard_normal(n)
    body = band(noise, 250 - 80 * excite, 1400 + 3000 * excite, soft=1)
    mod = 1 + .25 * np.sin(2 * np.pi * .31 * tt + 1) + .2 * np.sin(2 * np.pi * .73 * tt) + .12 * np.sin(2 * np.pi * 1.9 * tt + 2)
    x = body * mod * (.5 + 1.2 * excite)
    if excite > .3:
        for c in rng.uniform(0, sec, int(sec * 60 * excite)):
            put(x, c, band(rng.uniform(-1, 1, 400), 1200, 6000) * np.exp(-np.arange(400) / 60), .25 * rng.uniform(.3, 1))
        for c in rng.uniform(0, sec, int(sec * 1.5 * excite)):
            d = rng.uniform(.3, .9)
            m = int(d * SR)
            ft = 2200 + rng.uniform(0, 900) + 600 * np.sin(np.linspace(0, np.pi, m))
            put(x, c, np.sin(2 * np.pi * np.cumsum(ft) / SR) * np.sin(np.linspace(0, np.pi, m)), .05)
    fade = int(min(.4, sec / 3) * SR)
    x[:fade] *= np.linspace(0, 1, fade)
    x[-fade:] *= np.linspace(1, 0, fade)
    return x * level * .5


def rain(sec, g=1.0):
    n = int(sec * SR)
    x = band(rng.standard_normal(n), 800, 9000) * .3
    for c in rng.uniform(0, sec, int(sec * 40)):
        put(x, c, band(rng.uniform(-1, 1, 200), 2000, 9000) * np.exp(-np.arange(200) / 30), .2)
    fade = int(min(.5, sec / 3) * SR)
    x[:fade] *= np.linspace(0, 1, fade)
    x[-fade:] *= np.linspace(1, 0, fade)
    return x * g


def trumpet_call(g=1.0):
    """A bugle-style charge on one trumpet: short, short, short, long (the Filadelfia trumpet)."""
    notes = [(67, .13), (72, .13), (76, .13), (79, .34), (76, .13), (79, .9)]
    x = np.zeros(int((sum(d for _, d in notes) + .6) * SR))
    t = 0.0
    for m, d in notes:
        n = int(d * SR)
        tt = np.arange(n) / SR
        f0 = mid(m) * (1 + .004 * np.sin(2 * np.pi * 5.5 * tt) * np.minimum(1, tt / .2))
        ph = 2 * np.pi * np.cumsum(f0) / SR
        tone = sum(np.sin(ph * k) / k ** .9 for k in range(1, 12))
        e = np.minimum(1, tt / .015) * np.clip((d - tt) / .03, 0, 1) * (.8 + .2 * np.exp(-tt / .08))
        put(x, t, band(tone * e, 200, 5000, soft=1) * .18)
        t += d
    return reverb(x, 1.8, .35) * g


def toll(g=1.0, f=146.8, sec=6.0):
    """A deep church bell, one stroke, long decay."""
    n = int(sec * SR)
    tt = np.arange(n) / SR
    x = sum(a * np.sin(2 * np.pi * f * r * tt) * np.exp(-tt / d) for r, a, d in ((.5, .6, 4.0), (1, 1, 3.2), (1.19, .45, 2.2), (1.5, .35, 1.8), (2, .5, 1.5), (2.52, .2, .9), (3.01, .15, .6)))
    return x * np.minimum(1, tt / .003) * .35 * g


def wind(sec, g=1.0):
    n = int(sec * SR)
    tt = np.arange(n) / SR
    x = band(rng.standard_normal(n), 180, 1100, soft=1) * (.6 + .4 * np.sin(2 * np.pi * .17 * tt + 1) * np.sin(2 * np.pi * .41 * tt))
    fade = int(min(.8, sec / 3) * SR)
    x[:fade] *= np.linspace(0, 1, fade)
    x[-fade:] *= np.linspace(1, 0, fade)
    return x * .5 * g


def drone(sec, g=1.0):
    """Three piston engines heard from the ground: a low beating hum."""
    n = int(sec * SR)
    tt = np.arange(n) / SR
    x = sum(np.sign(np.sin(2 * np.pi * f * tt)) * a for f, a in ((62, .5), (65.5, .4), (93, .25)))
    x = band(x, 40, 500, soft=1) * (.75 + .25 * np.sin(2 * np.pi * 3.5 * tt))
    fade = int(min(1.0, sec / 3) * SR)
    x[:fade] *= np.linspace(0, 1, fade)
    x[-fade:] *= np.linspace(1, 0, fade)
    return x * .35 * g


# ---------------------------------------------------------------- kitchen sounds
def slowrand(n, step, lo=.5, hi=1.0):
    k = max(2, int(n / step) + 2)
    v = rng.uniform(lo, hi, k)
    return np.interp(np.arange(n), np.arange(k) * step, v)


def sizzle(sec, g=1.0):
    """Guanciale frying: a hiss that breathes plus tiny fat crackles."""
    n = int(sec * SR)
    tt = np.arange(n) / SR
    x = band(rng.standard_normal(n), 2200, 9500, soft=1) * slowrand(n, int(.18 * SR), .45, 1.0) * .5
    for c in rng.uniform(0, sec, int(sec * 45)):
        m = int(rng.uniform(.004, .012) * SR)
        put(x, c, band(rng.uniform(-1, 1, m + 200), 2500, 11000)[:m] * np.exp(-np.arange(m) / (m / 4)), rng.uniform(.2, .9))
    fade = int(min(.3, sec / 3) * SR)
    x[:fade] *= np.linspace(0, 1, fade)
    x[-fade:] *= np.linspace(1, 0, fade)
    return x * g


def boil(sec, g=1.0):
    """A pot at a rolling boil: low rumble plus bubbles that rise in pitch."""
    n = int(sec * SR)
    x = band(rng.standard_normal(n), 70, 400, soft=1) * .35
    for c in rng.uniform(0, sec, int(sec * 16)):
        d = rng.uniform(.02, .05)
        m = int(d * SR)
        f = np.linspace(rng.uniform(250, 450), rng.uniform(600, 1100), m)
        put(x, c, np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.linspace(0, np.pi, m)), rng.uniform(.08, .25))
    fade = int(min(.4, sec / 3) * SR)
    x[:fade] *= np.linspace(0, 1, fade)
    x[-fade:] *= np.linspace(1, 0, fade)
    return x * g


def chop(g=1.0):
    n = int(.12 * SR)
    tt = np.arange(n) / SR
    return (band(rng.uniform(-1, 1, n), 120, 900) * np.exp(-tt / .015) + band(rng.uniform(-1, 1, n), 2500, 7000) * np.exp(-tt / .004) * .6) * g


def chops(g=1.0, count=6, rate=5.5):
    x = np.zeros(int((count / rate + .3) * SR))
    for k in range(count):
        put(x, k / rate + rng.uniform(0, .02), chop(rng.uniform(.7, 1)))
    return x * g


def splash(g=1.0, sec=.7):
    n = int(sec * SR)
    tt = np.arange(n) / SR
    return band(rng.uniform(-1, 1, n), 300, 5000) * np.exp(-tt / .18) * np.minimum(1, tt / .01) * g


def pour(g=1.0, sec=1.1):
    n = int(sec * SR)
    tt = np.arange(n) / SR
    x = band(rng.uniform(-1, 1, n), 700, 3500) * (.7 + .3 * np.sin(2 * np.pi * 9 * tt)) * np.minimum(1, tt / .08) * np.clip((sec - tt) / .2, 0, 1)
    return x * .6 * g


def plop(g=1.0):
    n = int(.18 * SR)
    f = np.linspace(520, 160, n)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-np.arange(n) / (.05 * SR)) * g


def shake_salt(g=1.0):
    x = np.zeros(int(.8 * SR))
    for k in range(3):
        n = int(.12 * SR)
        put(x, k * .2, band(rng.uniform(-1, 1, n), 3000, 10000) * np.sin(np.linspace(0, np.pi, n)), .5)
    return x * g


SFX = {
    'trumpet': trumpet_call, 'toll': toll,
    'whoosh': lambda g: whoosh(.45, True, g), 'whip': lambda g: whoosh(.22, True, g * 1.2), 'impact': impact, 'hit': hit,
    'swish': swish, 'bounce': bounce, 'squeak': squeak, 'buzzer': buzzer, 'rewind': lambda g: rewind(1.6, g), 'tapestop': lambda g: tapestop(.7, g),
    'flash': flash, 'typewriter': lambda g: typewriter(16, 12, g), 'ding': lambda g: bell(g, 1760, 1.5), 'bell': schoolbell, 'sparkle': sparkle,
    'fire': lambda g: fire(3.5, g), 'riser': lambda g: riser(1.6, g), 'riser3': lambda g: riser(3.0, g), 'heartbeat': heartbeat,
    'kick': lambda g: kick(g), 'taiko': taiko, 'cymbal': lambda g: cymbal(g, 2.0), 'sub': lambda g: kick(g, 80, 28, 1.2),
    'pop': lambda g: bell(g * .8, 1320, .25), 'tick': lambda g: hat(g * 2, .01),
    'chop': chop, 'chops': chops, 'splash': splash, 'pour': pour, 'plop': plop, 'salt': shake_salt,
    'sizzle': lambda g: sizzle(1.6, g), 'boil': lambda g: boil(2.0, g), 'crowd': lambda g: crowd(2.5, g, .8),
    'rain': lambda g: rain(2.5, g), 'wind': lambda g: wind(2.5, g),
}
for s in scenes[1:]:
    if s['id'] not in cfg.get('no_whoosh', []):
        put(fx, s['start'] - .3, whoosh(.42, True, .28))
for item in cfg.get('sfx', []):
    at, kind = item[0], item[1]
    g = item[2] if len(item) > 2 else 1.0
    if kind not in SFX:
        raise SystemExit(f'unknown sfx {kind!r}: use one of {sorted(SFX)}')
    put(fx, T(at), SFX[kind](g))
for item in cfg.get('amb', []):
    a, b, kind = T(item[0]), T(item[1]), item[2]
    level = item[3] if len(item) > 3 else 1.0
    excite = item[4] if len(item) > 4 else 0.0
    if kind not in ('crowd', 'rain', 'wind', 'drone', 'sizzle', 'boil', 'fire'):
        raise SystemExit(f'unknown ambience {kind!r}: use crowd, rain, wind, drone, sizzle, boil or fire')
    sec = max(.2, b - a)
    x = (crowd(sec, level, excite) if kind == 'crowd' else rain(sec, level) if kind == 'rain' else wind(sec, level) if kind == 'wind'
         else drone(sec, level) if kind == 'drone' else sizzle(sec, level) if kind == 'sizzle' else boil(sec, level) if kind == 'boil'
         else fire(sec, level))
    put(amb, a, x)
fx = reverb(fx, 1.6, .18)


def wav(p, x, sr=SR):
    x = np.clip(x, -1, 1)
    with wave.open(p, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes((x * 32767).astype('<i2').tobytes())


n_total = int(total * SR)
mg = cfg.get('music_gain', .5)
# ambience beds (crowd, rain, fire) ride with the music and duck under the voice; one-shot effects stay on top
wav('audio/music.wav', (music * mg + amb * cfg.get('amb_gain', .3))[:n_total])
wav('audio/fx.wav', fx[:n_total] * cfg.get('fx_gain', .45))

args = ['ffmpeg', '-y', '-v', 'error', '-f', 'lavfi', '-t', f'{total:.3f}', '-i', f'anullsrc=r={SR}:cl=mono']
flt = []
for k, ln in enumerate(lines):
    args += ['-i', ln['file']]
    ms = int(ln['t'] * 1000)
    flt.append(f'[{k + 1}]adelay={ms}|{ms}[a{k}]')
flt.append('[0]' + ''.join(f'[a{k}]' for k in range(len(lines))) + f'amix=inputs={len(lines) + 1}:normalize=0[v]')
args += ['-filter_complex', ';'.join(flt), '-map', '[v]', '-ar', str(SR), '-ac', '1', 'audio/voice.wav']
subprocess.run(args, check=True)
# the voice gets a touch of presence; music and ambience duck under it; effects stay on top
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', 'audio/voice.wav', '-i', 'audio/music.wav', '-i', 'audio/fx.wav', '-filter_complex',
                '[0]highpass=f=70,acompressor=threshold=0.1:ratio=3:attack=5:release=120,equalizer=f=3000:t=q:w=1:g=2,asplit[v1][v2];'
                '[1][v1]sidechaincompress=threshold=0.015:ratio=8:attack=15:release=380[m];'
                '[v2][m][2]amix=inputs=3:normalize=0,alimiter=limit=0.9,loudnorm=I=-14:TP=-1.5:LRA=11[o]',
                '-map', '[o]', '-ar', '48000', '-ac', '2', 'audio/mix.wav'], check=True)

print(f"voice: {used['engine']} {used.get('voice')}")
print(f'total {total:.1f} s')
for s in scenes:
    print(f"{s['id']:10s} {s['start']:6.2f} -> {s['end']:6.2f}")
for ln in lines:
    print(f"  L{ln['i']:<2d} {ln['t']:6.2f} +{ln['d']:.2f}  {ln['cap']}")
