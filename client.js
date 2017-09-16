'use strict'

// this is the node.js version of the client.  See browser.js

const WebSocket = require('ws')
const EventEmitter = require('eventemitter3')
const debug = require('debug')('client')
const fs = require('fs')

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
    this.socket = new WebSocket(this.address)

    this.socket.on('message', messageRaw => {
      debug('client sees new message', messageRaw)
      let message
      try {
        message = JSON.parse(messageRaw)
      } catch (e) {
        console.error('badly formatted message ignored')
        return
      }
      debug('emitting', message[0], ...message.slice(1))
      this.emit(...message)
    })
    this.socket.on('open', () => {
      for (let item of this.buffer) {
        this.socket.send(item)
      }
      this.buffer = null
    })
    if (this.login) this.login()
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

  login () {
    this.on('$login-failed', fail => {
      throw Error('login failed: ' + fail)   // .msg?
    })
    this.on('$login', userData => {
      fs.writeFileSync('./client-login-data.json', JSON.stringify(userData, null, 2), {
        encoding: 'utf8',
        mode: 0o600})
    })

    if (!this.userData) {
      try {
        this.userData = JSON.parse(fs.readFileSync('./client-login-data.json', 'utf8'))
      } catch (e) {
        debug('error reading client-userData.json', e.message)
      }
    }
    if (!this.userData) {
      this.userData = { create: true }
    }
    this.send('$login', this.userData)
  }
}

module.exports.Client = Client
