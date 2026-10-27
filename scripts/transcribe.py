from faster_whisper import WhisperModel
from pathlib import Path
import av
original_open=av.open
def compatible_open(*args,**kwargs):
    kwargs.pop("metadata_errors",None)
    return original_open(*args,**kwargs)
av.open=compatible_open
model=WhisperModel('/Users/art/.cache/huggingface/hub/models--Systran--faster-whisper-small/snapshots/536b0662742c02347bc0e980a01041f333bce120', device='cpu', compute_type='int8')
out=['# Расшифровка голосовых\n\nАвтоматическая локальная расшифровка Whisper small. Возможны ошибки распознавания.\n']
for p in sorted(Path('/Users/art/Downloads').glob('2026-10-26 23.55.*.ogg')):
    segments,info=model.transcribe(str(p),language='ru',beam_size=5)
    content=' '.join(s.text.strip() for s in segments)
    print(p.name,content,flush=True)
    out.append('## '+p.name+'\n\n'+content+'\n')
Path('docs/voice-transcripts.md').write_text('\n'.join(out))
