const grapher = require('sass-graph');
const path = require('path');
const sass = require('node-sass');
const through2 = require('through2');

const PARTIAL_REGEX = /^_/;

module.exports = function(opts) {
    let graph;

    return (conf, execOpts) => {
        return through2.obj(function(file, encoding, cb) {
            if (conf.graph && !graph) {
                // Cache graph of scss imports so we can find non-partial ancestors
                graph = grapher.parseDir(file.base, {
                    loadPaths: opts.includePaths || []
                });
            }

            const execute = (filepath) => {
                sass.render(Object.assign({
                    file: filepath
                }, opts), (err, result) => {
                    if (err) {
                        return this.emit('spearhook:error', { err, file });
                    }

                    file.contents = result.css;

                    cb(null, file);
                });
            }

            // Always compile non-partials
            if (!PARTIAL_REGEX.test(file.basename)) {
                execute(file.path);
            }
            else if (!execOpts.initialRun && conf.graph) {
                var cache = graph.index[file.path];

                // Skip traversal for partials without parents
                if (!cache || !cache.importedBy.length) {
                    return cb(null);
                }

                // Only compile non-partial ancestors after first run
                graph.visitAncestors(file.path, (parent) => {
                    if (!PARTIAL_REGEX.test(path.basename(parent))) {
                        execute(parent);
                    }
                });
            }
            else {
                cb(null);
            }
        });
    }
};
