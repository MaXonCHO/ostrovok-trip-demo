"""Optional repair of missing local demo assets. No download occurs at app startup."""
import json
from pathlib import Path
from urllib.request import urlretrieve

for asset in json.loads(Path('public/demo/manifest.json').read_text()):
    destination = Path('public') / asset['path'].lstrip('/')
    if destination.exists():
        continue
    url = asset.get('downloadUrl', asset['source'])
    if not url.startswith('https://images.unsplash.com/'):
        raise RuntimeError('No direct downloadable source for ' + asset['assetId'])
    urlretrieve(url, destination)
    print('Restored', asset['assetId'])
