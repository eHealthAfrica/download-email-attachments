/* global describe, it */
require('chai').should()
var normalizeDirectoryPath = require('../../lib/helpers/normalize-directory-path')

describe('normalizeDirectoryPath(path)', function () {
  it('returns "./files/" for "./files/"', function () {
    var path = normalizeDirectoryPath('./files')
    path.should.equal('files/')
  })
})
