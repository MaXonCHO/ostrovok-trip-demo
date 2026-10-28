"""Find blog article links; only public search-card metadata is saved."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from urllib.parse import urlencode

from blog_parser.extract import search_cards
from blog_parser.net import Client

ROOT = Path(__file__).resolve().parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--query', default='Санкт-Петербург')
    parser.add_argument('--pages', type=int, default=6)
    args = parser.parse_args()
    if not 1 <= args.pages <= 20:
        parser.error('--pages: от 1 до 20')
    target = ROOT / 'data/candidates.json'
    found = {r['url']: r for r in json.loads(target.read_text())} if target.exists() else {}
    client = Client()
    for page in range(1, args.pages + 1):
        url = 'https://blog.ostrovok.ru/?' + urlencode({'s': args.query, 'page': page})
        final, data, _ = client.get(url)
        cards, _ = search_cards(data.decode('utf-8'), final)
        for card in cards:
            found.setdefault(card['url'], card)
        print(f'Страница {page}: {len(cards)} карточек, всего {len(found)}', flush=True)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(list(found.values()), ensure_ascii=False, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
