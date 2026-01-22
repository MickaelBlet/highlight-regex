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
import { extensionId } from '../../constants';
import { ScopeManager } from '../../core/scope';

interface QuickPickItemCustom extends vscode.QuickPickItem {
    scope?: string;
    index?: number;
    picked?: boolean;
}

export default class QuickPick {
    scopeManager: ScopeManager;
    quickpick: vscode.QuickPick<QuickPickItemCustom>;
    visible: boolean;
    activeEditorItems: any[];

    constructor(scopeManager: ScopeManager) {
        this.scopeManager = scopeManager;
        this.quickpick = vscode.window.createQuickPick<QuickPickItemCustom>();
        this.quickpick.placeholder = 'Name of regex';
        this.quickpick.title = 'Choose your regexes';
        this.quickpick.canSelectMany = true;
        this.quickpick.matchOnDescription = true;
        this.quickpick.matchOnDetail = true;
        this.visible = false;
        this.activeEditorItems = [];
        let that = this;
        this.quickpick.onDidAccept(() => {
            log.debug('quickpick: onDidAccept');
            that.quickpick.hide();
        });
        this.quickpick.onDidHide(() => {
            log.debug('quickpick: onDidHide');
            for (let scopeKey in that.scopeManager.map) {
                if (that.scopeManager.map.hasOwnProperty(scopeKey)) {
                    let scope = that.scopeManager.map[scopeKey];
                    if (scope.changed) {
                        scope.updateConfiguration();
                        scope.changed = false;
                    }
                }
            }
            that.visible = false;
            that.quickpick.hide();
        });
        this.quickpick.onDidChangeSelection((selectedItems: readonly QuickPickItemCustom[]) => {
            log.debug('quickpick: onDidChangeSelection');
            if (selectedItems === undefined) {
                return;
            }
            for (let scopeKey in that.scopeManager.map) {
                if (that.scopeManager.map.hasOwnProperty(scopeKey)) {
                    let scope = that.scopeManager.map[scopeKey];
                    for (let i = 0; i < scope.regexes?.length; i++) {
                        let j = 0;
                        for (; j < selectedItems.length; j++) {
                            if (selectedItems[j].scope == scope.name &&
                                selectedItems[j].index == i) {
                                break;
                            }
                        }
                        if (j === selectedItems.length) {
                            if (scope.regexes[i].active == undefined || scope.regexes[i].active) {
                                scope.regexes[i].active = false;
                                scope.changed = true;
                            }
                        }
                        else {
                            if (scope.regexes[i].active == undefined || scope.regexes[i].active == false) {
                                scope.regexes[i].active = true;
                                scope.changed = true;
                            }
                        }

                    }
                    if (scope.changed) {
                        scope.treeDataProvider.loadConfigurations();
                        scope.treeDataProvider.refresh();
                        scope.resetAllDecorations();
                        scope.updateAllDecorations();
                    }
                }
            }
        });
        this.quickpick.onDidTriggerItemButton(async (event: vscode.QuickPickItemButtonEvent<QuickPickItemCustom>) => {
            log.debug('quickpick: onDidTriggerItemButton');
            if (event.button.tooltip == 'Edit' && event.item.scope !== undefined && event.item.index !== undefined) {
                let path = `/${that.scopeManager.map[event.item.scope].propertyName}/[${event.item.index}]`;
                // is global setting
                if (path.startsWith(`/${extensionId}.regexes`)) {
                    await manager.scopeManager.global.updateConfiguration();
                    // first check remote setting
                    if (vscode.env.remoteName !== undefined && manager.globalSettingRemote === undefined) {
                        manager.globalSettingRemote = await manager.setting.useRemoteSetting();
                        log.debug(`globalSettingRemote: ${manager.globalSettingRemote}`);
                        manager.scopeManager.global.updateTreeTitle();
                    }
                    if (vscode.env.remoteName !== undefined && manager.globalSettingRemote) {
                        await manager.setting.focus('workbench.action.openRemoteSettingsFile', path);
                    }
                    else if (manager.scopeManager.global.getConfigurationTarget() != vscode.ConfigurationTarget.Workspace) {
                        await manager.setting.focus('workbench.action.openSettingsJson', path);
                    }
                    else {
                        await manager.setting.focus('workbench.action.openWorkspaceSettingsFile', path);
                    }
                }
                else {
                    await manager.scopeManager.workspace.updateConfiguration();
                    await manager.setting.focus('workbench.action.openWorkspaceSettingsFile', path);
                }
            }
        });
    }

