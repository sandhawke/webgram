'use strict'

/*
   This is painfully redundant with index.js, but I wasn't having much
   luck figuring out how to get browserify not to include ws with my
   other approaches.  Maybe we can this and index.js can call some
   common stuff.

   This also has different logic around storing login state, and it
   can auto-connect using document.location

   Retry logic is buggy right now -- it retries multiple times at once...

*/

const EventEmitter = require('eventemitter3')

function doToken (client) {
  let token
  if (!token) {
    token = window.localStorage.getItem('clientToken')
  }
  client.send('clientToken', token || 'requested')

  client.on('setClientToken', token => {
    window.localStorage.setItem('clientToken', token)
  })
}

class Client extends EventEmitter {
  constructor (address, options) {
    super()
    if (address) {
      this.address = address
    }
    if (!this.address && typeof document === 'object') {
      this.address = document.location.origin.replace(/^http/, 'ws')
      console.log('computed my call-home address as', this.address)
    }

    Object.assign(this, options)
    this.buffer = []
    this.connected = false
    this.connect()
  }

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
    doToken(this)
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

module.exports.Client = Client
