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
import { log } from '../../logger'
import { manager } from '../../manager';
import { basename } from '../../utils/basename';

export default class CustomQuickPick {
    quickpick: vscode.QuickPick<vscode.QuickPickItem>;
    custom_id: number | undefined;
    visible: boolean;

    constructor() {
        this.quickpick = vscode.window.createQuickPick();
        this.quickpick.placeholder = 'Name of file or uri';
        this.quickpick.title = 'Choose your uri on cache';
        this.quickpick.matchOnDescription = true;
        this.quickpick.matchOnDetail = true;
        this.custom_id = undefined;
        this.visible = false;
        let that = this;
        this.quickpick.onDidAccept(() => {
            log.debug('customQuickpick: onDidAccept');
            if (that.custom_id !== undefined && 1 === that.quickpick.selectedItems.length) {
                const custom = manager.customs[that.custom_id];
                custom.update(that.quickpick.selectedItems[0].description);
            }
            that.quickpick.hide();
        });
        this.quickpick.onDidHide(() => {
            log.debug('customQuickpick: onDidHide');
            that.visible = false;
            that.quickpick.hide();
        });
    }

    updateItems(custom_id: number, activeEditor: vscode.TextEditor | undefined): void {
        function uriLabelExists(items: vscode.QuickPickItem[], uri: string): boolean {
            for (let i = 0; i < items.length; i++) {
                if (items[i].description === uri) {
                    return true;
                }
            }
            return false;
        }

        let items: vscode.QuickPickItem[] = [];
        if (activeEditor) {
            const uriStr = activeEditor.document.uri.toString(true);
            // separator
            items.push({ label: `active`, kind: -1 as any });
            items.push({
                label: basename(activeEditor.document.uri.path),
                description: uriStr,
                iconPath: activeEditor.document.uri.scheme == 'file' ? new vscode.ThemeIcon('symbol-file') : new vscode.ThemeIcon('symbol-misc')
            });
        }

        // separator
        items.push({ label: `visible`, kind: -1 as any });
        for (let i = 0; i < vscode.window.visibleTextEditors.length; i++) {
            const editor = vscode.window.visibleTextEditors[i];
            const uri = editor.document.uri.toString(true);
            if (!uriLabelExists(items, uri)) {
                items.push({
                    label: basename(editor.document.uri.path),
                    description: uri,
                    iconPath: editor.document.uri.scheme == 'file' ? new vscode.ThemeIcon('symbol-file') : new vscode.ThemeIcon('symbol-misc')
                });
            }
        }

        for (let scopeKey in manager.scopeManager.map) {
            if (manager.scopeManager.map.hasOwnProperty(scopeKey)) {
                // separator
                items.push({ label: `Tab ${scopeKey}`, kind: -1 as any });
                const cacheEditors = manager.scopeManager.map[scopeKey].parser.cacheEditors;
                for (let i = 0; i < vscode.window.tabGroups.all.length; i++) {
                    let j = 0;
                    for (; j < vscode.window.tabGroups.all[i].tabs.length; j++) {
                        if (vscode.window.tabGroups.all[i].tabs[j].input !== undefined &&
                            (vscode.window.tabGroups.all[i].tabs[j].input as any).uri !== undefined) {
                            const uri = (vscode.window.tabGroups.all[i].tabs[j].input as any).uri.toString(true);
                            if (uri in cacheEditors && !uriLabelExists(items, uri)) {
                                const vsUri = vscode.Uri.parse(uri);
                                items.push({
                                    label: basename(vsUri.path),
                                    description: uri,
                                    iconPath: vsUri.scheme == 'file' ? new vscode.ThemeIcon('symbol-file') : new vscode.ThemeIcon('symbol-misc')
                                });
                            }
                        }
                    }
                }
            }
        }

        for (let scopeKey in manager.scopeManager.map) {
            if (manager.scopeManager.map.hasOwnProperty(scopeKey)) {
                // separator
                items.push({ label: `Cached ${scopeKey}`, kind: -1 as any });
                const cacheEditors = manager.scopeManager.map[scopeKey].parser.cacheEditors;
                for (let cacheEditor in cacheEditors) {
                    if (cacheEditors.hasOwnProperty(cacheEditor) && cacheEditors[cacheEditor].ranges.length > 0 && !uriLabelExists(items, cacheEditor)) {
                        const vsUri = vscode.Uri.parse(cacheEditor);
                        items.push({
                            label: basename(vsUri.path),
                            description: cacheEditor,
                            iconPath: vsUri.scheme == 'file' ? new vscode.ThemeIcon('symbol-file') : new vscode.ThemeIcon('symbol-misc')
                        });
                    }
                }
            }
        }

        this.custom_id = custom_id;
        this.quickpick.items = items;
    }
}
