'use strict'

const test = require('tape')
const webgram = require('.')

test(async (t) => {
  t.plan(1)
  const s = new webgram.Server()
  await s.start() // need to wait for address

  // console.log('address', s.address)
  const c = new webgram.Client(s.address)
  c.on('$pong', (text) => {
    console.log('test response to c1:', text)
    t.equal(text, 'hello')
    c.close()
    s.stop().then(() => {
      t.end()
    })
  })
  // c.send('$ping', 'hello')  // this is probably before connected, so queued
  c.on('$login', u => {
    c.send('$ping', 'hello') 
  })
})

test.skip(async (t) => {
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

test.skip('saveload', async (t) => {
  t.plan(1)
  class Server extends webgram.Server {
    constructor () {
      super({dbPath: 'db-test'})
      this.on('$ready', async (client) => {
        const oldvalue = await client.load('visits', 0)
        console.log('visits', oldvalue)
        client.save('visits', oldvalue + 1)
      })
      this.on('ping', (client, ...data) => {
        client.send('pong', ...data)
      })
    }
  }

  const s = new Server()
  await s.start() // need to wait for address

  // console.log('address', s.address)
  const c = new webgram.Client(s.address)
  c.on('pong', () => {
    c.close()
    s.stop().then(() => {
      t.pass()
      t.end()
    })
  })
  c.send('ping', 123, 456)
})
