'use strict';

var fs = require('fs');
var path = require('path');
var rollupPluginutils = require('rollup-pluginutils');
var nodeSass = require('node-sass');

function css(options) {
  if ( options === void 0 ) options = {};

  var filter = rollupPluginutils.createFilter(options.include || ['**/*.css', '**/*.scss', '**/*.sass'], options.exclude);
  var dest = options.output;

  var styles = {};
  var includePaths = options.includePaths || [];
  includePaths.push(process.cwd());

  return {
    name: 'css',
    transform: function transform(code, id) {
      if (!filter(id)) {
        return
      }

      // When output is disabled, the stylesheet is exported as a string
      if (options.output === false) {
        return {
          code: 'export default ' + JSON.stringify(code),
          map: { mappings: '' }
        }
      }

      // Map of every stylesheet
      styles[id] = code;
      includePaths.push(path.dirname(id));

      return ''
    },
    ongenerate: function ongenerate (opts) {
      // No stylesheet needed
      if (options.output === false) {
        return
      }

      // Combine all stylesheets
      var css = '';
      for (var id in styles) {
        css += styles[id] || '';
      }

      // Compile SASS to CSS
      includePaths = includePaths.filter(function (v, i, a) { return a.indexOf(v) === i; });
      css = nodeSass.renderSync(Object.assign({
        data: css,
        includePaths: includePaths
      }, options)).css.toString();

      // Emit styles through callback
      if (typeof options.output === 'function') {
        options.output(css, styles);
        return
      }

      if (typeof dest !== 'string') {
        // Don't create unwanted empty stylesheets
        if (!css.length) {
          return
        }

        // Guess destination filename
        dest = opts.dest || 'bundle.js';
        if (dest.endsWith('.js')) {
          dest = dest.slice(0, -3);
        }
        dest = dest + '.css';
      }

      // Ensure that dest parent folders exist (create the missing ones)
      ensureParentDirsSync(path.dirname(dest));

      // Emit styles to file
      return new Promise(function (resolve, reject) {
        fs.writeFile(dest, css, function (err) {
          if (err) {
            reject(err);
          } else {
            if (opts.verbose !== false) {
              console.log(green(dest), getSize(css.length));
            }
            resolve();
          }
        });
      })
    }
  }
}

function green (text) {
  return '\u001b[1m\u001b[32m' + text + '\u001b[39m\u001b[22m'
}

function getSize (bytes) {
  return bytes < 10000
    ? bytes.toFixed(0) + ' B'
    : bytes < 1024000
    ? (bytes / 1024).toPrecision(3) + ' kB'
    : (bytes / 1024 / 1024).toPrecision(4) + ' MB'
}

function ensureParentDirsSync (dir) {
  if (fs.existsSync(dir)) {
    return
  }

  try {
    fs.mkdirSync(dir);
  } catch (err) {
    if (err.code === 'ENOENT') {
      ensureParentDirsSync(path.dirname(dir));
      ensureParentDirsSync(dir);
    }
  }
}

module.exports = css;
