'use strict'

const webgram = require('.')

const conn = new webgram.Client(undefined /* serverAddress */, {useSessions: false})
const original = console.log.bind(console)
console.log = (...args) => {
  original(...args)
  conn.send('output', ...args)

  // this is how we guess tape is done
  const line = args[0]
  if (line.startsWith('1..')) {
    // after this, the pass and fail lines will follow immediately,
    // and actually I think it's okay if we stop before they come out.
    setTimeout(() => {
      conn.send('end')
    }, 10)
  }
}
