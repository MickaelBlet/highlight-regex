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
import { extensionId, extensionName } from './constants';
import { log } from './logger';
import { manager } from './manager';
import { registerAllCommands } from './commands';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    // Initialize log and store in global
    log.init();
    // Initialize manager and store in global
    manager.init(context);

    // Register all commands
    registerAllCommands();

    const timeoutTimer: { [key: string]: NodeJS.Timeout } = {};

    // First update visible editors
    for (let i = 0; i < vscode.window.visibleTextEditors.length; i++) {
        const textEditor = vscode.window.visibleTextEditors[i];
        for (const scopeKey in manager.scopeManager.map) {
            if (manager.scopeManager.map.hasOwnProperty(scopeKey)) {
                manager.scopeManager.map[scopeKey].parser.updateDecorations(textEditor);
            }
        }
    }

    manager.visible.update(vscode.window.visibleTextEditors);
    manager.active.update(vscode.window.activeTextEditor);

    for (let i = 0; i < manager.customs.length; i++) {
        manager.customs[i].loadConfiguration();
    }

    // Event configuration change
    vscode.workspace.onDidChangeConfiguration(async (event) => {
        for (const timerKey in timeoutTimer) {
            if (timeoutTimer.hasOwnProperty(timerKey)) {
                clearTimeout(timeoutTimer[timerKey]);
            }
        }
        manager.configuration = vscode.workspace.getConfiguration(extensionId);
        for (const scopeKey in manager.scopeManager.map) {
            if (manager.scopeManager.map.hasOwnProperty(scopeKey)) {
                if (event.affectsConfiguration(manager.scopeManager.map[scopeKey].propertyName)) {
                    log.debug(`event: onDidChangeConfiguration: ${manager.scopeManager.map[scopeKey].propertyName} updated`);
                    // Check if global on remote setting
                    if (scopeKey === 'global' && vscode.env.remoteName !== undefined) {
                        manager.globalSettingRemote = await manager.setting.useRemoteSetting();
                        log.debug(`globalSettingRemote: ${manager.globalSettingRemote}`);
                    }
                    // Update title of tree
                    manager.scopeManager.map[scopeKey].updateTreeTitle();
                    if (manager.scopeManager.map[scopeKey].configurationChangeEvent) {
                        manager.scopeManager.map[scopeKey].resetAllDecorations();
                        manager.scopeManager.map[scopeKey].loadFromConfiguration();
                        manager.scopeManager.map[scopeKey].updateAllDecorations();
                    }
                }
            }
        }
        for (let i = 0; i < manager.customs.length; i++) {
            manager.customs[i].loadConfiguration();
        }
    });

    // Event change visible editors
    let lastVisibleEditors: { [key: string]: boolean } = {};
    vscode.window.onDidChangeVisibleTextEditors(visibleTextEditors => {
        if (visibleTextEditors.length > 0) {
            log.debug(`event: onDidChangeVisibleTextEditors: ${visibleTextEditors.length} editor(s):`);
            for (const uriEditor of visibleTextEditors.map((editor) => editor.document.uri.toString(true))) {
                log.debug(`- ${uriEditor}`);
            }
        }
        const newVisibleEditors: { [key: string]: boolean } = {};
        for (let i = 0; i < visibleTextEditors.length; i++) {
            const textEditor = visibleTextEditors[i];
            const key = textEditor.document.uri.toString(true) + textEditor.viewColumn;
            newVisibleEditors[key] = true;
            // If new visible editor
            if (!(key in lastVisibleEditors)) {
                for (const scopeKey in manager.scopeManager.map) {
                    if (manager.scopeManager.map.hasOwnProperty(scopeKey)) {
                        manager.scopeManager.map[scopeKey].parser.cacheDecorations(textEditor);
                    }
                }
            }
        }
        lastVisibleEditors = newVisibleEditors;
        manager.visible.update(visibleTextEditors);
    });

    // Event change text content
    vscode.workspace.onDidChangeTextDocument(event => {
        const extensionNameLower = extensionName.toLowerCase();
        const openEditors = vscode.window.visibleTextEditors.filter(
            (editor) => editor.document.uri === event.document.uri
        );
        let isNotLogOuput = false;
        for (let i = 0; i < openEditors.length; i++) {
            const textEditor = openEditors[i];
            if (textEditor.document.uri.scheme !== 'output' || !textEditor.document.uri.toString(true).toLowerCase().includes(extensionNameLower)) {
                isNotLogOuput = true;
                triggerUpdate(textEditor);
            }
        }
        if (isNotLogOuput && openEditors.length > 0) {
            log.debug(`event: onDidChangeTextDocument: ${openEditors.length} editor(s):`);
            for (const uriEditor of openEditors.map((editor) => editor.document.uri.toString(true))) {
                log.debug(`- ${uriEditor}`);
            }
        }
    });

    // Trigger call update decoration
    function triggerUpdate(editor: vscode.TextEditor): void {
        const key = editor.document.uri.toString(true) + editor.viewColumn;
        if (key in timeoutTimer && timeoutTimer[key]) {
            clearTimeout(timeoutTimer[key]);
        }
        timeoutTimer[key] = setTimeout(() => {
            for (const scopeKey in manager.scopeManager.map) {
                if (manager.scopeManager.map.hasOwnProperty(scopeKey)) {
                    manager.scopeManager.map[scopeKey].parser.updateDecorations(editor);
                }
            }
            manager.visible.update(vscode.window.visibleTextEditors);
            manager.active.update(vscode.window.activeTextEditor);
        }, manager.configuration.delay);
    }

    // Change active editor
    vscode.window.onDidChangeActiveTextEditor((editor) => {
        log.debug(`event: onDidChangeTextDocument: ${editor?.document.uri.toString(true)} editor(s):`);
        manager.active.update(editor);
    });
}

export function deactivate(): void {
    // Clean up decorations
    for (const scopeKey in manager.scopeManager.map) {
        if (manager.scopeManager.map.hasOwnProperty(scopeKey)) {
            manager.scopeManager.map[scopeKey].parser.dispose();
        }
    }
}
