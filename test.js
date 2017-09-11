'use strict'

const test = require('tape')
const webgram = require('.')

test(async (t) => {
  t.plan(1)
  class Server extends webgram.Server {
    constructor () {
      super()

      this.on('test', (client, a1, a2) => {
        client.send('test-response', a1 + a2, a1 - a2)
      })
    }
  }

  const s = new Server()
  await s.start() // need to wait for address

  // console.log('address', s.address)
  const c = new webgram.Client(s.address)
  c.on('test-response', (plus, minus) => {
    // console.log('test response to c1', plus, minus)
    t.equal(plus, 123 + 456)
    c.close()
    s.stop().then(() => {
      t.end()
    })
  })
  c.send('test', 123, 456)  // this is probably before connected
})
