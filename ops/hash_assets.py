import os
from os import path
import re
import codecs

ASSETS_DIRECTORY = os.environ.get('ASSETS_DIRECTORY',  
                                  path.join(os.getcwd(), "..", "dist"))
ASSETS_VERSION = os.environ.get('ASSETS_VERSION',
                                codecs.encode(os.urandom(8), "hex").decode())

IMAGES_EXTENSIONS = ['jpg', 'jpeg', 'png', 'svg']
EXCLUDE_PATHS = ["favicon.svg", "favicon-light.svg"]

LINK_TAG = "link"
HREF_ATTR = "href"
SCRIPT_TAG = "script"
SRC_ATTR = "src"
IMG_TAG = "img"
BACKGROUND_PROPERTY = "background"
URL_PROPERTY = 'url'
CSS_URL_REGEX = re.compile("(.*)url\\((.*)\\)")

JS_KEY = "js"
CSS_KEY = "css"
IMG_KEY = "img"
HTML_KEY = 'html'


def walk_dir_recursively(root_dir, files_data=None):
    if files_data is None:
        files_data = {}
    root_dir = os.path.abspath(root_dir)

    for f in os.listdir(root_dir):
        f_path = os.path.join(root_dir, f)
        if os.path.isdir(f_path):
            if should_process(f_path):
                walk_dir_recursively(f_path, files_data=files_data)
        elif should_process(f_path):
            if f.endswith(".js"):
                set_files_data_tuple(files_data, JS_KEY, JS_KEY, root_dir, f_path, f)
            elif f.endswith(".css"):
                set_files_data_tuple(files_data, CSS_KEY, CSS_KEY, root_dir, f_path, f)
            elif f.endswith(".html") or f.endswith(".xml") or "." not in f:
                htmls = files_data.get(HTML_KEY, [])
                htmls.append(f_path)
                files_data[HTML_KEY] = htmls
            else:
                for ie in IMAGES_EXTENSIONS:
                    if f.endswith(f'.{ie}'):
                        set_files_data_tuple(files_data, IMG_KEY, ie, root_dir, f_path, f)
                        break

    return files_data

def should_process(path):
    for ep in EXCLUDE_PATHS:
        if ep in path:
            return False
    return True


def set_files_data_tuple(files_data, key, extension, root_dir, file_path, file_name):
    extension_len = len(extension)
    new_name = f'{file_name[0:-(extension_len + 1)]}_{ASSETS_VERSION}.{extension}'
    new_path = to_path(root_dir, new_name)
    data = files_data.get(key, ({}, {}))
    data[0][file_name] = new_name
    data[1][file_path] = new_path
    files_data[key] = data


def to_path(directory, name):
    return f'{directory}/{name}'


def change_imports(path, names_map):
    with open(path) as f:
        content = f.readlines()
        changed_content = create_new_content(content, names_map)
    if changed_content:
        with open(path, "w") as cf:
            cf.writelines(changed_content)


def create_new_content(lines, names_map):
    new_lines = []
    from_key = "from"
    changed = False
    for c in lines:
        from_idx = c.find(from_key)
        name_idx = 1
        old_name = ''
        new_name = ''
        for n in names_map:
            name_idx = c.find(n)
            if name_idx > 0:
                old_name = n
                new_name = names_map[n]
                break
        if from_idx > 0 and name_idx > 0:
            new_import = f'{c[0: name_idx]}{new_name}{c[name_idx + len(old_name):]}'
            new_lines.append(new_import)
            changed = True
        else:
            new_lines.append(c)
    return new_lines if changed else []


def change_html(path, css_names_map, js_names_map, images_names_map):
    with open(path) as f:
        content = f.readlines()
        changed_content = change_html_assets_references(content, css_names_map, js_names_map, images_names_map)
    if changed_content:
        with open(path, "w") as cf:
            cf.writelines(changed_content)


def change_html_assets_references(lines, css_names_map, js_names_map, images_names_map):
    new_lines = []
    changed = False
    for l in lines:
        new_line = resolve_new_line(l, css_names_map, js_names_map, images_names_map)
        if new_line:
            changed = True
            new_lines.append(new_line)
        else:
            new_lines.append(l)
    return new_lines if changed else []


def resolve_new_line(old_line, css_names_map, js_names_map, images_names_map):
    if not should_process(old_line):
        return None

    css_l = new_css_line(old_line, css_names_map)
    if css_l:
        return css_l

    js_l = new_js_line(old_line, js_names_map)
    if js_l:
        return js_l

    img_l = new_img_line(old_line, images_names_map)
    if img_l:
        return img_l

    return ''


def new_css_line(old_line, css_names_map):
    link_idx = old_line.find(LINK_TAG)
    href_idx = old_line.find(HREF_ATTR)
    return replace_in_line(link_idx, href_idx, old_line, css_names_map)


def replace_in_line(tag_idx, attr_idx, old_line, names_map):
    if 0 < tag_idx < attr_idx:
        for name in names_map:
            name_idx = old_line.find(name)
            if name_idx > attr_idx:
                old_name_len = len(name)
                new_line = f'{old_line[0:name_idx]}{names_map[name]}{old_line[(name_idx + old_name_len):]}'
                return new_line
    return ''


def new_js_line(old_line, js_names_map):
    script_idx = old_line.find(SCRIPT_TAG)
    src_idx = old_line.find(SRC_ATTR)
    return replace_in_line(script_idx, src_idx, old_line, js_names_map)


def new_img_line(old_line, img_names_map):
    img_idx = old_line.find(IMG_TAG)
    src_idx = old_line.find(SRC_ATTR)
    return replace_in_line(img_idx, src_idx, old_line, img_names_map)


def change_css(path, images_names_map):
    with open(path) as f:
        content = f.readlines()
        changed_content = change_css_images_references(content, images_names_map)
    if changed_content:
        with open(path, "w") as cf:
            cf.writelines(changed_content)


def change_css_images_references(lines, images_names_map):
    new_lines = []
    changed = False
    for l in lines:
        url_match = re.match(CSS_URL_REGEX, l)
        if url_match:
            new_line = new_css_background_line(l, url_match[2], images_names_map)
            new_lines.append(new_line)
            changed = True
        else:
            new_lines.append(l)

    return new_lines if changed else []


def new_css_background_line(old_line, url, images_names_map):
    for n in images_names_map:
        if n in url:
            replaced_url = url.replace(n, images_names_map[n])
            return old_line.replace(url, replaced_url)
    return old_line


print('Searching for assets...')
files_data = walk_dir_recursively(ASSETS_DIRECTORY)

js_names_map, js_paths_map = files_data.get(JS_KEY, ({}, {}))
css_names_map, css_paths_map = files_data.get(CSS_KEY, ({}, {}))
images_names_map, images_paths_map = files_data.get(IMG_KEY, ({}, {}))
html_paths = files_data[HTML_KEY]

print('Renaming assets...')
for k in js_paths_map:
    os.rename(k, js_paths_map[k])
for k in css_paths_map:
    os.rename(k, css_paths_map[k])
for k in images_paths_map:
    os.rename(k, images_paths_map[k])

print('Updating assets content...')
for p in js_paths_map.values():
    change_imports(p, js_names_map)
for p in css_paths_map.values():
    change_css(p, images_names_map)
for h in html_paths:
    change_html(h, css_names_map, js_names_map, images_names_map)

print('Done!')
