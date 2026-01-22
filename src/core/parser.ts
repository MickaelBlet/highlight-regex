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
import { addHiddenMatchGroups } from './add-hidden-match-groups';

interface Configuration {
    cacheLimit: number;
    defaultRegexLimit: number;
    defaultRegexFlag: string;
}

interface DecorationConfig extends vscode.DecorationRenderOptions {
    index?: number | string;
    hoverMessage?: string | string[];
}

interface RegexConfig {
    regex?: string | string[];
    regexFlag?: string;
    regexLimit?: number;
    index?: number | string;
    regexes?: RegexConfig[];
    decorations?: DecorationConfig[];
}

interface RegexListConfig {
    name?: string;
    active?: boolean;
    languageIds?: string[];
    languageRegex?: string;
    filenameRegex?: string;
    regexes?: RegexConfig[];
}

interface DecorationItem {
    index: number | string;
    hoverMessage?: string;
    decoration: number;
}

interface LoadedRegex {
    index: number | string;
    regexRegExp: RegExp;
    matchIndexToReal: { [key: number]: number; };
    matchNamedToReal: { [key: string]: number; };
    matchDependIndexes: { [key: number]: number[]; };
    regexCount: number;
    regexLimit: number;
    regexes: LoadedRegex[];
    decorations: DecorationItem[];
}

interface RegexEntry {
    label: string;
    decorationRange: {
        start: number;
        end: number;
    };
    active: boolean;
    languages?: string[];
    languageRegex: RegExp;
    filenameRegex: RegExp;
    regexes: LoadedRegex[];
}

interface CacheRange {
    range: vscode.Range;
    hoverMessage?: vscode.MarkdownString;
    line: vscode.TextLine;
}

interface CachedEditorData {
    version: number;
    ranges: CacheRange[][];
}

type ScopeType = 'global' | string;

class Parser {
    scope: ScopeType;
    active: boolean;
    cacheEditorLimit: number;
    regexes: RegexEntry[];
    decorations: vscode.TextEditorDecorationType[];
    cacheEditors: { [key: string]: CachedEditorData };
    cacheEditorList: string[];
    startZindex: number;

    constructor(scope: ScopeType, configuration: Configuration, regexesConfiguration: RegexListConfig[]) {
        this.scope = scope;
        this.active = true;
        this.cacheEditorLimit = 0;
        this.regexes = [];
        this.decorations = [];
        this.cacheEditors = {};
        this.cacheEditorList = [];
        this.startZindex = (scope === "global") ? -100000 : 0;
        this.loadConfigurations(configuration, regexesConfiguration);
    }

    //
    // PUBLIC
    //

