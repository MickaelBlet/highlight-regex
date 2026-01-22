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

export default class TreeItem extends vscode.TreeItem {
    regexes: RegexListConfig;
    scope: string;
    index: number;
    path: string;
    childrens: any[];

    constructor(regexes: RegexListConfig, scopeName: string, scopePropertyName: string, index: number) {
        // take the first regex if name not exists
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

        super(label, vscode.TreeItemCollapsibleState.Collapsed);

        if (regexes.description !== undefined) {
            this.tooltip = regexes.description;
        }
        this.iconPath = new vscode.ThemeIcon('regex');
        this.contextValue = 'parent';
        this.regexes = regexes;
        this.scope = scopeName;
        this.index = index;
        this.path = `/${scopePropertyName}/[${index}]`;
        this.checkboxState = regexes.active === undefined ? vscode.TreeItemCheckboxState.Checked : (regexes.active ? vscode.TreeItemCheckboxState.Checked : vscode.TreeItemCheckboxState.Unchecked);
        this.childrens = [];
        let sortedKeys = Object.keys(regexes).sort();
        for (let key of sortedKeys) {
            // not show active property
            if (key === 'active') {
                continue;
            }
            if (regexes.hasOwnProperty(key)) {
                this.generateChildrens(`${this.path}`, this.childrens, key, (regexes as any)[key]);
            }
        }
        if (this.childrens.length == 0) {
            this.collapsibleState = vscode.TreeItemCollapsibleState.None;
        }
    }

    generateChildrens(path: string, childs: any[], name: string, value: any, isArray: boolean = false): void {
        let label = isArray ? `[${name}]` : `${name}`;
        if (typeof value === 'object') {
            let parent: any = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Expanded);
            parent.path = `${path}/${label}`;
            parent.iconPath = Array.isArray(value) ? new vscode.ThemeIcon("array") : new vscode.ThemeIcon("json");
            parent.childrens = [];
            let sortedKeys = Object.keys(value).sort();
            for (let key of sortedKeys) {
                if (value.hasOwnProperty(key)) {
                    this.generateChildrens(`${path}/${label}`, parent.childrens, key, value[key], (Array.isArray(value)));
                }
            }
            childs.push(parent);
        }
        else {
            let valueFormated = `${value}`;
            if (typeof value === 'string') {
                valueFormated = `"${valueFormated}"`;
            }
            let item: any = new vscode.TreeItem(`${label}: ${valueFormated}`, vscode.TreeItemCollapsibleState.None);
            item.path = `${path}/${label}`;
            item.tooltip = valueFormated;
            childs.push(item);
        }
    }
}
