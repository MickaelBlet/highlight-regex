/*
MIT License

Copyright (c) 2022-2026 Mickaël Blet

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the 'Software'), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

// map each named capture group to its group number: '(a)(?<x>b)' -> { x: 2 }
export function getNamedGroupIndexes(sRegex: string): { [key: string]: number } {
    let namedGroupIndexes: { [key: string]: number } = {};
    let groupIndex = 0;
    for (let i = 0; i < sRegex.length; i++) {
        // jump escaped character
        if ('\\' === sRegex[i]) {
            i++;
        }
        // jump character class
        else if ('[' === sRegex[i]) {
            for (i++; i < sRegex.length && ']' !== sRegex[i]; i++) {
                if ('\\' === sRegex[i]) {
                    i++;
                }
            }
        }
        else if ('(' === sRegex[i]) {
            // capture group
            if ('?' !== sRegex[i + 1]) {
                groupIndex++;
            }
            // named capture group (not lookbehind)
            else if ('<' === sRegex[i + 2] && '=' !== sRegex[i + 3] && '!' !== sRegex[i + 3]) {
                groupIndex++;
                const end = sRegex.indexOf('>', i + 3);
                if (end > 0) {
                    namedGroupIndexes[sRegex.substring(i + 3, end)] = groupIndex;
                }
            }
        }
    }
    return namedGroupIndexes;
}
