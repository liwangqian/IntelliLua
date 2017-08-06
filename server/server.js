/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';
const LangServer = require('vscode-languageserver');
const IntelliLua = require('./lib/intelliLua');
const Protocols  = require('./lib/protocols');

const connection = LangServer.createConnection(new LangServer.IPCMessageReader(process),
                                               new LangServer.IPCMessageWriter(process));
var documents    = new LangServer.TextDocuments();
var intelliLua   = null;

connection.onInitialize((params) => {

    intelliLua = IntelliLua.instance();
    intelliLua.initialize({
        workspaceRoot: params.rootPath, 
        connection: connection, 
        documents: documents
    });

    connection.console.info('Initialized.');

    return {
        capabilities: {
            // Tell the client that the server works in FULL text document sync mode
            textDocumentSync: documents.syncKind,
            // Tell the client that the server support code complete
            documentSymbolProvider: true,
            definitionProvider: true,
            completionProvider: {
                resolveProvider: true,
                triggerCharacters: [".", ":"]
            },
            hoverProvider: true
        }
    };
});

documents.onDidChangeContent((change) => {
    intelliLua.onDidChangeContent(change);
});

documents.onDidSave((params) => {
    intelliLua.onDidSave(params);
});

// The settings have changed. Is send on server activation
// as well.
connection.onDidChangeConfiguration((change) => {
    intelliLua.onDidChangeConfiguration(change);
});

connection.onDidChangeWatchedFiles((change) => {
    intelliLua.onDidChangeWatchedFiles(change);
});

connection.onDocumentSymbol((params) => {
    return intelliLua.provideDocumentSymbols(params);
});

connection.onDefinition((params) => {
    return intelliLua.provideDefinitions(params);
});

connection.onCompletion((params) => {
    return intelliLua.provideCompletions(params);
});

// This handler resolve additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item) => {
    return intelliLua.resolveCompletion(item);
});

connection.onHover((params) => {
    return intelliLua.provideHover(params);
});

connection.onRequest(Protocols.UnitTestRequest.type, (params) => {
    return intelliLua.onUnitTestRequest(params);
})

documents.listen(connection);
// Listen on the connection
connection.listen();
//# sourceMappingURL=server.js.map