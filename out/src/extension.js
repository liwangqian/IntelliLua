/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';
const path           = require("path");
const vscode         = require("vscode");
const languageclient = require("vscode-languageclient");

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
            fileEvents: vscode.workspace.createFileSystemWatcher('**/.clientrc')
        }
    };
    
    let disposable = new languageclient.LanguageClient('intelliLua', serverOptions, clientOptions).start();

    context.subscriptions.push(disposable);
}

exports.activate = activate;
