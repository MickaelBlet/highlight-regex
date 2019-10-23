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
                let decorations = [];
                for (let css of rgx.css) {
                    let index = (css.index) ? css.index : 0;
                    delete css.index;
                    decorations.push({
                        index: index,
                        decoration: vscode.window.createTextEditorDecorationType(css),
                        ranges: []
                    });
                }
                this.regex.push({
                    language: (rgx.language) ? rgx.language : "*",
                    block: rgxBlockEx,
                    regex: rgxRegexEx,
                    limit: (rgx.limit) ? rgx.limit : 1000,
                    decorations: decorations
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
        this.activeEditor = activeEditor;
        this.text = this.activeEditor.document.getText();
        // search all ranges
        this.searchRegex();
        for (let rgx of this.regex) {
            for (let decoration of rgx.decorations) {
                // update decoration
                activeEditor.setDecorations(decoration.decoration, decoration.ranges);
                // reset range
                decoration.ranges.length = 0;
            }
        }
    }

    //
    // PRIVATE
    //

    // search all function in text document
    searchRegex() {
        for (let rgx of this.regex) {
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
            let count = 0;
            // block
            if (rgx.block) {
                let countBlock = 0;
                let searchBlock;
                while (searchBlock = rgx.block.exec(this.text)) {
                    if (++countBlock > 50000 || count > rgx.limit) {
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
                let searchRegex;
                while (searchRegex = rgx.regex.exec(this.text)) {
                    if (++count > rgx.limit) {
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