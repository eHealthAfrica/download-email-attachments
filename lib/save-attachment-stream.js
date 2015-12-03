var fs = require('fs')
var mkdirp = require('mkdirp')
var path = require('path')
var replaceTemplate = require('string-template')
var parseEmailAttachmentMeta = require('./helpers/parse-email-attachment-meta')

/**
 * Handles stream of email attachment
 */
module.exports = function (state, attachment, mail, callback, errorCb) {
  var output
  var originalFileName = attachment.fileName
  var meta = parseEmailAttachmentMeta(attachment, mail)
  var generatedFileName = replaceTemplate(state.filenameTemplate, meta).replace(state.invalidChars, '_')
  var filePath = state.directory + generatedFileName
  var fileExists = fs.existsSync(filePath)

  if (state.filenameFilter && !state.filenameFilter.test(originalFileName)) {
    state.log.info('Ignoring "' + originalFileName)
    callback(originalFileName)
    return
  }

  if (fileExists) {
    state.log.warn(filePath + ' already exists, ignoring')
    callback(originalFileName)
    return
  }

  // assure that directory exists
  mkdirp.sync(path.dirname(filePath))

  state.log.info('writing to ' + filePath + ' ...')

  output = fs.createWriteStream(filePath)
  attachment.stream.pipe(output)

  attachment.stream.on('end', function () {
    state.log.info('done writing ' + filePath)
    if (state.attachmentHandler) {
      // console.log('###### calling into att handler now for ' + filePath)
      state.attachmentHandler({path: filePath, generatedFileName: generatedFileName, att: attachment, mail: mail}, callback)
    } else {
      callback(originalFileName)
    }
  })

  attachment.stream.on('error', errorCb)
}
