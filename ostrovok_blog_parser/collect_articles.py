"""Collect dated article cards and photos; full article bodies are not exported."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from blog_parser.collect import collect_one, load_selection, save_json
from blog_parser.net import Client
from blog_parser.render import export

ROOT = Path(__file__).resolve().parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['run', 'export'])
    parser.add_argument('--selection', type=Path, default=ROOT / 'data/selection.json')
    parser.add_argument('--output', type=Path, default=ROOT)
    parser.add_argument('--max-photos', type=int, default=6)
    parser.add_argument('--limit', type=int)
    parser.add_argument('--resume', action='store_true')
    parser.add_argument('--delay', type=float, default=1)
    args = parser.parse_args()
    if args.max_photos < 1 or args.delay < 0 or (args.limit is not None and args.limit < 1):
        parser.error('Некорректный лимит или задержка')
    rows = load_selection(args.selection)
    selected = rows[:args.limit]
    client = Client(args.delay)
    errors = []
    try:
        if args.command == 'run':
            for i, choice in enumerate(selected, 1):
                print(f'[{i}/{len(selected)}] {choice["url"]}', flush=True)
                try:
                    result = collect_one(client, choice, args.output, args.max_photos, args.resume)
                    print(f'  {result["date_published"]} · {len(result["images"])} фото · {result["title"]}', flush=True)
                except Exception as e:
                    errors.append({'url': choice['url'], 'error': str(e)})
                    print('  Ошибка: ' + str(e), flush=True)
    finally:
        if args.command == 'run':
            save_json(args.output / 'data/run_errors.json', errors)
        print(json.dumps(export(args.output, rows), ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
