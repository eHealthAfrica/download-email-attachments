# download-email-attachments

> Download email attachments via IMAP

[![Build Status](https://travis-ci.org/gr2m/download-email-attachments.png?branch=master)](https://travis-ci.org/gr2m/download-email-attachments/)

`download-email-attachments` downloads all attachements of an email account
to a directory. It can either be required as module or used as
a command line tool.

## Command Line Interface

```
# install download-email-attachments globally
npm install -g download-email-attachments

# download all attachments of joe@example.com (password: secret) since beginning of 2015-01-12
download-email-attachments "joe@example.com":secret@imap-server.com:123 \
  --directory ./files \
  --filename-template "{day}-{filename}" \
  --filename-filter ".xlsx?$" \
  --timeout 3000 \
  --since 2015-01-12
```

## Using as module

```js
var downloadEmailAttachments = require('download-email-attachments');
downloadEmailAttachments({
  account: '"joe@example.com":secret@imap-server.com:123',
  directory: './files',
  filenameTemplate: '{day}-{filename}',
  filenameFilter: /.xlsx?$/,
  timeout: 3000,
  since: '2015-01-12'
})

## Options

You have to pass an imap account with password, the format is:

```
username:password@host:port
```

- `username`
  If username contains `@` or `:`, put it in quotes, e.g. `"joe@example.com":secret@example.com
- `password`
  If password contains `@` or `:`, put it in quotes, e.g. `joe:"123:@456"@example.com
- `host`
  This is the imap domain
- `port`
  Optional, defaults to `993`


### `--directory` / `directory`

**Optional**. Defaults to `./`

Directory where attachments shall be downloaded to.


### `--filename-template` / `filenameTemplate`

**Optional**. Defaults to `{filename}`

Filenames the attachments shall be saved as. Using `/` will
create subfolders. The following placeholders are available

- `{filename}`, e.g. `data.xls`
- `{basename}`, e.g. `data`
- `{extension}`, e.g. `xls`
- `{day}`, e.g. `2015-01-01`
- `{recipientAddress}`, e.g. `reciepient@example.com`
- `{senderAddress}`, e.g. `sender@example.com`
- `{id}`, unique content ID, e.g. `c361f45d-98b6-9b18-96ac-f66aee2cb760`
- `{nr}`, starts at 1 and increments for every stored file.


### `--filename-filter` / `filenameFilter`

**Optional**

Pass a regular expression, only attachments matching it will be
downloaded.


### `--timeout` / `timeout`

**Optional**, defaults to 10000

Timeout in millisecond to wait for data from the imap server until
closing the connection.


### `--since` / `since`

**Optional**. Defaults to today's date in `YYYY-MM-DD` format


## Local setup

```
git clone git@github.com:gr2m/download-email-attachments.git
cd download-email-attachments
npm install
```

Run all tests

```
npm test
```

**Note**: There is no full stack test yet, because of the complexity
of stubbing an imap server. If someone could help here, that'd be
much appreciated. [Ping me](https://twitter.com/gr2m)

## License

MIT