    // load configuration from contributions
    loadConfigurations(configuration: Configuration, regexesConfiguration: RegexListConfig[]): void {
        let rootPath = this.scope === 'global' ? `/${extensionId}.regexes` : `/${extensionId}.${this.scope}.regexes`;
        let currentRegexPath = `${rootPath}`;
        let zindex = this.startZindex;
        let loadRegexes = (childPath: string, configuration: Configuration, regex: RegexConfig): LoadedRegex => {
            if (regex.regex === undefined) {
                throw 'regex not found';
            }
            // force copy
            let regexStr = JSON.parse(JSON.stringify(regex.regex)) as string | string[];
            if (typeof regexStr !== 'string') {
                regexStr = regexStr.join('');
            }
            currentRegexPath = `${childPath}/regex`;
            let regexRegExp = new RegExp(regexStr, (regex.regexFlag) ? regex.regexFlag : configuration.defaultRegexFlag);
            regexRegExp.test('');
            // add hide groups: transform 'a(?: )bc(def(ghi)xyz)' to '(a)((?: ))(bc)((def)(ghi)(xyz))'
            let { sRegex, matchIndexToReal, matchNamedToReal, matchDependIndexes } = addHiddenMatchGroups(regexStr);
            regexRegExp = new RegExp(sRegex, (regex.regexFlag) ? regex.regexFlag : configuration.defaultRegexFlag);
            regexRegExp.test('');
            let decorationList: DecorationItem[] = [];
            let regexList: LoadedRegex[] = [];
            if (regex.regexes?.length && regex.regexes.length > 0) {
                for (let i = regex.regexes.length - 1; i >= 0; i--) {
                    regexList.push(loadRegexes(`${childPath}/regexes/[${i}]`, configuration, regex.regexes[i]));
                }
            }
            if (regex.decorations?.length && regex.decorations.length > 0) {
                let decorationsCopy: DecorationConfig[] = JSON.parse(JSON.stringify(regex.decorations));
                // sort decoration by real index
                decorationsCopy.sort((a, b) => {
                    let keyA = 0;
                    let keyB = 0;
                    if (a.index) {
                        if (typeof a.index === 'string') {
                            keyA = matchNamedToReal[a.index];
                        }
                        else {
                            keyA = matchIndexToReal[a.index];
                        }
                    }
                    if (b.index) {
                        if (typeof b.index === 'string') {
                            keyB = matchNamedToReal[b.index];
                        }
                        else {
                            keyB = matchIndexToReal[b.index];
                        }
                    }
                    if (keyA < keyB) return 1;
                    if (keyA > keyB) return -1;
                    return 0;
                });
                for (let i = 0; i < decorationsCopy.length; i++) {
                    let decoration = decorationsCopy[i];
                    let index: number | string = (decoration.index !== undefined) ? decoration.index : 0;
                    let hoverMessage: string | undefined = undefined;
                    if (decoration.hoverMessage) {
                        if (typeof decoration.hoverMessage !== 'string') {
                            hoverMessage = decoration.hoverMessage.join('');
                        } else {
                            hoverMessage = decoration.hoverMessage;
                        }
                    }
                    // z-index for background level
                    zindex--;
                    if (decoration.backgroundColor) {
                        decoration.backgroundColor += `; z-index: ${zindex}`;
                    }
                    else {
                        decoration.backgroundColor = `transparent; z-index: ${zindex}`;
                    }
                    delete decoration.index;
                    delete decoration.hoverMessage;
                    decorationList.push({
                        index: index,
                        hoverMessage: hoverMessage,
                        decoration: this.decorations.length,
                    });
                    this.decorations.push(vscode.window.createTextEditorDecorationType(decoration));
                }
            }
            return {
                index: (regex.index !== undefined) ? regex.index : 0,
                regexRegExp: regexRegExp,
                matchIndexToReal: matchIndexToReal,
                matchNamedToReal: matchNamedToReal,
                matchDependIndexes: matchDependIndexes,
                regexCount: 0,
                regexLimit: (regex.regexLimit) ? regex.regexLimit : configuration.defaultRegexLimit,
                regexes: regexList,
                decorations: decorationList
            };
        }
        // reset regex
        this.regexes = [];
        // dispose old decorations before clearing
        for (let i = 0; i < this.decorations.length; i++) {
            this.decorations[i].dispose();
        }
        this.decorations = []
        this.cacheEditors = {};
        this.cacheEditorList = [];
        this.cacheEditorLimit = configuration.cacheLimit;
        let decorationStartIndex = 0;
        // load regexes configuration
        for (let i = 0; i < regexesConfiguration.length; i++) {
            // compile regex
            try {
                let regexList = regexesConfiguration[i];
                let active = (regexList.active === undefined) ? true : regexList.active;
                // stock languages
                currentRegexPath = `${rootPath}/[${i}]/languageRegex`;
                let languages: string[] | undefined = (regexList.languageIds) ? regexList.languageIds : undefined;
                let languageRegex = new RegExp((regexList.languageRegex) ? regexList.languageRegex : '.*', '');
                languageRegex.test('');
                currentRegexPath = `${rootPath}/[${i}]/filenameRegex`;
                let filenameRegex = new RegExp((regexList.filenameRegex) ? regexList.filenameRegex : '.*', '');
                filenameRegex.test('');
                let regexes: LoadedRegex[] = [];
                if (regexList.regexes?.length && regexList.regexes.length > 0) {
                    for (let j = regexList.regexes.length - 1; j >= 0; j--) {
                        regexes.push(loadRegexes(`${rootPath}/[${i}]/regexes/[${j}]`, configuration, regexList.regexes[j]));
                    }
                }
                // take the first regex if name not exists
                let label = 'undefined';
                if (regexList.name !== undefined) {
                    label = regexList.name;
                }
                else {
                    if (regexList.regexes && regexList.regexes.length > 0 && regexList.regexes[0].regex !== undefined) {
                        if (typeof regexList.regexes[0].regex === 'string') {
                            label = regexList.regexes[0].regex;
                        }
                        else {
                            // transform regex array to string
                            label = regexList.regexes[0].regex.join('');
                        }
                    }
                }
                this.regexes.push({
                    label: label,
                    decorationRange: {
                        start: decorationStartIndex,
                        end: this.decorations.length - 1
                    },
                    active: active,
                    languages: languages,
                    languageRegex: languageRegex,
                    filenameRegex: filenameRegex,
                    regexes: regexes
                });
                decorationStartIndex = this.decorations.length;
            }
            catch (error: any) {
                log.error(`${this.scope}: ${error.toString()}: ${currentRegexPath}`);
                const searchPath = `${currentRegexPath}`;
                vscode.window.showErrorMessage(error.toString(), 'Edit', 'Close').then(async (choice: string | undefined) => {
                    if (choice === 'Edit') {
                        // is global setting
                        if (searchPath.startsWith(`/${extensionId}.regexes`)) {
                            // first check remote setting
                            if (vscode.env.remoteName !== undefined && manager.globalSettingRemote === undefined) {
                                manager.globalSettingRemote = await manager.setting.useRemoteSetting();
                                log.debug(`globalSettingRemote: ${manager.globalSettingRemote}`);
                                manager.scopeManager.global.updateTreeTitle();
                            }
                            if (vscode.env.remoteName !== undefined && manager.globalSettingRemote) {
                                manager.setting.focus('workbench.action.openRemoteSettingsFile', searchPath);
                            }
                            else if (manager.scopeManager.global.getConfigurationTarget() !== vscode.ConfigurationTarget.Workspace) {
                                manager.setting.focus('workbench.action.openSettingsJson', searchPath);
                            }
                            else {
                                manager.setting.focus('workbench.action.openWorkspaceSettingsFile', searchPath);
                            }
                        }
                        else {
                            manager.setting.focus('workbench.action.openWorkspaceSettingsFile', searchPath);
                        }
                    }
                });
            }
        }
    }

