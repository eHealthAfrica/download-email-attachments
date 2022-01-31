var saveAttachmentStream = require('./save-attachment-stream')
var Imap = require('imap')
var MailParser = require('mailparser').MailParser
var async = require('async')
var filter = require('lodash.filter')
var once = require('lodash.once')
var moment = require('moment')

module.exports = function findEmails (args, callback) {
  var state = {
    uidvalidity: args.uidvalidity, // used for future optimization of imap search and devalidation of last sync id
    errors: [],
    failedMessages: {},
    handledIds: [],
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
  function collectErrors (err, id) {
    if (id) {
      state.failedMessages[id] = true
    }
    state.errors.push(err)
  }

  // if problems during connection happen the callback is called after timeout
  var timeout
  function resetTimeout () {
    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(function () {
      if (state.connection === 'virgin') {
        state.errors.push('imap connection error')
      } else if (state.connection === 'open') {
        state.errors.push('connection closing in timeout error')
        args.log.error('timeout: did not close imap connection in time')
        imapDisconnect()
      } else if (state.connection === 'closed' && !state.queue.idle()) {
        state.errors.push('attachment handling in timeout error')
        args.log.error('attachments could not be handled in time')
        state.queue.kill()
      } else {
        args.log.error('timeout hit unmet case')
        imapDisconnect()
      }

      maybeErrorCallback()
    }, args.timeout)
  }

  resetTimeout()

  var maybeErrorCallback = once(function () {
    if ((state.connection !== 'closed' || !state.queue.idle())) {
      args.log.error('callback called on active connection')
    }

    clearTimeout(timeout)

    if (!callback) {
      return
    }

    var errorFree = state.errors.length === 0

    var lastSafeId

    if (errorFree) {
      lastSafeId = state.newLastSyncId
    } else {
      lastSafeId = state.lastSyncId
    }

    var extraHandledIds = filter(state.handledIds, function (id) {
      return lastSafeId < id
    })

    if (!errorFree) {
      callback({latestTime: state.latestTime, lastSyncId: state.newLastSyncId, uidvalidity: state.uidvalidity, handledIds: extraHandledIds, errors: state.errors})
    } else {
      callback({latestTime: state.latestTime, lastSyncId: state.newLastSyncId, uidvalidity: state.uidvalidity, handledIds: extraHandledIds})
    }
  })

  var imapOptions = {
    xoauth2: undefined,
    user: args.username,
    password: args.password,
    host: args.host,
    port: args.port,
    tls: args.ssl,
    keepAlive: false,
    debug: function (info) {
      args.log.debug(info)

      if (info.toLowerCase().indexOf('overquota') > -1) {
        collectErrors('Hit gmail overquota.')
      }
    }
  }

  if (args.ssl) {
    imapOptions.tlsOptions = {
      secureProtocol: 'TLSv1_method'
    }
  }

  var imap = new Imap(imapOptions)

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
      // TODO: handle change of email adress in conjunction with uidvalidity!
      if (state.uidvalidity !== mailbox.uidvalidity) {
        state.uidvalidity = mailbox.uidvalidity
        state.lastSyncId = 0
        state.handledIds = []
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
    try {
      imap.closeBox(false, function () {
        imap.end()
      })
      state.queue.kill()
    } catch (disErr) {
      collectErrors(disErr)
    }
  }

  function handleEmail (result, resultCallback) {
    var fetcher = imap.fetch(result, {
      bodies: '',
      markSeen: false
    })

    var handledAtts = 0
    var waitForAttNr = 0

    function mailFinished () {
      if (!state.failedMessages[result]) {
        state.handledIds.push(result)
      }
      resetTimeout()
      resultCallback()
    }

    fetcher.on('error', function (errFetch) {
      collectErrors(errFetch, result)
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
        saveAttachmentStream(args, attachment, mail, onAttStreamFinished, function (errC) { collectErrors(errC, result) })
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
        collectErrors(errFetch2, result)
      }
    })
  }

  function processMails () {
    var imap_args = [['SINCE', args.since]]
    args.sender ? imap_args.push(['FROM', args.sender]) : null
    imap.search(imap_args, function (err, results) {
      resetTimeout()

      results.sort(function (a, b) {
        return a - b
      })

      if (err) {
        collectErrors(err)
        return
      }

      var newResults = filter(results, function (uid) {
        if (state.handledIds.indexOf(uid) > -1) {
          return false
        } else if (state.lastSyncId >= uid) {
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
            collectErrors(errQ2, uid)
          }
        })
      })
    })
  }

  imap.connect()
}
