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
        let rgx = contributions.regex;
        for (let i = 0; i < rgx.length; i++) {
            let rgxRegexEx;
            let rgxBlockEx;
            try {
                if (rgx[i].block) {

                    rgxBlockEx = new RegExp(rgx[i].block, (rgx[i].blockFlags) ? rgx[i].blockFlags : "gm");
                    rgxBlockEx.test();
                }
                if (rgx[i].regex) {
                    rgxRegexEx = new RegExp(rgx[i].regex, (rgx[i].regexFlags) ? rgx[i].regexFlags : "gm");
                    rgxRegexEx.test();
                }
            }
            catch (error) {
                console.error(error);
                continue ;
            }
            this.regex.push({
                block: rgxBlockEx,
                regex: rgxRegexEx,
                index: (rgx[i].index && rgx[i].index >= 0) ? rgx[i].index : 0,
                limit: (rgx[i].limit) ? rgx[i].limit : 1000,
                decoration: vscode.window.createTextEditorDecorationType(rgx[i].css),
                ranges: []
            });
        }
    }

    resetDecorations(activeEditor) {
        if (!activeEditor) {
            return ;
        }
        for (let i = 0; i < this.regex.length; i++) {
            // reset range
            this.regex[i].ranges.length = 0;
            // disable old decoration
            activeEditor.setDecorations(this.regex[i].decoration, this.regex[i].ranges);
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
        for (let i = 0; i < this.regex.length; i++) {
            // disable old decoration
            this.activeEditor.setDecorations(this.regex[i].decoration, this.regex[i].ranges);
            // reset range
            this.regex[i].ranges.length = 0;
        }
    }

    //
    // PRIVATE
    //

    // search all function in text document
    searchRegex() {
        for (let i = 0; i < this.regex.length; i++) {
            if (this.regex[i].regex === undefined) {
                continue ;
            }
            let count = 0;
            let regEx = this.regex[i].regex;
            // block
            if (this.regex[i].block) {
                let countBlock = 0;
                let searchBlock;
                while (searchBlock = this.regex[i].block.exec(this.text)) {
                    if (++countBlock > 5000 || count > this.regex[i].limit) {
                        break ;
                    }
                    if (searchBlock[0].length == 0) {
                        continue ;
                    }
                    let searchRegex;
                    while (searchRegex = regEx.exec(searchBlock[0])) {
                        if (++count > this.regex[i].limit) {
                            break ;
                        }
                        if (searchRegex[0].length == 0){
                            continue ;
                        }
                        if (searchRegex.length <= this.regex[i].index) {
                            continue ;
                        }
                        let indexStart = 0;
                        for (let j = 1; j < this.regex[i].index; j++) {
                            if (searchRegex[j]) {
                                indexStart += searchRegex[j].length;
                            }
                        }
                        let startPos = this.activeEditor.document.positionAt(searchBlock.index + searchRegex.index + indexStart);
                        let endPos = this.activeEditor.document.positionAt(searchBlock.index + searchRegex.index + indexStart + searchRegex[this.regex[i].index].length);
                        let range = { range: new vscode.Range(startPos, endPos) };
                        this.regex[i].ranges.push(range);
                    }
                }
            }
            else {
                let search;
                while (search = this.regex[i].regex.exec(this.text)) {
                    if (++count > this.regex[i].limit) {
                        break ;
                    }
                    if (search[0].length == 0) {
                        continue ;
                    }
                    if (search.length <= this.regex[i].index) {
                        continue ;
                    }
                    let indexStart = 0;
                    for (let j = 1; j < this.regex[i].index; j++) {
                        if (searchRegex[j]) {
                            indexStart += search[j].length;
                        }
                    }
                    let startPos = this.activeEditor.document.positionAt(search.index + indexStart);
                    let endPos = this.activeEditor.document.positionAt(search.index + indexStart + search[this.regex[i].index].length);
                    let range = { range: new vscode.Range(startPos, endPos) };
                    this.regex[i].ranges.push(range);
                }
            }
        }
    }

} // class Parser

exports.Parser = Parser;