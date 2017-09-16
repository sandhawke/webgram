'use strict'

process.on('unhandledRejection', (reason, p) => {
  console.error(process.argv[1], '(Message from code embedded in webgram temporarilty)\nUnhandled Rejection at: Promise', p, 'reason:', reason)
  process.exit()
})

module.exports.Server = require('./server').Server
module.exports.Client = require('./nodejs_client').Client
