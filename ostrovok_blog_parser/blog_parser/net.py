from __future__ import annotations

import ipaddress
import socket
import time
import urllib.error
import urllib.parse
import urllib.request


def public_url(url):
    p = urllib.parse.urlsplit(url)
    if p.scheme != 'https' or not p.hostname or p.username or p.password or p.port not in (None, 443):
        raise ValueError('Ожидался публичный HTTPS URL')
    for row in socket.getaddrinfo(p.hostname, 443):
        if not ipaddress.ip_address(row[4][0]).is_global:
            raise ValueError('Локальные и служебные адреса не разрешены')


class Redirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        public_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


class Client:
    def __init__(self, delay=1, timeout=25):
        self.delay, self.timeout, self.last, self.blocked = delay, timeout, {}, set()
        self.denied_urls = set()
        self.opener = urllib.request.build_opener(Redirect())

    def get(self, url, image=False):
        # Cyrillic image filenames are valid IRIs but need URI encoding for urllib.
        url = urllib.parse.quote(url, safe=":/?&=%#@+;,!$'()*[]~-._")
        public_url(url)
        host = urllib.parse.urlsplit(url).hostname
        if url in self.denied_urls:
            raise RuntimeError('Доступ к этому URL запрещён; повторный запрос не выполняется')
        if host in self.blocked:
            raise RuntimeError('Источник ограничил доступ; запросы к хосту остановлены')
        pause = self.delay - (time.monotonic() - self.last.get(host, 0))
        if pause > 0:
            time.sleep(pause)
        self.last[host] = time.monotonic()
        try:
            req = urllib.request.Request(url, headers={
                'User-Agent': 'Mozilla/5.0 (compatible; ArticleResearch/1.0)',
                'Accept-Language': 'ru-RU,ru;q=0.9'})
            with self.opener.open(req, timeout=self.timeout) as r:
                limit = 15 * 1024 * 1024 if image else 5 * 1024 * 1024
                data = r.read(limit + 1)
                if len(data) > limit:
                    raise ValueError('Ответ превышает допустимый размер')
                return r.url, data, r.headers.get('Content-Type', '')
        except urllib.error.HTTPError as e:
            if e.code == 403 and image:
                # A forbidden media file does not imply that unrelated public
                # articles are forbidden. Do not request this media URL again.
                self.denied_urls.add(url)
            elif e.code in (403, 429):
                self.blocked.add(host)
            raise
