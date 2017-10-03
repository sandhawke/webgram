'use strict'

const WebSocket = require('ws')
const SharedClient = require('./shared_client.js').Client

class Client extends SharedClient {
  whenOpen (onOpen) {
    this.socket = new WebSocket(this.address)
    this.socket.addEventListener('open', onOpen)
  }
}

module.exports.Client = Client
