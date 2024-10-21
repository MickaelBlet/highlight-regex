#!/bin/bash
if [[ $# -ne 1 ]]; then
    >&2 echo "usage: $0 VERSION"
    >&2 echo -e "examples:\n  $0 \"1.0.0\"\n  INSTALL_VSIX=1 $0 \"1.0.0\""
    exit 1
fi

NB_PACKAGE_REGEX_RECURSE=5
VERSION="$1"

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
cd "${SCRIPT_DIR}/.." || exit 1

./scripts/generate.py "${VERSION}" "${NB_PACKAGE_REGEX_RECURSE}"

vsce package --githubBranch master

if [[ -n "${INSTALL_VSIX:-}" ]]; then
    code --install-extension "highlight-regex-${VERSION}.vsix"
fi