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

export function registerVisibleCommands(): void {
    manager.context.subscriptions.push(
        vscode.commands.registerCommand('highlight.regex.visible.toggleListView', () => {
            log.debug('command: highlight.regex.visible.toggleListView');
            vscode.commands.executeCommand(`setContext`, `highlight.regex.visible.listView.active`, false);
            manager.visible.mode = false;
            manager.visible.update(vscode.window.visibleTextEditors);
            manager.visible.refresh();
        })
    );
    manager.context.subscriptions.push(
        vscode.commands.registerCommand('highlight.regex.visible.toggleTreeView', () => {
            log.debug('command: highlight.regex.visible.toggleTreeView');
            vscode.commands.executeCommand(`setContext`, `highlight.regex.visible.listView.active`, true);
            manager.visible.mode = true;
            manager.visible.update(vscode.window.visibleTextEditors);
            manager.visible.refresh();
        })
    );
}
