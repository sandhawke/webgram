'use strict'

const test = require('tape')

/* const webgram = require('.')

const conn = new webgram.Client(serverAddress, {useSessions: false})
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
*/

test('foo', t => {
  t.plan(1)
  t.equal(10, 10)
  t.end()
})

test('bar', t => {
  t.plan(1)
  t.equal(11, 11)
  t.end()
})

/*
conn.on('webgram-pong', x => {

  console.log('ok something')
  console.log('ok something else')
  conn.send('end')
  // just in case server doesn't kill the browser on getting 'end':
  document.body.innerHTML = '<h1>Test complete.  Close this window please.</h1>'
})
conn.send('webgram-ping', 100)
*/
