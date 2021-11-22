/*
MIT License

Copyright (c) 2021 Mickaël Blet

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
const path = require("path");

class Parser {

    constructor(logger, contributions) {
        this.activeEditor;
        this.logger = logger;
        this.text;
        this.regexs = [];
        this.loadConfigurations(contributions);
    }

    //
    // PUBLIC
    //

    // load configuration from contributions
    loadConfigurations(contributions) {
        // reset regex
        this.regexs.length = 0;
        // load regex configuration
        for (let rgx of contributions.regexs) {
            let rgxRegexEx;
            let rgxBlockEx;
            try {
                if (rgx.block) {
                    rgxBlockEx = new RegExp(rgx.block, (rgx.blockFlag) ? rgx.blockFlag : "gm");
                    rgxBlockEx.test(); // just for valid regex
                }
                if (rgx.regex) {
                    rgxRegexEx = new RegExp(rgx.regex, (rgx.regexFlag) ? rgx.regexFlag : "gm");
                    rgxRegexEx.test(); // just for valid regex
                }
                let decorations = [];
                for (let decoration of rgx.decorations) {
                    let index = (decoration.index) ? decoration.index : 0;
                    delete decoration.index;
                    decorations.push({
                        index: index,
                        decoration: vscode.window.createTextEditorDecorationType(decoration),
                        ranges: []
                    });
                }
                this.regexs.push({
                    language: (rgx.language) ? rgx.language : "*",
                    block: rgxBlockEx,
                    regex: rgxRegexEx,
                    regexLimit: (rgx.regexLimit) ? rgx.regexLimit : 50000,
                    blockLimit: (rgx.blockLimit) ? rgx.blockLimit : 50000,
                    decorations: decorations
                });
            }
            catch (error) {
                console.error(error);
                this.log(error);
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
            return ;
        }
        for (let rgx of this.regexs) {
            for (let decoration of rgx.decorations) {
                // reset range
                decoration.ranges.length = 0;
                // disable old decoration
                activeEditor.setDecorations(decoration.decoration, decoration.ranges);
            }
        }
    }

    updateDecorations(activeEditor) {
        if (!activeEditor) {
            return ;
        }
        if (activeEditor.document.uri.scheme == "output") {
            return ;
        }
        let startTime = Date.now();
        this.activeEditor = activeEditor;
        this.text = this.activeEditor.document.getText();
        let countRange = 0;
        // search all ranges
        this.searchRegex();
        for (let rgx of this.regexs) {
            for (let decoration of rgx.decorations) {
                // update decoration
                activeEditor.setDecorations(decoration.decoration, decoration.ranges);
                countRange = countRange + decoration.ranges.length;
                // reset range
                decoration.ranges.length = 0;
            }
        }
        // log time
        this.log("Update decorations at \"" + path.basename(activeEditor.document.fileName) + "\" in " + (Date.now() - startTime) + "ms with " + (countRange) + " occurence(s)")
    }

    //
    // PRIVATE
    //

    // search all function in text document
    searchRegex() {
        for (let rgx of this.regexs) {
            if (rgx.language != "*") {
                // check if language match
                let searchLanguage = "(?:^|[|])(" + this.activeEditor.document.languageId + ")(?:$|[|])";
                let rgxLanguage = new RegExp(searchLanguage, "gmi");
                if (!rgxLanguage.test(rgx.language)) {
                    continue ;
                }
            }
            if (rgx.regex === undefined) {
                continue ;
            }
            // block
            if (rgx.block) {
                let countBlock = 0;
                let searchBlock;
                while (searchBlock = rgx.block.exec(this.text)) {
                    if (++countBlock > rgx.blockLimit) {
                        break ;
                    }
                    if (searchBlock[0].length == 0) {
                        continue ;
                    }
                    let count = 0;
                    let searchRegex;
                    while (searchRegex = rgx.regex.exec(searchBlock[0])) {
                        if (++count > rgx.regexLimit) {
                            break ;
                        }
                        if (searchRegex[0].length == 0){
                            continue ;
                        }
                        let indexCount = searchRegex.index;
                        let indexStart = [];
                        let indexEnd = [];
                        indexStart.push(searchRegex.index);
                        indexEnd.push(searchRegex.index + searchRegex[0].length);
                        for (let j = 1; j < searchRegex.length; j++) {
                            indexStart.push(indexCount);
                            if (searchRegex[j]) {
                                indexCount += searchRegex[j].length;
                            }
                            indexEnd.push(indexCount);
                        }
                        for (let decoration of rgx.decorations) {
                            if (searchRegex[decoration.index] && indexStart[decoration.index] != indexEnd[decoration.index]) {
                                let startPos = this.activeEditor.document.positionAt(searchBlock.index + indexStart[decoration.index]);
                                let endPos = this.activeEditor.document.positionAt(searchBlock.index + indexEnd[decoration.index]);
                                let range = { range: new vscode.Range(startPos, endPos) };
                                decoration.ranges.push(range);
                            }
                        }
                    }
                }
            }
            else {
                let count = 0;
                let searchRegex;
                while (searchRegex = rgx.regex.exec(this.text)) {
                    if (++count > rgx.regexLimit) {
                        break ;
                    }
                    if (searchRegex[0].length == 0){
                        continue ;
                    }
                    let indexCount = searchRegex.index;
                    let indexStart = [];
                    let indexEnd = [];
                    indexStart.push(searchRegex.index);
                    indexEnd.push(searchRegex.index + searchRegex[0].length);
                    for (let j = 1; j < searchRegex.length; j++) {
                        indexStart.push(indexCount);
                        if (searchRegex[j]) {
                            indexCount += searchRegex[j].length;
                        }
                        indexEnd.push(indexCount);
                    }
                    for (let decoration of rgx.decorations) {
                        if (searchRegex[decoration.index] && indexStart[decoration.index] != indexEnd[decoration.index]) {
                            let startPos = this.activeEditor.document.positionAt(indexStart[decoration.index]);
                            let endPos = this.activeEditor.document.positionAt(indexEnd[decoration.index]);
                            let range = { range: new vscode.Range(startPos, endPos) };
                            decoration.ranges.push(range);
                        }
                    }
                }
            }
        }
    }

} // class Parser

exports.Parser = Parser;