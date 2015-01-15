var DEFAULT_PORT = 993;
var DEFAULT_TARGET = './';
var DEFAULT_FILENAME_TEMPLATE = '{filename}';
var DEFAULT_TIMEOUT = 10000;

var log = require('verbalize');
var moment = require('moment');
var async = require('async');

var normalizeDirectoryPath = require('./lib/helpers/normalize-directory-path');
var parseImapAccountString = require('./lib/helpers/parse-imap-account-string');

var findEmails = require('./lib/find-emails');

module.exports = function(config, callback) {
  var account = (typeof config.account === 'string') ? parseImapAccountString(config.account) : config.account;
  var today = moment().format('YYYY-MM-DD');
  var since = config.since || today;
  var directory = config.directory ? normalizeDirectoryPath(config.directory) : DEFAULT_TARGET;
  var filenameTemplate = config.filenameTemplate || DEFAULT_FILENAME_TEMPLATE;
  var filenameFilter = config.filenameFilter;
  var timeout = config.timeout || DEFAULT_TIMEOUT;
  var args = {
    username: account.username,
    password: account.password,
    host: account.host,
    port: account.port || DEFAULT_PORT,
    directory: directory,
    filenameTemplate: filenameTemplate,
    filenameFilter: filenameFilter,
    since: since,
    timeout: timeout,
    log: log
  };

  log.runner = 'download-email-attachments';
  log.info('Downloading attachments for %s since %s to %s ...', args.username, args.since, args.directory);

  async.waterfall([
    function (callback) {
      callback(null);
    },
    findEmails.bind(null, args),
  ], callback);
};
