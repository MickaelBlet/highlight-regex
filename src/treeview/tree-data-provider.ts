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
import { log } from '../logger';
import TreeItem from './tree-item';

interface RegexListConfig {
    name?: string;
    active?: boolean;
    languageIds?: string[];
    languageRegex?: string;
    filenameRegex?: string;
    regexes?: any[];
    decorations?: any[];
}

interface ScopeInterface {
    name: string;
    propertyName: string;
    regexes: RegexListConfig[];
}

export default class TreeDataProvider implements vscode.TreeDataProvider<TreeItem> {
    items: TreeItem[];
    scope: ScopeInterface;
    private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | null | void>;
    readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null | void>;

    constructor(scope: ScopeInterface) {
        this.items = [];
        this.scope = scope;
        // refresh event
        this._onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined | null | void>();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;

        this.loadConfigurations();
    }

    getTreeItem(element: TreeItem): TreeItem {
        return element;
    }

    getChildren(element?: TreeItem): any[] {
        if (element) {
            return element.childrens;
        }
        else {
            return this.items;
        }
    }

    getParent(element: TreeItem): TreeItem {
        return element;
    }

    loadConfigurations(): void {
        log.debug(`${this.scope.name}: TreeView: loadConfigurations`);
        let items: TreeItem[] = [];
        for (let i = 0; i < this.scope.regexes.length; i++) {
            const regexes = this.scope.regexes[i];
            try {
                items.push(new TreeItem(regexes, this.scope.name, this.scope.propertyName, i));
            }
            catch (error) {
                log.error(`${this.scope.name}: TreeView: ${error instanceof Error ? error.toString() : String(error)}`);
            }
        }
        this.items = items;
    }

    collapseAll(): void {
        log.debug(`${this.scope.name}: TreeView: collapseAll`);
        let tmpItems: TreeItem[] = [];
        for (let i = 0; i < this.items.length; i++) {
            let item = this.items[i];
            const label = item.label;
            if (label && typeof label === 'string') {
                if (label[label.length - 1] == ' ') {
                    item.label = label.substr(0, label.length - 1);
                }
                else {
                    item.label = label + ' ';
                }
            }
            tmpItems.push(item);
        }
        this.items = tmpItems;
        this.refresh();
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }
}
