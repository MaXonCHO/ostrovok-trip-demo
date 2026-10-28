import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError

from blog_parser.collect import choose_images, collect_one, download_image, load_selection, safe_slug
from blog_parser.extract import extract_article, parse_date, search_cards
from blog_parser.render import export
from blog_parser.net import Client


URL = 'https://blog.ostrovok.ru/test-article/'
HTML = '''<html><head><meta name="author" content="Автор"><meta property="og:image" content="https://blog.ostrovok.ru/wp-content/uploads/cover.jpg"></head><body>
<article class="post post-single" id="post-123"><time itemprop="datePublished" datetime="2025-03-04T23:30:00+03:00">04.03.2025</time><h1 class="post-title">Необычные места</h1>
<div class="post-text"><p>Длинный исходный текст, который нельзя сохранять в итоговую карточку.</p>
<h2>Музей</h2><div class="wp-caption"><img src="https://blog.ostrovok.ru/wp-content/uploads/museum.jpg"><p class="wp-caption-text">Длинная подпись о музее. Фото: Анна Иванова</p></div>
<div class="frame"><h2>Реклама отеля</h2><img src="https://blog.ostrovok.ru/wp-content/uploads/ad.jpg"></div>
<h2>Кафе</h2><img src="https://blog.ostrovok.ru/wp-content/uploads/cafe.jpg"></div></article>
<article class="post-medium"><time datetime="2026-10-01">Рекомендация</time><img src="https://blog.ostrovok.ru/wp-content/uploads/other.jpg"></article></body></html>'''
CHOICE = {'url': URL, 'category': 'unusual', 'summary': 'Краткое самостоятельное описание.', 'tags': ['музеи']}


class ExtractTests(unittest.TestCase):
    def test_date_formats_and_unknown(self):
        self.assertEqual(parse_date('2025.03.04'), '2025-03-04')
        self.assertEqual(parse_date('04.03.2025'), '2025-03-04')
        self.assertEqual(parse_date('2025-03-04T23:30:00+03:00'), '2025-03-04')
        self.assertIsNone(parse_date('2025-02-31'))
        self.assertIsNone(parse_date('неизвестно'))

    def test_main_article_date_not_recommendation_date(self):
        article = extract_article(HTML, URL)
        self.assertEqual(article['date_published'], '2025-03-04')
        self.assertEqual(article['date_source'], 'article.time.datePublished')
        self.assertIsNone(article['date_modified'])

    def test_images_exclude_ads_and_recommendations(self):
        article = extract_article(HTML, URL)
        self.assertEqual(len(article['images']), 3)
        self.assertEqual(article['images'][0]['role'], 'cover')
        self.assertEqual(article['images'][1]['credit'], 'Анна Иванова')
        self.assertEqual(article['images'][2]['section_context'], 'Кафе')
        self.assertNotIn('Реклама отеля', article['_inspection_sections'])

    def test_missing_publication_date_not_guessed_from_title(self):
        with self.assertRaises(ValueError):
            extract_article(HTML.replace('datetime="2025-03-04T23:30:00+03:00"', ''), URL)

    def test_search_result_links(self):
        cards, pages = search_cards('<article><h1 class="post-title"><a href="/test-article/?utm_source=x">Название</a></h1><time datetime="2025.03.04"></time></article>', URL)
        self.assertEqual(cards[0]['url'], URL)
        self.assertEqual(cards[0]['search_date'], '2025-03-04')


class CollectionTests(unittest.TestCase):
    def test_forbidden_image_does_not_block_unrelated_pages(self):
        client = Client(delay=0)
        client.opener.open = lambda *a, **kw: (_ for _ in ()).throw(HTTPError(URL, 403, 'Forbidden', {}, None))
        with patch('blog_parser.net.public_url'):
            with self.assertRaises(HTTPError):
                client.get(URL, image=True)
        self.assertFalse(client.blocked)
        self.assertIn(URL, client.denied_urls)

    def test_rate_limit_stops_host_even_for_images(self):
        client = Client(delay=0)
        client.opener.open = lambda *a, **kw: (_ for _ in ()).throw(HTTPError(URL, 429, 'Limited', {}, None))
        with patch('blog_parser.net.public_url'):
            with self.assertRaises(HTTPError):
                client.get(URL, image=True)
        self.assertIn('blog.ostrovok.ru', client.blocked)

    def test_safe_paths(self):
        self.assertEqual(safe_slug('test-article'), 'test-article')
        with self.assertRaises(ValueError):
            safe_slug('../outside')

    def test_diverse_sections_and_limit(self):
        images = [{'role': 'cover', 'section_context': ''},
                  {'role': 'illustration', 'section_context': 'А'},
                  {'role': 'illustration', 'section_context': 'А'},
                  {'role': 'illustration', 'section_context': 'Б'}]
        self.assertEqual([x['section_context'] for x in choose_images(images, 3)], ['', 'А', 'Б'])

    def test_selection_domain_and_duplicates(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'selection.json'
            path.write_text(json.dumps([CHOICE, CHOICE]))
            with self.assertRaises(ValueError):
                load_selection(path)
            path.write_text(json.dumps([{**CHOICE, 'url': 'https://other.example/article/'}]))
            with self.assertRaises(ValueError):
                load_selection(path)

    def test_full_text_not_in_exported_record_and_bad_image_visible(self):
        class Client:
            def get(self, url, image=False):
                if image:
                    return url, b'<html>blocked</html>', 'text/html'
                return url, HTML.encode(), 'text/html'
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            result = collect_one(Client(), CHOICE, root)
            saved = (root / 'articles/test-article/article.json').read_text()
            self.assertNotIn('Длинный исходный текст', saved)
            self.assertNotIn('_inspection_', saved)
            self.assertEqual(result['summary'], CHOICE['summary'])
            self.assertEqual(len(result['errors']), 3)
            self.assertEqual(export(root, [CHOICE])['articles_without_photos'], ['test-article'])

    def test_real_image_validation_and_conversion(self):
        from PIL import Image
        data = io.BytesIO()
        Image.new('RGB', (1200, 800), 'blue').save(data, 'JPEG')
        class Client:
            def get(self, url, image=False):
                return url, data.getvalue(), 'image/jpeg'
        with tempfile.TemporaryDirectory() as directory:
            photo = download_image(Client(), {'original_url': 'https://cdn.example/test.jpg'}, Path(directory), 1)
            with Image.open(Path(directory) / photo['filename']) as image:
                self.assertEqual(image.format, 'WEBP')
                image.verify()


if __name__ == '__main__':
    unittest.main()
