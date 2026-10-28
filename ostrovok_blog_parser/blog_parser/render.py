from __future__ import annotations

import html
import json
from collections import Counter
from datetime import date

from .collect import CATEGORIES, save_json


STYLE = '''body{font:16px/1.55 system-ui,-apple-system,sans-serif;color:#1e293b;background:#f5f7fa;margin:0}main{max-width:1180px;margin:40px auto;padding:0 24px}h1{font-size:34px;line-height:1.2}h2{font-size:21px;line-height:1.35}a{color:#235db5}.intro{max-width:850px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px}.card{background:white;border:1px solid #dbe1e9;border-radius:16px;overflow:hidden}.card[hidden]{display:none}.card img{width:100%;height:190px;object-fit:cover}.body{padding:20px}.meta{color:#64748b;font-size:14px}button,input{font:inherit;padding:10px 13px;border:1px solid #b9c5d5;border-radius:8px;background:white}button{cursor:pointer}button[aria-pressed=true]{background:#1e293b;color:white}:focus-visible{outline:3px solid #427ce0;outline-offset:3px}.filters{display:flex;flex-wrap:wrap;gap:8px;margin:20px 0}figure{margin:0}figcaption{font-size:13px;color:#526174;padding:12px}.photos img{width:100%;height:230px;object-fit:cover}.tag{font-size:13px;color:#526174}.note{padding:16px;background:#eaf0f9;border-radius:10px}.source{display:block;margin-top:14px}@media(max-width:560px){main{padding:0 14px;margin:24px auto}h1{font-size:28px}.grid{grid-template-columns:1fr}}'''


def e(value):
    return html.escape(str(value), quote=True)


def display_date(value):
    return date.fromisoformat(value).strftime('%d.%m.%Y')


def page(title, body):
    return f'<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{e(title)}</title><style>{STYLE}</style></head><body><main>{body}</main></body></html>'


def export(root, selection):
    articles = []
    missing = []
    for choice in selection:
        slug = choice['url'].rstrip('/').rsplit('/', 1)[-1]
        path = root / 'articles' / slug / 'article.json'
        if not path.exists():
            missing.append(choice['url'])
            continue
        article = json.loads(path.read_text(encoding='utf-8'))
        articles.append(article)
    counts = Counter(a['category'] for a in articles)
    summary = {'articles': len(articles), 'photos': sum(len(a['images']) for a in articles),
               'categories': dict(counts), 'articles_without_photos': [a['slug'] for a in articles if not a['images']],
               'missing_articles': missing,
               'earliest_publication': min((a['date_published'] for a in articles), default=None),
               'latest_publication': max((a['date_published'] for a in articles), default=None)}
    save_json(root / 'data/articles.json', articles)
    save_json(root / 'data/summary.json', summary)
    body = '<h1>Петербург: статьи и фотографии</h1>'
    body += f'<p class="intro">{summary["articles"]} материалов блога Островка · {summary["photos"]} фотографий. Здесь краткие карточки, даты публикации и ссылки на оригиналы.</p>'
    body += '<p class="meta">Даты, цены и условия в оригиналах относятся ко времени публикации. Полные тексты читайте по ссылкам на источник.</p>'
    body += '<label>Поиск по теме <input id="search" type="search" placeholder="Например: кофе, музеи, дети"></label>'
    body += '<nav class="filters" aria-label="Темы статей"><button type="button" data-category="all" aria-pressed="true">Все статьи</button>'
    body += ''.join(f'<button type="button" data-category="{e(c)}" aria-pressed="false">{e(CATEGORIES[c])} · {n}</button>' for c, n in counts.items()) + '</nav>'
    body += f'<p id="count" role="status" aria-live="polite">Показано: {len(articles)}</p><div class="grid">'
    for article in articles:
        slug = article['slug']
        href = f'articles/{slug}/index.html'
        cover = article['images'][0] if article['images'] else None
        image = f'<a href="{e(href)}"><img src="{e(cover["path"])}" alt="{e(cover["caption"])}" loading="lazy"></a>' if cover else ''
        search = article['title'] + ' ' + article['summary'] + ' ' + ' '.join(article['tags'])
        body += f'<article class="card" data-article-category="{e(article["category"])}" data-search="{e(search.casefold())}">{image}<div class="body"><p class="meta">{e(article["category_label"])} · <time datetime="{e(article["date_published"])}">{e(display_date(article["date_published"]))}</time></p><h2><a href="{e(href)}">{e(article["title"])}</a></h2><p>{e(article["summary"])}</p><p class="tag">{e(" · ".join(article["tags"]))}</p><a href="{e(href)}">{len(article["images"])} фото и сведения</a> · <a href="{e(article["url"])}" target="_blank" rel="noreferrer">Оригинал</a></div></article>'
        detail = f'<p><a href="../../index.html">← К подборке</a></p><h1>{e(article["title"])}</h1><p class="meta">Опубликовано: <time datetime="{e(article["date_published"])}">{e(display_date(article["date_published"]))}</time> · {e(article["category_label"])}</p><p>Автор: {e(article["author"] or "не указан")}</p><p class="intro">{e(article["summary"])}</p><p class="note"><a href="{e(article["url"])}" target="_blank" rel="noreferrer">Читать полную статью на блоге Островка →</a></p><p class="meta">Подписи ниже обозначают раздел исходной статьи; содержимое фото отдельно не распознавалось. Кредиты фотографов сохранены, если указаны рядом со снимком.</p><div class="grid photos">'
        for photo in article['images']:
            src = '../../' + photo['path']
            credit = '<br>Фото: ' + e(photo['credit']) if photo['credit'] else ''
            detail += f'<figure class="card"><a href="{e(src)}" target="_blank"><img src="{e(src)}" alt="{e(photo["caption"])}" loading="lazy"></a><figcaption>{e(photo["caption"])}{credit}<a class="source" href="{e(photo["original_url"])}">Источник изображения</a></figcaption></figure>'
        detail += '</div>'
        (root / 'articles' / slug / 'index.html').write_text(page(article['title'], detail), encoding='utf-8')
    body += '</div><script>let category="all";const search=document.getElementById("search");const cards=[...document.querySelectorAll("[data-article-category]")];function update(){const query=search.value.trim().toLowerCase();cards.forEach(c=>{c.hidden=(category!=="all"&&c.dataset.articleCategory!==category)||!c.dataset.search.includes(query);});document.getElementById("count").textContent="Показано: "+cards.filter(c=>!c.hidden).length;}document.querySelectorAll("button[data-category]").forEach(b=>b.addEventListener("click",()=>{category=b.dataset.category;document.querySelectorAll("button[data-category]").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));update();}));search.addEventListener("input",update);</script>'
    (root / 'index.html').write_text(page('Петербург — подборка статей Островка', body), encoding='utf-8')
    return summary
