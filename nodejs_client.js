'use strict'

const WebSocket = require('ws')
const SharedClient = require('./shared_client.js').Client

class Client extends SharedClient {
  connect () {
    this.socket = new WebSocket(this.address)
    this.socket.addEventListener('error', this.onError.bind(this))
    this.socket.addEventListener('open', this.onOpen.bind(this))
  }
}

module.exports.Client = Client
