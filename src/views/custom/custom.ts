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
import CustomTreeDataProvider from './custom-tree-provider';
import CustomFileDecorationProvider from './custom-decoration';

export default class Custom {
    index: number;
    propertyName: string;
    uri: string | undefined;
    treeDataProvider: CustomTreeDataProvider;
    tree: vscode.TreeView<any>;

    constructor(index: number) {
        this.index = index;
        vscode.commands.executeCommand(`setContext`, `highlight.regex.custom${this.index}.active`, false);

        this.propertyName = `${extensionId}.custom${index}`;
        this.uri = undefined;
        this.treeDataProvider = new CustomTreeDataProvider(index - 1);
        this.tree = vscode.window.createTreeView(`${extensionId}.view.custom${index}`, {
            treeDataProvider: this.treeDataProvider
        });

        vscode.window.registerFileDecorationProvider(
            new CustomFileDecorationProvider(index - 1)
        );

        this.tree.onDidChangeSelection((e) => {
            if (e.selection && e.selection.length === 1) {
                let select = e.selection[0];
                if (select.context !== undefined && select.context == 'selectToEditor') {
                    vscode.workspace.openTextDocument(vscode.Uri.parse(this.uri!)).then(doc => {
                        vscode.window.showTextDocument(doc).then(editor => {
                            editor.selection = new vscode.Selection(
                                select.range.start,
                                select.range.end
                            );
                            editor.revealRange(select.range,
                                vscode.TextEditorRevealType.InCenter);
                        });
                    });
                }
            }
        });
    }

    loadConfiguration(): void {
        let configurationUri = vscode.workspace.getConfiguration(this.propertyName)?.uri;
        if (configurationUri) {
            this.tree.description = configurationUri;
            this.update(configurationUri);
        }
    }

    update(uri: string | undefined): void {
        // find editor of target
        this.uri = uri;
        // take all ranges from cached informations of scope parser
        this.treeDataProvider.updateUri(uri);
        // set configuration
        vscode.workspace.getConfiguration().update(
            this.propertyName + '.uri',
            this.uri
        );
        // set active tree buttons
        vscode.commands.executeCommand(`setContext`, `highlight.regex.custom${this.index}.active`, true);
    }

    clear(): void {
        this.uri = undefined;
        this.treeDataProvider.updateUri(undefined);
        vscode.workspace.getConfiguration().update(
            this.propertyName + '.uri',
            undefined
        );
        vscode.commands.executeCommand(`setContext`, `highlight.regex.custom${this.index}.active`, false);
    }

}
