const vscode = require("vscode");
class Parser {

    constructor(contributions) {
        this.activeEditor;
        this.text;
        this.regex = [];
        this.loadConfigurations(contributions);
    }

    //
    // PUBLIC
    //

    // load configuration from contributions
    loadConfigurations(contributions) {
        // reset regex
        this.regex.length = 0;
        // load regex configuration
        for (let rgx of contributions.regex) {
            let rgxRegexEx;
            let rgxBlockEx;
            try {
                if (rgx.block) {
                    rgxBlockEx = new RegExp(rgx.block, (rgx.blockFlags) ? rgx.blockFlags : "gm");
                    rgxBlockEx.test(); // just for valid regex
                }
                if (rgx.regex) {
                    rgxRegexEx = new RegExp(rgx.regex, (rgx.regexFlags) ? rgx.regexFlags : "gm");
                    rgxRegexEx.test(); // just for valid regex
                }
                this.regex.push({
                    block: rgxBlockEx,
                    regex: rgxRegexEx,
                    index: (rgx.index && rgx.index >= 0) ? rgx.index : 0,
                    limit: (rgx.limit) ? rgx.limit : 1000,
                    decoration: vscode.window.createTextEditorDecorationType(rgx.css),
                    ranges: []
                });
            }
            catch (error) {
                console.error(error);
            }
        }
    }

    resetDecorations(activeEditor) {
        if (!activeEditor) {
            return ;
        }
        for (let rgx of this.regex) {
            // reset range
            rgx.ranges.length = 0;
            // disable old decoration
            activeEditor.setDecorations(rgx.decoration, rgx.ranges);
        }
    }

    updateDecorations(activeEditor) {
        if (!activeEditor) {
            return ;
        }
        this.activeEditor = activeEditor;
        this.text = this.activeEditor.document.getText();
        // search all ranges
        this.searchRegex();
        for (let rgx of this.regex) {
            // disable old decoration
            this.activeEditor.setDecorations(rgx.decoration, rgx.ranges);
            // reset range
            rgx.ranges.length = 0;
        }
    }

    //
    // PRIVATE
    //

    // search all function in text document
    searchRegex() {
        for (let rgx of this.regex) {
            if (rgx.regex === undefined) {
                continue ;
            }
            let count = 0;
            // block
            if (rgx.block) {
                let countBlock = 0;
                let searchBlock;
                while (searchBlock = rgx.block.exec(this.text)) {
                    if (++countBlock > 5000 || count > rgx.limit) {
                        break ;
                    }
                    if (searchBlock[0].length == 0) {
                        continue ;
                    }
                    let searchRegex;
                    while (searchRegex = rgx.regex.exec(searchBlock[0])) {
                        if (++count > rgx.limit) {
                            break ;
                        }
                        if (searchRegex[0].length == 0){
                            continue ;
                        }
                        if (searchRegex.length <= rgx.index) {
                            continue ;
                        }
                        let indexStart = 0;
                        for (let j = 1; j < rgx.index; j++) {
                            if (searchRegex[j]) {
                                indexStart += searchRegex[j].length;
                            }
                        }
                        let startPos = this.activeEditor.document.positionAt(searchBlock.index + searchRegex.index + indexStart);
                        let endPos = this.activeEditor.document.positionAt(searchBlock.index + searchRegex.index + indexStart + searchRegex[rgx.index].length);
                        let range = { range: new vscode.Range(startPos, endPos) };
                        rgx.ranges.push(range);
                    }
                }
            }
            else {
                let search;
                while (search = rgx.regex.exec(this.text)) {
                    if (++count > rgx.limit) {
                        break ;
                    }
                    if (search[0].length == 0) {
                        continue ;
                    }
                    if (search.length <= rgx.index) {
                        continue ;
                    }
                    let indexStart = 0;
                    for (let j = 1; j < rgx.index; j++) {
                        if (searchRegex[j]) {
                            indexStart += search[j].length;
                        }
                    }
                    let startPos = this.activeEditor.document.positionAt(search.index + indexStart);
                    let endPos = this.activeEditor.document.positionAt(search.index + indexStart + search[rgx.index].length);
                    let range = { range: new vscode.Range(startPos, endPos) };
                    rgx.ranges.push(range);
                }
            }
        }
    }

} // class Parser

exports.Parser = Parser;