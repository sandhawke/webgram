const webgram = require('webgram')

const server = new webgram.Server({port: 5678})
server.on('$opened', conn => {
  conn.on('echo-in', (...args) => {
    conn.send('echo-out', ...args)
  })
})
