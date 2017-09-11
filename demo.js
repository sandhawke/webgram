'use strict'

const webgram = require('webgram')

class Server extends webgram.Server {
  constructor () {
    super({port:6502})

    this.on('search', (client, search) => {
      console.log('search for', search)
      client.send('search-results', search, 'nothing found')
    })

    this.on('test', (client, a1, a2) => {
      client.send('test-response', a1+a2, a1-a2)
    })
  }
}

const s = new Server()

const c = new webgram.Client('ws://127.0.0.1:6502')
c.send('test', 123, 456)
c.on('test-response', (plus, minus) => {
  console.log('test response to c1', plus, minus)
})
console.log('c1 did send call')

s.start().then( () => {
  const c2 = new webgram.Client('ws://127.0.0.1:6502')
  c2.send('test', 100, 200)
  c2.on('test-response', (plus, minus) => {
    console.log('test response to c2', plus, minus)
  })
})

