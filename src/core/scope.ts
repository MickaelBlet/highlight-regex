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
import { extensionId } from '../constants';
import { log } from '../logger';
import { manager } from '../manager';
import Parser from './parser';
import TreeDataProvider from '../treeview/tree-data-provider';

interface RegexListConfig {
    name?: string;
    active?: boolean;
    languageIds?: string[];
    languageRegex?: string;
    filenameRegex?: string;
    description?: string;
    regexes?: any[];
    decorations?: any[];
}

export class ScopeManager {
    global: Scope;
    workspace: Scope;
    map: { [key: string]: Scope };

    constructor(configuration: vscode.WorkspaceConfiguration) {
        this.global = new Scope('global', `${extensionId}.regexes`, configuration, configuration.regexes);
        this.workspace = new Scope('workspace', `${extensionId}.workspace.regexes`, configuration, configuration.workspace.regexes);
        this.map = {};
        this.map['workspace'] = this.workspace;
        this.map['global'] = this.global;
    }
}

export class Scope {
    name: string;
    propertyName: string;
    configuration: vscode.WorkspaceConfiguration;
    regexes: RegexListConfig[];
    configurationChangeEvent: boolean;
    changed: boolean;
    parser: Parser;
    treeDataProvider: TreeDataProvider;
    tree: vscode.TreeView<any>;

    constructor(name: string, propertyName: string, configuration: vscode.WorkspaceConfiguration, regexes: RegexListConfig[]) {
        this.name = name;
        this.propertyName = propertyName;
        this.configuration = configuration;
        this.regexes = regexes;
        this.configurationChangeEvent = true;
        this.changed = false;

        this.parser = new Parser(this.name, this.configuration as any, this.regexes);
        this.treeDataProvider = new TreeDataProvider(this);
        this.tree = vscode.window.createTreeView(`${extensionId}.view.${this.name}`, {
            canSelectMany: true,
            treeDataProvider: this.treeDataProvider
        });

        const that = this;
        // TreeView events
        this.tree.onDidChangeCheckboxState((event: vscode.TreeCheckboxChangeEvent<any>) => {
            for (let i = 0; i < event.items.length; i++) {
                const item = event.items[i];
                const treeItem = item[0];
                const actived = item[1] ? true : false;
                treeItem.regexes.active = actived;
                log.debug(`${that.name}: treeView: onDidChangeCheckboxState: "${treeItem.label}" to ${treeItem.regexes.active}`);
            }
            that.resetAllDecorations();
            that.updateAllDecorations();
            that.updateConfiguration();
        });
        this.updateTreeTitle();
    }

    updateTreeTitle(): void {
        const inspect = this.configuration.inspect(this.propertyName.substring(extensionId.length + 1));
        const scopes: [string, string][] = [
            ['workspaceFolderLanguageValue', 'workspace folder language'],
            ['workspaceLanguageValue', 'workspace language'],
            ['globalLanguageValue', 'global language'],
            ['defaultLanguageValue', 'default language'],
            ['workspaceFolderValue', 'workspace folder'],
            ['workspaceValue', 'workspace'],
            ['globalValue', 'global'],
            ['defaultValue', 'default']
        ];
        let scopeStr = "undefined";
        if ('global' === this.name && manager.globalSettingRemote) {
            this.tree.description = `remote settings`;
        }
        else {
            for (let i = 0; i < scopes.length; i++) {
                const language = scopes[i];
                if (inspect && language[0] in inspect && (inspect as any)[language[0]] !== undefined) {
                    scopeStr = language[1];
                    break;
                }
            }
            if (vscode.env.remoteName !== undefined && 'global' === this.name && manager.globalSettingRemote === undefined) {
                scopeStr += '/remote?';
            }
            this.tree.description = `${scopeStr} settings`;
        }
    }

    loadFromConfiguration(): void {
        if (this.name === 'global') {
            this.regexes = vscode.workspace.getConfiguration(extensionId).regexes;
        }
        else if (this.name === 'workspace') {
            this.regexes = vscode.workspace.getConfiguration(extensionId).workspace.regexes;
        }
        this.treeDataProvider.loadConfigurations();
        this.treeDataProvider.refresh();
    }

