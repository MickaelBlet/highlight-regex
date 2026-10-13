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

interface DetailView {
    setDetail(detail: boolean): void;
}

function registerViewDetailCommands(name: string, getView: () => DetailView | undefined): void {
    manager.context.subscriptions.push(
        vscode.commands.registerCommand(`highlight.regex.${name}.showDetail`, () => {
            log.debug(`command: highlight.regex.${name}.showDetail`);
            getView()?.setDetail(true);
        })
    );
    manager.context.subscriptions.push(
        vscode.commands.registerCommand(`highlight.regex.${name}.hideDetail`, () => {
            log.debug(`command: highlight.regex.${name}.hideDetail`);
            getView()?.setDetail(false);
        })
    );
}

export function registerDetailCommands(): void {
    registerViewDetailCommands('visible', () => manager.visible);
    registerViewDetailCommands('active', () => manager.active);
    for (let i = 1; i < 11; i++) {
        registerViewDetailCommands(`custom${i}`, () => manager.customs[i - 1]);
    }
}
