const UnitTest = require('../lib/unit-test');
const path     = require('path');
const fs       = require('fs');
const async    = require('async');
const util = require("../lib/util");

function test01() {
    console.log("I am here")

    // var luacov = path.resolve("F:\\lua\\power_manage", ".luacov");
    // if (fs.existsSync(luacov)) {
    //     console.log(fs.readFileSync(luacov).toString());
    // }

    const json_report = JSON.parse(fs.readFileSync("F:\\lua\\power_manage\\luacov.report.out"));
    json_report.forEach(function(element) {
        console.log(element.name + " : " + element.cover)
    });

    const luacov = util.loadConfig(".luacov", "F:\\lua\\power_manage");

    console.log(luacov.reporter);

    const busted = util.loadConfig(".busted", "F:\\lua\\power_manage");

    console.log(busted);

    const protocols = require('../lib/protocols');

    console.log(protocols.UnitTestRequest.type);

    const fileName = path.resolve("F:\\lua", ".busted");
    console.log(fileName);
    console.log(fs.existsSync(fileName));

    const bustedCfgTemplate = path.resolve(__dirname, "../../out/src/templates/.busted");

    console.log(bustedCfgTemplate);
}

function test02() {
    
}

test01();