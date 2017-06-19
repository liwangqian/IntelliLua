"use strict";

const execFile = require('child_process').execFile;
const kill  = require('tree-kill');
const path  = require('path');
const fs    = require('fs');
const Uri   = require('vscode-uri');

const FAILED_REGEX = /\[\s+FAILED\s+\]\s+(\d+)\s+test/g;
const PASSED_REGEX = /\[\s+PASSED\s+\]\s+(\d+)\s+tests/g;

const LUACOV_CONFIG_FILE    = ".luacov";
const LUABUSTED_CONFIG_FILE = ".busted";

const LUACOV_LINE_REGEX = '/(.+file+.)\s+(\d+)\s+(\d+)\s+(\d+\.\d+\%)/g';

class TestRunner {
    constructor(intelliLua) {
        this._commander = "busted.bat";
        this._options   = ["-o", "gtest"];
        this._process   = null;
        this._intelliLua= intelliLua;

        this._passed    = 0;
        this._failed    = 0;

        this._lastTC    = [];
    }

    stop() {
        if (this._process) {
            kill(this._process.pid, "SIGKILL");
        }
    }

    dispose() {
        this.stop();
    }

    getCoverageReportFile(cwd) {
        var luacov = path.resolve(cwd, LUACOV_CONFIG_FILE);
        if (fs.existsSync(luacov)) {
            var luacov_config = fs.readFileSync(luacov).toString();
            var reportFile = luacov_config.match(/\s+\[\'reportfile\'\]\s+=\s+\'(\w+.?)+/g);
            reportFile = path.resolve(cwd, reportFile);
            if (fs.existsSync(reportFile)) {
                return reportFile;
            }
        }

        return null;
    }

    parseCoverage(cwd, fileName) {
        var reportFile = this.getCoverageReportFile(cwd);
        if (!reportFile) {
            return null;
        }

        var content = fs.readFileSync(reportFile).toString();
        var coverages = content.match(LUACOV_LINE_REGEX);

        var rate  = '0%';

        for (var i = 0; i < coverages.length; ++i) {
            if (coverages[i].includes(fileName)) {
                rate = coverages[i].match(/(\d+.\d+)\%$/)[0];
                break;
            }
        }

        return rate;
    }

    run(cwd, fileName) {
        if (this._process) {
            return true;
        }

        return new Promise((resolve, reject) => {
            this._process = execFile(this._commander, this._options, {cwd: cwd}, (error, stdout, stderr) => {
                if (!error) {
                    reject(error, {stdout: stdout, stderr: stderr});
                } else {
                    resolve({stdout: stdout, stderr: stderr});
                }
            });
            
        });
    }

};

exports.TestRunner = TestRunner;

class TestManager {
    constructor(intelliLua) {
        this._iLua = intelliLua;
    }

    parseTestResult(data) {
        var failed_cnt = 0;
        var passed_cnt = 0;

        this._iLua.debug(data.stdout);

        data.stdout.split(/\r\n|\r|\n/).forEach((line) => {
            var failed = FAILED_REGEX.exec(line);
            var passed = PASSED_REGEX.exec(line);

            if (failed) {
                failed_cnt += parseInt(failed[0].match(/(\d+)/));
            }
            
            if (passed) {
                passed_cnt += parseInt(passed[0].match(/(\d+)/));
            }
        });
        
        var rate = passed_cnt / (passed_cnt + failed_cnt);
        this._iLua.conn.console.info("Passed Rate: " +  rate.toPrecision(2) * 100 + "%");
    }
    runTests(document) {
        var uri = document.uri;
        var fileName = Uri.default.parse(uri).fsPath;
        var cwd = path.dirname(fileName);

        var testRunner = new TestRunner();
        testRunner.run(cwd, fileName).then((result) => {
            this.parseTestResult(result);
        }, (err, result) => {
            this._iLua.conn.console.error(result.stderr);
        });
    }
}

exports.TestManager = TestManager;