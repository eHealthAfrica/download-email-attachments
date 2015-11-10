var saveAttachmentStream = require('./save-attachment-stream')
var Imap = require('imap')
var MailParser = require('mailparser').MailParser
var async = require('async')
var _ = require('underscore')

module.exports = function findEmails (args, callback) {
  var state = {
    errors: [],
    openAttHandlers: 0,
    connection: 'virgin'
  }

  // aggregate all errors during the attachment downloading
  function collectErrors (err) {
    state.errors.push(err)
  }

  // if problems during connection happen the callback is called after timeout
  var timout = setTimeout(function () {
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

  var maybeErrorCallback = function () {
    clearTimeout(timout)
    if (state.errors.length > 0) {
      callback(state.errors)
    } else {
      callback()
    }
  }

  function onAttHandlerFinished () {
    state.openAttHandlers--
    if (state.openAttHandlers === 0 && state.connection === 'closed') {
      maybeErrorCallback()
    }
  }

  var imap = new Imap({
    xoauth2: undefined,
    user: args.username,
    password: args.password,
    host: args.host,
    port: args.port,
    tls: true,
    keepAlive: args.keepalive,
    // debug: function (info) { console.log(info) },
    tlsOptions: {}
  })

  imap.on('error', function (err) {
    // filter out disconnection error due to node js tls bug
    if (err.code === 'ECONNRESET' && state.connection === 'closed') {
      return
    } else if (err.code === 'ECONNRESET') {
      state.connection = 'closed'
      console.log('Connection reset before successful halftermination, dataloss pssible!')
      return
    }
    collectErrors(err)
  })

  imap.once('ready', function () {
    imap.openBox('INBOX', false, function (err, mailbox) {
      if (err) {
        collectErrors(err)
        return
      }

      console.info('connected to %s', args.username)
      state.connection = 'open'

      processMails()
      imap.on('mail', function () {
        processMails()
      })
    })
  })

  imap.once('close', function () {
    console.info('disconnected from %s', args.username)

    state.connection = 'closed'
    if (state.openAttHandlers === 0) {
      maybeErrorCallback()
    }
  })

  function imapDisconnect () {
    console.log('imap: closing')

    imap.closeBox(false, function () {
      imap.end()
    })
  }

  function processMails () {
    imap.search([ [ 'SINCE', args.since ] ], function (err, results) {
      if (err) {
        collectErrors(err)
        return
      }

      if (results.length === 0) {
        imapDisconnect()
        return
      }

      async.each(results, function (result, resultCallback) {
        // make sure fetching and parsing are both finished up properly
        var callback1 = _.after(2, resultCallback)

        var fetcher = imap.fetch(result, {
          bodies: '',
          markSeen: false
        })

        fetcher.on('error', function (err) {
          collectErrors(err)
        })

        fetcher.on('message', function (msg, seqno) {
          var parser = new MailParser({streamAttachments: true})
          msg.on('body', function (stream, info) {
            stream.pipe(parser)
          })

          // var attributes = null
          // msg.on('attributes', function (attrs) {
          //   attributes = attrs
          // })

          parser.on('attachment', function (attachment, mail) {
            state.openAttHandlers++
            saveAttachmentStream(args, attachment, mail, onAttHandlerFinished, collectErrors)
          })

          parser.on('end', function (mail) {
            callback1()
          })
        })

        fetcher.once('end', function (err) {
          if (err) {
            collectErrors(err)
          }
          callback1()
        })
      }, function (err) {
        if (err) {
          collectErrors(err)
        }
        imapDisconnect()
      })
    })
  }

  imap.connect()
}
