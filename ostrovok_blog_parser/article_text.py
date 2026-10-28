"""Inspect public articles without saving their bodies, or parse local HTML.

Network inspection prints structural metrics only. Structured body export takes
an explicit local HTML file supplied by the operator and never overwrites cards.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from urllib.parse import urlsplit

from blog_parser.body import body_metrics, extract_body
from blog_parser.collect import load_selection, save_json
from blog_parser.extract import DOMAIN, canonical
from blog_parser.net import Client

ROOT = Path(__file__).resolve().parent


def article_url(value):
    parsed = urlsplit(value)
    if (parsed.scheme != 'https' or parsed.hostname != DOMAIN or parsed.username
            or parsed.password or parsed.port not in (None, 443) or not parsed.path.strip('/')):
        raise argparse.ArgumentTypeError('Нужен URL публичной статьи https://blog.ostrovok.ru/.../')
    return canonical(value)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    local = commands.add_parser('extract', help='Разобрать явно переданный локальный HTML')
    local.add_argument('--html', required=True, type=Path)
    local.add_argument('--url', required=True, type=article_url)
    local.add_argument('--output', required=True, type=Path)
    inspect = commands.add_parser('inspect', help='Проверить структуру публичных страниц без сохранения текста')
    target = inspect.add_mutually_exclusive_group(required=True)
    target.add_argument('--url', type=article_url)
    target.add_argument('--selection', type=Path)
    inspect.add_argument('--limit', type=int, default=3)
    inspect.add_argument('--delay', type=float, default=1)
    args = parser.parse_args()
    if args.command == 'extract':
        body = extract_body(args.html.read_text(encoding='utf-8'), args.url)
        # Explicit local input/output, independent of the existing card dataset.
        output = args.output.resolve()
        if output.exists() or output == args.html.resolve() or output.is_relative_to((ROOT / 'articles').resolve()) or output.is_relative_to((ROOT / 'data').resolve()):
            parser.error('Выберите отдельный output вне существующих articles/ и data/')
        save_json(output, body)
        print(json.dumps(body_metrics(body), ensure_ascii=False))
        return
    if args.limit < 1 or args.delay < 0:
        parser.error('Некорректный лимит или задержка')
    urls = [args.url] if args.url else [row['url'] for row in load_selection(args.selection)[:args.limit]]
    client = Client(delay=args.delay)
    failed = False
    for url in urls:
        try:
            final, raw, content_type = client.get(url)
            if canonical(final) != canonical(url) or not content_type.startswith('text/html'):
                raise ValueError('Получен другой URL или не HTML')
            body = extract_body(raw.decode('utf-8'), final)
            print(json.dumps({'status': 'ok', **body_metrics(body)}, ensure_ascii=False), flush=True)
            # No HTML/body/paragraphs are written to disk or printed.
            del body, raw
        except Exception as error:
            failed = True
            print(json.dumps({'source_url': url, 'status': 'error', 'error_type': type(error).__name__}, ensure_ascii=False), flush=True)
    if failed:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
