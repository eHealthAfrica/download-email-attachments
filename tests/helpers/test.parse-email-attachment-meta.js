/* global describe, it, beforeEach */
require('chai').should();
var parseEmailAttachmentMeta = require('../../lib/helpers/parse-email-attachment-meta');

describe('parseEmailAttachmentMeta(attachment, mail)', function() {
  beforeEach(function() {
    var attachment = {
      fileName: 'data.xls',
      contentId: '123-45@localhost'
    };
    var mail = {
      parsedHeaders: {
        'delivered-to': 'reciepient@example.com'
      },
      meta: {
        date: 'Thu Jan 1 2015 19:14:29 GMT+0100 (CET)'
      },
      from: [
        { address: 'sender@example.com' }
      ],
      parentNode: null
    };
    this.meta = parseEmailAttachmentMeta(attachment, mail);
  });
  it('returns meta.filename', function () {
    this.meta.filename.should.equal('data.xls');
  });
  it('returns meta.basename', function () {
    this.meta.basename.should.equal('data');
  });
  it('returns meta.extension', function () {
    this.meta.extension.should.equal('xls');
  });
  it('returns meta.day', function () {
    this.meta.day.should.equal('2015-01-01');
  });
  it('returns meta.recipientAddress', function () {
    this.meta.recipientAddress.should.equal('reciepient@example.com');
  });
  it('returns meta.senderAddress', function () {
    this.meta.senderAddress.should.equal('sender@example.com');
  });
  it('returns meta.id', function () {
    this.meta.id.should.equal('123-45');
  });
  it('returns meta.nr', function () {
    // 8 because it's the 8th test
    this.meta.nr.should.equal(8);
  });
});
