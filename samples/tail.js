/*
 *  tail.js
 *
 *  David Janes
 *  IOTDB.org
 *  2018-10-17
 */

"use strict"

const _ = require("iotdb-helpers")
const fs = require("fs")
const assert = require("assert")

const tail = require("..")

const tailer = tail("xxx")
tailer.on("line", x => {
    console.log("line:", x)
    /*
    if (!x.startsWith("{")) {
        console.log(x)
        return
    }

    try {
        console.log(JSON.stringify(JSON.parse(x), null, 2))
    } catch (x) {
    }
    */
})
