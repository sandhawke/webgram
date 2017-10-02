'use strict'

const WebSocket = require('ws')
const SharedClient = require('./shared_client.js').Client

class Client extends SharedClient {
  async makeSocket () {
    this.socket = new WebSocket(this.address)
  }
}

module.exports.Client = Client
