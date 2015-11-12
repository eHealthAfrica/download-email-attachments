var path = require('path')

/**
 * Makes sure directory ends with "/"
 *
 * @param {String} path
 * @returns {String} path
 */
module.exports = function normalizeDirectoryPath (directory) {
  return path.normalize(directory) + '/'
}