    dispose(): void {
        // dispose all decorations
        for (let i = 0; i < this.decorations.length; i++) {
            this.decorations[i].dispose();
        }
        this.decorations = [];
        this.cacheEditors = {};
        this.cacheEditorList = [];
    }

    resetDecorations(editor: vscode.TextEditor | undefined): void {
        if (!editor) {
            return;
        }
        try {
            for (let i = 0; i < this.decorations.length; i++) {
                // disable old decoration
                editor.setDecorations(this.decorations[i], []);
            }
            log.info(`${this.scope}: Reset decorations at "${editor.document.fileName}"`);
        }
        catch (error: any) {
            log.error(`${this.scope}: resetDecorations: ${error.toString()}`);
        }
    }

    updateDecorations(editor: vscode.TextEditor | undefined): void {
        if (!editor) {
            return;
        }
        let key = editor.document.uri.toString(true);
        if (!this.active) {
            if (key in this.cacheEditors) {
                delete this.cacheEditors[key];
                // remove element on cache editor list
                this.cacheEditorList.splice(this.cacheEditorList.indexOf(key), 1);
            }
            return;
        }
        if (!(key in this.cacheEditors)) {
            if (this.cacheEditorList.length > this.cacheEditorLimit) {
                let firstCacheEditor = this.cacheEditorList.shift();
                if (firstCacheEditor) {
                    log.debug(`${this.scope}: Remove cached editor: "${firstCacheEditor}"`);
                    delete this.cacheEditors[firstCacheEditor];
                }
            }
            this.cacheEditorList.push(key);
        }
        this.cacheEditors[key] = { version: editor.document.version, ranges: [] };
        let cacheRanges: any[][] = [];
        for (let i = 0; i < this.decorations.length; i++) {
            cacheRanges.push([]);
        }
        var recurseSearchDecorations = (regex: any, text: string, index: number = 0): void => {
            let search: RegExpExecArray | null;
            regex.regexCount = 0;
            regex.regexRegExp.lastIndex = 0;
            while (search = regex.regexRegExp.exec(text)) {
                regex.regexCount++;
                if (regex.regexCount > regex.regexLimit) {
                    log.warn(`${this.scope}: Count overload pattern "${regex.regexRegExp.source}" > ${regex.regexLimit} occurence(s)`);
                    break;
                }
                if (search[0].length === 0) {
                    log.error(`${this.scope}: Bad pattern "${regex.regexRegExp.source}"`);
                    break;
                }
                if (regex.decorations && regex.decorations.length > 0) {
                    for (let i = 0; i < regex.decorations.length; i++) {
                        const decoration = regex.decorations[i];
                        if (decoration.decoration === undefined) {
                            continue;
                        }
                        let decorationRealIndex: number;
                        if (typeof decoration.index === 'number') {
                            decorationRealIndex = regex.matchIndexToReal[decoration.index];
                        }
                        else {
                            decorationRealIndex = regex.matchNamedToReal[decoration.index];
                        }
                        if (decorationRealIndex < search.length && search[decorationRealIndex] && search[decorationRealIndex].length > 0) {
                            let decorationIndex = search.index;
                            for (let j = 0; j < regex.matchDependIndexes[decorationRealIndex].length; j++) {
                                if (search[regex.matchDependIndexes[decorationRealIndex][j]]) {
                                    decorationIndex += search[regex.matchDependIndexes[decorationRealIndex][j]].length;
                                }
                            }
                            let vsRange = new vscode.Range(
                                editor.document.positionAt(index + decorationIndex),
                                editor.document.positionAt(index + decorationIndex + search[decorationRealIndex].length)
                            );
                            if (decoration.hoverMessage) {
                                let htmlHovermessage = new vscode.MarkdownString();
                                htmlHovermessage.supportHtml = true;
                                htmlHovermessage.isTrusted = true;
                                htmlHovermessage.supportThemeIcons = true;
                                htmlHovermessage.appendMarkdown(decoration.hoverMessage);
                                cacheRanges[decoration.decoration].push({
                                    range: vsRange,
                                    hoverMessage: htmlHovermessage,
                                    line: editor.document.lineAt(vsRange.start.line)
                                });
                            }
                            else {
                                cacheRanges[decoration.decoration].push({
                                    range: vsRange,
                                    line: editor.document.lineAt(vsRange.start.line)
                                });
                            }
                        }
                    }
                }
                if (regex.regexes && regex.regexes.length > 0) {
                    for (let i = 0; i < regex.regexes.length; i++) {
                        const insideRegex = regex.regexes[i];
                        let insideRegexRealIndex: number;
                        if (typeof insideRegex.index === 'number') {
                            insideRegexRealIndex = regex.matchIndexToReal[insideRegex.index];
                        }
                        else {
                            insideRegexRealIndex = regex.matchNamedToReal[insideRegex.index];
                        }
                        if (insideRegexRealIndex < search.length && search[insideRegexRealIndex] && search[insideRegexRealIndex].length > 0) {
                            let regexIndex = search.index;
                            for (let j = 0; j < regex.matchDependIndexes[insideRegexRealIndex].length; j++) {
                                if (search[regex.matchDependIndexes[insideRegexRealIndex][j]]) {
                                    regexIndex += search[regex.matchDependIndexes[insideRegexRealIndex][j]].length;
                                }
                            }
                            recurseSearchDecorations(insideRegex, search[insideRegexRealIndex], index + regexIndex);
                        }
                    }
                }
            }
        }
        let useWithRegexes = false;
        let startTime = Date.now();
        let text = editor.document.getText();
        try {
            // search all regexes
            for (let i = 0; i < this.regexes.length; i++) {
                const regexes = this.regexes[i];
                // has regex
                if (regexes.regexes === undefined) {
                    continue;
                }
                // isActive
                if (regexes.active === false) {
                    continue;
                }
                // check language
                if (editor.document.languageId) {
                    if (regexes.languages !== undefined) {
                        if (regexes.languages.indexOf(editor.document.languageId) < 0) {
                            log.debug(`${this.scope}: languageIds [${regexes.languages}] not match with "${editor.document.languageId}" at "${editor.document.fileName}"`);
                            continue;
                        }
                    }
                    else {
                        if (!regexes.languageRegex.test(editor.document.languageId)) {
                            log.debug(`${this.scope}: languageRegex "${regexes.languageRegex}" not match with "${editor.document.languageId}" at "${editor.document.fileName}"`);
                            continue;
                        }
                    }
                }
                // check filename
                if (editor.document.fileName && !regexes.filenameRegex.test(editor.document.fileName)) {
                    log.debug(`${this.scope}: filenameRegex "${regexes.filenameRegex}" not match with "${editor.document.fileName}" at "${editor.document.fileName}"`);
                    continue;
                }
                useWithRegexes = true;
                for (let j = 0; j < regexes.regexes.length; j++) {
                    recurseSearchDecorations(regexes.regexes[j], text);
                }
            }
        }
        catch (error: any) {
            log.error(`${this.scope}: updateDecorations: ${error.toString()}`);
        }

        if (useWithRegexes === false) {
            return;
        }

        try {
            let countDecoration = 0;
            for (let i = 0; i < cacheRanges.length; i++) {
                countDecoration += cacheRanges[i].length;
                editor.setDecorations(
                    this.decorations[i],
                    cacheRanges[i]
                );
            }
            if (countDecoration > 0) {
                log.debug(`${this.scope}: Update decorations at "${editor.document.fileName}" with ${countDecoration} occurence(s) in ${(Date.now() - startTime)} millisecond(s)`);
                log.info(`${this.scope}: Update decorations at "${editor.document.fileName}" with ${countDecoration} occurence(s)`);
            }
            this.cacheEditors[key] = { version: editor.document.version, ranges: cacheRanges };
            // search on custom treeview
            for (let i = 0; manager.customs && i < manager.customs.length; i++) {
                if (key === manager.customs[i].uri) {
                    manager.customs[i].update(key);
                }
            }
        }
        catch (error: any) {
            log.error(`${this.scope}: updateDecorations: ${error.toString()}`);
        }
    }

