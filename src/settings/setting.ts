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

export default class Setting {
    uris: Record<string, vscode.Uri>;

    constructor() {
        this.uris = {};
    }

    async close(cmd: string): Promise<void> {
        const tabs = vscode.window.tabGroups.all.map((tg: vscode.TabGroup) => tg.tabs).flat();
        const index = tabs.findIndex((tab: vscode.Tab) => tab.input instanceof vscode.TabInputText && tab.input.uri.path === this.uris[cmd].path);
        if (index !== -1) {
            await vscode.window.tabGroups.close(tabs[index]);
        }
    }

    async focus(cmd: string, path: string): Promise<void> {
        // open setting and focus editor
        if (!(cmd in this.uris)) {
            await vscode.commands.executeCommand(cmd, {});
            // wait executeCommand can be not focus
            await new Promise(resolve => setTimeout(resolve, 2000));
            // get informations from focused editor
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return;
            }
            const text = editor.document.getText();
            let jsoncSetting = new JsoncSettingParser(text);
            this.uris[cmd] = editor.document.uri;
            if (path in jsoncSetting.ranges) {
                editor.selection = new vscode.Selection(editor.document.positionAt(jsoncSetting.ranges[path].start), editor.document.positionAt(jsoncSetting.ranges[path].end));
                editor.revealRange(new vscode.Range(editor.document.positionAt(jsoncSetting.ranges[path].start), editor.document.positionAt(jsoncSetting.ranges[path].end)), vscode.TextEditorRevealType.InCenter);
            }
        }
        else {
            const text = `${await vscode.workspace.fs.readFile(this.uris[cmd])}`;
            let jsoncSetting = new JsoncSettingParser(text);
            if (path in jsoncSetting.ranges) {
                const doc = await vscode.workspace.openTextDocument(this.uris[cmd]);
                const editor = await vscode.window.showTextDocument(doc, { preview: false });
                editor.selection = new vscode.Selection(editor.document.positionAt(jsoncSetting.ranges[path].start), editor.document.positionAt(jsoncSetting.ranges[path].end));
                editor.revealRange(new vscode.Range(editor.document.positionAt(jsoncSetting.ranges[path].start), editor.document.positionAt(jsoncSetting.ranges[path].end)), vscode.TextEditorRevealType.InCenter);
            }
        }
    }

    async useRemoteSetting(): Promise<boolean> {
        // open setting and focus editor
        const cmd = 'workbench.action.openRemoteSettingsFile';
        if (!(cmd in this.uris)) {
            await vscode.commands.executeCommand(cmd, {});
            log.trace(`wait...`);
            // wait executeCommand can be not focus
            await new Promise(resolve => setTimeout(resolve, 1000));
            // get informations from focused editor
            while (vscode.window.activeTextEditor == undefined ||
                vscode.window.activeTextEditor == null ||
                vscode.window.activeTextEditor?.document?.languageId != 'jsonc') {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            log.debug(`Remote uri: ${vscode.window.activeTextEditor.document.uri.toString(true)}`);
            this.uris[cmd] = vscode.window.activeTextEditor.document.uri;
            let jsoncSetting = new JsoncSettingParser(vscode.window.activeTextEditor.document.getText());
            await this.close(cmd);
            if ('/highlight.regex.regexes' in jsoncSetting.ranges) {
                return true;
            }
            return false;
        }
        else {
            const text = `${await vscode.workspace.fs.readFile(this.uris[cmd])}`;
            let jsoncSetting = new JsoncSettingParser(text);
            if ('/highlight.regex.regexes' in jsoncSetting.ranges) {
                return true;
            }
            return false;
        }
    }
}
