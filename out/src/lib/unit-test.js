"use strict";

const fs        = require('fs');
const path      = require('path');
const vscode    = require('vscode');
const protocols = require("./protocols");

const bustedCfgTemplate = path.resolve(__dirname, "../templates/.busted");
const luacovCfgTemplate = path.resolve(__dirname, "../templates/.luacov");

const RequestCallbacks = {
    ready: (params, context) => {
        context.outputChannel.appendLine("Server> " + params.message);
    },
    started: (params, context) => {
        context.outputChannel.appendLine("Server> test is started.");
    },
    finished: (params, context) => {
        context.outputChannel.appendLine("Server> test is finished.");
        if (params) {
            context.outputChannel.appendLine("Server> " + JSON.stringify(params));
        }
    },
    stopped: (params, context) => {
        context.outputChannel.appendLine("Server> test is stopped.");
    },
    reject: (params, context) => {
        context.outputChannel.appendLine("Server> " + params.message);
    },
    error: (params, context) => {
        context.outputChannel.appendLine("Server> " + params.message);
    },
    report: (params, context) => {

    },
    message: (params, context) => {
        context.outputChannel.append("Server> " + params.message);
        context.outputChannel.appendLine("\nServer>");
    }
}

function defaultCallback(params, context) {
    context.outputChannel.appendLine("Unknown request type.");
}

function onUnitTestRequest(params, context) {
    context.outputChannel.appendLine("Server> " + params.type);
    const callback = RequestCallbacks[params.type] || defaultCallback;
    return callback(params.params, context);
}

function SendRequest(type, params, context) {
    context.outputChannel.appendLine("Client> " + type);
    context.options.connection.sendRequest(protocols.UnitTestRequest.type, {
        type: type, 
        params: params
    });
}

function getActiveTextEditorFilePath() {
    const activeTextEditor = vscode.window.activeTextEditor;
    if (activeTextEditor === undefined || activeTextEditor.document === undefined) {
        vscode.window.showErrorMessage("Busted command should run in a lua text editor.");
        return null;
    }

    if (activeTextEditor.document.languageId != "lua") {
        vscode.window.showErrorMessage("Busted command should run in a lua text editor.")
        return null;
    }

    return activeTextEditor.document.fileName;
}

class UnitTestManager {
    constructor(options) {
        this.outputChannel = vscode.window.createOutputChannel("busted");
        this.outputChannel.clear();

        this.options = options;
        
        this.options.connection.onRequest(protocols.UnitTestRequest.type, (params) => {
            return onUnitTestRequest(params, this);
        });
    }

    onInitCommand() {
        this.outputChannel.appendLine("Client> init busted.");

        const fileName = getActiveTextEditorFilePath();
        if (fileName == null) {
            return;
        }

        const initPath = path.dirname(fileName);
        const bustedInitFileName = path.resolve(initPath, ".busted");

        if (!fs.existsSync(bustedInitFileName) && fs.existsSync(bustedCfgTemplate)) {
            var readable = fs.createReadStream(bustedCfgTemplate);
            var writable = fs.createWriteStream(bustedInitFileName);
            readable.pipe(writable);
        }

        this.outputChannel.appendLine("open busted configuration file: " + bustedInitFileName);

        const luacovInitFileName = path.resolve(initPath, ".luacov");

        if (!fs.existsSync(luacovInitFileName) && fs.existsSync(luacovCfgTemplate)) {
            var readable = fs.createReadStream(luacovCfgTemplate);
            var writable = fs.createWriteStream(luacovInitFileName);
            readable.pipe(writable);
        }
        
        vscode.workspace.openTextDocument(bustedInitFileName).then((document) => {
            vscode.window.showTextDocument(document);
        }, () => {
            this.outputChannel.appendLine("Open .busted file failed, create an issue to https://github.com/liwangqian/intelliLua/issues")
        });
        
        // const document_2 = vscode.workspace.openTextDocument(luacovInitFileName);
        // vscode.window.showTextDocument(document_2);
        
    }

    onRunCommand() {
        const fileName = getActiveTextEditorFilePath();
        if (fileName == null) {
            return;
        }

        const cwd = path.dirname(fileName);

        SendRequest("run", {cwd: cwd, fileName: fileName}, this);
    }

    onStopCommand() {
        SendRequest("stop", {}, this);
    }

    onNewTestCommand() {
        this.outputChannel.appendLine("Client> new test command triggered.");
    }

    onShowReportCommand() {
        this.outputChannel.appendLine("Client> show report command triggered.");
    }

    onSaveReportCommand() {
        this.outputChannel.appendLine("Client> save report command triggered.");
    }
}

exports.UnitTestManager = UnitTestManager;

