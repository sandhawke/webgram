const webgram = require('webgram')
const server = new webgram.Server({port: 6004})
server.answer.incr = x => x + 1
