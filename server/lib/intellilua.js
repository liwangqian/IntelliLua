"use strict";

const Langserver           = require('vscode-languageserver');
const fs                   = require('fs');
const Uri                  = require('vscode-uri').default;
const Util                 = require('./util');
const {FileManager }       = require('./file-manager');
const {SymbolProvider}     = require('./symbol-provider');
const {CompletionProvider} = require('./completion-provider');
const {DefinitionProvider} = require('./definition-provider');
const {HoverProvider}      = require('./hover-provider');
const {DiagnosticProvider} = require('./diagnostic-provider');
const unitTest             = require('./unit-test');
const Protocols            = require('./protocols');

class IntelliLua {
    constructor() {
        this.workspaceRoot = null;
        this.conn          = null;
        this.documents     = null;

        this.fileManager        = new FileManager();
        this.symbolProvider     = new SymbolProvider(this);
        this.completionProvider = new CompletionProvider(this);
        this.definitionProvider = new DefinitionProvider(this);
        this.hoverProvider      = new HoverProvider(this);
        this.diagnosticProvider = new DiagnosticProvider(this);
        this.testManager        = new unitTest.TestManager(this);

        this.settings     = null;
        this._initialized = false;
    }

    initialize(context) {
        if (this._initialized) {
            return true;
        }

        if (!context || !context.workspaceRoot || !context.connection || !context.documents) {
            return false;
        }

        this.workspaceRoot = context.workspaceRoot;
        this.conn          = context.connection;
        this.documents     = context.documents;
        this._initialized  = true;

        setTimeout(() => {
            this.conn.sendRequest(Protocols.UnitTestRequest.type, {
                type: "ready", 
                params: {message: "Hello busted."}
            });
        }, 1000);

        return true;
    }
    
    debug(msg) {
        if (this.settings.debug.enable)
            this.conn.console.log(msg);
    }

    getDocument(uri) {
        var document = this.documents.get(uri);
        if (document) {
            return document;
        }

        var fileName = Uri.parse(uri).fsPath;
        document = Langserver.TextDocument.create(uri, "lua", 0, fs.readFileSync(fileName).toString());
        return document;
    }

    onDidChangeConfiguration(change) {
        let settings  = change.settings.intelliLua;
        this.settings = change.settings.intelliLua;

        this.fileManager.reset();
        this.fileManager.setRoots(settings.searchOptions.externalPaths.concat(this.workspaceRoot));
        this.fileManager.searchFiles(settings.searchOptions, ".lua");
    }

    onDidChangeContent(change) {
        var uri = change.document.uri;
        if (this.symbolProvider.isParsed(uri)) {
            this.symbolProvider.markDirty(uri, true);
        } else {
            if (!Util.parseFile(this.symbolProvider, change.document, uri, true)) {
                this.debug(`[ERROR] onDidChangeContent >>> parse file ${uri} is failed.`);
            }
        }

        this.diagnosticProvider.provideDiagnostic(change.document);
    }

    onDidSave(params) {
        var uri = params.document.uri;
        if (!Util.parseFile(this.symbolProvider, this.documents.get(uri), uri, true)) {
            this.debug(`[ERROR] onDidSave >>> parse file ${uri} is failed.`);
        }

        this.diagnosticProvider.provideDiagnostic(params.document);
    }

    onDidChangeWatchedFiles(change) {
        this.debug('We recevied an file change event');
    }

    provideDocumentSymbols(params) {
        var uri = params.textDocument.uri;
        if (!Util.parseFile(this.symbolProvider, this.documents.get(uri), uri, false)) {
            this.debug(`[ERROR] onDocumentSymbol >>> parse file ${uri} is failed.`);
            return [];
        }

        return this.symbolProvider.getDefinitions(uri).filter((symbol) => {
            return (!this.settings.showGlobalsOnly) || (this.settings.showGlobalsOnly && !symbol.isLocal);
        }).map((symbol) => {
            return Langserver.SymbolInformation.create(symbol.name, symbol.kind, 
                                                    symbol.range, symbol.uri, 
                                                    symbol.base);
        });
    }

    provideDefinitions(params) {
        return this.definitionProvider.provideDefinition(params);
    }

    provideCompletions(params) {
        return this.completionProvider.provideCompletions(params);
    }

    resolveCompletion(item) {
        return this.completionProvider.resolveCompletion(item);
    }

    provideHover(params) {
        return this.hoverProvider.provideHover(params);
    }

    sendDiagnostics(diagnostics) {
        this.conn.sendDiagnostics(diagnostics);
    }

    showWarningMessage(msg) {
        this.conn.window.showWarningMessage(msg);
    }

    onUnitTestRequest(params) {
        this.testManager.onUnitTestRequest(params);
    }

    sendUnitTestRequest(type, params) {
        this.conn.sendRequest(Protocols.UnitTestRequest.type, {type: type, params: params});
    }
}

//singletonize
var _intelliLuaInstance = null;

function instance() {
    if (!_intelliLuaInstance) {
        _intelliLuaInstance = new IntelliLua();
    }

    return _intelliLuaInstance;
}

exports.instance = instance;