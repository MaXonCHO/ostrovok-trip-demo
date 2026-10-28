import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from blog_parser.body import body_metrics, extract_body

URL = 'https://blog.ostrovok.ru/local-fixture/'
ROOT = Path(__file__).resolve().parents[1]


def document(content):
    return f'''<html><body><nav>Навигация</nav><article class="post-single"><h1>Учебная статья</h1>
<div class="post-text">{content}</div></article><footer>Подвал</footer>
<article class="post-medium"><p>Другая статья</p></article></body></html>'''


class BodyTests(unittest.TestCase):
    def test_dom_order_inline_text_and_embedded_image(self):
        html = document('''<p>Первый <strong>выделенный</strong> абзац.</p><h2>Раздел</h2>
<p>Перед фото<img src="/wp-content/uploads/photo.jpg" alt="Учебное фото">После фото.</p>
<ol><li>Один</li><li>Два <em>слова</em></li></ol><blockquote><p>Учебная цитата.</p></blockquote>''')
        body = extract_body(html, URL)
        blocks = body['blocks']
        self.assertEqual([b['type'] for b in blocks], ['paragraph', 'heading', 'paragraph', 'image', 'paragraph', 'list', 'quote'])
        self.assertEqual(blocks[0]['text'], 'Первый выделенный абзац.')
        self.assertEqual(blocks[1], {'type': 'heading', 'level': 2, 'text': 'Раздел'})
        self.assertEqual(blocks[3]['url'], 'https://blog.ostrovok.ru/wp-content/uploads/photo.jpg')
        self.assertEqual(blocks[5], {'type': 'list', 'ordered': True, 'items': ['Один', 'Два слова']})
        self.assertEqual(body['schema_version'], 1)

    def test_ads_toc_recommendations_and_hidden_content_are_removed(self):
        html = document('''<div class="frame"><h2>Реклама</h2><p>Лишнее</p><img src="/wp-content/uploads/ad.jpg"></div>
<aside><p>Баннер</p></aside><nav><a>Навигация</a></nav><div class="toc"><p>Оглавление</p></div>
<p hidden>Скрытый</p><div aria-hidden="true"><p>Скрытая вставка</p></div>
<div id="adfox-1"><p>Рекламный текст</p></div><div class="related-posts"><p>Рекомендации</p></div>
<p>Читайте также: что-нибудь ещё</p><p>Остаётся только этот абзац.</p>''')
        body = extract_body(html, URL)
        self.assertEqual(body['blocks'], [{'type': 'paragraph', 'text': 'Остаётся только этот абзац.'}])

    def test_figure_caption_credit_and_lazy_image_are_not_duplicated(self):
        html = document('''<h3>Место</h3><figure><img src="/blank.gif" data-src="/wp-content/uploads/place.webp" alt="Вид">
<figcaption>Учебный вид. Фото: Тестовый Автор</figcaption></figure><p>Далее текст.</p>''')
        blocks = extract_body(html, URL)['blocks']
        self.assertEqual(len(blocks), 3)
        self.assertEqual(blocks[1]['credit'], 'Тестовый Автор')
        self.assertEqual(blocks[1]['caption'], 'Учебный вид. Фото: Тестовый Автор')
        self.assertEqual(blocks[1]['url'], 'https://blog.ostrovok.ru/wp-content/uploads/place.webp')

    def test_source_html_is_never_output_and_unsafe_images_are_removed(self):
        html = document('''<p>Текст<script>alert(1)</script><a href="javascript:alert(2)"> ссылки</a>.</p>
<img src="javascript:alert(3)"><img src="http://example.com/test.jpg"><img src="/wp-content/themes/icon.png">''')
        body = extract_body(html, URL)
        self.assertEqual(body['blocks'], [{'type': 'paragraph', 'text': 'Текст ссылки.'}])
        self.assertNotIn('<', json.dumps(body, ensure_ascii=False))
        self.assertEqual(body_metrics(body)['types'], {'paragraph': 1})

    def test_nested_list_and_table_retain_text_once(self):
        html = document('''<ul><li>Родитель<ul><li>Ребёнок</li></ul></li></ul>
<table><tr><th>Место</th><th>Число</th></tr><tr><td>Учебное</td><td>1</td></tr></table>''')
        blocks = extract_body(html, URL)['blocks']
        self.assertEqual(blocks[0]['items'], ['Родитель Ребёнок'])
        self.assertEqual(blocks[1], {'type': 'table', 'rows': [['Место', 'Число'], ['Учебное', '1']]})

    def test_missing_or_empty_body_fails_instead_of_using_whole_page(self):
        for html in ['<p>Нет контейнера</p>', document('<div class="frame"><p>Только реклама</p></div>')]:
            with self.assertRaises(ValueError):
                extract_body(html, URL)

    def test_local_cli_exports_fixture_to_separate_file_and_prints_metrics_only(self):
        with tempfile.TemporaryDirectory() as directory:
            html = Path(directory) / 'local.html'
            output = Path(directory) / 'body.json'
            html.write_text(document('<p>Учебный текст оператора.</p>'), encoding='utf-8')
            run = subprocess.run([sys.executable, str(ROOT / 'article_text.py'), 'extract', '--html', str(html), '--url', URL, '--output', str(output)], capture_output=True, text=True)
            self.assertEqual(run.returncode, 0, run.stderr)
            self.assertEqual(json.loads(output.read_text())['blocks'][0]['text'], 'Учебный текст оператора.')
            self.assertNotIn('Учебный текст', run.stdout)
            self.assertEqual(json.loads(run.stdout)['blocks'], 1)

    def test_local_cli_never_overwrites_existing_output(self):
        with tempfile.TemporaryDirectory() as directory:
            html = Path(directory) / 'local.html'
            output = Path(directory) / 'body.json'
            html.write_text(document('<p>Учебный текст.</p>'), encoding='utf-8')
            output.write_text('original output', encoding='utf-8')
            run = subprocess.run([sys.executable, str(ROOT / 'article_text.py'), 'extract', '--html', str(html), '--url', URL, '--output', str(output)], capture_output=True, text=True)
            self.assertNotEqual(run.returncode, 0)
            self.assertEqual(output.read_text(), 'original output')


if __name__ == '__main__':
    unittest.main()
