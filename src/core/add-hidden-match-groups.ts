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

export interface ProcessedRegex {
    sRegex: string;
    matchIndexToReal: { [key: number]: number };
    matchNamedToReal: { [key: string]: number };
    matchDependIndexes: { [key: number]: number[] };
}

// transform 'a(?: )bc(def(ghi)xyz)' to '(a)((?: ))(bc)((def)(ghi)(xyz))'
export function addHiddenMatchGroups(sRegex: string): ProcessedRegex {
    let jumpToEndOfBrace = (text: string, index: number): number => {
        let level = 1;
        while (level > 0) {
            index++;
            if (index === text.length) {
                break;
            }
            switch (text[index]) {
                case '}':
                    if ('\\' !== text[index - 1]) {
                        level--;
                        if ('?' === text[index + 1]) {
                            index++; // jump '}'
                        }
                    }
                    break;
                default:
                    break;
            }
        }
        return index;
    }

    let jumpToEndOfBracket = (text: string, index: number): number => {
        let level = 1;
        while (level > 0) {
            index++;
            if (index === text.length) {
                break;
            }
            switch (text[index]) {
                case ']':
                    if ('\\' !== text[index - 1]) {
                        level--;
                        if ('*' === text[index + 1]) {
                            index++; // jump ']'
                            if ('?' === text[index + 1]) {
                                index++; // jump '*'
                            }
                        }
                        else if ('+' === text[index + 1]) {
                            index++; // jump ']'
                            if ('?' === text[index + 1]) {
                                index++; // jump '+'
                            }
                        }
                        else if ('?' === text[index + 1]) {
                            index++; // jump ']'
                            if ('?' === text[index + 1]) {
                                index++; // jump '?'
                            }
                        }
                        else if ('{' === text[index + 1]) {
                            index++; // jump ']'
                            index = jumpToEndOfBrace(text, index);
                        }
                    }
                    break;
                default:
                    break;
            }
        }
        return index;
    }

    let jumpToEndOfParenthesis = (text: string, index: number): number => {
        let level = 1;
        while (level > 0) {
            index++;
            if (index === text.length) {
                break;
            }
            switch (text[index]) {
                case '(':
                    if ('\\' !== text[index - 1]) {
                        level++;
                    }
                    break;
                case ')':
                    if ('\\' !== text[index - 1]) {
                        level--;
                        if ('*' === text[index + 1]) {
                            index++; // jump ')'
                            if ('?' === text[index + 1]) {
                                index++; // jump '*'
                            }
                        }
                        else if ('+' === text[index + 1]) {
                            index++; // jump ')'
                            if ('?' === text[index + 1]) {
                                index++; // jump '+'
                            }
                        }
                        else if ('?' === text[index + 1]) {
                            index++; // jump ')'
                            if ('?' === text[index + 1]) {
                                index++; // jump '?'
                            }
                        }
                        else if ('{' === text[index + 1]) {
                            index++; // jump ')'
                            index = jumpToEndOfBrace(text, index);
                        }
                    }
                    break;
                case '[':
                    if ('\\' !== text[index - 1]) {
                        index = jumpToEndOfBracket(text, index);
                    }
                    break;
                default:
                    break;
            }
        }
        return index;
    }

    let splitOrRegex = (text: string): string[] => {
        let ret: string[] = [];
        let start = 0;
        let end = 0;
        for (let i = 0; i < text.length; i++) {
            // is bracket
            if ('[' === text[i] && (i === 0 || i > 0 && '\\' !== text[i - 1])) {
                i = jumpToEndOfBracket(text, i);
            }
            // is real match group
            if ('(' === text[i] && (i === 0 || i > 0 && '\\' !== text[i - 1])) {
                i = jumpToEndOfParenthesis(text, i);
            }
            // is or
            if ('|' === text[i]) {
                end = i;
                ret.push(text.substr(start, end - start));
                start = i + 1;
            }
        }
        if (start > 0) {
            ret.push(text.substr(start, text.length - start));
        }
        else {
            ret.push(text);
        }
        return ret;
    }
    function hasMatchGroup(str: string): boolean {
        let hasGroup = false;
        // check if match group exists
        for (let i = 0; i < str.length; i++) {
            if ('[' === str[i] && (i === 0 || i > 0 && '\\' !== str[i - 1])) {
                i = jumpToEndOfBracket(str, i);
            }
            if ('(' === str[i] && (i === 0 || i > 0 && '\\' !== str[i - 1])) {
                hasGroup = true;
                break;
            }
        }
        return hasGroup;
    }

    function convertBackSlash(str: string, offset: number, input: string): string {
        return '####B4CKSL4SHB4CKSL4SH####';
    }
    function reloadBackSlash(str: string, offset: number, input: string): string {
        return '\\\\';
    }

    // replace all '\\'
    let sRegexConverted = sRegex.replace(/\\\\/gm, convertBackSlash);

    let matchIndexToReal: { [key: number]: number } = { 0: 0 };
    let matchNamedToReal: { [key: string]: number } = {};
    let matchDependIndexes: { [key: number]: number[] } = { 0: [] };

    // not match group found
    if (!hasMatchGroup(sRegexConverted)) {
        // default return
        return {
            sRegex,
            matchIndexToReal,
            matchNamedToReal,
            matchDependIndexes
        };
    }

    // -------------------------------------------------------------------------
    // create a newRegex

    let newStrRegex = '';

    let index = 1;
    let realIndex = 1;

    let findGroups = (text: string, parentIndexes: number[] = [], dependIndexes: number[] = []): void => {
        let addSimpleGroup = (str: string, prefix: string = '(', sufix: string = ')'): void => {
            // update newRegex
            newStrRegex += prefix + str + sufix;

            // add depend
            dependIndexes.push(index);

            index++;
        }
        let getEndOfGroup = (str: string, i: number): number => {
            while (i > 0 && ')' !== str[i]) {
                i--;
            }
            return i;
        }

        let start = 0;
        let end = 0;

        for (let i = 0; i < text.length; i++) {
            // is not capture group
            if ('(' === text[i] && '?' === text[i + 1] && (i === 0 || i > 0 && '\\' !== text[i - 1])) {
                // set cursor before found
                end = i;
                if (end - start > 0) {
                    // before
                    addSimpleGroup(text.substr(start, end - start));
                }

                // check type of not capture group

                i++; // jump '('
                i++; // jump '?'

                // is assert
                if ('<' === text[i] && ('=' === text[i + 1] || '!' === text[i + 1])) {
                    newStrRegex += '((?<' + text[i + 1];
                    i++; // jump '<'
                    start = i + 1;
                    i = jumpToEndOfParenthesis(text, i);
                    end = i;
                }
                // is assert
                else if ('=' === text[i] || '!' === text[i]) {
                    newStrRegex += '((?' + text[i];
                    start = i + 1;
                    i = jumpToEndOfParenthesis(text, i);
                    end = i;
                }
                // is named
                else if ('<' === text[i]) {
                    newStrRegex += '((?:';
                    start = i + 1;
                    for (let j = i; j < text.length; j++) {
                        i++;
                        if (text[j] === '>') {
                            break;
                        }
                    }

                    matchNamedToReal[text.substr(start, i - start - 1)] = index;

                    // add index in real
                    matchIndexToReal[realIndex] = index;
                    matchDependIndexes[index] = dependIndexes.filter(item => !parentIndexes.includes(item));

                    realIndex++;

                    start = i;
                    i = jumpToEndOfParenthesis(text, start - 1);
                    end = i;
                }
                // is non capture group
                else if (':' === text[i]) {
                    newStrRegex += '((?:';
                    start = i + 1;
                    i = jumpToEndOfParenthesis(text, i);
                    end = i;
                }
                else {
                    throw new Error(`regex: bad pattern at '(?${text[i]}...'`);
                }

                // get the end of group ')[...]'
                let endGroup = getEndOfGroup(text, end);
                // get content of group
                let sGroup = text.substr(start, endGroup - start);

                // add in depend
                dependIndexes.push(index);
                parentIndexes.push(index);

                index++;

                let splitRegex = splitOrRegex(sGroup);
                for (let j = 0; j < splitRegex.length; j++) {
                    if (j > 0) {
                        newStrRegex += '|';
                    }
                    findGroups(splitRegex[j], parentIndexes.slice(), dependIndexes.slice());
                }

                parentIndexes.pop();

                newStrRegex += ')' + text.substr(endGroup + 1, end - endGroup) + ')';

                start = i + 1; // jump ')'
            }
            // is bracket
            if ('[' === text[i] && (i === 0 || i > 0 && '\\' !== text[i - 1])) {
                i = jumpToEndOfBracket(text, i);
            }
            // is real match group
            if ('(' === text[i] && '?' !== text[i + 1] && (i === 0 || i > 0 && '\\' !== text[i - 1])) {
                // set cursor before found
                end = i;
                if (end - start > 0) {
                    // before
                    addSimpleGroup(text.substr(start, end - start));
                }

                start = i + 1;
                i = jumpToEndOfParenthesis(text, i);
                end = i;

                // get the end of group ')[...]'
                let endGroup = getEndOfGroup(text, end);
                // get content of group
                let sGroup = text.substr(start, endGroup - start);

                // add index in real
                matchIndexToReal[realIndex] = index;
                matchDependIndexes[index] = dependIndexes.filter(item => !parentIndexes.includes(item));

                dependIndexes.push(index);
                parentIndexes.push(index);

                index++;
                realIndex++;

                newStrRegex += '(';

                if (end !== endGroup) {
                    newStrRegex += '(?:';
                }

                let splitRegex = splitOrRegex(sGroup);
                for (let j = 0; j < splitRegex.length; j++) {
                    if (j > 0) {
                        newStrRegex += '|';
                    }
                    findGroups(splitRegex[j], parentIndexes.slice(), dependIndexes.slice());
                }

                parentIndexes.pop();

                if (end !== endGroup) {
                    newStrRegex += ')' + text.substr(endGroup + 1, end - endGroup);
                }

                newStrRegex += ')';

                start = i + 1;
            }
        }
        if (start > 0 && text.length > (end + 1) && text.length - start > 0) {
            addSimpleGroup(text.substr(start, text.length - start));
        }
        else if (start === 0) {
            newStrRegex += text;
        }
    }
    let splitRegex = splitOrRegex(sRegexConverted);
    for (let i = 0; i < splitRegex.length; i++) {
        if (i > 0) {
            newStrRegex += '|';
        }
        findGroups(splitRegex[i]);
    }
    // replace backreference by index
    let backreferenceRegex = ""
    for (let i = 0; i < newStrRegex.length; i++) {
        // is named backreference
        // NOTE: In unicode-unaware mode, this CAN (but shouldn't) cause issues (`\k` resolves to literal `k` unless a group matches)
        //       https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Named_backreference#description
        if ('\\' === newStrRegex[i] && 'k' === newStrRegex[i + 1] && '<' === newStrRegex[i + 2]) {
            i += 3; // skip `\k<`
            let start = i;
            for (; i < newStrRegex.length; i++) {
                if (newStrRegex[i] === '>') {
                    break;
                }
            }
            backreferenceRegex += `\\${matchNamedToReal[newStrRegex.substr(start, i - start)]}`;
        }
        // is backreference
        else if ('\\' === newStrRegex[i] && newStrRegex[i + 1] >= '0' && newStrRegex[i + 1] <= '9') {
            i++; // skip '\'
            let start = i;
            for (; i < newStrRegex.length; i++) {
                if (newStrRegex[i] < '0' || newStrRegex[i] > '9') {
                    break;
                }
            }
            backreferenceRegex += `\\${matchIndexToReal[parseInt(newStrRegex.substr(start, i - start))]}`;
            i--;
        }
        else {
            backreferenceRegex += newStrRegex[i];
        }
    }
    // rollback replace all '\\'
    newStrRegex = backreferenceRegex.replace(/####B4CKSL4SHB4CKSL4SH####/gm, reloadBackSlash);
    return {
        sRegex: newStrRegex,
        matchIndexToReal,
        matchNamedToReal,
        matchDependIndexes
    };
}