"""
Script to calculate reading speed of file. Usage:
python reading_time_counter.py <path-to-file>
"""

import re
import sys

AVG_READING_SPEED = 150
LINK_REGEX = re.compile("(http://|https://)([^\s]+)")
NON_WORDS_REGEX = re.compile(",|\\.|\\?|-|>")
HTML_REGEX = re.compile('(.*)<(.+)>(.*)')
FONT_MATTER_REGEX = re.compile('(?s)^---(.*?)---')

text_path = sys.argv[1]

with open(text_path) as f:
    content = f.read()
    font_matter_text = re.match(FONT_MATTER_REGEX, content)
    if font_matter_text:
       font_matter = font_matter_text[0]
       content = content.replace(font_matter_text[0], "").strip()


    lines = content.split("\n")
    words_count = 0
    for l in lines:
        if re.match(HTML_REGEX, l):
            continue

        l_words = 0

        # each link counts as one word
        line_without_links = re.sub(LINK_REGEX, " W ", l.strip())

        line_without_sep = re.sub(NON_WORDS_REGEX, " ", line_without_links)
        for w in line_without_sep.split(" "):
            if len(w.strip()) > 0:
                l_words += 1

        words_count += l_words

raw_minutes_to_read = float(words_count) / AVG_READING_SPEED
minutes_to_read = round(raw_minutes_to_read)

print(f'Words: {words_count}')
print(f'Minutes to read: {minutes_to_read} with average speed of {AVG_READING_SPEED} wpm')
print(f'Rounding from: {raw_minutes_to_read}')