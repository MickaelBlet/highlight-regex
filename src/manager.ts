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
import { log } from './logger';
import { extensionId } from './constants';
import { ScopeManager } from './core/scope';
import Setting from './settings/setting';
import QuickPick from './views/quickpick/quickpick';
import Visible from './views/visible/visible';
import Active from './views/active/active';
import Custom from './views/custom/custom';
import CustomQuickPick from './views/custom/custom-quickpick';

export class Manager {
    private static instance: Manager;

    context: vscode.ExtensionContext;
    configuration: vscode.WorkspaceConfiguration;
    scopeManager: ScopeManager;
    setting: Setting;
    quickpick: QuickPick;
    visible: Visible;
    active: Active;
    globalSettingRemote: boolean | undefined;
    customs: Custom[];
    customQuickpick: CustomQuickPick;

    private constructor() {

    }

    public static getInstance(): Manager {
        if (!Manager.instance) {
            Manager.instance = new Manager();
        }
        return Manager.instance;
    }

    init(context: vscode.ExtensionContext) {
        log.info(`Initialize ${extensionId}`);

        this.context = context;
        this.globalSettingRemote = undefined;
        this.configuration = vscode.workspace.getConfiguration(extensionId);
        this.scopeManager = new ScopeManager(this.configuration);
        this.setting = new Setting(context);
        this.quickpick = new QuickPick(this.scopeManager);
        this.visible = new Visible(this.configuration);
        this.active = new Active();

        this.customs = [];
        for (let i = 1; i < 11; i++) {
            this.customs.push(new Custom(i));
        }
        this.customQuickpick = new CustomQuickPick();
    }
}

export const manager = Manager.getInstance();
