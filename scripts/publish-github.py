"""Publish the committed source snapshot; local attachments and secrets stay local."""
import argparse
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parent.parent
REMOTE = 'git@github.com:bershteinartem/ostrovok-trip.git'
EXCLUDED = ('docs/references/',)
EXCLUDED_FILES = {'docs/voice-transcripts.md'}


def git(*args, cwd=ROOT, capture=True):
    result = subprocess.run(['git', *args], cwd=cwd, check=True,
                            text=True, capture_output=capture,
                            env={**os.environ, 'GIT_TERMINAL_PROMPT': '0'})
    return result.stdout.strip() if capture else ''


def publish():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--push', action='store_true', help='Publish the prepared commit to main')
    args = parser.parse_args()
    if git('status', '--porcelain'):
        raise SystemExit('Commit local changes before publishing the snapshot.')
    paths = [p for p in git('ls-files', '-z').split('\0') if p]
    files = [p for p in paths if p not in EXCLUDED_FILES and not p.startswith(EXCLUDED)]
    forbidden = re.compile(rb'(?:sk-[A-Za-z0-9]{24,}|gh[pousr]_[A-Za-z0-9]{24,}|github_pat_[A-Za-z0-9_]{30,}|-----BEGIN (?:RSA |OPENSSH )?PRIVATE KEY-----)')
    for path in files:
        if path.startswith('.env') and path != '.env.example':
            raise SystemExit('Environment file selected for publication.')
        if Path(path).suffix not in ('.jpg', '.png', '.ttf') and forbidden.search((ROOT/path).read_bytes()):
            raise SystemExit(f'Possible credential in {path}; publication stopped.')
    output = ROOT/'.data'
    output.mkdir(exist_ok=True)
    destination = Path(tempfile.mkdtemp(prefix='github-publish-', dir=output))
    git('clone', '--depth', '1', REMOTE, str(destination), capture=False)
    for path in files:
        target = destination/path
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT/path, target)
    git('config', 'user.name', 'bershteinartem', cwd=destination)
    git('config', 'user.email', '278774701+bershteinartem@users.noreply.github.com', cwd=destination)
    git('add', '--all', cwd=destination)
    if git('diff', '--cached', '--name-only', cwd=destination):
        git('commit', '-m', 'Ship travel prototype with DeepSeek agent and sequential swipe flow', cwd=destination, capture=False)
    commit = git('rev-parse', 'HEAD', cwd=destination)
    if args.push:
        git('push', 'origin', 'HEAD:main', cwd=destination, capture=False)
        head = git('ls-remote', REMOTE, 'refs/heads/main').split()[0]
        if head != commit:
            raise SystemExit('Remote head differs from the published snapshot.')
    result = {'published': args.push, 'repository': 'https://github.com/bershteinartem/ostrovok-trip',
              'commit': commit, 'sourceCommit': git('rev-parse', 'HEAD'), 'files': len(files),
              'directory': str(destination), 'excluded': sorted(EXCLUDED_FILES)+list(EXCLUDED)}
    (output/'github-publication.json').write_text(json.dumps(result, indent=2))
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    publish()
