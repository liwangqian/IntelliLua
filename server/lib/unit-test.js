"use strict";

const execFile      = require('child_process').execFile;
const kill          = require('tree-kill');
const path          = require('path');
const fs            = require('fs');
const Uri           = require('vscode-uri');
const util          = require("./util");
const outputParsers = require('./ut/outputParser');

class TestRunner {
    constructor(iLua) {
        this.process = null;
        this.iLua    = iLua;
    }

    stop() {
        if (this.process) {
            kill(this.process.pid, "SIGKILL");
            this.process = null;
        }

        this.iLua.sendUnitTestRequest("stopped", {});
    }

    run(cwd) {
        if (this.process) {
            this.iLua.sendUnitTestRequest("reject", {
                message: "Test is still running."
            });
            return true;
        }
        
        this.iLua.sendUnitTestRequest("started", {});
        return new Promise((resolve, reject) => {
            this.process = execFile("busted.bat", {cwd: cwd},(error, stdout, stderr) => {
                if (error && !error.message.includes("Command failed")) {
                    reject(error);
                } else {
                    resolve(stdout);
                }
                this.process = null;
            });
        });
    }

};

function getUnitTestConfig(fileName, cwd) {
    var fullPath = path.resolve(cwd, fileName);
    if (fs.existsSync(fullPath)) {
        return util.loadConfig(fileName, cwd);
    }

    return null;
}

class TestManager {
    constructor(iLua) {
        this.iLua = iLua;
        this.testRunner = new TestRunner(iLua);
    }

    getReport(bustedCfg, cwd, fileName) {
        const luacovCfg = getUnitTestConfig(".luacov", cwd);
        const reportFile = luacovCfg.reportfile;
        const fullPath = path.resolve(cwd, bustedCfg.directory, reportFile);

        var jsonReport = null;
        
        if (fs.existsSync(fullPath)) {
            jsonReport = JSON.parse(fs.readFileSync(fullPath));
        }

        if (!jsonReport || !Array.isArray(jsonReport)) {
            this.iLua.sendUnitTestRequest("error", {message: "report file not exist."});
            return null;
        }

        for (var index = 0; index < jsonReport.length; index++) {
            var report = jsonReport[index];
            const fullPath = path.resolve(cwd, report.name);

            if (fullPath == fileName) {
                return report;
            }
        }

        return null;
    }

    parseOutput(bustedCfg, cwd, data) {
        let outputParser = outputParsers.get(bustedCfg.output);
        if (outputParser === undefined) {
            this.iLua.sendUnitTestRequest("error", {
                message: "Unsupported output formatter: " + bustedCfg.default.output
            });
            return null;
        }

        return outputParser(data);
        
    }

    runTests(cwd, fileName) {
        let bustedCfg = getUnitTestConfig(".busted", cwd);
        this.testRunner.run(cwd).then((data) => {
            const result = this.parseOutput(bustedCfg.default, cwd, data);
            this.iLua.sendUnitTestRequest("message",  {message: data});
            this.iLua.sendUnitTestRequest("finished", result);

            if (bustedCfg.default.coverage) {
                const report = this.getReport(bustedCfg.default, cwd, fileName);
                const shortName = path.basename(fileName);

                if (report != null) {
                    this.iLua.sendUnitTestRequest("message", {
                        message: `Coverage of ${shortName} is ${report.cover}`
                    });
                }
            }
        }, (err, result) => {
            this.iLua.sendUnitTestRequest("error", {
                message: err.message
            });
        });
    }

    stopTests(params) {
        this.testRunner.stop();
    }

    onUnitTestRequest(params) {
        if (params.type == "run") {
            this.runTests(params.params.cwd, params.params.fileName);
        } else if (params.type == "stop") {
            this.stopTests(params.params);
        }
    }
}

exports.TestManager = TestManager;