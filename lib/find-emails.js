var saveAttachmentStream = require('./save-attachment-stream')
var Imap = require('imap')
var MailParser = require('mailparser').MailParser
var async = require('async')
var filter = require('lodash.filter')
var moment = require('moment')

module.exports = function findEmails (args, callback) {
  var state = {
    uidvalidity: args.uidvalidity, // used for future optimization of imap search and devalidation of last sync id
    errors: [],
    handledIds: [], // used for future optimization of imap search
    newLastSyncId: args.lastSyncId,
    lastSyncId: args.lastSyncId,
    latestTime: undefined,
    queue: async.queue(handleEmail, 5),
    connection: 'virgin'
  }

  state.queue.drain = function (err) {
    if (err) {
      collectErrors(err)
    }
    imapDisconnect()
  }

  // aggregate all errors during the attachment downloading
  function collectErrors (err) {
    state.errors.push(err)
  }

  // if problems during connection happen the callback is called after timeout
  var timeout = setTimeout(function () {
    if (state.connection === 'virgin') {
      state.errors.push('imap connection error')
      maybeErrorCallback()
    } else if (state.connection === 'open') {
      state.errors.push('connection closing in timeout error')
      args.log.error('timeout did not close imap connection in time')
      maybeErrorCallback()
      maybeErrorCallback = function () {
        args.log.error('callback called after timeout')
      }
    } else if (state.connection === 'closed' && !state.queue.idle()) {
      state.errors.push('attachment handling in timeout error')
      args.log.error('attachments could not be handled in time')
      maybeErrorCallback()
      maybeErrorCallback = function () {
        args.log.error('callback called after timeout')
      }
    }
  }, args.timeout)

  var maybeErrorCallback = function () {
    if (state.connection === 'closed' && state.queue.idle()) {
      clearTimeout(timeout)

      if (!callback) {
        return
      }

      if (state.errors.length > 0) {
        callback({errors: state.errors, latestTime: state.latestTime, lastSyncId: state.newLastSyncId, uidvalidity: state.uidvalidity})
      } else {
        callback({latestTime: state.latestTime, lastSyncId: state.newLastSyncId, uidvalidity: state.uidvalidity})
      }
    }
  }

  var imap = new Imap({
    xoauth2: undefined,
    user: args.username,
    password: args.password,
    host: args.host,
    port: args.port,
    tls: true,
    keepAlive: false,
    // debug: function (info) { console.log(info) },
    tlsOptions: {
      secureProtocol: 'TLSv1_method'
    }
  })

  imap.on('error', function (err) {
    // filter out disconnection errors due to node js tls bug
    if (err.code === 'ECONNRESET' && state.connection === 'closed') {
      return
    } else if (err.code === 'ECONNRESET') {
      // possible recovery, if this error pops up again (though so far only on mavericks):
      // check uidvalidity
      // dedupe handled and sort
      // take lowest timepoint for new checkpoint
      // use uid instead of since timestamp on polling  'UID' - Messages
      // (with UIDs corresponding to the specified UID set. Ranges are permitted (e.g. '2504:2507' or '*' or '2504:*') )
      args.log.error('Connection reset before successful halftermination. Connection state was: ' + state.connection)
    }
    collectErrors(err)
  })

  imap.once('ready', function () {
    imap.openBox('INBOX', false, function (err, mailbox) {
      if (state.uidvalidity !== mailbox.uidvalidity) {
        state.uidvalidity = mailbox.uidvalidity
        state.lastSyncId = 0
      }

      if (err) {
        collectErrors(err)
        return
      }

      args.log.info('connected to ' + args.username)
      state.connection = 'open'

      processMails()
    })
  })

  imap.once('close', function () {
    args.log.info('disconnected from ' + args.username)

    state.connection = 'closed'
    maybeErrorCallback()
  })

  function imapDisconnect () {
    args.log.info('imap: closing')

    imap.closeBox(false, function () {
      imap.end()
    })
  }

  function handleEmail (result, resultCallback) {
    var fetcher = imap.fetch(result, {
      bodies: '',
      markSeen: false
    })

    var handledAtts = 0
    var waitForAttNr = 0

    function mailFinished () {
      state.handledIds.push(result)
      resultCallback()
    }

    fetcher.on('error', function (errFetch) {
      collectErrors(errFetch)
    })

    fetcher.on('message', function (msg, seqno) {
      var parser = new MailParser({streamAttachments: true})
      msg.on('body', function (stream, info) {
        stream.pipe(parser)
      })

      msg.on('attributes', function (attrs) {
        if (!state.latestTime) {
          state.latestTime = moment(attrs.date)
        } else {
          state.latestTime = moment.max(moment(attrs.date), state.latestTime)
        }
      })

      function onAttStreamFinished () {
        handledAtts += 1
        if (waitForAttNr > 0 && waitForAttNr === handledAtts) {
          mailFinished()
        }
      }

      parser.on('attachment', function (attachment, mail) {
        // console.log("########     attachment for: " + result)
        saveAttachmentStream(args, attachment, mail, onAttStreamFinished, collectErrors)
      })

      parser.on('end', function (mail) {
        if (!mail.attachments || mail.attachments.length < 1) {
          mailFinished()
        } else if (mail.attachments.length === handledAtts) {
          mailFinished()
        } else {
          waitForAttNr = mail.attachments.length
        }
      })
    })

    fetcher.once('end', function (errFetch2) {
      if (errFetch2) {
        collectErrors(errFetch2)
      }
    })
  }

  function processMails () {
    imap.search([ [ 'SINCE', args.since ] ], function (err, results) {
      results.sort(function (a, b) {
        return a - b
      })

      if (err) {
        collectErrors(err)
        return
      }

      var newResults = filter(results, function (uid) {
        if (state.lastSyncId >= uid) {
          state.handledIds.push(uid)
          return false
        }
        return true
      })

      state.newLastSyncId = results[results.length - 1]

      if (newResults.length === 0) {
        imapDisconnect()
        return
      }

      newResults.forEach(function (uid) {
        state.queue.push(uid, function (errQ2) {
          if (errQ2) {
            collectErrors(errQ2)
          }
        })
      })
    })
  }

  imap.connect()
}
