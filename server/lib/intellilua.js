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

        this._searchOptions   = { filters: [], followLinks: false, externalPaths: [] };
        this._parseOptions    = { luaversion: 5.1 };
        this._showGlobalsOnly = true;
        this._DEBUG_MODE      = false;
        this._initialized     = false;
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

        return true;
    }
    
    debug(msg) {
        if (this._DEBUG_MODE)
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
        let settings = change.settings.intelliLua;
    
        this._searchOptions.filters       = settings.searchOptions.filters;
        this._searchOptions.followLinks   = settings.searchOptions.followLinks;
        this._searchOptions.externalPaths = settings.searchOptions.externalPaths;

        this._parseOptions.luaversion     = settings.parseOptions.luaversion;

        this._showGlobalsOnly             = settings.documentSymbols.showGlobalsOnly;
        this._DEBUG_MODE                  = settings.debug.enable;

        this.fileManager.reset();
        this.fileManager.setRoots(this._searchOptions.externalPaths.concat(this.workspaceRoot));
        this.fileManager.searchFiles(this._searchOptions, ".lua");
    }

    onDidChangeContent(change) {
        var uri = change.document.uri;
        if (this.symbolProvider.isParsed(uri)) {
            this.symbolProvider.markDirty(uri, true);
            return;
        }

        if (!Util.parseFile(this.symbolProvider, this.documents.get(uri), uri, true)) {
            this.debug(`[ERROR] onDidChangeContent >>> parse file ${uri} is failed.`);
            return;
        }
    }

    onDidSave(params) {
        var uri = params.document.uri;
        if (!Util.parseFile(this.symbolProvider, this.documents.get(uri), uri, true)) {
            this.debug(`[ERROR] onDidSave >>> parse file ${uri} is failed.`);
        }
    }

    onDidChangeWatchedFiles(change) {
        this.debug('We recevied an file change event');
    }

    provideDocumentSymbols(params) {
        var uri = params.textDocument.uri;
        if (!Util.parseFile(this.symbolProvider, this.documents.get(uri), uri, false)) {
            debug(`[ERROR] onDocumentSymbol >>> parse file ${uri} is failed.`);
            return [];
        }

        return this.symbolProvider.getDefinitions(uri).filter((symbol) => {
            return (!this._showGlobalsOnly) || (this._showGlobalsOnly && !symbol.isLocal);
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