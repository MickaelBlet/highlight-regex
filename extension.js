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
const parser = require("./src/parser");

const nameOfProperties = "highlight-regex";

function activate(context) {
    let activeEditor;
    let logger = vscode.window.createOutputChannel("Highlight regex");
    let contributions = vscode.workspace.getConfiguration(nameOfProperties);
    let parserObj = new parser.Parser(logger, contributions);

    // function call by triggerUpdateDecorations
    let updateDecorations = function (useHash = false) {
        if (!activeEditor) {
            return ;
        }
        parserObj.updateDecorations(activeEditor);
    };

    // first launch
    if (vscode.window.visibleTextEditors.length > 0) {
        let textEditors = vscode.window.visibleTextEditors;
        for (let i = 0 ; i < textEditors.length ; i++) {
            parserObj.updateDecorations(textEditors[i]);
        }
    }

    // set first activeEditor
    if (vscode.window.activeTextEditor) {
        activeEditor = vscode.window.activeTextEditor;
    }

    // event configuration change
    vscode.workspace.onDidChangeConfiguration(event => {
        contributions = vscode.workspace.getConfiguration(nameOfProperties);
        let textEditors = vscode.window.visibleTextEditors;
        for (let i = 0 ; i < textEditors.length ; i++) {
            parserObj.resetDecorations(textEditors[i]);
        }
        parserObj.loadConfigurations(contributions);
        for (let i = 0 ; i < textEditors.length ; i++) {
            parserObj.updateDecorations(textEditors[i]);
        }
    });

    // event change text editor focus
    vscode.window.onDidChangeActiveTextEditor(editor => {
        activeEditor = editor;
        if (editor) {
            triggerUpdateDecorations();
        }
    }, null, context.subscriptions);

    // event change all text editor
    vscode.window.onDidChangeVisibleTextEditors(editors => {
        let textEditors = editors;
        for (let i = 0 ; i < textEditors.length ; i++) {
            parserObj.updateDecorations(textEditors[i]);
        }
    });

    // event change text content
    vscode.workspace.onDidChangeTextDocument(event => {
        if (activeEditor && event.document === activeEditor.document) {
            triggerUpdateDecorations();
        }
    });

    // trigger call update decoration
    var timeout;
    function triggerUpdateDecorations() {
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(updateDecorations, contributions.setTimeout);
    }
}

function desactivate() {}

module.exports = {
    activate,
    desactivate
}