    cacheDecorations(editor: vscode.TextEditor | undefined): void {
        if (!editor || !this.active) {
            return;
        }
        try {
            let startTime = Date.now();
            let key = editor.document.uri.toString(true);
            const cachedData = this.cacheEditors[key];
            if (cachedData !== undefined) {
                // check if document has been modified since cache was created
                if (cachedData.version !== editor.document.version) {
                    log.debug(`${this.scope}: Cached decorations stale at "${editor.document.fileName}" (cached version: ${cachedData.version}, current version: ${editor.document.version})`);
                    this.updateDecorations(editor);
                    return;
                }

                // move key to the end of cached list
                this.cacheEditorList.splice(this.cacheEditorList.indexOf(key), 1);
                this.cacheEditorList.push(key);

                let countDecoration = 0;
                const cacheRanges = cachedData.ranges;
                for (let i = 0; i < cacheRanges.length; i++) {
                    countDecoration += cacheRanges[i].length;
                    editor.setDecorations(
                        this.decorations[i],
                        cacheRanges[i]
                    );
                }
                if (countDecoration > 0) {
                    log.debug(`${this.scope}: Cached decorations at "${editor.document.fileName}" with ${countDecoration} occurence(s) in ${(Date.now() - startTime)} millisecond(s)`);
                    log.info(`${this.scope}: Cached decorations at "${editor.document.fileName}" with ${countDecoration} occurence(s)`);
                }
                // search on custom treeview
                for (let i = 0; manager.customs && i < manager.customs.length; i++) {
                    if (key === manager.customs[i].uri) {
                        manager.customs[i].update(key);
                    }
                }
            }
            else {
                log.debug(`${this.scope}: Cached decorations not exists at "${editor.document.fileName}"`);
                this.updateDecorations(editor);
            }
        }
        catch (error: any) {
            log.error(`${this.scope}: cacheDecorations: ${error.toString()}`);
        }
    }

    toggle(visibleTextEditors: readonly vscode.TextEditor[]): void {
        this.active = !this.active;
        if (this.active) {
            for (let i = 0; i < visibleTextEditors.length; i++) {
                this.cacheDecorations(visibleTextEditors[i]);
            }
        }
        else {
            for (let i = 0; i < visibleTextEditors.length; i++) {
                this.resetDecorations(visibleTextEditors[i]);
            }
        }
    }

    clearCache(): void {
        this.cacheEditors = {};
    }
}

export default Parser;
