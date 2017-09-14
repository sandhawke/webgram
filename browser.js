'use strict'

/*
   This is painfully redundant with index.js, but I wasn't having much
   luck figuring out how to get browserify not to include ws with my
   other approaches.  Maybe we can this and index.js can call some
   common stuff.
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
    this.socket = new window.WebSocket(this.address)

    this.socket.addEventListener('message', messageRaw => {
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
      for (let item of this.buffer) {
        this.socket.send(item)
      }
      this.buffer = null
    })
    doToken(this)
  }

  send (...args) {
    if (this.buffer) {
      this.buffer.push(JSON.stringify(args))
    } else {
      this.socket.send(JSON.stringify(args))
    }
  }

  close () {
    this.socket.close()
  }
}

module.exports.Client = Client
