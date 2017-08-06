"use strict";

function tapOuputParser(data) {
    let regex_ok = /^ok\s\d+/;
    let regex_nok = /^not ok\s\d+/;

    var ok_cnt = 0;
    var nok_cnt = 0;

    data.split(/[\n\r|\n|\r]/).forEach(function(line) {
        if(regex_ok.exec(line)) {
            ok_cnt += 1;
        } else if(regex_nok.exec(line)) {
            nok_cnt += 1;
        }
    });

    return {
        total: ok_cnt + nok_cnt,
        passed: ok_cnt,
        failed: nok_cnt,
        pending: 0,  //count in ok
        errors: 0    //count in nok
    }
}

function gtestOuputParser(data) {
    let regex_failed = /\[\s+FAILED\s+\]\s+(\d+)\s+test/;
    let regex_passed = /\[\s+PASSED\s+\]\s+(\d+)\s+tests/;
    let regex_skipped = /\[\s+SKIPPED\s+\]\s+(\d+)\s+test/;
    let regex_errors = /\[\s+ERROR\s+\]\s+(\d+)\s+error/;

    var failedCnt = 0;
    var passedCnt = 0;
    var skippedCnt = 0;
    var errorsCnt = 0;

    var failed  = regex_failed.exec(data);
    var passed  = regex_passed.exec(data);
    var skipped = regex_skipped.exec(data);
    var errors  = regex_errors.exec(data);

    if (failed)  failedCnt  = parseInt(failed[1]);
    if (passed)  passedCnt  = parseInt(passed[1]);
    if (skipped) skippedCnt = parseInt(skipped[1]);
    if (errors)  errorsCnt  = parseInt(errors[1]);
    
    return {
        total: passedCnt + failedCnt + skippedCnt + errorsCnt,
        passed: passedCnt,
        failed: failedCnt,
        pending: skippedCnt,
        errors: errorsCnt
    };
}

function plainTerminalOutputParser(data) {
    // 13 successes / 1 failure / 0 errors / 1 pending : 0.187 seconds
    let regex = /(\d+)\ssuccesses\s\/\s(\d+)\sfailure\s\/\s(\d+)\serrors\s\/\s(\d+)\spending/;
    let matches = regex.exec(data);

    var passed = 0, failed = 0, pending = 0, errors = 0;
    if (matches.length >= 5) {
        passed = parseInt(matches[1]);
        failed = parseInt(matches[2]);
        errors = parseInt(matches[3]);
        pending = parseInt(matches[4]);
    }

    return {
        total: passed + failed + pending + errors,
        passed: passed,
        failed: failed,
        pending: pending,
        errors: errors
    }
}

let parsers = {
    TAP: tapOuputParser,
    gtest: gtestOuputParser,
    plainTerminal: plainTerminalOutputParser
};

exports.get = function(type) {
    return parsers[type];
}