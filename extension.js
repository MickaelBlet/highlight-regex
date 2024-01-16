/*
MIT License

Copyright (c) 2022-2024 Mickaël Blet

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
const vscode = require("vscode");

class Parser {

    constructor(logger, configuration, regexesConfiguration) {
        this.active = true;
        this.logger = logger;
        this.regexes = [];
        this.decorations = [];
        this.loadConfigurations(configuration, regexesConfiguration);
    }

    //
    // PUBLIC
    //

    // load configuration from contributions
    loadConfigurations(configuration, regexesConfiguration) {
        let loadRegexes = (configuration, regex) => {
            // transform 'a(?: )bc(def(ghi)xyz)' to '(a)((?: ))(bc)((def)(ghi)(xyz))'
            let addHiddenMatchGroups = (sRegex) => {
                let jumpToEndOfBrace = (text, index) => {
                    let level = 1;
                    while (level > 0) {
                        index++;
                        if (index == text.length) {
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

                let jumpToEndOfBracket = (text, index) => {
                    let level = 1;
                    while (level > 0) {
                        index++;
                        if (index == text.length) {
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

                let jumpToEndOfParenthesis = (text, index) => {
                    let level = 1;
                    while (level > 0) {
                        index++;
                        if (index == text.length) {
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

                let splitOrRegex = (text) => {
                    let ret = [];
                    let start = 0;
                    let end = 0;
                    for (let i = 0 ; i < text.length ; i++) {
                        // is bracket
                        if ('[' === text[i] && (i == 0 || i > 0 && '\\' !== text[i - 1])) {
                            i = jumpToEndOfBracket(text, i);
                        }
                        // is real match group
                        if ('(' === text[i] && (i == 0 || i > 0 && '\\' !== text[i - 1])) {
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
                function hasMatchGroup(str) {
                    let hasGroup = false;
                    // check if match group exists
                    for (let i = 0 ; i < str.length ; i++) {
                        if ('[' === str[i] && (i == 0 || i > 0 && '\\' !== str[i - 1])) {
                            i = jumpToEndOfBracket(str, i);
                        }
                        if ('(' === str[i] && (i == 0 || i > 0 && '\\' !== str[i - 1])) {
                            hasGroup = true;
                            break;
                        }
                    }
                    return hasGroup;
                }

                function convertBackSlach(str, offset, input) {
                    return '####B4CKSL4CHB4CKSL4CH####';
                }
                function reloadBackSlach(str, offset, input) {
                    return '\\\\';
                }

                // replace all \\
                let sRegexConverted = sRegex.replace(/\\\\/gm, convertBackSlach);

                let matchIndexToReal = {0: 0};
                let matchNamedToReal = {};
                let matchDependIndexes = {0: []};

                // not match group found
                if (!hasMatchGroup(sRegexConverted)) {
                    // default return
                    return {
                        sRegex,
                        matchIndexToReal,
                        matchNamedToReal,
                        matchDependIndexes
                    }
                }

                // -------------------------------------------------------------------------
                // create a newRegex

                let newStrRegex = "";

                let index = 1;
                let realIndex = 1;

                let debugIndexesPrefix = (realIndex = undefined) => {
                    if (realIndex) {
                        return (" " + index).slice(-2) + ":" + (" " + realIndex).slice(-2) + ": ";
                    }
                    else {
                        return (" " + index).slice(-2) + ":--: ";
                    }
                }

                let findGroups = (text, parentIndexes = [], dependIndexes = []) => {
                    let addSimpleGroup = (str, prefix = '(', sufix = ')') => {
                        // console.log(debugIndexesPrefix() + "'" + str + "'");

                        // update newRegex
                        newStrRegex += prefix + str + sufix;

                        // add depend
                        dependIndexes.push(index);

                        index++;
                    }
                    let getEndOfGroup = (str, i) => {
                        while (i > 0 && ')' !== str[i]) {
                            i--;
                        }
                        return i;
                    }

                    let start = 0;
                    let end = 0;

                    for (let i = 0 ; i < text.length ; i++) {
                        // is not capture group
                        if ('(' === text[i] && '?' === text[i + 1] && (i == 0 || i > 0 && '\\' !== text[i - 1])) {
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
                                newStrRegex += "((?<" + text[i + 1];
                                i++; // jump '<'
                                start = i + 1;
                                i = jumpToEndOfParenthesis(text, i);
                                end = i;
                            }
                            // is assert
                            else if ('=' === text[i] || '!' === text[i]) {
                                newStrRegex += "((?" + text[i];
                                start = i + 1;
                                i = jumpToEndOfParenthesis(text, i);
                                end = i;
                            }
                            // is named
                            else if ('<' === text[i]) {
                                newStrRegex += "((?:";
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
                                i = jumpToEndOfParenthesis(text, i);
                                end = i;
                            }
                            // is non capture group
                            else if (':' === text[i]) {
                                newStrRegex += "((?:";
                                start = i + 1;
                                i = jumpToEndOfParenthesis(text, i);
                                end = i;
                            }
                            else {
                                console.error("bad pattern ?");
                            }

                            // get the end of group ')[...]'
                            let endGroup = getEndOfGroup(text, end);
                            // get content of group
                            let sGroup = text.substr(start, endGroup - start);

                            // add group
                            // console.log(debugIndexesPrefix() + "'" + sGroup + "'");
                            // add in depend
                            dependIndexes.push(index);
                            parentIndexes.push(index);

                            index++;

                            let splitRegex = splitOrRegex(sGroup);
                            for (let j = 0; j < splitRegex.length; j++) {
                                if (j > 0) {
                                    newStrRegex += "|";
                                }
                                findGroups(splitRegex[j], parentIndexes.slice(), dependIndexes.slice());
                            }

                            parentIndexes.pop();

                            newStrRegex += ")" + text.substr(endGroup + 1, end - endGroup) + ")";

                            start = i + 1; // jump ')'
                        }
                        // is bracket
                        if ('[' === text[i] && (i == 0 || i > 0 && '\\' !== text[i - 1])) {
                            i = jumpToEndOfBracket(text, i);
                        }
                        // is real match group
                        if ('(' === text[i] && '?' !== text[i + 1] && (i == 0 || i > 0 && '\\' !== text[i - 1])) {
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

                            // console.log(debugIndexesPrefix(realIndex) + "'" + sGroup + "' (real)");

                            // add index in real
                            matchIndexToReal[realIndex] = index;
                            matchDependIndexes[index] = dependIndexes.filter(item => !parentIndexes.includes(item));

                            dependIndexes.push(index);
                            parentIndexes.push(index);

                            index++;
                            realIndex++;

                            newStrRegex += "(";

                            if (end !== endGroup) {
                                newStrRegex += "(?:";
                            }

                            let splitRegex = splitOrRegex(sGroup);
                            for (let j = 0; j < splitRegex.length; j++) {
                                if (j > 0) {
                                    newStrRegex += "|";
                                }
                                findGroups(splitRegex[j], parentIndexes.slice(), dependIndexes.slice());
                            }

                            parentIndexes.pop();

                            if (end !== endGroup) {
                                newStrRegex += ")" + text.substr(endGroup + 1, end - endGroup);
                            }

                            newStrRegex += ")";

                            start = i + 1;
                        }
                    }
                    if (start > 0 && text.length > (end + 1) && text.length - start > 0) {
                        addSimpleGroup(text.substr(start, text.length - start));
                    }
                    else if (start == 0) {
                            newStrRegex += text;
                    }
                }
                let splitRegex = splitOrRegex(sRegexConverted);
                for (let i = 0; i < splitRegex.length; i++) {
                    if (i > 0) {
                        newStrRegex += "|";
                    }
                    findGroups(splitRegex[i]);
                }

                // rollback replace all \\
                newStrRegex = newStrRegex.replace(/####B4CKSL4CHB4CKSL4CH####/gm, reloadBackSlach)

                // console.log("OldRegex: " + sRegex);
                // console.log("NewRegex: " + newStrRegex);
                // console.log(matchIndexToReal);
                // console.log(matchNamedToReal);
                // console.log(matchDependIndexes);

                return {
                    sRegex: newStrRegex,
                    matchIndexToReal,
                    matchNamedToReal,
                    matchDependIndexes
                };
            }
            if (regex.regex === undefined) {
                throw "regex not found";
            }
            let regexRegExp = new RegExp(regex.regex, (regex.regexFlag) ? regex.regexFlag : configuration.defaultRegexFlag);
            regexRegExp.test();
            // add hide groups
            let {sRegex, matchIndexToReal, matchNamedToReal, matchDependIndexes} = addHiddenMatchGroups(regex.regex);
            regexRegExp = new RegExp(sRegex, (regex.regexFlag) ? regex.regexFlag : configuration.defaultRegexFlag);
            regexRegExp.test();
            let decorationList = [];
            if (regex.decorations && regex.decorations.length > 0) {
                for (let decoration of regex.decorations) {
                    let index = (decoration.index) ? decoration.index : 0;
                    let hoverMessage = (decoration.hoverMessage) ? decoration.hoverMessage : undefined;
                    delete decoration.index;
                    delete decoration.hoverMessage;
                    decorationList.push({
                        index: index,
                        hoverMessage: hoverMessage,
                        decoration: this.decorations.length,
                        ranges: []
                    });
                    this.decorations.push(vscode.window.createTextEditorDecorationType(decoration));
                }
            }
            let regexList = [];
            if (regex.regexes && regex.regexes.length > 0) {
                for (let regexes of regex.regexes) {
                    regexList.push(loadRegexes(configuration, regexes));
                }
            }
            return {
                index: (regex.index) ? regex.index : 0,
                regexRegExp: regexRegExp,
                matchIndexToReal: matchIndexToReal,
                matchNamedToReal: matchNamedToReal,
                matchDependIndexes: matchDependIndexes,
                regexCount: 0,
                regexLimit: (regex.regexLimit) ? regex.regexLimit : configuration.defaultRegexLimit,
                regexes: regexList,
                decorations: decorationList
            };
        }
        // reset regex
        this.regexes.length = 0;
        this.decorations.length = 0;
        // load regexes configuration
        for (let regexList of regexesConfiguration) {
            // compile regex
            try {
                // stock languages
                let languages = (regexList.languageIds) ? regexList.languageIds : undefined;
                let regexes = [];
                if (regexList.regexes && regexList.regexes.length > 0) {
                    for (let regex of regexList.regexes) {
                        regexes.push(loadRegexes(configuration, regex));
                    }
                }
                this.regexes.push({
                    languages: languages,
                    regexes: regexes
                });
            }
            catch (error) {
                console.error(error);
                this.log(error);
                vscode.window.showErrorMessage(error.toString(), "Close");
            }
        }
    }

    log(text) {
        let date = new Date()
        this.logger.appendLine('[' +
            ("000" + date.getFullYear()).slice(-4) + '-' +
            ("0" + date.getDate()).slice(-2) + '-' +
            ("0" + (date.getMonth() + 1)).slice(-2) + ' ' +
            ("0" + date.getHours()).slice(-2) + ':' +
            ("0" + date.getMinutes()).slice(-2) + ':' +
            ("0" + date.getSeconds()).slice(-2) + '.' +
            ("00" + date.getMilliseconds()).slice(-3) + "] " +
            text);
    }

    resetDecorations(activeEditor) {
        if (!activeEditor) {
            return;
        }
        if (activeEditor.document.uri.scheme == "output") {
            return;
        }
        let recurseResetDecorations = (regex) => {
            if (regex === undefined) {
                return;
            }
            if (regex.decorations && regex.decorations.length > 0) {
                for (let decoration of regex.decorations) {
                    // reset range
                    decoration.ranges.length = 0;
                    // disable old decoration
                    activeEditor.setDecorations(this.decorations[decoration.decoration], []);
                }
            }
            if (regex.regexes && regex.regexes.length > 0) {
                for (let insideRegexes of regex.regexes) {
                    recurseResetDecorations(insideRegexes);
                }
            }
        }
        try {
            for (let regexes of this.regexes) {
                for (let regex of regexes.regexes) {
                    recurseResetDecorations(regex);
                }
            }
        }
        catch (error) {
            console.error(error);
            this.log(error);
        }
    }

    updateDecorations(editor) {
        if (!editor || !this.active) {
            return;
        }
        var recurseSearchDecorations = (regex, text, index = 0) => {
            let search;
            regex.regexCount = 0;
            while (search = regex.regexRegExp.exec(text)) {
                regex.regexCount++;
                if (regex.regexCount > regex.regexLimit) {
                    console.log("Count overload pattern: " + regex.regexRegExp.source + " > " + regex.regexLimit);
                    this.log("Count overload pattern " + regex.regexRegExp.source + " > " + regex.regexLimit);
                    break;
                }
                if (search[0].length == 0) {
                    console.error("Bad pattern: " + regex.regexRegExp.source);
                    this.log("Error: Bad pattern " + regex.regexRegExp.source);
                    break;
                }
                if (regex.decorations && regex.decorations.length > 0) {
                    for (let decoration of regex.decorations) {
                        if (decoration.decoration === undefined) {
                            continue;
                        }
                        let decorationRealIndex;
                        if (typeof decoration.index === "number") {
                            decorationRealIndex = regex.matchIndexToReal[decoration.index];
                        }
                        else {
                            decorationRealIndex = regex.matchNamedToReal[decoration.index];
                        }
                        if (decorationRealIndex < search.length && search[decorationRealIndex] && search[decorationRealIndex].length > 0) {
                            let decorationIndex = search.index;
                            for (let j = 0; j < regex.matchDependIndexes[decorationRealIndex].length; j++) {
                                if (search[regex.matchDependIndexes[decorationRealIndex][j]]) {
                                    decorationIndex += search[regex.matchDependIndexes[decorationRealIndex][j]].length;
                                }
                            }
                            decoration.ranges.push({
                                start: index + decorationIndex,
                                end: index + decorationIndex + search[decorationRealIndex].length
                            });
                        }
                    }
                }
                if (regex.regexes && regex.regexes.length > 0) {
                    for (let insideRegex of regex.regexes) {
                        let insideRegexRealIndex;
                        if (typeof insideRegex.index === "number") {
                            insideRegexRealIndex = regex.matchIndexToReal[insideRegex.index]
                        }
                        else {
                            insideRegexRealIndex = regex.matchNamedToReal[insideRegex.index];
                        }
                        if (insideRegexRealIndex < search.length && search[insideRegexRealIndex] && search[insideRegexRealIndex].length > 0) {
                            let regexIndex = search.index;
                            for (let j = 0; j < regex.matchDependIndexes[insideRegexRealIndex].length; j++) {
                                if (search[regex.matchDependIndexes[insideRegexRealIndex][j]]) {
                                    regexIndex += search[regex.matchDependIndexes[insideRegexRealIndex][j]].length;
                                }
                            }
                            recurseSearchDecorations(insideRegex, search[insideRegexRealIndex], index + regexIndex)
                        }
                    }
                }
            }
        }
        let startTime = Date.now();
        let text = editor.document.getText();
        try {
            // search all regexes
            for (let regexes of this.regexes) {
                // has regex
                if (regexes.regexes === undefined) {
                    continue;
                }
                // check language
                if (regexes.languages != undefined && regexes.languages.indexOf(editor.document.languageId) < 0) {
                    continue;
                }
                // foreach regexes
                for (let regex of regexes.regexes) {
                    recurseSearchDecorations(regex, text);
                }
            }

        }
        catch (error) {
            console.error(error);
        }

        let countDecoration = 0;
        let recurseUpdateDecorations = (regex) => {
            if (regex === undefined) {
                return;
            }
            if (regex.decorations && regex.decorations.length > 0) {
                for (let decoration of regex.decorations) {
                    // create range
                    let ranges = [];
                    for (let range of decoration.ranges) {
                        let startPosition = editor.document.positionAt(range.start);
                        let endPosition = editor.document.positionAt(range.end);
                        let vsRange = new vscode.Range(startPosition, endPosition);
                        if (decoration.hoverMessage) {
                            let htmlHovermessage = new vscode.MarkdownString();
                            htmlHovermessage.supportHtml = true;
                            htmlHovermessage.isTrusted = true;
                            if (typeof decoration.hoverMessage === "string") {
                                htmlHovermessage.appendMarkdown(decoration.hoverMessage);
                            }
                            else {
                                for (let line of decoration.hoverMessage) {
                                    htmlHovermessage.appendMarkdown(line);
                                }
                            }
                            ranges.push({
                                range: vsRange,
                                hoverMessage: htmlHovermessage
                            });
                        }
                        else {
                            ranges.push({ range: vsRange });
                        }
                    }
                    // update decoration
                    countDecoration += decoration.ranges.length;
                    editor.setDecorations(
                        this.decorations[decoration.decoration],
                        ranges
                    );
                    decoration.ranges.length = 0;
                    ranges.length = 0;
                }
            }
            if (regex.regexes && regex.regexes.length > 0) {
                for (let insideRegex of regex.regexes) {
                    recurseUpdateDecorations(insideRegex);
                }
            }
        }
        try {
            for (let regexes of this.regexes) {
                for (let regex of regexes.regexes) {
                    recurseUpdateDecorations(regex);
                }
            }
            if (countDecoration > 0) {
                this.log("Update decorations at \"" + editor.document.fileName + "\" in " + (Date.now() - startTime) + "ms with " + (countDecoration) + " occurence(s)")
            }
        }
        catch (error) {
            console.error(error);
            this.log(error);
        }
    }

    toggle(visibleTextEditors) {
        this.active = !this.active;
        if (this.active) {
            for (let i = 0; i < visibleTextEditors.length; i++) {
                this.updateDecorations(visibleTextEditors[i]);
            }
        }
        else {
            for (let i = 0; i < visibleTextEditors.length; i++) {
                this.resetDecorations(visibleTextEditors[i]);
            }
        }
    }

}; // class Parser

function activate(context) {
    const nameOfProperties = "highlight.regex";

    let configuration = vscode.workspace.getConfiguration(nameOfProperties);
    let logger = vscode.window.createOutputChannel("Highlight regex");
    let parserGlobalObj = new Parser(logger, configuration, configuration.regexes);
    let parserMachineObj = new Parser(logger, configuration, configuration.machine.regexes);
    let parserWorkspaceObj = new Parser(logger, configuration, configuration.workspace.regexes);

    context.subscriptions.push(
        vscode.commands
            .registerCommand('highlight.regex.toggle', () => {
                parserGlobalObj.toggle(vscode.window.visibleTextEditors);
                parserMachineObj.toggle(vscode.window.visibleTextEditors);
                parserWorkspaceObj.toggle(vscode.window.visibleTextEditors);
            })
    );
    context.subscriptions.push(
        vscode.commands
            .registerCommand('highlight.regex.global.toggle', () => {
                parserGlobalObj.toggle(vscode.window.visibleTextEditors);
            })
    );
    context.subscriptions.push(
        vscode.commands
            .registerCommand('highlight.regex.machine.toggle', () => {
                parserMachineObj.toggle(vscode.window.visibleTextEditors);
            })
    );
    context.subscriptions.push(
        vscode.commands
            .registerCommand('highlight.regex.workspace.toggle', () => {
                parserWorkspaceObj.toggle(vscode.window.visibleTextEditors);
            })
    );

    let lastVisibleEditors = [];
    let timeoutTimer = [];

    // first launch
    let visibleTextEditors = vscode.window.visibleTextEditors;
    for (let i = 0; i < visibleTextEditors.length; i++) {
        triggerUpdate(visibleTextEditors[i]);
    }

    // event configuration change
    vscode.workspace.onDidChangeConfiguration(event => {
        configuration = vscode.workspace.getConfiguration(nameOfProperties);
        let visibleTextEditors = vscode.window.visibleTextEditors;
        for (let i = 0; i < visibleTextEditors.length; i++) {
            parserGlobalObj.resetDecorations(visibleTextEditors[i]);
            parserMachineObj.resetDecorations(visibleTextEditors[i]);
            parserWorkspaceObj.resetDecorations(visibleTextEditors[i]);
        }
        parserGlobalObj.loadConfigurations(configuration, configuration.regexes);
        parserMachineObj.loadConfigurations(configuration, configuration.machine.regexes);
        parserWorkspaceObj.loadConfigurations(configuration, configuration.workspace.regexes);
        for (let i = 0; i < visibleTextEditors.length; i++) {
            triggerUpdate(visibleTextEditors[i]);
        }
    });

    // event change all text editor
    vscode.window.onDidChangeVisibleTextEditors(visibleTextEditors => {
        let newVisibleEditors = [];
        for (let i = 0; i < visibleTextEditors.length; i++) {
            let key = visibleTextEditors[i].document.uri.toString(true) + visibleTextEditors[i].viewColumn;
            newVisibleEditors[key] = true;
            if (!(key in lastVisibleEditors)) {
                triggerUpdate(visibleTextEditors[i]);
            }
        }
        lastVisibleEditors = newVisibleEditors;
    });

    // event change text content
    vscode.workspace.onDidChangeTextDocument(event => {
        let openEditors = vscode.window.visibleTextEditors.filter(
            (editor) => editor.document.uri === event.document.uri
        );
        for (let i = 0; i < openEditors.length; i++) {
            triggerUpdate(openEditors[i]);
        }
    });

    // trigger call update decoration
    function triggerUpdate(editor) {
        let key = editor.document.uri.toString(true) + editor.viewColumn;
        if (key in timeoutTimer && timeoutTimer[key]) {
            clearTimeout(timeoutTimer[key]);
        }
        timeoutTimer[key] = setTimeout(() => {
            parserGlobalObj.updateDecorations(editor);
            parserMachineObj.updateDecorations(editor);
            parserWorkspaceObj.updateDecorations(editor);
        }, configuration.timeout);
    }
}

function desactivate() { }

module.exports = { activate, desactivate }