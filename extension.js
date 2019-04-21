const vscode = require("vscode");
const parser_1 = require("./parser/parser");

function activate(context) {
    let activeEditor;
    let contributions = vscode.workspace.getConfiguration('mblet-regex-hightlight');
    let parser = new parser_1.Parser(contributions);

    // function call by triggerUpdateDecorations
    let updateDecorations = function (useHash = false) {
        if (!activeEditor) {
            return ;
        }
        parser.updateDecorations(activeEditor);
    };

    // first launch
    if (vscode.window.visibleTextEditors.length > 0) {
        let textEditors = vscode.window.visibleTextEditors;
        for (let i = 0 ; i < textEditors.length ; i++) {
            parser.updateDecorations(textEditors[i]);
        }
    }

    // set first activeEditor
    if (vscode.window.activeTextEditor) {
        activeEditor = vscode.window.activeTextEditor;
    }

    // event configuration change
    vscode.workspace.onDidChangeConfiguration(event => {
        contributions = vscode.workspace.getConfiguration('mblet-regex-hightlight');
        let textEditors = vscode.window.visibleTextEditors;
        for (let i = 0 ; i < textEditors.length ; i++) {
            parser.resetDecorations(textEditors[i]);
        }
        parser.loadConfigurations(contributions);
        for (let i = 0 ; i < textEditors.length ; i++) {
            parser.updateDecorations(textEditors[i]);
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
            parser.updateDecorations(textEditors[i]);
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