    updateItems(activeEditor?: vscode.TextEditor): void {
        let items: (QuickPickItemCustom | vscode.QuickPickItem)[] = [];
        let selectedItems: QuickPickItemCustom[] = [];
        let activeItems: QuickPickItemCustom[] = [];
        if (activeEditor) {
            for (let scopeKey in this.scopeManager.map) {
                if (this.scopeManager.map.hasOwnProperty(scopeKey)) {
                    let scope = this.scopeManager.map[scopeKey];
                    // separator
                    items.push({ label: `active - ${scope.name}`, kind: vscode.QuickPickItemKind.Separator });
                    for (let i = 0; i < scope.regexes?.length; i++) {
                        const regexes = scope.regexes[i];
                        try {
                            let languageRegex = new RegExp((regexes.languageRegex) ? regexes.languageRegex : '.*', '');
                            languageRegex.test('');
                            let filenameRegex = new RegExp((regexes.filenameRegex) ? regexes.filenameRegex : '.*', '');
                            filenameRegex.test('');
                            // check language
                            if (activeEditor.document.languageId) {
                                if (regexes.languageIds != undefined) {
                                    if (regexes.languageIds.indexOf(activeEditor.document.languageId) < 0) {
                                        continue;
                                    }
                                }
                                else {
                                    if (!languageRegex.test(activeEditor.document.languageId)) {
                                        continue;
                                    }
                                }
                            }
                            // check filename
                            if (activeEditor.document.fileName && !filenameRegex.test(activeEditor.document.fileName)) {
                                continue;
                            }
                            let label = 'undefined';
                            if (regexes.name !== undefined) {
                                label = regexes.name;
                            }
                            else {
                                if (regexes.regexes && regexes.regexes.length > 0 && regexes.regexes[0].regex !== undefined) {
                                    if (typeof regexes.regexes[0].regex === 'string') {
                                        label = regexes.regexes[0].regex;
                                    }
                                    else {
                                        // transform regex array to string
                                        label = regexes.regexes[0].regex.join('');
                                    }
                                }
                            }
                            let item: QuickPickItemCustom = {
                                label: label,
                                description: regexes.description,
                                scope: scope.name,
                                index: i,
                                picked: regexes.active === undefined ? true : regexes.active,
                                buttons: [
                                    {
                                        iconPath: new vscode.ThemeIcon('edit'),
                                        tooltip: "Edit"
                                    }
                                ]
                            };
                            items.push(item);
                            if (item.picked) {
                                selectedItems.push(item);
                            }
                        }
                        catch (error) {
                            log.error('quickpick: ' + (error instanceof Error ? error.toString() : String(error)));
                        }
                    }
                }
            }
        }
        for (let scopeKey in this.scopeManager.map) {
            if (this.scopeManager.map.hasOwnProperty(scopeKey)) {
                const scope = this.scopeManager.map[scopeKey];
                // separator
                items.push({ label: scope.name, kind: vscode.QuickPickItemKind.Separator });
                for (let i = 0; i < scope.regexes?.length; i++) {
                    const regexes = scope.regexes[i];
                    try {
                        let inActiveEditor = true;
                        if (activeEditor) {
                            let languageRegex = new RegExp((regexes.languageRegex) ? regexes.languageRegex : '.*', '');
                            languageRegex.test('');
                            let filenameRegex = new RegExp((regexes.filenameRegex) ? regexes.filenameRegex : '.*', '');
                            filenameRegex.test('');
                            // check language
                            if (activeEditor.document.languageId) {
                                if (regexes.languageIds != undefined) {
                                    if (regexes.languageIds.indexOf(activeEditor.document.languageId) < 0) {
                                        inActiveEditor = false;
                                    }
                                }
                                else {
                                    if (!languageRegex.test(activeEditor.document.languageId)) {
                                        inActiveEditor = false;
                                    }
                                }
                            }
                            // check filename
                            if (activeEditor.document.fileName && !filenameRegex.test(activeEditor.document.fileName)) {
                                inActiveEditor = false;
                            }
                        }
                        else {
                            inActiveEditor = false;
                        }
                        if (inActiveEditor) {
                            continue;
                        }
                        let label = 'undefined';
                        if (regexes.name !== undefined) {
                            label = regexes.name;
                        }
                        else {
                            if (regexes.regexes && regexes.regexes.length > 0 && regexes.regexes[0].regex !== undefined) {
                                if (typeof regexes.regexes[0].regex === 'string') {
                                    label = regexes.regexes[0].regex;
                                }
                                else {
                                    // transform regex array to string
                                    label = regexes.regexes[0].regex.join('');
                                }
                            }
                        }
                        let item: QuickPickItemCustom = {
                            label: label,
                            description: regexes.description,
                            scope: scope.name,
                            index: i,
                            picked: regexes.active === undefined ? true : regexes.active,
                            buttons: [
                                {
                                    iconPath: new vscode.ThemeIcon('edit'),
                                    tooltip: "Edit"
                                }
                            ]
                        };
                        if (inActiveEditor) {
                            item.detail = "Use by active editor";
                        }
                        items.push(item);
                        if (item.picked) {
                            selectedItems.push(item);
                        }
                    }
                    catch (error) {
                        log.error('quickpick: ' + (error instanceof Error ? error.toString() : String(error)));
                    }
                }
            }
        }
        this.quickpick.items = items;
        this.quickpick.selectedItems = selectedItems;
        this.quickpick.activeItems = activeItems;
    }
}
