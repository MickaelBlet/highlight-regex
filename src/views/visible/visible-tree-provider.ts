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

export default class VisibleTreeDataProvider implements vscode.TreeDataProvider<TreeItemChild> {
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

    updateVisibleEditors(visibleEditors: readonly vscode.TextEditor[] | undefined): void {
        log.debug(`Visible: TreeView: updateVisibleEditors`);
        if (visibleEditors === undefined) {
            this.items = [];
            return;
        }
        let editors: TreeItemChild[] = [];
        if (!manager.visible.mode) {
            for (let v = 0; v < visibleEditors.length; v++) {
                let description = "";
                try {
                    // search editor uri on tabgroups
                    let i = 0;
                    for (; i < vscode.window.tabGroups.all.length; i++) {
                        let j = 0;
                        for (; j < vscode.window.tabGroups.all[i].tabs.length; j++) {
                            if (vscode.window.tabGroups.all[i].tabs[j].input !== undefined &&
                                (vscode.window.tabGroups.all[i].tabs[j].input as any).uri !== undefined &&
                                (vscode.window.tabGroups.all[i].tabs[j].input as any).uri.toString(true) === visibleEditors[v].document.uri.toString(true)) {
                                description = vscode.window.tabGroups.all[i].tabs[j].label;
                                break;
                            }
                        }
                        if (j < vscode.window.tabGroups.all[i].tabs.length) {
                            break;
                        }
                    }
                    if (i == vscode.window.tabGroups.all.length) {
                        description = basename(visibleEditors[v].document.uri.path);
                    }
                }
                catch (error) {
                    log.error(`${error}`);
                }
                try {
                    let activeEditorKey = visibleEditors[v].document.uri.toString(true);
                    log.debug(`- ${activeEditorKey}`);
                    let items = buildRegexItems(activeEditorKey, {
                        detail: manager.visible.detail,
                        badgeUri: `highlight.regex.treeview.visible.uri:${manager.visible.tree.description}`,
                        editor: visibleEditors[v]
                    });
                    if (items.length > 0) {
                        editors.push({
                            label: `${description}`,
                            iconPath: visibleEditors[v].document.uri.scheme == 'file' ? new vscode.ThemeIcon('symbol-file') : new vscode.ThemeIcon('symbol-misc'),
                            tooltip: `${description}`,
                            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                            resourceUri: vscode.Uri.parse(`highlight.regex.treeview.visible.file.uri:${manager.visible.tree.description}?${items.length}`, true),
                            childrens: items
                        });
                    }
                }
                catch (error) {
                    log.error(`${error}`);
                }
            }
            editors.sort((a, b) => {
                if (a.label! > b.label!) return 1;
                if (a.label! < b.label!) return -1;
                return 0;
            });
        }
        else {
            let items: TreeItemChild[] = [];
            for (let v = 0; v < visibleEditors.length; v++) {
                let description = "";
                try {
                    // search editor uri on tabgroups
                    let i = 0;
                    for (; i < vscode.window.tabGroups.all.length; i++) {
                        let j = 0;
                        for (; j < vscode.window.tabGroups.all[i].tabs.length; j++) {
                            if (vscode.window.tabGroups.all[i].tabs[j].input !== undefined &&
                                (vscode.window.tabGroups.all[i].tabs[j].input as any).uri !== undefined &&
                                (vscode.window.tabGroups.all[i].tabs[j].input as any).uri.toString(true) === visibleEditors[v].document.uri.toString(true)) {
                                description = vscode.window.tabGroups.all[i].tabs[j].label;
                                break;
                            }
                        }
                        if (j < vscode.window.tabGroups.all[i].tabs.length) {
                            break;
                        }
                    }
                    if (i == vscode.window.tabGroups.all.length) {
                        description = basename(visibleEditors[v].document.uri.fsPath);
                    }
                }
                catch (error) {
                    log.error(`${error}`);
                }
                try {
                    let activeEditorKey = visibleEditors[v].document.uri.toString(true);
                    log.debug(`- ${activeEditorKey}`);
                    items.push(...buildRegexItems(activeEditorKey, {
                        detail: manager.visible.detail,
                        badgeUri: `highlight.regex.treeview.visible.uri:${manager.visible.tree.title}`,
                        editor: visibleEditors[v],
                        description: description
                    }));
                }
                catch (error) {
                    log.error(`${error}`);
                }
            }
            items.sort((a, b) => {
                if (a.description! > b.description!) return 1;
                if (a.description! < b.description!) return -1;
                return 0;
            });
            editors = items;
        }
        this.items = editors;
        manager.visible.tree.badge = {
            value: editors.length,
            tooltip: ""
        };
        this.refresh();
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }
}
