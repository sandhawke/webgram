'use strict'

process.on('unhandledRejection', (reason, p) => {
  console.error(process.argv[1], 'Unhandled Rejection at: Promise', p, 'reason:', reason)
  process.exit()
})

const http = require('http')
const os = require('os')
const path = require('path')
const crypto = require('crypto')
const express = require('express')
//const logger = require('morgan')
const debug = require('debug')('server')
const WebSocket = require('ws')
const level = require('level')
const EventEmitter = require('eventemitter3')

class Server extends EventEmitter {
  constructor (config) {
    super()
    Object.assign(this, config)
    if (!this.app) this.app = express()
    if (!this.db) this.db = level(this.dbPath || 'db.level')
    if (!this.port) this.port = 0
  }

  start () {
    return new Promise((resolve, reject) => {

      // if https...
      this.hServer = http.createServer(this.app)
      this.wServer = new WebSocket.Server({
        server: this.hServer
      })
      this.wServer.on('connection', ws => {
        // connection
        debug('new connection')
        const client = {}
        client.send = (...args) => {
          // todo: buffer if needed, survive disconnect/reconnect
          ws.send(JSON.stringify(args))
        }
        
        ws.on('message', messageRaw => {
          debug('new message', messageRaw)
          let message
          try {
            message = JSON.parse(messageRaw)
          }
          catch (e) {
            console.error('badly formatted message ignored')
            return
          }
          debug('emitting', message[0], ...message.slice(1))
          this.emit(message[0], client, ...message.slice(1))
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
        debug('Running at: ', this.siteURL)
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
    this.address = address
    Object.assign(this, options)
    this.buffer = []
    this.socket = new WebSocket(this.address)
    
    this.socket.on('message', messageRaw => {
      debug('client sees new message', messageRaw)
      let message
      try {
        message = JSON.parse(messageRaw)
      }
      catch (e) {
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
  }

  send (...args) {
    if (this.buffer) {
      this.buffer.push(JSON.stringify(args))
    } else {
      this.socket.send(JSON.stringify(args))
    }
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

