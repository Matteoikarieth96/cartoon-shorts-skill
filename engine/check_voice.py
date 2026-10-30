# Transcribe each voice line of an episode with OpenAI Whisper and compare it with the script (catches skipped words).
#   python3 engine/check_voice.py episodes/<name>
import json, os, ssl, sys, glob, uuid, urllib.request
ep = sys.argv[1]
envf = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env')
key = os.environ.get('OPENAI_API_KEY') or next((l.split('=', 1)[1].strip().strip('"\'') for l in open(envf) if l.startswith('OPENAI_API_KEY=')), None) if os.path.exists(envf) or os.environ.get('OPENAI_API_KEY') else None
if not key:
    sys.exit('check_voice needs OPENAI_API_KEY (Whisper); without it, listen to each line instead')
ctx = ssl.create_default_context(cafile='/etc/ssl/cert.pem') if os.path.exists('/etc/ssl/cert.pem') else ssl.create_default_context()
cfg = json.load(open(os.path.join(ep, 'short.json')))
LANG = cfg.get('lang', 'en')
for i, ln in enumerate(cfg['lines']):
    files = sorted(glob.glob(os.path.join(ep, 'audio', f'line_{i:02d}_*.wav')), key=os.path.getmtime)
    if not files: print(i, 'MISSING'); continue
    data = open(files[-1], 'rb').read(); b = uuid.uuid4().hex
    body = (f'--{b}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n--{b}\r\nContent-Disposition: form-data; name="language"\r\n\r\n{LANG}\r\n'
            f'--{b}\r\nContent-Disposition: form-data; name="file"; filename="a.wav"\r\nContent-Type: audio/wav\r\n\r\n').encode() + data + f'\r\n--{b}--\r\n'.encode()
    req = urllib.request.Request('https://api.openai.com/v1/audio/transcriptions', body, {'Authorization': f'Bearer {key}', 'Content-Type': f'multipart/form-data; boundary={b}'})
    got = json.load(urllib.request.urlopen(req, context=ctx))['text']
    print(f'L{i:<2d} script: {ln["say"]}\n    heard:  {got}')
