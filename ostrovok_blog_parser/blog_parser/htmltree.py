from __future__ import annotations

import re
from html.parser import HTMLParser


class Node:
    def __init__(self, tag='', attrs=None, parent=None):
        self.tag, self.attrs, self.parent = tag, dict(attrs or []), parent
        self.children = []

    def has_class(self, value):
        return value in self.attrs.get('class', '').split()

    def find_all(self, tag=None, cls=None):
        for child in self.children:
            if isinstance(child, Node):
                if (tag is None or child.tag == tag) and (cls is None or child.has_class(cls)):
                    yield child
                yield from child.find_all(tag, cls)

    def find(self, tag=None, cls=None):
        return next(self.find_all(tag, cls), None)

    def text(self):
        def parts(node):
            if isinstance(node, str):
                yield node
            elif node.tag not in ('script', 'style', 'noscript'):
                for child in node.children:
                    yield from parts(child)
        return re.sub(r'\s+', ' ', ' '.join(parts(self))).strip()

    def ancestor(self, tag=None, cls=None):
        node = self.parent
        while node:
            if (tag is None or node.tag == tag) and (cls is None or node.has_class(cls)):
                return node
            node = node.parent
        return None


class Tree(HTMLParser):
    VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
            'param', 'source', 'track', 'wbr'}

    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.root = Node('document')
        self.stack = [self.root]
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs, self.stack[-1])
        self.stack[-1].children.append(node)
        if tag not in self.VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in self.VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                del self.stack[index:]
                break

    def handle_data(self, data):
        self.stack[-1].children.append(data)
