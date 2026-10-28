"""Extract a structured article body from local HTML, without exporting HTML.

The ordinary card/photo collector is intentionally unchanged. This module can
also inspect a fetched page in memory; its network CLI only reports metrics.
"""
from __future__ import annotations

import re
from urllib.parse import urlsplit

from .extract import canonical, image_url
from .htmltree import Node, Tree


SKIP_TAGS = {'script', 'style', 'noscript', 'template', 'iframe', 'nav', 'footer',
             'aside', 'form', 'button', 'input', 'select', 'textarea', 'figcaption'}
SKIP_CLASSES = {
    'frame', 'advertisement', 'advert', 'ads', 'ad-block', 'adsbygoogle',
    'related', 'related-posts', 'post-related', 'post-recommendations',
    'recommended', 'recommendations', 'newsletter', 'subscribe', 'social',
    'share', 'sharing', 'toc', 'table-of-contents', 'post-contents',
    'wp-caption-text', 'post-amenities', 'author', 'breadcrumbs',
}
BLOCK_TAGS = {'p', 'div', 'section', 'article', 'h2', 'h3', 'h4', 'h5', 'h6',
              'ul', 'ol', 'blockquote', 'figure', 'table'}


def _skip(node):
    if node.tag in SKIP_TAGS or node.attrs.get('aria-hidden') == 'true' or 'hidden' in node.attrs:
        return True
    classes = set(node.attrs.get('class', '').lower().split())
    if classes & SKIP_CLASSES:
        return True
    marker = node.attrs.get('id', '').lower()
    return marker.startswith(('adfox', 'yandex_rtb', 'ads-', 'subscribe-', 'related-'))


def _plain(node, ignore_blocks=False):
    """Preserve inline punctuation while removing hidden/promotional children."""
    if isinstance(node, str):
        return node
    if _skip(node) or (ignore_blocks and node.tag in BLOCK_TAGS):
        return ''
    if node.tag == 'br':
        return '\n'
    value = ''.join(_plain(child, ignore_blocks) for child in node.children)
    return f' {value} ' if node.tag in BLOCK_TAGS | {'li', 'td', 'th'} else value


def _clean(value):
    return re.sub(r'\s+', ' ', value).strip()


def _paragraphs(children, base, blocks):
    """Flush inline text before each embedded image/list/heading in DOM order."""
    pending = []

    def flush():
        text = _clean(''.join(pending))
        pending.clear()
        if text and not re.match(r'^(?:Читайте также|Смотрите также|Вам также может понравиться)\s*[:：]', text, re.I):
            blocks.append({'type': 'paragraph', 'text': text})

    def inline(child):
        if isinstance(child, str):
            pending.append(child)
        elif _skip(child):
            return
        elif child.tag == 'br':
            pending.append(' ')
        elif child.tag == 'img' or child.tag in BLOCK_TAGS:
            flush()
            _walk(child, base, blocks)
        else:
            for nested in child.children:
                inline(nested)

    for child in children:
        inline(child)
    flush()


def _image(node, base):
    url = image_url(node, base)
    parsed = urlsplit(url)
    if (parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password
            or not parsed.path.lower().endswith(('.jpg', '.jpeg', '.png', '.webp'))
            or any(part in parsed.path.lower() for part in ('/themes/', '/avatar', '/amenities-'))):
        return None
    figure = node.ancestor('figure') or node.ancestor(cls='wp-caption')
    caption_node = (figure.find('figcaption') or figure.find(cls='wp-caption-text')) if figure else None
    caption = _clean(caption_node.text()) if caption_node else ''
    # Captions are metadata for this image, never a duplicated body paragraph.
    credit = re.split(r'Фото\s*:\s*', caption, flags=re.I)[-1] if re.search(r'Фото\s*:', caption, re.I) else ''
    return {'type': 'image', 'url': url, 'alt': node.attrs.get('alt', ''),
            'caption': caption, 'credit': credit}


def _walk(node, base, blocks):
    if isinstance(node, str) or _skip(node):
        return
    if node.tag in ('h2', 'h3', 'h4', 'h5', 'h6'):
        text = _clean(_plain(node))
        if text:
            blocks.append({'type': 'heading', 'level': int(node.tag[1]), 'text': text})
    elif node.tag == 'img':
        image = _image(node, base)
        if image:
            blocks.append(image)
    elif node.tag in ('ol', 'ul'):
        items = []
        for child in node.children:
            if isinstance(child, Node) and child.tag == 'li' and not _skip(child):
                # A nested list is retained once inside its parent item.
                value = _clean(_plain(child))
                if value:
                    items.append(value)
        if items:
            blocks.append({'type': 'list', 'ordered': node.tag == 'ol', 'items': items})
    elif node.tag == 'blockquote':
        value = _clean(_plain(node))
        if value:
            blocks.append({'type': 'quote', 'text': value})
    elif node.tag == 'table':
        rows = []
        for row in node.find_all('tr'):
            cells = [_clean(_plain(c)) for c in row.children
                     if isinstance(c, Node) and c.tag in ('th', 'td') and not _skip(c)]
            if any(cells):
                rows.append(cells)
        if rows:
            blocks.append({'type': 'table', 'rows': rows})
    else:
        _paragraphs(node.children, base, blocks)


def extract_body(html, url):
    """Return plain structured blocks. Callers control storage of local input.

    Never execute scripts or return source HTML. Remote inspection should discard
    this result after body_metrics; collecting summaries/photos remains separate.
    """
    root = Tree(html).root
    article = root.find('article', 'post-single')
    content = article.find(cls='post-text') if article else None
    if not article or not content:
        raise ValueError('Не найдена основная область article.post-single .post-text')
    blocks = []
    _paragraphs(content.children, url, blocks)
    if not any(block['type'] in ('paragraph', 'heading', 'list', 'quote', 'table') for block in blocks):
        raise ValueError('Основная область не содержит текста статьи')
    return {'schema_version': 1, 'source_url': canonical(url), 'blocks': blocks}


def body_metrics(body):
    counts = {}
    characters = 0
    for block in body['blocks']:
        kind = block['type']
        counts[kind] = counts.get(kind, 0) + 1
        characters += len(block.get('text', ''))
        characters += sum(len(item) for item in block.get('items', []))
        characters += sum(len(cell) for row in block.get('rows', []) for cell in row)
    return {'source_url': body['source_url'], 'blocks': len(body['blocks']),
            'types': counts, 'text_characters': characters}
