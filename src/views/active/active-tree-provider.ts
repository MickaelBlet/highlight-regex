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
import { log } from '../../logger';
import { manager } from '../../manager';
import { TreeItemChild, buildRegexItems } from '../../treeview/occurrence-tree';

export default class ActiveTreeDataProvider implements vscode.TreeDataProvider<TreeItemChild> {
    items: TreeItemChild[];
    private _onDidChangeTreeData: vscode.EventEmitter<TreeItemChild | undefined | null | void>;
    readonly onDidChangeTreeData: vscode.Event<TreeItemChild | undefined | null | void>;

    constructor() {
        this.items = [];
        // refresh event
        this._onDidChangeTreeData = new vscode.EventEmitter<TreeItemChild | undefined | null | void>();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    getTreeItem(element: TreeItemChild): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TreeItemChild): TreeItemChild[] | undefined {
        if (element) {
            return element.childrens;
        }
        else {
            return this.items;
        }
    }

    getParent(element: TreeItemChild): TreeItemChild {
        return element;
    }

    updateActiveEditor(activeEditor: vscode.TextEditor | undefined): void {
        log.debug(`Active: TreeView: updateActiveEditor: ${activeEditor?.document.uri.toString(true)}`);
        if (activeEditor === undefined) {
            this.items = [];
            return;
        }
        try {
            // search editor uri on tabgroups
            let i = 0;
            for (; i < vscode.window.tabGroups.all.length; i++) {
                let j = 0;
                for (; j < vscode.window.tabGroups.all[i].tabs.length; j++) {
                    if (vscode.window.tabGroups.all[i].tabs[j].input !== undefined &&
                        (vscode.window.tabGroups.all[i].tabs[j].input as any).uri !== undefined &&
                        (vscode.window.tabGroups.all[i].tabs[j].input as any).uri.toString(true) === activeEditor.document.uri.toString(true)) {
                        manager.active.tree.description = vscode.window.tabGroups.all[i].tabs[j].label;
                        break;
                    }
                }
                if (j < vscode.window.tabGroups.all[i].tabs.length) {
                    break;
                }
            }
            if (i == vscode.window.tabGroups.all.length) {
                manager.active.tree.description = activeEditor.document.uri.fsPath;
            }
        }
        catch (error) {
            log.error(`${error}`);
        }
        let items: TreeItemChild[] = [];
        try {
            items = buildRegexItems(activeEditor.document.uri.toString(true), {
                detail: manager.active.detail,
                badgeUri: `highlight.regex.treeview.uri:${manager.active.tree.description}`
            });
        }
        catch (error) {
            log.error(`${error}`);
        }
        this.items = items;
        manager.active.tree.badge = {
            value: items.length,
            tooltip: ""
        };
        this.refresh();
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }
}
