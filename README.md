# iotdb-tail

Tail a file

# usage

    const tail = require("iotdb-tail")

    const tailer = tail("file.txt")
    tailer.on("line", line => console.log("+", line))

    // later to stop
    tailer.clear()

# features

This deals with:

* `file.txt` not existing (it will wait for it)
* `file.txt` being replaced
* `file.txt` being emptied or made smaller

# events

* `gone` - the file has disappeared
* `issue` - some error or exception was seen
* `line` - a new line
* `new` - a new file has appeared
* `partial` - a result was so long we couldn't find a line, so deal with this yourself
* `replaced` - the file has been replaced by a new file
* `reset` - we went back to the beginning, because the file was made smaller
