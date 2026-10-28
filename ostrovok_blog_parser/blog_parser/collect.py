from __future__ import annotations

import hashlib
import io
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

from .extract import DOMAIN, canonical, extract_article


CATEGORIES = {'unusual': 'Необычные места', 'food': 'Еда и рестораны',
              'routes': 'Маршруты и пригороды', 'nature': 'Природа и загородный отдых',
              'housing': 'Где остановиться', 'tips': 'Практические советы',
              'family': 'С детьми', 'seasonal': 'Сезонные идеи'}


def save_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.replace(path)


def safe_slug(slug):
    if not re.fullmatch('[a-z0-9][a-z0-9_-]{0,180}', slug):
        raise ValueError('Некорректный slug: ' + slug)
    return slug


def load_selection(path):
    rows = json.loads(path.read_text(encoding='utf-8'))
    seen = set()
    for row in rows:
        if urlsplit(row['url']).hostname != DOMAIN or urlsplit(row['url']).scheme != 'https':
            raise ValueError('Поддерживаются только статьи https://' + DOMAIN)
        safe_slug(urlsplit(row['url']).path.strip('/'))
        if canonical(row['url']) in seen:
            raise ValueError('Повторяющаяся статья: ' + row['url'])
        seen.add(canonical(row['url']))
        if row.get('category') not in CATEGORIES or not row.get('summary', '').strip():
            raise ValueError('У статьи должны быть категория и краткое описание')
    return rows


def choose_images(images, limit):
    cover = [p for p in images if p['role'] == 'cover'][:1]
    rest = [p for p in images if p not in cover]
    # First pick one photo for each section, then fill with remaining photos.
    unique, extra, sections = [], [], set()
    for image in rest:
        key = image['section_context']
        (extra if key in sections else unique).append(image)
        sections.add(key)
    return (cover + unique + extra)[:limit]


def download_image(client, image, folder, number):
    from PIL import Image, UnidentifiedImageError

    _, raw, content_type = client.get(image['original_url'], image=True)
    if not content_type.startswith('image/'):
        raise ValueError('URL вернул не изображение')
    try:
        with Image.open(io.BytesIO(raw)) as picture:
            width, height = picture.size
            if min(width, height) < 240 or max(width, height) < 600 or width * height > 40_000_000:
                raise ValueError(f'Неподходящий размер изображения: {width}×{height}')
            picture.verify()
        with Image.open(io.BytesIO(raw)) as picture:
            picture.load()
            converted = picture.convert('RGB')
            converted.thumbnail((1600, 1600))
            out = io.BytesIO()
            converted.save(out, 'WEBP', quality=85)
            encoded = out.getvalue()
            digest = hashlib.sha256(encoded).hexdigest()
            saved_width, saved_height = converted.size
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as e:
        raise ValueError('Повреждённое или неподдерживаемое изображение') from e
    folder.mkdir(parents=True, exist_ok=True)
    filename = f'{number:02d}_{digest[:16]}.webp'
    (folder / filename).write_bytes(encoded)
    return {'filename': filename, 'sha256': digest, 'bytes': len(encoded),
            'width': saved_width, 'height': saved_height}


def collect_one(client, choice, root, max_photos=6, resume=False):
    slug = safe_slug(urlsplit(choice['url']).path.strip('/'))
    destination = root / 'articles' / slug
    manifest_path = destination / 'article.json'
    previous = json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.exists() else {}
    if resume and previous:
        if (previous.get('requested_max_photos') == max_photos and previous.get('selection') == choice
                and previous.get('images') and (not previous.get('errors') or len(previous['images']) >= max_photos)
                and all((root / p['path']).is_file() for p in previous['images'])):
            return previous
    final, html, _ = client.get(choice['url'])
    if urlsplit(final).hostname != DOMAIN or canonical(final) != canonical(choice['url']):
        raise ValueError('Статья перенаправила на другую страницу: ' + final)
    article = extract_article(html.decode('utf-8'), final)
    # Only dates, bibliographic data, the curated summary and image metadata are
    # delivered. Article body text and original long captions are not persisted.
    article.pop('_inspection_intro', None)
    article.pop('_inspection_sections', None)
    available = article.pop('images')
    article.update(category=choice['category'], category_label=CATEGORIES[choice['category']],
                   summary=choice['summary'], tags=choice.get('tags', []), selection=choice,
                   collected_at=datetime.now(timezone.utc).isoformat(),
                   available_images=len(available), requested_max_photos=max_photos,
                   content_format='curated_summary_with_source_link', images=[], errors=[])
    seen = set()
    existing = {p['original_url']: p for p in previous.get('images', [])}
    denied_images = {e['url'] for e in previous.get('errors', []) if 'HTTP Error 403' in e['error']}
    # Try additional illustrations if a file fails or duplicates a previously saved image.
    ordered = choose_images(available, len(available))
    for image in ordered:
        if len(article['images']) >= max_photos:
            break
        try:
            if image['original_url'] in denied_images:
                article['errors'].append({'url': image['original_url'], 'error': 'HTTP Error 403: ранее получен запрет; повторный запрос не выполнялся'})
                continue
            prior = existing.get(image['original_url'])
            if prior and (root / prior['path']).is_file():
                saved = {key: prior[key] for key in ('sha256', 'bytes', 'width', 'height')}
                saved['filename'] = Path(prior['path']).name
            else:
                saved = download_image(client, image, destination / 'images', len(article['images']) + 1)
            if saved['sha256'] in seen:
                continue
            seen.add(saved['sha256'])
            section = ' '.join(image['section_context'].split()[:8])
            caption = 'Обложка материала' if image['role'] == 'cover' else (
                f'Иллюстрация раздела: {section}' if section else 'Иллюстрация из статьи')
            photo = {**saved, 'path': f'articles/{slug}/images/{saved.pop("filename")}',
                     'original_url': image['original_url'], 'source_url': article['url'],
                     'caption': caption, 'caption_origin': 'article_section_context',
                     'credit': image['credit'], 'role': image['role'],
                     'rights_status': 'unknown'}
            # Avoid duplicate filename data after expansion.
            photo.pop('filename', None)
            article['images'].append(photo)
        except Exception as e:
            article['errors'].append({'url': image['original_url'], 'error': str(e)})
    save_json(manifest_path, article)
    return article
