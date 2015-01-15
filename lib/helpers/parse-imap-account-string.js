/**
 * Turns `joe:secret@example.com` into
 * `{username: 'joe', password: 'secret', host: 'example.com', port: 993}`
 *
 * @param {String} imap-account string
 * @returns {Object(username, password, host, port)}
 */
var exports = module.exports = function parseImapAccountString(accountString) {

  return {
    username: exports.findUsername(accountString),
    password: exports.findPassword(accountString),
    host: exports.findHost(accountString),
    port: exports.findPort(accountString)
  };
};

/**
 * Turns `joe:secret@example.com` into 'joe' and
 * `"joe@example.com":secret@example.com` into 'joe@example.com'
 *
 * @param {String} imap-account string
 * @returns {String} username
 */
exports.findUsername = function(accountString) {
  if (/^"/.test(accountString)) {
    return accountString.match(/^"([^"]+)"/).pop();
  }

  return accountString.match(/^([^:]+):/).pop();
};

/**
 * Turns `joe:secret@example.com` into 'secret' and
 * `joe:"123:@456"@example.com` into '123:@456'
 *
 * @param {String} imap-account string
 * @returns {String} password
 */
exports.findPassword = function(accountString) {
  if (/:"/.test(accountString)) {
    return accountString.match(/:"([^"]+)"/).pop();
  }

  return accountString.match(/:([^@:]+)@/).pop();
};

/**
 * Turns `joe:secret@example.com` into 'example.com'
 *
 * @param {String} imap-account string
 * @returns {String} host
 */
exports.findHost = function(accountString) {
  accountString = accountString.replace(/:\d+$/, '');
  return accountString.match(/@([^:@]+)$/).pop();
};

/**
 * Turns `joe:secret@example.com:123` into 123
 *
 * @param {String} imap-account string
 * @returns {String} host
 */
exports.findPort = function(accountString) {
  var matches = accountString.match(/:(\d+)$/);
  if (matches) {
    return parseInt(matches.pop(), 10);
  }
};
