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
import JsoncSettingParser from './jsonc-parser';

const CMD_EXPECTED_PATH: Record<string, string> = {
    'workbench.action.openSettingsJson': '/User/settings.json',
    'workbench.action.openWorkspaceSettingsFile': '/.vscode/settings.json',
    'workbench.action.openRemoteSettingsFile': '/User/settings.json',
};

export default class Setting {
    uris: Record<string, vscode.Uri>;

    constructor(context: vscode.ExtensionContext) {
        this.uris = {};

        // Derive user settings URI from globalStorageUri
        // globalStorageUri = .../User/globalStorage/<extension-id>
        // settings.json    = .../User/settings.json
        const userSettingsUri = vscode.Uri.joinPath(
            context.globalStorageUri, '..', '..', 'settings.json'
        );

        if (vscode.env.remoteName !== undefined) {
            // Remote context: globalStorageUri points to remote host
            this.uris['workbench.action.openRemoteSettingsFile'] = userSettingsUri;
            log.debug(`Pre-resolved remote settings URI: ${userSettingsUri.toString(true)}`);
        } else {
            this.uris['workbench.action.openSettingsJson'] = userSettingsUri;
            log.debug(`Pre-resolved user settings URI: ${userSettingsUri.toString(true)}`);
        }

        // Workspace settings
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            const wsUri = vscode.Uri.joinPath(workspaceFolders[0].uri, '.vscode', 'settings.json');
            this.uris['workbench.action.openWorkspaceSettingsFile'] = wsUri;
            log.debug(`Pre-resolved workspace settings URI: ${wsUri.toString(true)}`);
        }
    }

    async close(cmd: string): Promise<void> {
        if (!(cmd in this.uris)) {
            return;
        }
        const tabs = vscode.window.tabGroups.all.map((tg: vscode.TabGroup) => tg.tabs).flat();
        const index = tabs.findIndex((tab: vscode.Tab) => tab.input instanceof vscode.TabInputText && tab.input.uri.path === this.uris[cmd].path);
        if (index !== -1) {
            await vscode.window.tabGroups.close(tabs[index]);
        }
    }

    /**
     * Fallback: resolve URI by executing the command and listening for the editor event.
     * Used only when the URI cannot be pre-computed (e.g., local settings from a remote context).
     */
    private resolveUriFromCommand(cmd: string): Promise<void> {
        log.trace(`Resolving URI for command: ${cmd}`);
        return new Promise<void>((resolve) => {
            let resolved = false;
            const done = () => {
                if (resolved) {
                    return;
                }
                resolved = true;
                disposable.dispose();
                clearTimeout(timeout);
                resolve();
            };

            const expectedSuffix = CMD_EXPECTED_PATH[cmd] ?? '/settings.json';
            const check = (editor: vscode.TextEditor | undefined) => {
                if (editor?.document?.languageId === 'jsonc' && editor.document.uri.path.endsWith(expectedSuffix)) {
                    this.uris[cmd] = editor.document.uri;
                    log.debug(`Resolved URI for ${cmd}: ${editor.document.uri.toString(true)}`);
                    done();
                }
            };

            const timeout = setTimeout(() => {
                log.trace(`Timeout resolving URI for command: ${cmd}`);
                done();
            }, 5000);

            const disposable = vscode.window.onDidChangeActiveTextEditor(check);

            vscode.commands.executeCommand(cmd, {}).then(() => {
                check(vscode.window.activeTextEditor);
            });
        });
    }

    async focus(cmd: string, path: string): Promise<void> {
        if (!(cmd in this.uris)) {
            await this.resolveUriFromCommand(cmd);
        }

        if (!(cmd in this.uris)) {
            return;
        }

        const text = `${await vscode.workspace.fs.readFile(this.uris[cmd])}`;
        const jsoncSetting = new JsoncSettingParser(text);
        if (path in jsoncSetting.ranges) {
            const doc = await vscode.workspace.openTextDocument(this.uris[cmd]);
            const editor = await vscode.window.showTextDocument(doc, { preview: false });
            editor.selection = new vscode.Selection(editor.document.positionAt(jsoncSetting.ranges[path].start), editor.document.positionAt(jsoncSetting.ranges[path].end));
            editor.revealRange(new vscode.Range(editor.document.positionAt(jsoncSetting.ranges[path].start), editor.document.positionAt(jsoncSetting.ranges[path].end)), vscode.TextEditorRevealType.InCenter);
        }
    }

    async insertSnippet(cmd: string, path: string, snippet: string): Promise<void> {
        if (!(cmd in this.uris)) {
            await this.resolveUriFromCommand(cmd);
        }

        if (!(cmd in this.uris)) {
            return;
        }

        const text = `${await vscode.workspace.fs.readFile(this.uris[cmd])}`;
        const jsoncSetting = new JsoncSettingParser(text);
        const doc = await vscode.workspace.openTextDocument(this.uris[cmd]);
        const editor = await vscode.window.showTextDocument(doc, { preview: false });
        if (path in jsoncSetting.ranges) {
            await editor.insertSnippet(new vscode.SnippetString(`\n\t\${1}`), editor.document.positionAt(jsoncSetting.ranges[path].start + 1));
            editor.revealRange(new vscode.Range(editor.document.positionAt(jsoncSetting.ranges[path].start + 1), editor.document.positionAt(jsoncSetting.ranges[path].start + 1)), vscode.TextEditorRevealType.InCenter);
            editor.insertSnippet(new vscode.SnippetString(`${snippet}`));
        }
        else {
            // create new extension key at end of setting
            await editor.insertSnippet(new vscode.SnippetString(`,\n"${path}": [\n\t\${1}\n\t]`), editor.document.positionAt(jsoncSetting.ranges[''].end - 1));
            editor.revealRange(new vscode.Range(editor.document.positionAt(jsoncSetting.ranges[''].end - 1), editor.document.positionAt(jsoncSetting.ranges[''].end - 1)), vscode.TextEditorRevealType.InCenter);
            editor.insertSnippet(new vscode.SnippetString(`${snippet},`));
        }
    }

    async useRemoteSetting(): Promise<boolean> {
        const cmd = 'workbench.action.openRemoteSettingsFile';
        if (!(cmd in this.uris)) {
            await this.resolveUriFromCommand(cmd);
            if (!(cmd in this.uris)) {
                return false;
            }
        }

        try {
            const text = `${await vscode.workspace.fs.readFile(this.uris[cmd])}`;
            const jsoncSetting = new JsoncSettingParser(text);
            return '/highlight.regex.regexes' in jsoncSetting.ranges;
        } catch {
            return false;
        }
    }
}
