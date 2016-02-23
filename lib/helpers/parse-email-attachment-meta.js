var moment = require('moment')
var path = require('path')

/**
 * expects an attachment and an mail object as passed by
 * `mailparser`'s "attachment" event:
 * https://github.com/gr2m/mailparser#attachment-streaming.
 *
 * It returns an object with
 *
 * - `{filename}`, e.g. `data.xls`
 * - `{basename}`, e.g. `data`
 * - `{extension}`, e.g. `xls`
 * - `{day}`, e.g. `2015-01-01`
 * - `{recipientAddress}`, e.g. `reciepient@example.com`
 * - `{senderAddress}`, e.g. `sender@example.com`
 * - `{id}`, unique content ID, e.g. `c361f45d-98b6-9b18-96ac-f66aee2cb760`
 * - `{nr}`, starts at 1 and increments for every stored file.
 *
 * @param {String} imap-account string
 * @returns {Object}
 */
var nr = 1
module.exports = function parseEmailAttachmentMeta (attachment, mail) {
  // workaround for https://github.com/andris9/mailparser/pull/106/files#r22999900
  mail = findMailObject(mail)
  var day = moment(Date.parse(mail.meta.date)).format('YYYY-MM-DD')
  var filename = attachment.fileName || 'unknown_filename' + Math.random(10000)
  var extension = path.extname(filename) // includes leading .
  var id = attachment.contentId.replace(/@.*$/, '')
  var senderAddress
  if (mail.from && mail.from[0]) {
    senderAddress = mail.from[0].address
  } else {
    senderAddress = 'unknown sender'
  }

  return {
    filename: filename,
    basename: filename.replace(extension, ''),
    extension: extension.substr(1),
    day: day,
    recipientAddress: mail.parsedHeaders['delivered-to'],
    senderAddress: senderAddress,
    id: id,
    nr: nr++
  }
}

function findMailObject (node) {
  if (node.parentNode === null) return node
  return findMailObject(node.parentNode)
}
