var MailListener = require('mail-listener2')
var saveAttachmentStream = require('./save-attachment-stream')

module.exports = function findEmails (args, callback) {
  var mailListener = new MailListener({
    username: args.username,
    password: args.password,
    host: args.host,
    port: args.port,
    tls: true,

    timeout: args.timeout,

    keepalive: args.keepalive,

    markSeen: false,
    fetchUnreadOnStart: true,

    searchFilter: [ [ 'SINCE', args.since ] ],
    mailParserOptions: {streamAttachments: true}
  })

  // aggregate all errors during the attachment downloading
  var state = {
    errors: [],
    openAttHandlers: 0,
    connection: 'virgin'
  }
  function errorCb (err) {
    state.errors.push(err)
  }

  var maybeErrorCallback = function () {
    if (state.errors.length > 0) {
      callback(state.errors)
    } else {
      callback()
    }
  }

  function attHandlerCb () {
    state.openAttHandlers--
    if (state.openAttHandlers === 0 && state.connection === 'closed') {
      maybeErrorCallback()
    }
  }

  // if problems during connection happen the callback is called after timeout
  setTimeout(function () {
    if (state.connection === 'virgin') {
      state.errors.push('imap connection error')
      maybeErrorCallback()
    } else if (state.connection === 'open') {
      state.errors.push('connection closing in timout error')
      console.log('timeout did not close imap connection in time')
      maybeErrorCallback()
      maybeErrorCallback = function () {
        console.log('callback called after timeout')
      }
    } else if (state.connection === 'closed' && state.openAttHandlers > 0) {
      state.errors.push('attachment handling in timout error')
      console.log('attachments could not be handled in time')
      maybeErrorCallback()
      maybeErrorCallback = function () {
        console.log('callback called after timeout')
      }
    }
  }, args.timeout)

  mailListener.on('server:connected', function () {
    args.log.info('connected to %s', args.username)
    state.connection = 'open'
  })

  mailListener.on('server:disconnected', function () {
    args.log.info('disconnected from %s', args.username)
    state.connection = 'closed'
    if (state.openAttHandlers === 0) {
      maybeErrorCallback()
    }
  })

  mailListener.on('error', function (error) {
    errorCb(error)
  })

  mailListener.on('attachment', function (attachment, mail) {
    state.openAttHandlers++
    saveAttachmentStream(args, attachment, mail, attHandlerCb, errorCb)
  })

  mailListener.start()
  console.log('new email listener created')
}
