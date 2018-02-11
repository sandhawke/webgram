'use strict'

const http = require('http')
const os = require('os')
const express = require('express')

const morgan = require('morgan')
const debug = require('debug')('webgram_server')
const EventEmitter = require('eventemitter3')
const WebSocket = require('ws')
const sessions = require('webgram-sessions')
// const wtf = require('wtfnode')

class Server extends EventEmitter {
  constructor (options = {}) {
    super()
    Object.assign(this, options)
    if (!this.app) this.app = express()
    if (!this.logger) this.logger = morgan
    if (!this.root) this.root = './static'
    if (!this.ConnectionClass) this.ConnectionClass = Connection
    this.connections = new Set()

    if (this.port === undefined) this.port = process.env.PORT
    if (this.port === undefined) this.port = 0 // assigned by OS

    if (!this.hostname) {
      this.hostname = process.env.HOSTNAME
      if (this.hostname) this.proxied = true
    }
    if (!this.hostname) this.hostname = os.hostname() // not usually good

    if (!this.quiet) {
      this.app.use(this.logger('short'))
    }

    this.app.use(express.static(this.root))
    // {extensions: ['html', 'css']}))

    this.on('webgram-ping', (conn, ...args) => {
      debug('got ping')
      conn.send('webgram-pong', ...args)
    })

    this.answer = {}
    this.on('ask', (conn, code, type, ...args) => {
      debug('handling ask, code %j type %j args %o', code, type, args)
      const handler = this.answer[type]
      if (!handler) {
        debug('no handler')
        conn.send(code, 'no handler')
        return
      }
      let result
      function onErr (err) {
        if (err.message && err.message.startsWith('client:')) {
          conn.send(code, err)
        } else {
          throw err
        }
      }
      try {
        result = handler(conn, ...args)
      } catch (err) {
        debug('sync failure %j', err)
        onErr(err)
      }
      if (result instanceof Promise) {
        result
          .then((resp) => {
            debug('async success %o', resp)
            conn.send(code, null, resp)
          })
          .catch(err => {
            debug('async failure %j', err)
            onErr(err)
          })
      } else {
        debug('sync success %o', result)
        conn.send(code, null, result)
      }
    })

    // common bug for me is to forget to call server.start
    if (!this.manualStart) {
      process.nextTick(() => this.start())
    }

    this.acceptsWebgramServerHooks = true
    if (this.useSessions === undefined) this.useSessions = true
    if (this.useSessions) {
      sessions.hook(this, options.sessionOptions)
    } else {
      debug('WARNING: SESSIONS DISABLED at API request')
      // maybe we should catch the session messages anyway and issue a
      // console.warn then?   Suggests protocol mismatch.
    }
  }

  // okay to call repeatedly, for the promise of being started.  will
  // only call innerStart once.
  start () {
    if (this.startPromise) return this.startPromise
    this.startPromise = this.innerStart()
    return this.startPromise
  }

  innerStart () {
    return new Promise((resolve, reject) => {
      // if https...
      this.hServer = http.createServer(this.app)
      this.wServer = new WebSocket.Server({
        server: this.hServer
      })
      this.wServer.on('connection', (ws, req) => {
        // connection
        debug('new connection', req.connection.remoteAddress)
        const remote = new this.ConnectionClass(ws, this)
        this.connections.add(remote)
        // rename to $connect[ed], $connection-created ?  was $opened
        this.emit('$connect', remote)

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
          debug('emitting %o', message)
          // server.on(ev, conn, ...) style
          this.emit(message[0], remote, ...message.slice(1))
          // conn.on(ev, ...) style
          remote.emit(...message)
        })
        ws.on('close', () => {
          this.connections.delete(remote)
          this.emit('$closed', remote)
          remote.emit('$closed')
        })
      })

      this.hServer.listen(this.port, () => {
        this.assignedPort = this.hServer.address().port
        if (this.proxied) {
          this.siteURL = 'https://' + this.hostname
        } else {
          this.siteURL = 'http://' + this.hostname
          if (this.assignedPort !== 80) {
            this.siteURL += ':' + this.assignedPort
          }
        }
        this.address = this.siteURL.replace(/^http/, 'ws')
        debug('Running at: ', this.siteURL)
        if (!this.quiet) {
          console.log('# Site available at', this.siteURL)
        }
        resolve()
      })
    })
  }

  // unsure which name to use!
  //
  // httpServer uses .close() but our semantic are different; we
  // actually shut down running connections, they just stop accepting
  // new ones.
  //

  close () {
    return this.stop()
  }

  foobar () { return 'FOOBAR 123' }

  stop () {
    debug('stop called, returning promise')
    return new Promise((resolve, reject) => {
      debug('stopping', this.siteURL)
      // wtf.dump()
      // close each connection, too?
      // maybe destroy it?   confusing.
      for (const conn of this.connections) {
        if (conn.close) {
          debug('closing connnection from ', conn.address)
          conn.close()
        } else {
          debug('conn has no .close %O', conn)
        }
      }
      debug('closing server')
      // wtf.dump()
      this.hServer.close(() => {
        debug('stopped', this.siteURL)
        // lsof -i :xxxxxx
        // wtf.dump()
        resolve()
      })
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
    debug('server trying to send %o', args)
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
  close () {
    return this.socket.close()
  }
}

Server.Connection = Connection

module.exports.Server = Server
