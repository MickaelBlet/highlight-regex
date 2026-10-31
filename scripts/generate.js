#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// fetched on demand by npx, not a project dependency
const LIQUIDJS = 'liquidjs@^10.30.1';
// number of unrolled nested "regexes" schema levels
const NB_RECURSE = 5;
const PACKAGE_JSON = path.join(__dirname, '..', 'package.json');

function generateFile(nbRecurse) {
    // keep the version of the current package.json
    const { version } = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
    const context = {
        version,
        nb_recurse_last: nbRecurse - 1,
        scopes: ['global', 'workspace'],
        views: ['visible', 'active'],
    };
    // trim-tag-right + no-greedy: drop only the newline after a tag (like jinja trim_blocks)
    const rendered = execFileSync('npx', [
        '-y', LIQUIDJS,
        '--template', '@' + path.join(__dirname, 'package.liquid.json'),
        '--context', JSON.stringify(context),
        '--trim-tag-right', '--no-greedy',
    ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'] });
    // reformat json file
    fs.writeFileSync(PACKAGE_JSON, JSON.stringify(JSON.parse(rendered), null, '\t'));
}

generateFile(NB_RECURSE);
