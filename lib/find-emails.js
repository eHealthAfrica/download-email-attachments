var saveAttachmentStream = require('./save-attachment-stream')
var Imap = require('imap')
var MailParser = require('mailparser').MailParser
var async = require('async')
var after = require('lodash.after')
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
      args.log.error('timeout did not close imap connection in time')
      maybeErrorCallback()
      maybeErrorCallback = function () {
        args.log.error('callback called after timeout')
      }
    } else if (state.connection === 'closed' && state.openAttHandlers > 0) {
      state.errors.push('attachment handling in timout error')
      args.log.error('attachments could not be handled in time')
      maybeErrorCallback()
      maybeErrorCallback = function () {
        args.log.error('callback called after timeout')
      }
    }
  }, args.timeout)

  var maybeErrorCallback = function () {
    clearTimeout(timout)

    if (!callback) {
      return
    }

    if (state.errors.length > 0) {
      callback({errors: state.errors, latestTime: state.latestTime, lastSyncId: state.newLastSyncId, uidvalidity: state.uidvalidity})
    } else {
      callback({latestTime: state.latestTime, lastSyncId: state.newLastSyncId, uidvalidity: state.uidvalidity})
    }
  }

  function onAttHandlerFinished (arg) {
    state.openAttHandlers--
    // console.log("########     down to: " + state.openAttHandlers + "  for " +  arg)
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
    keepAlive: false, // args.keepalive,
    // debug: function (info) { console.log(i########     nfo) }
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

      // use this for future implementation of live email listener
      // imap.on('mail', function () {
      //   processMails()
      // })
    })
  })

  imap.once('close', function () {
    args.log.info('disconnected from ' + args.username)

    state.connection = 'closed'
    if (state.openAttHandlers === 0) {
      maybeErrorCallback()
    }
  })

  function imapDisconnect () {
    args.log.info('imap: closing')

    imap.closeBox(false, function () {
      imap.end()
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

      async.each(newResults, function (result, resultCallback) {
        // make sure fetching and parsing are both finished properly
        var resultCallback2 = after(2, function () {
          // console.log("########     finished for :" + result)
          state.handledIds.push(result)
          resultCallback()
        })
        // console.log("########     start for :" + result)
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

          msg.on('attributes', function (attrs) {
            if (!state.latestTime) {
              state.latestTime = moment(attrs.date)
            } else {
              state.latestTime = moment.max(moment(attrs.date), state.latestTime)
            }
          })

          parser.on('attachment', function (attachment, mail) {
            // console.log("########     attachment for: " + result)
            state.openAttHandlers++
            // console.log("########     up one " + state.openAttHandlers + '     for ' + JSON.stringify(attachment.fileName))
            saveAttachmentStream(args, attachment, mail, onAttHandlerFinished, collectErrors)
          })

          parser.on('end', function (mail) {
            resultCallback2()
          })
        })

        fetcher.once('end', function (err) {
          if (err) {
            collectErrors(err)
          }
          resultCallback2()
        })
      }, function (err) {
        if (err) {
          collectErrors(err)
        }
        // console.log("######## closing imap because of handled all")
        // console.log("######## handlers " + state.openAttHandlers)
        imapDisconnect()
      })
    })
  }

  imap.connect()
}
