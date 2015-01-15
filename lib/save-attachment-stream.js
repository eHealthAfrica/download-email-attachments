var fs = require('fs');
var mkdirp = require('mkdirp');
var path = require('path');
var replaceTemplate = require('string-template');
var parseEmailAttachmentMeta = require('./helpers/parse-email-attachment-meta');

/**
 * Handles stream of email attachment
 */
module.exports = function(state, attachment, mail, callback) {
  var output;
  var originalFileName = attachment.fileName;
  var meta = parseEmailAttachmentMeta(attachment, mail);
  var generatedFileName = replaceTemplate(state.filenameTemplate, meta);
  var filePath = state.directory + generatedFileName;
  var fileExists = fs.existsSync(filePath);

  if (state.filenameFilter && !state.filenameFilter.test(originalFileName)) {
    state.log.warn('Ignoring %s due to filter: %s', originalFileName, state.filenameFilter);
    return;
  }

  if (fileExists) {
    state.log.warn('%s already exists, ignoring', filePath);
    return;
  }

  // assure that directory exists
  mkdirp.sync(path.dirname(filePath));

  state.log.info('writing to %s ...', filePath);

  output = fs.createWriteStream(filePath);
  attachment.stream.pipe(output);
  attachment.stream.on('end', function() {
    state.log.info('done writing %s', filePath);
  });
  attachment.stream.on('error', callback);
};
