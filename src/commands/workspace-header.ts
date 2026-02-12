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
import { manager } from '../manager';

export function registerWorkspaceHeaderCommands(): void {
    manager.context.subscriptions.push(
        vscode.commands.registerCommand('highlight.regex.workspace.toggleCheckAll', async () => {
            log.debug('command: highlight.regex.workspace.toggleCheckAll');
            let count = 0;
            for (let i = 0; i < manager.scopeManager.workspace.regexes.length; i++) {
                if (manager.scopeManager.workspace.regexes[i].active) {
                    count++;
                }
            }
            if (count >= manager.scopeManager.workspace.regexes.length / 2) {
                for (let i = 0; i < manager.scopeManager.workspace.regexes.length; i++) {
                    manager.scopeManager.workspace.regexes[i].active = false;
                }
            }
            else {
                for (let i = 0; i < manager.scopeManager.workspace.regexes.length; i++) {
                    manager.scopeManager.workspace.regexes[i].active = true;
                }
            }
            manager.scopeManager.workspace.treeDataProvider.loadConfigurations();
            manager.scopeManager.workspace.treeDataProvider.refresh();
            manager.scopeManager.workspace.resetAllDecorations();
            manager.scopeManager.workspace.updateAllDecorations();
            manager.scopeManager.workspace.updateConfiguration();
        })
    );
    manager.context.subscriptions.push(
        vscode.commands.registerCommand('highlight.regex.workspace.addEntry', async () => {
            log.debug('command: highlight.regex.workspace.addEntry');
            try {
                await manager.scopeManager.workspace.updateConfiguration();
                let snippet = manager.configuration.defaultAddSnippet;
                // is array
                if (typeof snippet !== 'string') {
                    snippet = snippet.join('\n');
                }
                const next = manager.scopeManager.workspace.regexes.length > 0 ? ',' : '';
                await manager.setting.insertSnippet('workbench.action.openWorkspaceSettingsFile',
                                                    `/${manager.scopeManager.workspace.propertyName}`,
                                                    `${snippet}${next}`);
            }
            catch (error) {
                log.error(`command: highlight.regex.workspace.addEntry: ${(error instanceof Error ? error.toString() : String(error))}`);
                vscode.window.showErrorMessage(`${(error instanceof Error ? error.toString() : String(error))}`);
            }
        })
    );
    manager.context.subscriptions.push(
        vscode.commands.registerCommand('highlight.regex.workspace.refreshEntries', () => {
            log.debug('command: highlight.regex.workspace.refreshEntries');
            manager.scopeManager.workspace.loadFromConfiguration();
        })
    );
    manager.context.subscriptions.push(
        vscode.commands.registerCommand('highlight.regex.workspace.collapseAll', () => {
            log.debug('command: highlight.regex.workspace.collapseAll');
            manager.scopeManager.workspace.treeDataProvider.collapseAll();
        })
    );
}
