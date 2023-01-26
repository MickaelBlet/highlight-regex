/*
MIT License

Copyright (c) 2022 Mickaël Blet

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

    constructor(logger, configuration) {
        this.logger = logger;
        this.regexes = [];
        this.decorations = [];
        this.loadConfigurations(configuration);
    }

    //
    // PUBLIC
    //

    // load configuration from contributions
    loadConfigurations(configuration) {
        let loadRegexes = (configuration, regex) => {
            let regexRegExp = new RegExp(regex.regex, (regex.regexFlag) ? regex.regexFlag : configuration.defaultRegexFlag);
            regexRegExp.test();
            let decorationList = [];
            if (regex.decorations && regex.decorations.length > 0) {
                for (let decoration of regex.decorations) {
                    let index = (decoration.index) ? decoration.index : 0;
                    delete decoration.index;
                    decorationList.push({
                        index: index,
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
        for (let regexList of configuration.regexes) {
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
        if (!editor) {
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
                let indexCount = search.index;
                let indexStart = [];
                let indexEnd = [];
                indexStart.push(search.index);
                indexEnd.push(search.index + search[0].length);
                for (let j = 1; j < search.length; j++) {
                    indexStart.push(indexCount);
                    if (search[j]) {
                        indexCount += search[j].length;
                    }
                    indexEnd.push(indexCount);
                }
                if (regex.decorations && regex.decorations.length > 0) {
                    for (let decoration of regex.decorations) {
                        if (decoration.decoration === undefined) {
                            continue;
                        }
                        if (decoration.index < search.length && indexStart[decoration.index] != indexEnd[decoration.index]) {
                            decoration.ranges.push({
                                start: index + indexStart[decoration.index],
                                end: index + indexEnd[decoration.index]
                            });
                        }
                    }
                }
                if (regex.regexes && regex.regexes.length > 0) {
                    for (let insideRegex of regex.regexes) {
                        if (insideRegex.index < search.length && indexStart[insideRegex.index] != indexEnd[insideRegex.index]) {
                            recurseSearchDecorations(insideRegex, search[insideRegex.index], index + indexStart[insideRegex.index])
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
                        ranges.push({ range: vsRange });
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

}; // class Parser

function activate(context) {
    const nameOfProperties = "highlight.regex";

    let configuration = vscode.workspace.getConfiguration(nameOfProperties);
    let logger = vscode.window.createOutputChannel("Highlight regex");
    let parserObj = new Parser(logger, configuration);

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
            parserObj.resetDecorations(visibleTextEditors[i]);
        }
        parserObj.loadConfigurations(configuration);
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
        timeoutTimer[key] = setTimeout(() => { parserObj.updateDecorations(editor) }, configuration.timeout);
    }
}

function desactivate() { }

module.exports = { activate, desactivate }