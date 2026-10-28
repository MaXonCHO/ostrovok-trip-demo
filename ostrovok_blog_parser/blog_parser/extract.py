from __future__ import annotations

import re
from datetime import datetime
from urllib.parse import urljoin, urlsplit, urlunsplit

from .htmltree import Tree


DOMAIN = 'blog.ostrovok.ru'


def canonical(url):
    p = urlsplit(url)
    return urlunsplit(('https', p.netloc.lower(), p.path, '', ''))


def parse_date(raw):
    if not raw:
        return None
    for fmt in ('%Y.%m.%d', '%d.%m.%Y', '%Y-%m-%d'):
        try:
            return datetime.strptime(raw, fmt).date().isoformat()
        except ValueError:
            pass
    try:
        return datetime.fromisoformat(raw.replace('Z', '+00:00')).date().isoformat()
    except ValueError:
        return None


def search_cards(html, url):
    tree = Tree(html).root
    result = []
    for article in tree.find_all('article'):
        title = article.find(cls='post-title')
        link = title.find('a') if title else None
        when = article.find('time')
        if link:
            href = canonical(urljoin(url, link.attrs.get('href', '')))
            if urlsplit(href).hostname == DOMAIN:
                result.append({'url': href, 'title': title.text(),
                               'search_date': parse_date(when.attrs.get('datetime')) if when else None,
                               'discovered_from': url})
    pagination = tree.find(cls='content-pagination')
    pages = list(dict.fromkeys(urljoin(url, a.attrs.get('href', ''))
                              for a in pagination.find_all('a'))) if pagination else []
    return result, pages


def image_url(node, base):
    candidates = []
    for key in ('data-srcset', 'srcset'):
        for item in node.attrs.get(key, '').split(','):
            fields = item.strip().split()
            if fields:
                size = int(fields[-1][:-1]) if len(fields) > 1 and fields[-1].endswith('w') and fields[-1][:-1].isdigit() else 0
                candidates.append((size, fields[0]))
    raw = max(candidates)[1] if candidates else node.attrs.get('data-src') or node.attrs.get('src', '')
    return urljoin(base, raw)


def extract_article(html, url):
    tree = Tree(html).root
    article = tree.find('article', 'post-single')
    if not article:
        raise ValueError('Страница не содержит основной статьи post-single')
    title = article.find('h1', 'post-title')
    content = article.find(cls='post-text')
    when = next((n for n in article.find_all('time') if n.attrs.get('itemprop') == 'datePublished'), None)
    if when is None:
        when = article.find('time')
    date_raw = when.attrs.get('datetime') or when.attrs.get('content') if when else ''
    published = parse_date(date_raw)
    if not title or not content or not published:
        raise ValueError('Не найдены заголовок, дата публикации или основная область статьи')
    author = article.find(cls='post-amenities-author')
    metas = {m.attrs.get('property', m.attrs.get('name', '')): m.attrs.get('content', '') for m in tree.find_all('meta')}
    modified = parse_date(metas.get('article:modified_time', ''))
    # Headings are transient inspection context. The final dataset contains a short
    # independently written summary, not a copy of the article or its body text.
    sections = [n.text() for n in content.find_all() if n.tag in ('h2', 'h3') and not n.ancestor(cls='frame')]
    images, seen = [], set()
    current_section = ''
    for node in content.find_all():
        if node.ancestor(cls='frame'):
            continue
        if node.tag in ('h2', 'h3'):
            current_section = node.text()
        elif node.tag == 'img':
            image = image_url(node, url)
            p = urlsplit(image)
            if p.scheme != 'https' or not p.path.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
                continue
            if any(x in p.path for x in ('/themes/', '/avatar', '/amenities-')) or image in seen:
                continue
            seen.add(image)
            figure = node.ancestor('figure') or node.ancestor(cls='wp-caption')
            caption_node = (figure.find('figcaption') or figure.find(cls='wp-caption-text')) if figure else None
            caption_text = caption_node.text() if caption_node else ''
            credit = re.split(r'Фото\s*:\s*', caption_text, flags=re.I)[-1] if re.search(r'Фото\s*:', caption_text, re.I) else ''
            images.append({'original_url': image, 'section_context': current_section,
                           'credit': credit[:300], 'role': 'illustration'})
    cover = metas.get('og:image', '')
    if cover and cover not in seen:
        images.insert(0, {'original_url': cover, 'section_context': '', 'credit': '', 'role': 'cover'})
    return {'id': article.attrs.get('id', '').removeprefix('post-') or urlsplit(url).path.strip('/'),
            'slug': urlsplit(url).path.strip('/'), 'title': title.text(), 'url': canonical(url),
            'date_published': published, 'date_published_raw': date_raw,
            'date_source': 'article.time.datePublished' if when and when.attrs.get('itemprop') else 'article.time',
            'date_modified': modified, 'author': author.text() if author else metas.get('author', ''),
            'images': images, '_inspection_sections': sections,
            '_inspection_intro': content.text()[:600]}
