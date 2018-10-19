/*
 *  index.js
 *
 *  David Janes
 *  IOTDB.org
 *  2018-10-17
 *
 *  Copyright [2013-2018] [David P. Janes]
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

"use strict"

const _ = require("iotdb-helpers")

const fs = require("fs")
const assert = require("assert")
const events = require("events")

const VERBOSE = false

/**
 */
const tail = filename => {
    const self = Object.assign({}, events.EventEmitter.prototype);

    let finished = false
    let stbuf = null
    let byte_index = 0
    let line_index = 0
    let watcher = null
    let fin = null
    let interval_id = null

    const buffer = Buffer.alloc(32 * 1024)

    const _emit = (what, ...rest) => {
        // if (VERBOSE) console.log("+", "emit", what, rest)

        self.emit(what, ...rest)
    }

    /* --- promises --- */
    const _stat = _.promise((self, done) => {
        fs.stat(filename, (error, stbuf) => {
            if (error) {
                return done(error)
            }

            self.stbuf = stbuf

            done(null, self)
        })
    })

    const _watcher_open = _.promise(self => {
        if (watcher) {
            return
        }

        watcher = fs.watch(filename, etype => {
            if (VERBOSE) console.log("-", "watcher", etype)
            _check()
        })
    })

    const _file_open = _.promise((self, done) => {
        if (fin) {
            return done(null, self)
        }

        fs.open(filename, "r", (error, fd) => {
            if (error) {
                return done(error)
            }

            fin = fd

            done(null, self)
        })
    })

    const _file_read = _.promise((self, done) => {
        const nbytes = Math.min(stbuf.size - byte_index, buffer.length)
        if (nbytes <= 0) {
            return done(null, self)
        }

        fs.read(fin, buffer, 0, nbytes, byte_index, (error, nread) => {
            if (error) {
                return done(error)
            }
            if (nread === 0) {
                return done(null, self)
            }

            let bstart = 0
            let oindex = byte_index

            for (let bx = 0; bx < nread; bx++) {
                if (buffer[bx] !== 10) {
                    continue
                }

                try {
                    _emit("line", buffer.toString("utf-8", bstart, bx), {
                        line: line_index,
                        byte: byte_index + bx,
                        bytes: bx - bstart,
                        path: filename,
                    })
                    line_index ++
                }
                catch (x) {
                    console.log(x)
                    process.exit()
                    _emit("issue", x)
                }

                bstart = bx + 1
            }

            // partial is basically saying "we give up"
            if (bstart === 0) {
                _emit("partial", buffer)
                bstart = nread
            }

            byte_index += bstart

            done(null, self)
        })
    })

    /* --- functions --- */
    const _file_clear = () => {
        if (VERBOSE) console.log("-", "_file_clear")

        stbuf = null
        byte_index = 0
        line_index = 0

        if (fin !== null) {
            fs.close(fin)
            fin = null
        }
    }

    const _watcher_close = () => {
        try {
            if (watcher) {
                watcher.close();
            }
        } catch (x) {
        }

        watcher = null
    }

    let _checking = false

    const _check = () => {
        if (finished) {
            return
        }

        if (_checking) {
            process.nextTick(_check)
            return
        }

        _checking = true

        _.promise.make({})
            .then(_stat)
            .make(sd => {
                assert.ok(sd.stbuf)

                if (!stbuf) {
                    // no previous file
                    _file_clear()
                    stbuf = sd.stbuf
                    _emit("new")
                } else if (stbuf.ino !== sd.stbuf.ino) {
                    // file has been replaced (new inode)
                    _file_clear()
                    stbuf = sd.stbuf
                    _emit("replaced")
                    _emit("new")
                } else if (stbuf.size > sd.stbuf.size) {
                    // file got smaller - start from beginning
                    _file_clear()
                    stbuf = sd.stbuf
                    _emit("reset")
                } else if (stbuf.size < sd.stbuf.size) {
                    // file got bigger - read stuff
                    stbuf = sd.stbuf
                } else {
                }
            })
            .then(_file_open)
            .then(_file_read)
            .then(_watcher_open)
            .make(sd => {
                _checking = false

                if (stbuf && (byte_index < stbuf.size)) {
                    process.nextTick(_check)
                }
            })
            .except(error => {
                try {
                    if (stbuf) {
                        _emit("issue", error)
                        _emit("gone")
                    }
                    _watcher_close()
                    _file_clear()
                } catch (x) {
                    if (VERBOSE) console.log("WHAT", x)
                }

                _checking = false
            })
    }

    _check()

    interval_id = setInterval(_check, 1 * 1000)

    self.clear = () => {
        finished = true

        if (interval_id) {
            clearInterval(interval_id)
            interval_id = null
        }
    }
    self.close = self.clear

    return self
}

/**
 */
exports.tail = tail
