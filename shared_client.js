'use strict'

// this is the node.js version of the client.  See browser.js

const EventEmitter = require('eventemitter3')
const debugModule = require('debug')
const sessions = require('webgram-sessions')

let counter = 0

class Client extends EventEmitter {
  constructor (address, options = {}) {
    super()
    this.debug = debugModule('webgram_client_' + ++counter)
    if (address) {
      this.address = address
    }

    Object.assign(this, options)
    this.buffer = []
    this.askSeq = 0
    this.timeout = 10000

    this.connect() // ends up calling back to onOpen later

    this.acceptsWebgramClientHooks = true
    if (this.useSessions === undefined || this.useSessions) {
      sessions.hook(this, options)
    }
  }

  // called by subclass when connection is made
  onOpen () {
    // console.log('# whenOpen called, readyState=', this.socket.readyState)
    this.socket.addEventListener('message', this.onMessage.bind(this))
    this.socket.addEventListener('error', this.onError.bind(this))
    for (let item of this.buffer) {
      this.socket.send(item)
    }
    this.buffer = null
  }

  onError (err) {
    console.log('webgram/shared_client error')
    throw err
  }

  onMessage (messageRaw) {
    messageRaw = messageRaw.data
    this.debug('client sees new message', messageRaw)
    let message
    try {
      message = JSON.parse(messageRaw)
    } catch (e) {
      console.error('badly formatted message ignored')
      return
    }
    this.debug('emitting %o', message)
    this.emit(...message)
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
    this.closed = true
    this.socket.close()
  }
}

module.exports.Client = Client
