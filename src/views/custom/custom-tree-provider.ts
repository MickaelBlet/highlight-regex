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
import { basename } from '../../utils/basename';
import { TreeItemChild, buildRegexItems } from '../../treeview/occurrence-tree';

export default class CustomTreeDataProvider implements vscode.TreeDataProvider<TreeItemChild> {
    index: number;
    items: TreeItemChild[];
    private _onDidChangeTreeData: vscode.EventEmitter<TreeItemChild | undefined | null | void>;
    readonly onDidChangeTreeData: vscode.Event<TreeItemChild | undefined | null | void>;

    constructor(index: number) {
        this.index = index;
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

    updateUri(uri: string | undefined): void {
        log.debug(`Custom: TreeView: updateUri: ${uri}`);
        if (undefined === uri) {
            this.items = [];
            manager.customs[this.index].tree.description = '';
            manager.customs[this.index].tree.badge = {
                value: 0,
                tooltip: ""
            };
            this.refresh();
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
                        (vscode.window.tabGroups.all[i].tabs[j].input as any).uri.toString(true) === uri) {
                        manager.customs[this.index].tree.description = vscode.window.tabGroups.all[i].tabs[j].label;
                        break;
                    }
                }
                if (j < vscode.window.tabGroups.all[i].tabs.length) {
                    break;
                }
            }
            if (i == vscode.window.tabGroups.all.length) {
                manager.customs[this.index].tree.description = basename(vscode.Uri.parse(uri).path);
            }
        }
        catch (error) {
            log.error(`${error}`);
        }

        let items: TreeItemChild[] = [];
        try {
            items = buildRegexItems(uri, {
                detail: manager.customs[this.index].detail,
                badgeUri: `highlight.regex.treeview.custom${this.index}.uri:custom`
            });
        }
        catch (error) {
            log.error(`${error}`);
        }
        this.items = items;
        manager.customs[this.index].tree.badge = {
            value: items.length,
            tooltip: ""
        };
        this.refresh();
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }
}
