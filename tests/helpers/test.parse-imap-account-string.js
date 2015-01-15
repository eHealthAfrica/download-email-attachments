/* global describe, it, beforeEach */
require('chai').should();
var parseImapAccountString = require('../../lib/helpers/parse-imap-account-string');

describe('parseImapAccountString(accountString)', function() {
  describe('joe:secret@example.com', function() {
    beforeEach(function() {
      this.account = parseImapAccountString('joe:secret@example.com');
    });
    it('account.username should be "joe"', function() {
      this.account.username.should.equal('joe');
    });
    it('account.password should be "secret"', function() {
      this.account.password.should.equal('secret');
    });
    it('account.host should be "example.com"', function() {
      this.account.host.should.equal('example.com');
    });
    it('account.port should be undefined', function() {
      (typeof this.account.port).should.equal('undefined');
    });
  });

  describe('"joe@example.com":"123:@456"@imap-server.com:123', function() {
    beforeEach(function() {
      this.account = parseImapAccountString('"joe@example.com":"123:@456"@imap-server.com:123');
    });
    it('account.username should be "joe"', function() {
      this.account.username.should.equal('joe@example.com');
    });
    it('account.password should be "secret"', function() {
      this.account.password.should.equal('123:@456');
    });
    it('account.host should be "example.com"', function() {
      this.account.host.should.equal('imap-server.com');
    });
    it('account.port should be 123', function() {
      this.account.port.should.equal(123);
    });
  });
});
