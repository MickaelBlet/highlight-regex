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
import { extensionId } from '../constants';
import { manager } from '../manager';

export function registerGlobalItemCommands(): void {
    manager.context.subscriptions.push(
        vscode.commands.registerCommand('highlight.regex.global.editEntry', async (e: any) => {
            log.debug(`command: highlight.regex.global.editEntry: ${e.path}`);
            try {
                await manager.scopeManager.global.updateConfiguration();
                // first check remote setting
                if (vscode.env.remoteName !== undefined && manager.globalSettingRemote === undefined) {
                    manager.globalSettingRemote = await manager.setting.useRemoteSetting();
                    log.debug(`globalSettingRemote: ${manager.globalSettingRemote}`);
                    manager.scopeManager.global.updateTreeTitle();
                }
                // run on remote
                if (vscode.env.remoteName !== undefined && manager.globalSettingRemote) {
                    await manager.setting.focus('workbench.action.openRemoteSettingsFile', e.path);
                }
                else {
                    if (manager.scopeManager.global.getConfigurationTarget() != vscode.ConfigurationTarget.Workspace) {
                        await manager.setting.focus('workbench.action.openSettingsJson', e.path);
                    }
                    else {
                        await manager.setting.focus('workbench.action.openWorkspaceSettingsFile', e.path);
                    }
                }
            }
            catch (error) {
                log.error(`command: highlight.regex.global.editEntry: ${(error instanceof Error ? error.toString() : String(error))}`);
            }
        })
    );
    manager.context.subscriptions.push(
        vscode.commands.registerCommand('highlight.regex.global.deleteEntry', async (e: any) => {
            log.debug('command: highlight.regex.global.deleteEntry');
            await manager.scopeManager.global.updateConfiguration();
            // remove root path
            let path = e.path.substring('/highlight.regex.regexes/'.length);

            let deletePath = (path: string, configuration: any): void => {
                // split path
                let i = 0;
                for (; i < path.length; i++) {
                    if (path[i] == '/' && i > 0 && path[i - 1] != '\\') {
                        break;
                    }
                }
                let key: string | number = path.substring(0, i);
                if (key[0] == '[' && key[key.length - 1] == ']') {
                    key = parseInt(key.substring(1, key.length - 1));
                }
                if (i != path.length) {
                    if (!(key in configuration)) {
                        log.debug(`${key} not found on ${configuration}`);
                    }
                    deletePath(path.substring(i + 1), configuration[key]);
                    return;
                }
                if (Array.isArray(configuration)) {
                    configuration = configuration.splice(key as number, 1);
                }
                else {
                    delete configuration[key];
                }
            }
            deletePath(path, manager.scopeManager.global.regexes);
            if (manager.scopeManager.global.regexes?.length == 0) {
                manager.scopeManager.global.resetAllDecorations();
                manager.scopeManager.global.regexes = [];
                await manager.scopeManager.global.updateConfiguration();
                manager.scopeManager.global.regexes = vscode.workspace.getConfiguration(extensionId).regexes;
                manager.scopeManager.global.treeDataProvider.loadConfigurations();
                manager.scopeManager.global.treeDataProvider.refresh();
                manager.scopeManager.global.updateAllDecorations();
            }
            else {
                manager.scopeManager.global.treeDataProvider.loadConfigurations();
                manager.scopeManager.global.treeDataProvider.refresh();
                manager.scopeManager.global.resetAllDecorations();
                manager.scopeManager.global.updateAllDecorations();
                manager.scopeManager.global.updateConfiguration();
            }
        })
    );
    manager.context.subscriptions.push(
        vscode.commands.registerCommand('highlight.regex.global.moveUpEntry', async (e: any) => {
            log.debug('command: highlight.regex.global.moveUpEntry');
            // hide quickpick if visible
            if (manager.quickpick.visible) {
                manager.quickpick.quickpick.hide();
            }
            let index = manager.scopeManager.global.moveUpItem(e.index);
            // select item after move
            manager.scopeManager.global.tree.reveal(
                manager.scopeManager.global.treeDataProvider.items[index],
                { select: true }
            );
        })
    );
    manager.context.subscriptions.push(
        vscode.commands.registerCommand('highlight.regex.global.moveDownEntry', async (e: any) => {
            log.debug('command: highlight.regex.global.moveDownEntry');
            // hide quickpick if visible
            if (manager.quickpick.visible) {
                manager.quickpick.quickpick.hide();
            }
            let index = manager.scopeManager.global.moveDownItem(e.index);
            // select item after move
            manager.scopeManager.global.tree.reveal(
                manager.scopeManager.global.treeDataProvider.items[index],
                { select: true }
            );
        })
    );
    manager.context.subscriptions.push(
        vscode.commands.registerCommand('highlight.regex.global.copyToWorkspace', async (e: any) => {
            log.debug('command: highlight.regex.global.copyToWorkspace');
            // hide quickpick if visible
            if (manager.quickpick.visible) {
                manager.quickpick.quickpick.hide();
            }
            await manager.scopeManager.workspace.updateConfiguration();
            // push global item to workspace
            let regex = manager.scopeManager.global.regexes[e.index];
            manager.scopeManager.workspace.regexes.push(regex);
            // get last index of new regex
            let index = manager.scopeManager.workspace.regexes.length - 1;
            // update tree view
            manager.scopeManager.workspace.treeDataProvider.loadConfigurations();
            manager.scopeManager.workspace.treeDataProvider.refresh();
            // update decoration
            manager.scopeManager.workspace.resetAllDecorations();
            manager.scopeManager.workspace.updateAllDecorations();
            manager.scopeManager.workspace.updateConfiguration();
            // select item after copy
            manager.scopeManager.workspace.tree.reveal(
                manager.scopeManager.workspace.treeDataProvider.items[index],
                { select: true }
            );
        })
    );
}
