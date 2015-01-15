var MailListener = require('mail-listener2');
var once = require('once');
var debounce = require('debounce');
var saveAttachmentStream = require('./save-attachment-stream');

module.exports = function findEmails(state, callback) {
  var mailListener = new MailListener({
    username: state.username,
    password: state.password,
    host: state.host,
    port: state.port,
    tls: true,

    markSeen: false,
    fetchUnreadOnStart: true,

    searchFilter: [ [ 'SINCE', state.since ] ],
    mailParserOptions: {streamAttachments: true},
  });

  // debounce callback, and only call once
  callback = once(callback);
  var debouncedCallback = debounce( callback, state.timeout);

  mailListener.start();

  mailListener.on('server:connected', function(){
    state.log.info('connected to %s', state.username);
    debouncedCallback();
  });

  mailListener.on('server:disconnected', function(){
    state.log.info('disconnected from %s', state.username);
  });

  mailListener.on('error', function(error){
    callback(error);
  });

  mailListener.on('attachment', function(attachment, mail){
    debouncedCallback();
    saveAttachmentStream(state, attachment, mail, callback);
  });
};
