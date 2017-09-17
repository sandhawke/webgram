'use strict'

// this is the node.js version of the client.  See browser.js

const EventEmitter = require('eventemitter3')
const debug = require('debug')('webgram:client')

class Client extends EventEmitter {
  constructor (address, options) {
    super()
    if (address) {
      this.address = address
    }

    Object.assign(this, options)
    this.buffer = []
    this.askSeq = 0
    this.timeout = 10000

    // Let subclass do:  this.socket = new WebSocket(this.address)
    this.makeSocket()

    this.socket.addEventListener('message', messageRaw => {
      messageRaw = messageRaw.data
      debug('client sees new message', messageRaw)
      let message
      try {
        message = JSON.parse(messageRaw)
      } catch (e) {
        console.error('badly formatted message ignored')
        return
      }
      debug('emitting %o', message)
      this.emit(...message)
    })
    this.socket.addEventListener('open', () => {
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

  ask (...args) {
    return new Promise((resolve, reject) => {
      const code = ++this.askSeq
      const myTimer = setTimeout(() => {
        this.send('cancel', code)
        reject(Error('timeout'))
      }, this.timeout)
      this.send('ask', code, ...args)
      this.once(code, (err, resp) => {
        clearTimeout(myTimer)
        if (err) {
          reject(err)
          return
        }
        resolve(resp)
      })
    })
  }

  close () {
    this.socket.close()
  }
}

module.exports.Client = Client
