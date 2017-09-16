'use strict'

process.on('unhandledRejection', (reason, p) => {
  console.error(process.argv[1], 'Unhandled Rejection at: Promise', p, 'reason:', reason)
  process.exit()
})

const http = require('http')
const os = require('os')
const crypto = require('crypto')
const express = require('express')
const morgan = require('morgan')
const debug = require('debug')('server')
const level = require('level')
const EventEmitter = require('eventemitter3')
const WebSocket = require('ws')

class Server extends EventEmitter {
  constructor (config) {
    super()
    Object.assign(this, config)
    if (!this.app) this.app = express()
    if (!this.db) this.db = level(this.dbPath || 'db.level', {
      keyEncoding: 'json', valueEncoding: 'json'
    })
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

    this.on('$login', async (conn, auth) => {
      if (auth.create) {
        delete auth.create 
        await conn.createLogin(auth)
        conn.send('$login', conn.userData)
      } else {
        const fail = await conn.login(auth)
        if (fail) {
          conn.send('$login-failed', fail)
          return
        }
        conn.send('$login', conn.userData)
      }
      this.emit('$login-complete', conn)
      conn.emit('$login-complete')
      debug('client logged in')
    })
  }

  async genUID () {
    if (!this.nextUID) {
      try {
        this.nextUID = await get(this.db, 'nextUID')
      } catch (e) {
        if (e.notFound) {
          this.nextUID = 1
        } else {
          throw e
        }
      }
    }
    const uid = this.nextUID
    this.nextUID++
    await put(this.db, 'nextUID', this.nextUID)
    return uid
  }

  start () {
    return new Promise((resolve, reject) => {
      // if https...
      this.hServer = http.createServer(this.app)
      this.wServer = new WebSocket.Server({
        server: this.hServer
      })
      this.wServer.on('connection', (ws, req) => {
        // connection
        debug('new connection', req.connection.remoteAddress)
        const remote = new Connection(ws, this.db, this)

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
          debug('emitting', message[0], ...message.slice(1))
          // server.on(ev, conn, ...) style
          this.emit(message[0], remote, ...message.slice(1))
          // conn.on(ev, ...) style
          remote.emit(...message)
        })
        ws.on('close', () => {
          this.emit('$close', remote)
          remote.emit('$close')
        })
      })

      this.hServer.listen(this.port, () => {
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
  }

  stop () {
    return new Promise((resolve, reject) => {
      debug('stopping', this.siteURL)
      this.hServer.close(() => { resolve() })
    })
  }
}

class Connection extends EventEmitter {
  constructor (socket, db, server) {
    super()
    this.socket = socket
    this.db = db
    this.server = server
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

  // write conn.userData to disk, which you should probably do after
  // you modify it for some reason.
  async save () {
    debug('SAVING', this.userData._uid, JSON.stringify(this.userData, null, 2))
    await put(this.db, this.userData._uid, this.userData)
  }
  
  async createLogin (auth) {
    const _uid = await this.server.genUID()
    const _secret = crypto.randomBytes(64).toString('base64')
    const _firstVisitTime = new Date()
    const _latestVisitTime = _firstVisitTime
    const userData = {
      _uid,
      _secret,
      _firstVisitTime,
      _latestVisitTime
    }

    // carry through some properties?
    if (auth._displayName) userData._displayName = auth._displayName
    
    this.userData = userData
    await this.save()
  }

  async login (auth) {
    let userData
    try {
      userData = await get(this.db, auth._uid)
    } catch (err) {
      if (err.notFound) return 'unknown uid'
      console.error('error in looking for userdata', err)
      return 'internal error'
    }

    // todo: add some crypto
    if (userData.secret === auth.secret) {
      userData._previousVisitTime = userData._latestVisitTime
      userData._latestVisitTime = new Date()
      this.userData = userData
      await this.save()
      return null // success
    }
    return 'incorrect secret'
  }
}

// alas, right now the Promises support in leveldb isn't released

function get(db, key) {
  return new Promise((resolve, reject) => {
    debug('doing get', key)
    db.get(key, (err, data) => {
      if (err) reject(err)
      resolve(data)
    })
  })
}

function put(db, key, value) {
  return new Promise((resolve, reject) => {
    db.put(key, value, (err) => {
      if (err) reject(err)
      resolve()
    })
  })
}

module.exports.Server = Server
module.exports.Client = require('./client').Client


