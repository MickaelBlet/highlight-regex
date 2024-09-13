#!/usr/bin/env python3
# coding=utf-8

import os
import sys
import json
from jinja2 import Environment, FileSystemLoader

def generate_file(version: str, nb_recurse: int):
    # Create the jinja2 environment.
    # Notice the use of trim_blocks, which greatly helps control whitespace.
    j2_env = Environment(loader=FileSystemLoader(os.path.dirname(os.path.abspath(__file__))),
                         trim_blocks=True)
    with open(os.path.dirname(os.path.realpath(__file__)) + '/../package.json', 'w') as f:
        f.write(j2_env.get_template('package.json.jinja').render(version=version, nb_recurse=nb_recurse))
    # minimise json file
    with open(os.path.dirname(os.path.realpath(__file__)) + '/../package.json', 'r') as f:
        file_data = json.load(f)
    with open(os.path.dirname(os.path.realpath(__file__)) + '/../package.json', 'w') as f:
        json.dump(file_data, f, separators=(',', ':'))

if __name__ == '__main__':
    if len(sys.argv) == 3:
        generate_file(sys.argv[1], int(sys.argv[2]))
    else:
        print(f'usage: {sys.argv[0]} VERSION NB_RECURSE')