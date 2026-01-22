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
import VisibleTreeDataProvider from './visible-tree-provider';
import VisibleFileDecorationProvider from './visible-decoration';

export default class Visible {
    treeDataProvider: VisibleTreeDataProvider;
    tree: vscode.TreeView<any>;
    mode: boolean;

    constructor(configuration: vscode.WorkspaceConfiguration) {
        this.treeDataProvider = new VisibleTreeDataProvider();
        this.tree = vscode.window.createTreeView(`${extensionId}.view.visible`, {
            treeDataProvider: this.treeDataProvider,
            showCollapseAll: true
        });
        vscode.window.registerFileDecorationProvider(
            new VisibleFileDecorationProvider()
        );

        this.tree.onDidChangeSelection(this.onDidChangeSelection);

        if ('tree' === configuration.visibleTreeviewMode) {
            this.mode = false;
        }
        else {
            this.mode = true;
        }

        vscode.commands.executeCommand(`setContext`, `highlight.regex.visible.listView.active`, this.mode);
    }

    onDidChangeSelection(e: vscode.TreeViewSelectionChangeEvent<any>): void {
        if (e.selection && e.selection.length === 1) {
            let select = e.selection[0];
            if (select.context !== undefined && select.context == 'selectToEditor') {
                select.editor.selection = new vscode.Selection(
                    select.range.start,
                    select.range.end
                );
                select.editor.revealRange(select.range,
                    vscode.TextEditorRevealType.InCenter);
            }
        }
    }

    update(visibleEditors: readonly vscode.TextEditor[] | undefined): void {
        // take all ranges from cached informations of scope parser
        this.treeDataProvider.updateVisibleEditors(visibleEditors);
    }

    refresh(): void {
        this.treeDataProvider.refresh();
    }

}
