var DEFAULT_PORT = 993
var DEFAULT_TARGET = './'
var DEFAULT_FILENAME_TEMPLATE = '{filename}'
var DEFAULT_TIMEOUT = 1000

var normalizeDirectoryPath = require('./lib/helpers/normalize-directory-path')
var parseImapAccountString = require('./lib/helpers/parse-imap-account-string')

var findEmails = require('./lib/find-emails')

module.exports = function (config, callback) {
  var account = (typeof config.account === 'string') ? parseImapAccountString(config.account) : config.account
  var directory = config.directory ? normalizeDirectoryPath(config.directory) : DEFAULT_TARGET

  var args = {
    invalidChars: config.invalidChars || /[^A-Za-z\d-_\.]/g, // /a^/g for everything
    username: account.username,
    password: account.password,
    attachmentHandler: config.attachmentHandler,
    host: account.host,
    port: account.port || DEFAULT_PORT,
    directory: directory,
    filenameTemplate: config.filenameTemplate || DEFAULT_FILENAME_TEMPLATE,
    filenameFilter: config.filenameFilter,
    since: config.since,
    keepalive: config.keepalive,
    lastSyncId: config.lastSyncId || 0,
    uidvalidity: config.uidvalidity,
    timeout: config.timeout || DEFAULT_TIMEOUT,
    log: config.log || console.log,
    debug: config.debug,
    sender: config.sender
  }

  if (config.ssl === false) {
    args.ssl = false
  } else {
    args.ssl = true
  }

  args.log.info('Downloading attachments for ' + args.username + ' since ' + args.since + ' to ' + args.directory + '...')

  findEmails(args, callback)
}
