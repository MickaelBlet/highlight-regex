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
import { manager } from '../manager';
import { CacheRange, LoadedRegex, RegexEntry } from '../core/parser';

export interface TreeItemChild extends vscode.TreeItem {
    context?: string;
    editor?: vscode.TextEditor;
    range?: vscode.Range;
    childrens?: TreeItemChild[];
}

export interface RegexItemsOptions {
    // show child regexes and groups
    detail: boolean;
    // 'scheme:path' of the file decoration uri used to display the occurrence count badge
    badgeUri: string;
    editor?: vscode.TextEditor;
    description?: string;
}

interface GroupChildrens {
    occurrences: TreeItemChild[];
    regexes: TreeItemChild[];
    count: number;
}

function compareOccurrences(a: TreeItemChild, b: TreeItemChild): number {
    if (a.range!.start.line > b.range!.start.line) return 1;
    if (a.range!.start.line < b.range!.start.line) return -1;
    if (a.range!.start.character > b.range!.start.character) return 1;
    if (a.range!.start.character < b.range!.start.character) return -1;
    return 0;
}

function badgeUri(options: RegexItemsOptions, count: number): vscode.Uri {
    return vscode.Uri.parse(`${options.badgeUri}?${count}`, true);
}

export function buildOccurrence(range: CacheRange, editor?: vscode.TextEditor): TreeItemChild {
    let line = range.line;
    let prefix = `${range.range.start.line + 1}:\t`;
    return {
        context: "selectToEditor",
        editor: editor,
        range: range.range,
        label: {
            label: `${prefix}${line.text.substring(line.firstNonWhitespaceCharacterIndex)}`,
            highlights: [
                [
                    range.range.start.character - line.firstNonWhitespaceCharacterIndex + prefix.length,
                    range.range.end.character - line.firstNonWhitespaceCharacterIndex + prefix.length
                ]
            ]
        },
        tooltip: `${line.text.substring(line.firstNonWhitespaceCharacterIndex)} [Ln ${range.range.start.line + 1}, Col ${range.range.start.character + 1}]`,
        collapsibleState: vscode.TreeItemCollapsibleState.None
    };
}

// all occurrences of a regex entry
function buildEntryOccurrences(entry: RegexEntry, cacheRanges: CacheRange[][], options: RegexItemsOptions): TreeItemChild[] {
    let childrens: TreeItemChild[] = [];
    for (let j = entry.decorationRange.start; j <= entry.decorationRange.end && j < cacheRanges.length; j++) {
        for (let l = 0; l < cacheRanges[j].length; l++) {
            childrens.push(buildOccurrence(cacheRanges[j][l], options.editor));
        }
    }
    return childrens.sort(compareOccurrences);
}

// tree of a loaded regex: occurrences of group 0, then groups and child regexes
function buildLoadedRegex(regex: LoadedRegex, cacheRanges: CacheRange[][], options: RegexItemsOptions): { item: TreeItemChild, count: number } | undefined {
    let groups = new Map<number, GroupChildrens>();
    let getGroup = (index: number | string): GroupChildrens => {
        const groupIndex = (typeof index === 'string') ? (regex.namedGroupIndexes[index] ?? 0) : index;
        let group = groups.get(groupIndex);
        if (group === undefined) {
            group = { occurrences: [], regexes: [], count: 0 };
            groups.set(groupIndex, group);
        }
        return group;
    };
    for (const decoration of regex.decorations) {
        const ranges = cacheRanges[decoration.decoration] ?? [];
        if (ranges.length > 0) {
            let group = getGroup(decoration.index);
            for (const range of ranges) {
                group.occurrences.push(buildOccurrence(range, options.editor));
            }
            group.count += ranges.length;
        }
    }
    // child regexes are loaded in reverse order
    for (let i = regex.regexes.length - 1; i >= 0; i--) {
        const child = buildLoadedRegex(regex.regexes[i], cacheRanges, options);
        if (child !== undefined) {
            let group = getGroup(regex.regexes[i].index);
            group.regexes.push(child.item);
            group.count += child.count;
        }
    }
    let childrens: TreeItemChild[] = [];
    let count = 0;
    for (const groupIndex of [...groups.keys()].sort((a, b) => a - b)) {
        const group = groups.get(groupIndex)!;
        if (group.count === 0) {
            continue;
        }
        count += group.count;
        const groupChildrens = [...group.occurrences.sort(compareOccurrences), ...group.regexes];
        if (groupIndex === 0) {
            childrens.unshift(...groupChildrens);
            continue;
        }
        const groupName = Object.keys(regex.namedGroupIndexes).find((name) => regex.namedGroupIndexes[name] === groupIndex);
        const label = regex.groupSources[groupIndex] ?? `group ${groupIndex}`;
        childrens.push({
            label: label,
            iconPath: new vscode.ThemeIcon('bracket'),
            tooltip: (groupName !== undefined) ? `group ${groupIndex} <${groupName}>: ${label}` : `group ${groupIndex}: ${label}`,
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
            resourceUri: badgeUri(options, group.count),
            childrens: groupChildrens
        });
    }
    if (count === 0) {
        return undefined;
    }
    return {
        item: {
            label: regex.source,
            iconPath: new vscode.ThemeIcon('regex'),
            tooltip: regex.source,
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
            resourceUri: badgeUri(options, count),
            childrens: childrens
        },
        count: count
    };
}

// tree items of all regex entries found in the cached editor
export function buildRegexItems(editorKey: string, options: RegexItemsOptions): TreeItemChild[] {
    let items: TreeItemChild[] = [];
    for (let scopeKey in manager.scopeManager.map) {
        if (!manager.scopeManager.map.hasOwnProperty(scopeKey)) {
            continue;
        }
        const parser = manager.scopeManager.map[scopeKey].parser;
        const cacheEditor = parser.cacheEditors[editorKey];
        if (cacheEditor === undefined) {
            continue;
        }
        const cacheRanges = cacheEditor.ranges;
        for (const entry of parser.regexes) {
            let childrens: TreeItemChild[] = [];
            let count = 0;
            if (options.detail) {
                // regexes are loaded in reverse order
                for (let i = entry.regexes.length - 1; i >= 0; i--) {
                    const child = buildLoadedRegex(entry.regexes[i], cacheRanges, options);
                    if (child !== undefined) {
                        childrens.push(child.item);
                        count += child.count;
                    }
                }
            }
            else {
                childrens = buildEntryOccurrences(entry, cacheRanges, options);
                count = childrens.length;
            }
            if (count > 0) {
                items.push({
                    label: `${entry.label}`,
                    description: options.description,
                    iconPath: new vscode.ThemeIcon('regex'),
                    tooltip: `${entry.label}`,
                    collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                    resourceUri: badgeUri(options, count),
                    childrens: childrens
                });
            }
        }
    }
    return items;
}