    moveUpItem(index: number): number {
        log.debug(`${this.name}: moveUpItem: ${index}`);
        if (this.regexes.length <= 1) {
            return index;
        }
        this.resetAllDecorations();
        if (index === 0) {
            this.regexes.splice(this.regexes.length - 1, 0, this.regexes.splice(index, 1)[0]);
            index = this.regexes.length - 1;
        }
        else {
            this.regexes.splice(index - 1, 0, this.regexes.splice(index, 1)[0]);
            index = index - 1;
        }
        this.treeDataProvider.loadConfigurations();
        this.treeDataProvider.refresh();
        this.updateAllDecorations();
        this.updateConfiguration();
        return index;
    }

    moveDownItem(index: number): number {
        log.debug(`${this.name}: moveDownItem: ${index}`);
        if (this.regexes.length <= 1) {
            return index;
        }
        this.resetAllDecorations();
        if (index === this.regexes.length - 1) {
            this.regexes.splice(0, 0, this.regexes.splice(index, 1)[0]);
            index = this.regexes.length - 1;
        }
        else {
            this.regexes.splice(index + 1, 0, this.regexes.splice(index, 1)[0]);
            index = index + 1;
        }
        this.treeDataProvider.loadConfigurations();
        this.treeDataProvider.refresh();
        this.updateAllDecorations();
        this.updateConfiguration();
        return index;
    }

    clearCaches(): void {
        log.debug(`${this.name}: clearCaches`);
        this.parser.clearCache();
    }

    resetAllDecorations(): void {
        log.debug(`${this.name}: resetAllDecorations`);
        for (let i = 0; i < vscode.window.visibleTextEditors.length; i++) {
            this.parser.resetDecorations(vscode.window.visibleTextEditors[i]);
        }
        manager.visible.update(vscode.window.visibleTextEditors);
        manager.active.update(vscode.window.activeTextEditor);
    }

    updateAllDecorations(): void {
        log.debug(`${this.name}: updateAllDecorations`);
        this.parser.loadConfigurations(this.configuration as any, this.regexes);
        for (let i = 0; i < vscode.window.visibleTextEditors.length; i++) {
            this.parser.updateDecorations(vscode.window.visibleTextEditors[i]);
        }
        manager.visible.update(vscode.window.visibleTextEditors);
        manager.active.update(vscode.window.activeTextEditor);
    }

    toggleDecorations(): void {
        this.parser.toggle(vscode.window.visibleTextEditors);
    }

    getConfigurationTarget(): vscode.ConfigurationTarget {
        const inspect = this.configuration.inspect(this.propertyName.substring(extensionId.length + 1));
        const scopes: [string, vscode.ConfigurationTarget][] = [
            ['workspaceFolderLanguageValue', vscode.ConfigurationTarget.WorkspaceFolder],
            ['workspaceLanguageValue', vscode.ConfigurationTarget.Workspace],
            ['globalLanguageValue', vscode.ConfigurationTarget.Global],
            ['defaultLanguageValue', vscode.ConfigurationTarget.Workspace],
            ['workspaceFolderValue', vscode.ConfigurationTarget.WorkspaceFolder],
            ['workspaceValue', vscode.ConfigurationTarget.Workspace],
            ['globalValue', vscode.ConfigurationTarget.Global],
            ['defaultValue', vscode.ConfigurationTarget.Global]
        ];
        let scope = vscode.ConfigurationTarget.Workspace;
        for (let i = 0; i < scopes.length; i++) {
            const language = scopes[i];
            if (inspect && language[0] in inspect && (inspect as any)[language[0]] !== undefined) {
                scope = language[1];
                break;
            }
        }
        if (this.name === 'workspace') {
            if (scope === vscode.ConfigurationTarget.Global) {
                scope = vscode.ConfigurationTarget.Workspace;
            }
        }
        return scope;
    }

    async updateConfiguration(configurationTarget: vscode.ConfigurationTarget = this.getConfigurationTarget()): Promise<void> {
        this.configurationChangeEvent = false;
        await vscode.workspace.getConfiguration().update(
            this.propertyName,
            this.regexes,
            configurationTarget
        );
        this.configurationChangeEvent = true;
    }
}
