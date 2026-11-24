"""Build the compact Bible files bundled with the Always Scripture server.

Source: scrollmapper/bible_databases (JSON format). Only translations whose licence
permits free redistribution are listed in TRANSLATIONS; licences were checked against
the source's own metadata and the publishers' statements recorded in data/translations.json.

Usage: python3 scripts/build-data.py /path/to/bible_databases <source-commit-sha>
"""

import gzip
import json
import os
import sys

# id, source file, name, language (BCP 47), licence, licence note
TRANSLATIONS = [
    ('BSB', 'BSB', 'Berean Standard Bible', 'en', 'Public domain (CC0)', 'Dedicated to the public domain by its publishers on 30 April 2023.'),
    ('RV1909', 'SpaRV', 'Reina-Valera 1909', 'es', 'Public domain', ''),
    ('BLIVRE', 'PorBLivre', 'Bíblia Livre', 'pt', 'CC BY 3.0 BR', 'Attribution: Bíblia Livre, licensed under Creative Commons Attribution 3.0 Brazil.'),
    ('RUSSYN', 'RusSynodal', 'Russian Synodal Translation', 'ru', 'Public domain', 'The source includes deuterocanonical books, which are kept.'),
    ('CUV', 'ChiUn', 'Chinese Union Version (Traditional)', 'zh-Hant', 'Public domain', ''),
    ('ADB1905', 'TagAngBiblia', 'Ang Biblia (1905)', 'tl', 'Public domain', ''),
    ('VIE1934', 'Viet', 'Kinh Thánh Tiếng Việt (1934)', 'vi', 'Public domain', ''),
]

# Canonical book codes, in order, keyed by the source's English book names.
BOOKS = [
    ('GEN', 'Genesis'), ('EXO', 'Exodus'), ('LEV', 'Leviticus'), ('NUM', 'Numbers'), ('DEU', 'Deuteronomy'),
    ('JOS', 'Joshua'), ('JDG', 'Judges'), ('RUT', 'Ruth'), ('1SA', 'I Samuel'), ('2SA', 'II Samuel'),
    ('1KI', 'I Kings'), ('2KI', 'II Kings'), ('1CH', 'I Chronicles'), ('2CH', 'II Chronicles'), ('EZR', 'Ezra'),
    ('NEH', 'Nehemiah'), ('EST', 'Esther'), ('JOB', 'Job'), ('PSA', 'Psalms'), ('PRO', 'Proverbs'),
    ('ECC', 'Ecclesiastes'), ('SNG', 'Song of Solomon'), ('ISA', 'Isaiah'), ('JER', 'Jeremiah'), ('LAM', 'Lamentations'),
    ('EZK', 'Ezekiel'), ('DAN', 'Daniel'), ('HOS', 'Hosea'), ('JOL', 'Joel'), ('AMO', 'Amos'),
    ('OBA', 'Obadiah'), ('JON', 'Jonah'), ('MIC', 'Micah'), ('NAM', 'Nahum'), ('HAB', 'Habakkuk'),
    ('ZEP', 'Zephaniah'), ('HAG', 'Haggai'), ('ZEC', 'Zechariah'), ('MAL', 'Malachi'), ('MAT', 'Matthew'),
    ('MRK', 'Mark'), ('LUK', 'Luke'), ('JHN', 'John'), ('ACT', 'Acts'), ('ROM', 'Romans'),
    ('1CO', 'I Corinthians'), ('2CO', 'II Corinthians'), ('GAL', 'Galatians'), ('EPH', 'Ephesians'), ('PHP', 'Philippians'),
    ('COL', 'Colossians'), ('1TH', 'I Thessalonians'), ('2TH', 'II Thessalonians'), ('1TI', 'I Timothy'), ('2TI', 'II Timothy'),
    ('TIT', 'Titus'), ('PHM', 'Philemon'), ('HEB', 'Hebrews'), ('JAS', 'James'), ('1PE', 'I Peter'),
    ('2PE', 'II Peter'), ('1JN', 'I John'), ('2JN', 'II John'), ('3JN', 'III John'), ('JUD', 'Jude'),
    ('REV', 'Revelation of John'),
]
NAME_TO_CODE = {n: c for c, n in BOOKS}


def build(src_root, sha, out_dir):
    meta = []
    for tid, src, name, lang, lic, note in TRANSLATIONS:
        data = json.load(open(os.path.join(src_root, 'formats', 'json', src + '.json'), encoding='utf-8'))
        books, extra = {}, []
        for b in data['books']:
            code = NAME_TO_CODE.get(b['name'])
            if code is None:
                extra.append(b['name'])
                code = 'X:' + b['name']
            books[code] = [[v['text'].strip() for v in sorted(ch['verses'], key=lambda v: v['verse'])]
                           for ch in sorted(b['chapters'], key=lambda c: c['chapter'])]
        missing = [c for c, _ in BOOKS if c not in books]
        path = os.path.join(out_dir, tid.lower() + '.json.gz')
        with gzip.open(path, 'wt', encoding='utf-8', compresslevel=9) as f:
            json.dump({'id': tid, 'books': books}, f, ensure_ascii=False, separators=(',', ':'))
        meta.append({'id': tid, 'name': name, 'language': lang, 'licence': lic, 'note': note,
                     'source': f'scrollmapper/bible_databases@{sha} formats/json/{src}.json',
                     'missing_books': missing, 'additional_books': extra})
        print(tid, 'books', len(books), 'missing', missing, 'extra', len(extra))
    json.dump(meta, open(os.path.join(out_dir, 'translations.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)


if __name__ == '__main__':
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    build(sys.argv[1], sys.argv[2], os.path.join(root, 'scripture-mcp', 'data'))
