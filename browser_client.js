'use strict'

const SharedClient = require('./shared_client.js').Client

class Client extends SharedClient {
  constructor (address, options) {
    if (!address) {
      // which method to use?   my testing setup needs indirection.

      address = document.location.origin.replace(/^http/, 'ws')

      console.log('# computed my call-home address as', address)
    }
    super(address, options)
  }

  async makeSocket () {
    this.socket = new window.WebSocket(this.address)
  }
}

module.exports.Client = Client

/*

  connect (buffer) {
    this.socket = new window.WebSocket(this.address)

    this.socket.addEventListener('message', messageRaw => {
      this.connected = true
      messageRaw = messageRaw.data // IN BROWSER
      // debug('client sees new message', messageRaw)
      let message
      try {
        message = JSON.parse(messageRaw)
      } catch (e) {
        console.error('badly formatted message ignored', messageRaw)
        return
      }
      // debug('emitting', message[0], ...message.slice(1))
      this.emit(...message)
    })
    this.socket.addEventListener('open', () => {
      console.log('$online')
      this.emit('$online')
      while (true) {
        let item = this.buffer.shift()
        if (!item) break
        this.socket.send(item)
      }
      this.connected = true
    })
    this.socket.addEventListener('close', () => {
      this.connected = false
      console.log('websocket closed; retrying ...')
      window.setTimeout(() => { this.connect(this.buffer) }, 5000)
      // indicate upstream that we're offline?
      this.emit('$offline')
      console.log('$offline')
    })
    this.socket.addEventListener('error', (e) => {
      this.connected = false
      console.log('websocket error; retrying in 1s', e)
      // window.setTimeout(() => { this.connect() }, 1000)
    })
  }

  send (...args) {
    if (this.connected) {
      this.socket.send(JSON.stringify(args))
    } else {
      this.buffer.push(JSON.stringify(args))
    }
  }

  close () {
    this.connected = false
    this.socket.close()
  }
}

*/
