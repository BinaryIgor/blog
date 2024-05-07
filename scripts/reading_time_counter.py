"""
Script to calculate reading speed of file. Usage:
python reading_time_counter.py <path-to-file>
"""

import re
import sys

AVG_READING_SPEED = 125

LINK_REGEX = re.compile("(http://|https://)([^\s]+)")
CODE_BLOCK = "```"
LINK_PLACEHOLDER="_link_"
NON_WORD_CHARACTERS_REGEX = re.compile("[,.?!~`'\"/\\\=\-_+<>{}()\[\]|;:#$%*&]")
FONT_MATTER_REGEX = re.compile('(?s)^---(.*?)---')
A_LINK_PATTERN = re.compile("<a href=(.*?)>(.*?)</a>")

def replace_a_link_pattern(match):
    return match.group(2)

def is_line_to_skip(line):
    return '<div class="post-delimiter">' in line or "<div class='post-delimiter'>" in line \
        or has_html_tag('figure', line) or has_html_tag('figcaption', line) or has_html_tag('img', line) 

def has_html_tag(tag, line):
    return f'<{tag}' in line or f'{tag}>' in line or f'{tag}/>' in line 


text_path = sys.argv[1]

with open(text_path) as f:
    content = f.read()
    font_matter_text = re.match(FONT_MATTER_REGEX, content)
    if font_matter_text:
       font_matter = font_matter_text[0]
       content = content.replace(font_matter_text[0], "").strip()

    in_code_block = False

    lines = content.split("\n")
    words_count = 0
    for l in lines:
        if CODE_BLOCK in l:
            in_code_block = not in_code_block

        if in_code_block:
            clean_line = l
        else:
            if is_line_to_skip(l):
                print("Skipping this line!")
                print(l)
                print()
                continue

            # each visible link should count as one word
            clean_line = re.sub(A_LINK_PATTERN, replace_a_link_pattern, l.strip())
            clean_line = re.sub(LINK_REGEX, LINK_PLACEHOLDER, clean_line)

        for w in clean_line.split(" "):
            clean_w = re.sub(NON_WORD_CHARACTERS_REGEX, "", w.strip())
            if len(clean_w) > 0:
                words_count += 1

raw_minutes_to_read = float(words_count) / AVG_READING_SPEED
minutes_to_read = round(raw_minutes_to_read)

print(f'Words: {words_count}')
print(f'Minutes to read: {minutes_to_read} with average speed of {AVG_READING_SPEED} wpm')
print(f'Rounding from: {raw_minutes_to_read}')