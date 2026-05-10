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

const CMD_EXPECTED_PATH: Record<string, Array<string>> = {
    'workbench.action.openSettingsJson': ['/User/settings.json'],
    'workbench.action.openWorkspaceSettingsFile': ['/.vscode/settings.json'],
    'workbench.action.openRemoteSettingsFile': ['/Machine/settings.json', '/User/settings.json'],
};

export default class Setting {
    uris: Record<string, vscode.Uri>;
    private remoteCandidates: vscode.Uri[];

    constructor(context: vscode.ExtensionContext) {
        this.uris = {};
        this.remoteCandidates = [];

        // Derive user settings URI from globalStorageUri
        // globalStorageUri = .../User/globalStorage/<extension-id>
        // settings.json    = .../User/settings.json
        const userSettingsUri = vscode.Uri.joinPath(
            context.globalStorageUri, '..', '..', 'settings.json'
        );

        if (vscode.env.remoteName !== undefined) {
            // Remote context: in modern VS Code Server, remote-scope settings live in
            // ~/.vscode-server/data/Machine/settings.json (sibling of User/). Older versions
            // stored them in User/settings.json. Keep both as candidates; the active URI is
            // chosen by selectRemoteUri() based on which file actually has the regex setting
            // (or which exists). Default to Machine so first-time writes land in the modern path.
            const machineUri = vscode.Uri.joinPath(
                context.globalStorageUri, '..', '..', '..', 'Machine', 'settings.json'
            );
            this.remoteCandidates = [machineUri, userSettingsUri];
            this.uris['workbench.action.openRemoteSettingsFile'] = machineUri;
            log.debug(`Remote settings candidates: ${machineUri.toString(true)} | ${userSettingsUri.toString(true)}`);
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

    private setRemoteUri(uri: vscode.Uri): void {
        this.uris['workbench.action.openRemoteSettingsFile'] = uri;
    }

    /**
     * Pick the active remote settings URI from the candidates (Machine, then User).
     * Prefers the file that contains the regex setting; otherwise falls back to whichever
     * file exists; otherwise keeps the current default (Machine, for first-time writes).
     */
    private async selectRemoteUri(): Promise<void> {
        if (this.remoteCandidates.length === 0) {
            return;
        }
        let firstExisting: vscode.Uri | undefined;
        for (const uri of this.remoteCandidates) {
            try {
                const jsoncSetting = await this.readSettings(uri);
                if (firstExisting === undefined) {
                    firstExisting = uri;
                }
                if ('/highlight.regex.regexes' in jsoncSetting.ranges) {
                    this.setRemoteUri(uri);
                    log.debug(`Active remote settings URI (contains regex): ${uri.toString(true)}`);
                    return;
                }
            } catch {
                // file missing or unreadable — skip
            }
        }
        if (firstExisting !== undefined) {
            this.setRemoteUri(firstExisting);
            log.debug(`Active remote settings URI (exists, no regex): ${firstExisting.toString(true)}`);
        }
    }

    /**
     * Fallback: execute the command and capture the URI of the opened document.
     * Latest VS Code may open settings in a non-active overlay editor, so we listen on
     * onDidOpenTextDocument (fires regardless of visibility) and also scan all open
     * documents after the command resolves.
     */
    private resolveUriFromCommand(cmd: string): Promise<void> {
        log.trace(`Resolving URI for command: ${cmd}`);
        return new Promise<void>((resolve) => {
            const expectedSuffixes = CMD_EXPECTED_PATH[cmd] ?? ['/settings.json'];
            const disposables: vscode.Disposable[] = [];
            let resolved = false;

            const done = () => {
                if (resolved) {
                    return;
                }
                resolved = true;
                disposables.forEach((d) => d.dispose());
                clearTimeout(timeout);
                resolve();
            };

            const tryDoc = (doc: vscode.TextDocument | undefined): boolean => {
                if (doc && (doc.languageId === 'jsonc' || doc.languageId === 'json')) {
                    for (const suffix of expectedSuffixes) {
                        if (doc.uri.path.endsWith(suffix)) {
                            this.uris[cmd] = doc.uri;
                            log.debug(`Resolved URI for ${cmd}: ${doc.uri.toString(true)}`);
                            done();
                            return true;
                        }
                    }
                }
                return false;
            };

            disposables.push(
                vscode.workspace.onDidOpenTextDocument(tryDoc),
                vscode.window.onDidChangeActiveTextEditor((editor) => tryDoc(editor?.document)),
            );

            const timeout = setTimeout(() => {
                log.trace(`Timeout resolving URI for command: ${cmd}`);
                done();
            }, 5000);

            vscode.commands.executeCommand(cmd).then(() => {
                if (tryDoc(vscode.window.activeTextEditor?.document)) {
                    return;
                }
                for (const doc of vscode.workspace.textDocuments) {
                    if (tryDoc(doc)) {
                        return;
                    }
                }
            });
        });
    }

    async close(cmd: string): Promise<void> {
        if (!(cmd in this.uris)) {
            return;
        }
        const targetPath = this.uris[cmd].path;
        const tab = vscode.window.tabGroups.all
            .flatMap((tg: vscode.TabGroup) => tg.tabs)
            .find((t: vscode.Tab) => t.input instanceof vscode.TabInputText && t.input.uri.path === targetPath);
        if (tab) {
            await vscode.window.tabGroups.close(tab);
        }
    }

    private async readSettings(uri: vscode.Uri): Promise<JsoncSettingParser> {
        const bytes = await vscode.workspace.fs.readFile(uri);
        return new JsoncSettingParser(Buffer.from(bytes).toString('utf8'));
    }

    private isRemoteCmd(cmd: string): boolean {
        return this.remoteCandidates.length > 0
            && (cmd === 'workbench.action.openRemoteSettingsFile');
    }

    async focus(cmd: string, path: string): Promise<void> {
        if (this.isRemoteCmd(cmd)) {
            await this.selectRemoteUri();
        }
        if (!(cmd in this.uris)) {
            await this.resolveUriFromCommand(cmd);
        }
        if (!(cmd in this.uris)) {
            return;
        }
        const uri = this.uris[cmd];
        const jsoncSetting = await this.readSettings(uri);
        if (!(path in jsoncSetting.ranges)) {
            return;
        }
        const range = jsoncSetting.ranges[path];
        const doc = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(doc, { preview: false });
        const start = editor.document.positionAt(range.start);
        const end = editor.document.positionAt(range.end);
        editor.selection = new vscode.Selection(start, end);
        editor.revealRange(new vscode.Range(start, end), vscode.TextEditorRevealType.InCenter);
    }

    async insertSnippet(cmd: string, path: string, snippet: string): Promise<void> {
        if (this.isRemoteCmd(cmd)) {
            await this.selectRemoteUri();
        }
        if (!(cmd in this.uris)) {
            await this.resolveUriFromCommand(cmd);
        }
        if (!(cmd in this.uris)) {
            return;
        }
        const uri = this.uris[cmd];
        const jsoncSetting = await this.readSettings(uri);
        const doc = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(doc, { preview: false });
        if (path in jsoncSetting.ranges) {
            const insertPos = editor.document.positionAt(jsoncSetting.ranges[path].start + 1);
            await editor.insertSnippet(new vscode.SnippetString(`\n\t\${1}`), insertPos);
            editor.revealRange(new vscode.Range(insertPos, insertPos), vscode.TextEditorRevealType.InCenter);
            editor.insertSnippet(new vscode.SnippetString(`${snippet}`));
        }
        else {
            // create new extension key at end of setting
            const insertPos = editor.document.positionAt(jsoncSetting.ranges[''].end - 1);
            await editor.insertSnippet(new vscode.SnippetString(`,\n"${path}": [\n\t\${1}\n\t]`), insertPos);
            editor.revealRange(new vscode.Range(insertPos, insertPos), vscode.TextEditorRevealType.InCenter);
            editor.insertSnippet(new vscode.SnippetString(`${snippet},`));
        }
    }

    async useRemoteSetting(): Promise<boolean> {
        if (this.remoteCandidates.length === 0) {
            return false;
        }
        for (const uri of this.remoteCandidates) {
            try {
                const jsoncSetting = await this.readSettings(uri);
                if ('/highlight.regex.regexes' in jsoncSetting.ranges) {
                    this.setRemoteUri(uri);
                    return true;
                }
            } catch {
                // file missing or unreadable — try the next candidate
            }
        }
        return false;
    }
}
