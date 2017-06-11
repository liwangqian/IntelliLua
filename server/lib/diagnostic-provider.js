"use strict";

const execFile = require('child_process').execFile;
const {Luachecker} = require('./linters');

const Linter = {};
(function (Linter) {
    function lint(checker, input) {
        return new Promise((resolve, reject) => {
            var proc = execFile(checker.cmd, checker.args, {cwd: checker.cwd}, 
            (error, stdout, stderr) => {
                if (error != null) {
                    reject({error: error, stdout: stdout, stderr: stderr});
                } else {
                    resolve({error: error, stdout: stdout, stderr: stderr});
                }
            });

            proc.stdin.end(input);
        });
    }

    Linter.lint = lint;
})(Linter);

class DiagnosticProvider {
    constructor(intelliLua) {
        this._intelliLua = intelliLua;
        this._luachecker = new Luachecker();
    }

    provideDiagnostic(document, lintOnFly) {
        const command = this._luachecker.command(document, this._intelliLua);
        Linter.lint(command, document.getText().toString()).then((d) => {}, (result) => {
            const diagnostics = this._luachecker.parseDiagnostics(result);
            if (diagnostics.length > 0) {
                this._intelliLua.sendDiagnostics({
                    uri: document.uri, 
                    diagnostics: diagnostics
                });
            } 
        });
    }
};

exports.DiagnosticProvider = DiagnosticProvider;