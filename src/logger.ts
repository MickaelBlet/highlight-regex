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

import { window, LogOutputChannel } from 'vscode';
import { extensionName } from './constants';

/**
 * Singleton Logger class that wraps VS Code's LogOutputChannel
 * Provides centralized logging throughout the extension
 */
export class Logger {
    private static instance: Logger;
    private channel: LogOutputChannel;

    /**
     * Private constructor to enforce singleton pattern
     */
    private constructor() {

    }

    /**
     * Get the singleton Logger instance
     * Automatically creates the instance on first access
     */
    public static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    public init(): void {
        this.channel = window.createOutputChannel(extensionName, { log: true });
        // Set log level to Debug by default (can be changed in VS Code output panel)
        this.channel.info('Logger initialized. Change log level via the gear icon in the Output panel to see Debug/Trace messages.');
    }

    /**
     * Log a trace message
     */
    public trace(message: string, ...args: any[]): void {
        this.channel.trace(message, ...args);
    }

    /**
     * Log a debug message
     */
    public debug(message: string, ...args: any[]): void {
        this.channel.debug(message, ...args);
    }

    /**
     * Log an info message
     */
    public info(message: string, ...args: any[]): void {
        this.channel.info(message, ...args);
    }

    /**
     * Log a warning message
     */
    public warn(message: string, ...args: any[]): void {
        this.channel.warn(message, ...args);
    }

    /**
     * Log an error message
     */
    public error(message: string | Error, ...args: any[]): void {
        this.channel.error(message, ...args);
    }

    /**
     * Show the output channel
     */
    public show(): void {
        this.channel.show();
    }

    /**
     * Hide the output channel
     */
    public hide(): void {
        this.channel.hide();
    }

    /**
     * Clear the output channel
     */
    public clear(): void {
        this.channel.clear();
    }

    /**
     * Dispose the output channel
     */
    public dispose(): void {
        this.channel.dispose();
    }

    /**
     * Get the underlying VS Code LogOutputChannel
     */
    public getChannel(): LogOutputChannel {
        return this.channel;
    }
}

/**
 * Convenience export for backward compatibility
 * Usage: log.debug('message') or Logger.getInstance().debug('message')
 */
export const log = Logger.getInstance();