"""Public discovery and metadata must survive the actual Zola rendering."""
from html.parser import HTMLParser
import json
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
class Page(HTMLParser):
    def __init__(self,text):
        super().__init__(); self.links=[]; self.schemas=[]; self.canonical=[]; self.json=False; self.buffer=''; self.feed(text)
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if tag=='a': self.links.append(attrs.get('href',''))
        if tag=='link' and attrs.get('rel')=='canonical': self.canonical.append(attrs['href'])
        if tag=='script' and attrs.get('type')=='application/ld+json': self.json=True; self.buffer=''
    def handle_data(self,text):
        if self.json: self.buffer+=text
    def handle_endtag(self,tag):
        if tag=='script' and self.json: self.schemas.append(json.loads(self.buffer)); self.json=False
class Lucy(unittest.TestCase):
    def test_routes_metadata_and_listing(self):
        for route in ['lucy','things-i-built/lucy']:
            text=(ROOT/'public'/route/'index.html').read_text(); page=Page(text)
            self.assertEqual(page.canonical,[f'https://dhilipsiva.dev/{route}/'])
            self.assertIn('https://github.com/dhilipsiva/lucy',page.links)
            self.assertTrue(any(s.get('@type') in ['SoftwareApplication','SoftwareSourceCode'] for s in page.schemas))
        for route in ['index.html','things-i-built/index.html']:
            self.assertTrue(any(link.endswith('/things-i-built/lucy/') for link in Page((ROOT/'public'/route).read_text()).links), route)
        for route in ['lucy/','things-i-built/lucy/']:
            self.assertIn(f'https://dhilipsiva.dev/{route}',(ROOT/'public/sitemap.xml').read_text())
    def test_protocol_discovery_and_privacy(self):
        self.assertIn('/lucy/wake.txt',(ROOT/'public/llms.txt').read_text())
        text=(ROOT/'public/lucy/wake.txt').read_text()
        self.assertIn('No program needs to execute',text)
        self.assertIn('private storage',text)
        self.assertIn('every wake',text)
        self.assertIn('session context only',text)
if __name__=='__main__': unittest.main()
