'use strict'

const http = require('http')
const os = require('os')
const express = require('express')
const morgan = require('morgan')
const debug = require('debug')('webgram-server')
const EventEmitter = require('eventemitter3')
const WebSocket = require('ws')
const enableDestroy = require('server-destroy')

class Server extends EventEmitter {
  constructor (config) {
    super()
    Object.assign(this, config)
    if (!this.app) this.app = express()
    if (!this.port) this.port = 0
    if (!this.logger) this.logger = morgan
    if (!this.root) this.root = './static'

    if (!this.quiet) {
      this.app.use(this.logger('short'))
    }

    this.app.use(express.static(this.root))
    // {extensions: ['html', 'css']}))

    this.on('$ping', (conn, ...args) => {
      console.log('got ping')
      conn.send('$pong', ...args)
    })

    // common bug for me is to forget to call server.start
    if (!this.manualStart) {
      process.nextTick(() => this.start())
    }
  }

  // only starts once, but you can call this many times to get the
  // Promise of it being started
  start () {
    if (this.startPromise) return this.startPromise
    this.startPromise = new Promise((resolve, reject) => {
      // if https...
      this.hServer = http.createServer(this.app)
      this.wServer = new WebSocket.Server({
        server: this.hServer
      })
      this.wServer.on('connection', (ws, req) => {
        // connection
        debug('new connection', req.connection.remoteAddress)
        const remote = new Connection(ws, this)
        this.emit('$opened', remote)

        ws.on('message', messageRaw => {
          debug('new message: ', messageRaw)
          let message
          try {
            message = JSON.parse(messageRaw)
          } catch (e) {
            console.error('badly formatted message ignored')
            return
          }
          const type = message[0]
          if (type[0] === '$') {
            // don't let someone maybe trick us with $login or something
            console.warn('received message starting with $.  Ignored:', type)
            return
          }
          debug('emitting', message[0], ...message.slice(1))
          // server.on(ev, conn, ...) style
          this.emit(message[0], remote, ...message.slice(1))
          // conn.on(ev, ...) style
          remote.emit(...message)
        })
        ws.on('close', () => {
          this.emit('$closed', remote)
          remote.emit('$closed')
        })
      })

      this.hServer.listen(this.port, () => {
        enableDestroy(this.hServer)
        this.assignedPort = this.hServer.address().port
        if (this.proxied) {
          this.siteURL = 'https://' + (this.hostname || os.hostname())
        } else {
          this.siteURL = 'http://' + (this.hostname || os.hostname())
          if (this.assignedPort !== 80) {
            this.siteURL += ':' + this.assignedPort
          }
        }
        this.address = this.siteURL.replace(/^http/, 'ws')
        debug('Running at: ', this.siteURL)
        if (!this.quiet) {
          console.log('Site available at', this.siteURL)
        }
        resolve()
      })
    })
    return this.startPromise
  }

  stop () {
    return new Promise((resolve, reject) => {
      debug('stopping', this.siteURL)
      // this.hServer.destroy()
      // console.log("DESTROY")
      this.hServer.close(() => { resolve() })
    })
  }
}

class Connection extends EventEmitter {
  constructor (socket, server) {
    super()
    this.socket = socket
    this.server = server

    // make a copy so it's still available after close
    this.address = [socket._socket.remoteAddress, socket._socket.remotePort]
  }
  send (...args) {
    debug('server trying to send', ...args)
    const text = JSON.stringify(args)
    try {
      this.socket.send(text)
      debug('sent')
    } catch (e) {
      if (e.message === 'not opened') {
        debug('cant send: socket already closed')
        // tried to write when it's closed, probably a timing issue, likely
        // it's in the process of closing.  Ignore, I guess.
      } else {
        console.error('Connection.send() error:', e.message)
        console.error('text was:', text)
        console.error('userData was:', this.userData)
      }
    }
  }
}

Server.Connection = Connection

module.exports.Server = Server
