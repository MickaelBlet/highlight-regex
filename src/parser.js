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
const path = require("path");
const { throws } = require("assert");

class Parser {

    constructor(logger, configuration) {
        this.activeEditor;
        this.logger = logger;
        this.text;
        this.regexs = [];
        this.loadConfigurations(configuration);
    }

    //
    // PUBLIC
    //

    // load configuration from contributions
    loadConfigurations(configuration) {
        // reset regex
        this.regexs.length = 0;
        // load regex configuration
        for (let rgx of configuration.regexs) {
            try {
                let rgxRegexEx;
                let rgxBlocks = [];
                if (rgx.blocks) {
                    for (let block of rgx.blocks) {
                        if (block.regex) {
                            try {
                                let rgxBlockEx;
                                rgxBlockEx = new RegExp(block.regex, (block.regexFlag) ? rgx.regexFlag : configuration.defaultBlockFlag);
                                rgxBlockEx.test(); // just for valid regex
                                this.log(block.regex);
                                this.log(block.regexFlag);
                                this.log(block.regexLimit);
                                rgxBlocks.push({
                                    regex: rgxBlockEx,
                                    regexLimit: (block.regexLimit) ? block.regexLimit : configuration.defaultBlockLimit
                                });
                            }
                            catch (error) {
                                console.error(error);
                                this.log(error);
                            }
                        }
                    }
                }
                if (rgx.regex) {
                    rgxRegexEx = new RegExp(rgx.regex, (rgx.regexFlag) ? rgx.regexFlag : configuration.defaultRegexFlag);
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
                    blocks: rgxBlocks,
                    regex: rgxRegexEx,
                    regexLimit: (rgx.regexLimit) ? rgx.regexLimit : configuration.defaultRegexLimit,
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
            return;
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
            return;
        }
        if (activeEditor.document.uri.scheme == "output") {
            return;
        }
        let startTime = Date.now();
        this.activeEditor = activeEditor;
        this.text = this.activeEditor.document.getText();
        let countRange = 0;
        // search all ranges
        for (let rgx of this.regexs) {
            if (rgx.language != "*") {
                // check if language match
                let searchLanguage = "(?:^|[|])(" + this.activeEditor.document.languageId + ")(?:$|[|])";
                let rgxLanguage = new RegExp(searchLanguage, "gmi");
                if (!rgxLanguage.test(rgx.language)) {
                    continue;
                }
            }
            if (rgx.regex === undefined) {
                continue;
            }
            if (rgx.blocks.length > 0) {
                this.searchBlocks(rgx, this.text);
            }
            else {
                this.searchRegex(rgx, this.text, 0);
            }
        }
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
    searchBlocks(rgx, text, searchIndex=0, index=0) {
        let count = 0;
        let search;

        while (search = rgx.blocks[index].regex.exec(text)) {
            if (++count > rgx.blocks[index].regexLimit) {
                break;
            }
            if (search[0].length == 0) {
                continue;
            }
            if (index + 1 < rgx.blocks.length) {
                this.searchBlocks(rgx, search[0], searchIndex + search.index, index + 1);
            }
            else {
                this.searchRegex(rgx, search[0], searchIndex + search.index);
            }
        }
    }

    // search all function in text document
    searchRegex(rgx, text, index) {
        let count = 0;
        let search;
        while (search = rgx.regex.exec(text)) {
            if (++count > rgx.regexLimit) {
                break;
            }
            if (search[0].length == 0) {
                continue;
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
            for (let decoration of rgx.decorations) {
                if (search[decoration.index] && indexStart[decoration.index] != indexEnd[decoration.index]) {
                    let startPos = this.activeEditor.document.positionAt(index + indexStart[decoration.index]);
                    let endPos = this.activeEditor.document.positionAt(index + indexEnd[decoration.index]);
                    let range = { range: new vscode.Range(startPos, endPos) };
                    decoration.ranges.push(range);
                }
            }
        }
    }

} // class Parser

exports.Parser = Parser;