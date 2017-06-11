"use strict";

const spawn = require('child_process').spawn;
const kill  = require('tree-kill');
const path  = require('path');
const fs    = require('fs');

const FAILED_REGEX = /\[\s+FAILED\s+\]\s+(\d+)\s+test/g;
const PASSED_REGEX = /\[\s+PASSED\s+\]\s+(\d+)\s+tests/g;

const LUACOV_CONFIG_FILE    = ".luacov";
const LUABUSTED_CONFIG_FILE = ".busted";

const LUACOV_LINE_REGEX = '/(.+file+.)\s+(\d+)\s+(\d+)\s+(\d+\.\d+\%)/g';

class TestRunner {
    constructor(logger) {
        this._commander = "busted.bat";
        this._options   = ["-o", "gtest"];
        this._process   = null;
        this._logger    = logger;

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

        try {
            this._process = spawn(this._commander, this._options, {cwd: cwd, detached: false});
        } catch (exception) {
            this._logger("[ERROR] TestRunner.run >>> create run process failed.");
            this._process = null;
            return false;
        }

        this._process.unref();
        this._process.stdout.on("data", (data) => {
            var out = data.toString();

            var failed = out.match(FAILED_REGEX);
            var passed = out.match(PASSED_REGEX);

            // this._logger(out);

            if (failed) {
                this._failed += parseInt(failed[0].match(/(\d+)/));
            }
            
            if (passed) {
                this._passed += parseInt(passed[0].match(/(\d+)/));
            }
        });

        this._process.stderr.on("data", (data) => {
            this._logger("[ERROR] TestRunner.run >>> run tests error: " + data.toString());
        });

        this._process.on("close", (code, signal) => {
            this._process = null;
            
            if (signal) {
                this._logger("[ERROR] TestRunner.run >>> run tests exit with " + signal);
                return;
            }

            var passedRate = this._passed / (this._passed + this._failed);
            this._logger("Passed Rate: " +  passedRate.toPrecision(2) * 100 + "%");
        });
    }

};

exports.TestRunner = TestRunner;