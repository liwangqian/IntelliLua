/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';
const path           = require("path");
const vscode         = require("vscode");
const languageclient = require("vscode-languageclient");
const unitTest       = require("./lib/unit-test");

var unitTestManager;

function activate(context) {
    let serverModule  = context.asAbsolutePath(path.join('server', 'server.js'));
    let debugOptions  = { execArgv: ["--nolazy", "--debug=6004"] };
    let serverOptions = {
        run: { module: serverModule, transport: languageclient.TransportKind.ipc },
        debug: { module: serverModule, transport: languageclient.TransportKind.ipc, options: debugOptions }
    };

    let clientOptions = {

        documentSelector: ['lua'],
        synchronize: {
            configurationSection: 'intelliLua',
            fileEvents: [vscode.workspace.createFileSystemWatcher('**/.lua')]
        }
    };
    
    let connection = new languageclient.LanguageClient('intelliLua', serverOptions, clientOptions);
    context.subscriptions.push(connection.start());

    unitTestManager = new unitTest.UnitTestManager({connection: connection});

    context.subscriptions.push(vscode.commands.registerCommand('intelliLua.bustedInit', () => {
        unitTestManager.onInitCommand();
    }));
    context.subscriptions.push(vscode.commands.registerCommand("intelliLua.bustedRun", () => {
        unitTestManager.onRunCommand();
    }));
    context.subscriptions.push(vscode.commands.registerCommand("intelliLua.bustedStop", () => {
        unitTestManager.onStopCommand();
    }));
    context.subscriptions.push(vscode.commands.registerCommand("intelliLua.bustedNewTest", () => {
        unitTestManager.onNewTestCommand();
    }));
    context.subscriptions.push(vscode.commands.registerCommand("intelliLua.bustedShowReport", () => {
        unitTestManager.onShowReportCommand();
    }));
    context.subscriptions.push(vscode.commands.registerCommand("intelliLua.bustedSaveReport", () => {
        unitTestManager.onSaveReportCommand();
    }));
}

exports.activate = activate;
