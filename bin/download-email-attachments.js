#!/usr/bin/env node
var argv = require('minimist')(process.argv.slice(2));
var accountString = argv._[0];
var filenameFilter = argv['filename-filter'] && new RegExp(argv['filename-filter']);
var timeout = argv.timeout;
var config = {
  account: accountString,
  directory: argv.directory,
  filenameTemplate: argv['filename-template'],
  filenameFilter: filenameFilter,
  since: argv.since,
  timeout: timeout
};

var downloadEmailAttachments = require('../index.js');

downloadEmailAttachments(config, function (error) {
  if (error) {
    console.log(JSON.stringify(error, null, 2));
  }
  console.log('done');
  process.exit(0);
});
