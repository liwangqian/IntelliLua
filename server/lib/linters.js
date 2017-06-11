"use strict";

const Uri        = require('vscode-uri').default;
const LangServer = require('vscode-languageserver');
const path       = require('path');
const fs         = require('fs');

const luacheckRegex    = /^(.+):(\d+):(\d+)-(\d+): \(([EW])(\d+)\) (.+)$/;
const luacompilerRegex = /^luac:\s+.+\:(\d+)\:\s+(.+)$/;

var DiagnosticSeverity = {};
DiagnosticSeverity[DiagnosticSeverity["Error"]       = 1] = "Error";
DiagnosticSeverity[DiagnosticSeverity["Warning"]     = 2] = "Warning";
DiagnosticSeverity[DiagnosticSeverity["Information"] = 3] = "Information";
DiagnosticSeverity[DiagnosticSeverity["Hint"]        = 4] = "Hint";

function errCodeToSeverity(errCode) {
    switch (errCode) {
        case "E": return DiagnosticSeverity.Error;
        case "W": return DiagnosticSeverity.Warning;
        default : return DiagnosticSeverity.Information;
    }
}

class Luachecker {
    constructor() {
    }
    
    parseDiagnostics(data) {
        var diagnostics = [];

        if (data.error != null && data.error.message === 'stdout maxBuffer exceeded.') {
            return diagnostics;
        }

        //luacheck output to stdout channal
        data.stdout.split(/\r\n|\r|\n/).forEach(function(line) {
            var matched = luacheckRegex.exec(line);
            if (!matched) {
                return;
            }

            var line     = parseInt(matched[2]);
            var schar    = parseInt(matched[3]);
            var echar    = parseInt(matched[4]);
            var eType    = errCodeToSeverity(matched[5]);
            var eCode    = parseInt(matched[6])
            var errMsg   = matched[7];

            diagnostics.push(LangServer.Diagnostic.create(
                LangServer.Range.create(line - 1, schar - 1, line - 1, echar),
                errMsg, eType, eCode, "luacheck"
            ));
        });;

        return diagnostics;
    }
    
    command(document, iLua) {
        const settings = iLua.settings.luacheck;
        var args = [];

        if (fs.exists(path.resolve(settings.configFilePath, ".luacheckrc"))) {
            args.push("--config", settings.configFilePath);
        }

        const defaultOpt = ['-m', '-t', '--no-self', '--no-color', '--codes', '--ranges', '--formatter', 'plain'];
        args.push.apply(args, defaultOpt);

        const jobs = settings.jobs;
        if (jobs > 1) {
            args.push('-j', jobs);
        }

        var globals = iLua.symbolProvider.getDependences(document.uri).map((dep) => {
            return dep.name;
        });

        if (globals.length > 0) {
            args.push('--read-globals');
            args.push.apply(args, globals);
        }

        const fileName = Uri.parse(document.uri).fsPath;
        args.push("--filename", fileName, "-"); //use stdin

        var cmd = settings.luacheckPath || 'luacheck';

        return {
            cmd: cmd,
            cwd: path.dirname(fileName), 
            args: args
        };
    }
};

exports.Luachecker = Luachecker;