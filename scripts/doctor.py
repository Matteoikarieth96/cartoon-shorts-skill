"""Check that this machine can make cartoon shorts: Node 22+, Python numpy, ffmpeg, Chrome or Chromium, a voice.

    python3 scripts/doctor.py [series folder]

Prints one line per check (ok / MISSING) with the fix. Exit code 1 if something required is missing.
"""
import os, platform, shutil, subprocess, sys

series = sys.argv[1] if len(sys.argv) > 1 else '.'
mac, linux = platform.system() == 'Darwin', platform.system() == 'Linux'
bad = 0


def line(ok, what, fix='', required=True):
    global bad
    print(f"{'ok     ' if ok else ('MISSING' if required else 'note   ')} {what}" + ('' if ok or not fix else f'  ->  {fix}'))
    if not ok and required:
        bad += 1


def out(cmd):
    try:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=20).stdout.strip()
    except Exception:
        return ''


v = out(['node', '--version'])
major = int(v.lstrip('v').split('.')[0]) if v else 0
line(major >= 22, f'Node {v or "not found"} (22 or newer)', 'brew install node' if mac else 'install Node 22+ from nodejs.org')
try:
    import numpy  # noqa: F401
    line(True, f'Python {platform.python_version()} with numpy')
except ImportError:
    line(False, 'Python numpy', f'{sys.executable} -m pip install numpy')
for tool in ('ffmpeg', 'ffprobe'):
    line(bool(shutil.which(tool)), tool, 'brew install ffmpeg' if mac else 'sudo apt install ffmpeg')
if shutil.which('ffmpeg'):
    line('drawtext' in out(['ffmpeg', '-hide_banner', '-filters']), 'ffmpeg drawtext (frame numbers on contact sheets)',
         'optional: sheets still work, without numbers', required=False)
chromes = [os.environ.get('CHROME_PATH', ''), '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
           '/Applications/Chromium.app/Contents/MacOS/Chromium', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
           '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium', r'C:\Program Files\Google\Chrome\Application\chrome.exe']
found = next((c for c in chromes if c and os.path.exists(c)), None)
line(bool(found), f'Chrome or Chromium{": " + found if found else ""}', 'install Google Chrome, or set CHROME_PATH')

key = bool(os.environ.get('OPENAI_API_KEY'))
envf = os.path.join(series, '.env')
if not key and os.path.exists(envf):
    key = any(l.startswith('OPENAI_API_KEY=') and len(l.strip()) > 16 for l in open(envf))
line(key, 'OpenAI key for the best voices and the voice check', f'put OPENAI_API_KEY=... in {os.path.abspath(envf)}', required=False)
if mac:
    line(bool(shutil.which('say')), 'macOS voices (offline fallback)', required=False)
else:
    line(bool(shutil.which('espeak-ng')), 'espeak-ng (offline fallback voice)', 'sudo apt install espeak-ng', required=False)
print('\nready' if not bad else f'\n{bad} required item(s) missing')
sys.exit(1 if bad else 0)
