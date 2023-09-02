"""
Script to calculate reading speed of file. Usage:
python reading_time_counter.py <path-to-file>
"""

import re
import sys

AVG_READING_SPEED = 200
LINK_REGEX = re.compile("(http://|https://)([^\s]+)")
NON_WORDS_REGEX = re.compile(",|\\.|\\?|-|>")
HTML_REGEX = re.compile('(.*)<(.+)>(.*)')

text_path = sys.argv[1]

with open(text_path) as f:
    lines = f.readlines()
    words_count = 0
    for l in lines:
        if re.match(HTML_REGEX, l):
            continue

        l_words = 0

        # Each link as one world
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