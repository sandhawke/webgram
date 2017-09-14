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
const doToken = require('./nodejs_token')
const WebSocket = require('ws')

class Server extends EventEmitter {
  constructor (config) {
    super()
    Object.assign(this, config)
    if (!this.app) this.app = express()
    if (!this.db) this.db = level(this.dbPath || 'db.level')
    if (!this.port) this.port = 0
    if (!this.logger) this.logger = morgan
    if (!this.root) this.root = './static'

    if (!this.quiet) {
      this.app.use(this.logger('short'))
    }

    this.app.use(express.static(this.root))
    // {extensions: ['html', 'css']}))

    this.on('clientToken', (remote, token) => {
      if (token === 'requested') {
        // send a token
        token = crypto.randomBytes(64).toString('base64')
        console.log('new user, assigning userToken', token)
        remote.send('setClientToken', token)
        remote.save('firstVisitTime', new Date())
      } else {
        console.log('client offers return token', token)
        remote.token = token  // allows client.load/save to work
      }
      this.emit('$ready', remote)
      remote.save('lastVisitTime', new Date())
      // maybe dig out and save the IP, too?
    })
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
        const remote = new Connection(ws, this.db)

        ws.on('message', messageRaw => {
          debug('new message', messageRaw)
          let message
          try {
            message = JSON.parse(messageRaw)
          } catch (e) {
            console.error('badly formatted message ignored')
            return
          }
          debug('emitting', message[0], ...message.slice(1))
          this.emit(message[0], remote, ...message.slice(1))
        })
        ws.on('close', () => {
          this.emit('$close', remote)
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

module.exports.Server = Server
module.exports.Client = Client

/*
function start (config = {}) {
  return new Promise((resolve, reject) => {

    let userCounter = 0
    const me = {}
    const app = config.app || express()
    me.app = app
    const db = level(config.dbFile || 'db.level')

    levelDump(db)

    let siteURL
    let port = config.port || 0
    const server = http.createServer(app)

    const wss = new WebSocket.Server({server})

    wss.on('connection', ws => {
      let userToken
      let userData

      function save () {
        db.put(['user', userToken], JSON.stringify(userData), (err) => {
          if (err) throw err
          debug('wrote userData', userData)
        })
      }

      ws.on('message', (message) => {
        console.log('MESSAGE', JSON.stringify(message))
        const [op, ...args] = JSON.parse(message)

        console.log(`WS message ${op} args ${args}`)

        if (op === 'userToken') {
          userToken = args[0]
          if (userToken) {
            debug('user is', userToken)
            db.get(['user', userToken], (err, data) => {
              if (err && err.notFound) {
                debug('Missing User Data')
                userData = {}
                userData.created = new Date()
                save()
                return
              }
              if (err) throw err
              userData = JSON.parse(data)
              debug('userData is %O', userData)
            })
          } else {
            userToken = crypto.randomBytes(64).toString('base64')
            console.log('new user, assigning userToken', userToken)
            ws.send(JSON.stringify(['setUserToken', userToken]))
            userData = { created: new Date() }
            save()
          }
        }

        if (op === 'search') {
          const search = args.shift()
          console.log('search for', search)
          ws.send(JSON.stringify(['search-results', search, 'nothing found']))
        }
      });
    });

    server.listen(port, () => {
      const a = server.address()
      port = a.port
      if (port === 4040) {  // assuming this is what's in nginx
        siteURL = 'https://' + (config.hostname || os.hostname())
      } else {
        siteURL = 'http://' + (config.hostname || os.hostname()) + ':' + port
      }
      me.siteURL = siteURL
      debug('Running at: ', siteURL)
      resolve(me)
    })

    me.stop = () => {
      debug('stopping', siteURL)
      server.close()
    }

    app.use(logger('short'))
    app.use(express.static(path.join(__dirname, 'static'),
                              {extensions: ['html', 'css']}))

    app.get('/hello', (req, res) => {
      res.send('Hello, session=' + JSON.stringify(req.session))
    })

  })
}

module.exports.start = start

function levelDump(db) {
  db.createReadStream()
  .on('data', function (data) {
    console.log(data.key, '=', data.value)
  })
  .on('error', function (err) {
    console.log('Oh my!', err)
  })
  .on('close', function () {
    console.log('Stream closed')
  })
  .on('end', function () {
    console.log('Stream ended')
  })
}

*/

class Connection {
  constructor (socket, db) {
    this.socket = socket
    this.db = db
  }
  send (...args) {
    debug('trying to sent', ...args)
    this.socket.send(JSON.stringify(args))
    debug('sent')
  }

  save (key, value) {
    if (!this.token) {
      throw Error('Connection.save() called before token known')
    }
    return this.db.put([this.token, key], JSON.stringify(value))
  }

  load (key, setDefault) {
    return new Promise((resolve, reject) => {
      if (!this.token) {
        throw Error('Connection.load() called before token known')
      }
      this.db.get([this.token, key], (err, data) => {
        if (err) {
          if (err.notFound) {
            if (setDefault) {
              if (typeof setDefault === 'function') {
                setDefault = setDefault(key)
              }
              this.save(key, setDefault)
            }
            resolve(setDefault)
          } else {
            reject(err)
          }
        } else {
          resolve(JSON.parse(data))
        }
      })
    })
  }
}
