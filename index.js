var DEFAULT_PORT = 993
var DEFAULT_TARGET = './'
var DEFAULT_FILENAME_TEMPLATE = '{filename}'
var DEFAULT_TIMEOUT = 10000

var log = require('verbalize')
var moment = require('moment')

var normalizeDirectoryPath = require('./lib/helpers/normalize-directory-path')
var parseImapAccountString = require('./lib/helpers/parse-imap-account-string')

var findEmails = require('./lib/find-emails')

module.exports = function (config, callback) {
  var account = (typeof config.account === 'string') ? parseImapAccountString(config.account) : config.account
  var today = moment().toDate()
  var directory = config.directory ? normalizeDirectoryPath(config.directory) : DEFAULT_TARGET

  var args = {
    username: account.username,
    password: account.password,
    attachmentHandler: config.attachmentHandler,
    host: account.host,
    port: account.port || DEFAULT_PORT,
    directory: directory,
    filenameTemplate: config.filenameTemplate || DEFAULT_FILENAME_TEMPLATE,
    filenameFilter: config.filenameFilter,
    since: config.since || today,
    keepalive: config.keepalive,
    timeout: config.timeout || DEFAULT_TIMEOUT,
    log: log
  }

  log.runner = 'download-email-attachments'

  log.info(
    'Downloading attachments for %s since %s to %s ...',
    args.username,
    args.since,
    args.directory)

  findEmails(args, callback)
}
