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

import * as vscode from 'vscode';
import { extensionId } from '../../constants';
import ActiveTreeDataProvider from './active-tree-provider';
import ActiveFileDecorationProvider from './active-decoration';

export default class Active {
    treeDataProvider: ActiveTreeDataProvider;
    tree: vscode.TreeView<any>;

    constructor() {
        this.treeDataProvider = new ActiveTreeDataProvider();
        this.tree = vscode.window.createTreeView(`${extensionId}.view.active`, {
            treeDataProvider: this.treeDataProvider,
            showCollapseAll: true
        });

        // manager.context.subscriptions.push(
        vscode.window.registerFileDecorationProvider(
            new ActiveFileDecorationProvider()
        );
        // );

        this.tree.onDidChangeSelection((e) => {
            if (e.selection && e.selection.length === 1) {
                let select = e.selection[0];
                if (select.context !== undefined && select.context == 'selectToEditor') {
                    vscode.window.activeTextEditor!.selection = new vscode.Selection(
                        select.range.start,
                        select.range.end
                    );
                    vscode.window.activeTextEditor!.revealRange(select.range,
                        vscode.TextEditorRevealType.InCenter);
                }
            }
        })
    }

    update(activeEditor: vscode.TextEditor | undefined): void {
        // take all ranges from cached informations of scope parser
        this.treeDataProvider.updateActiveEditor(activeEditor);
    }

}
