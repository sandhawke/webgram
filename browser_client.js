'use strict'

const SharedClient = require('./shared_client.js').Client

class Client extends SharedClient {
  constructor (address, options) {
    super(address, options)
    this.address = address
  }

  tryRoot () {
    return new Promise((resolve) => {
      const a = document.location.origin.replace(/^http/, 'ws')
      console.log('# computed my call-home address as', a)
      try {
        const s = new window.WebSocket(a)
        s.addEventListener('open', () => {
          resolve([a, s, 'direct'])
        })
      } catch (e) { }
    })
  }

  tryViaConf () {
    return new Promise((resolve) => {
      window.fetch('/.well-known/webgram.json')
        .then(response => {
          response.json()
            .then(conf => {
              console.log('# fetched json ', JSON.stringify(conf))
              const a = conf.wsAddress
              console.log('# learned my call-home address is', a)
              const s = new window.WebSocket(a)
              s.addEventListener('open', () => {
                console.log('ws open 1!')
              })
              s.addEventListener('open', () => {
                console.log('ws open 2! resolving!')
                resolve([a, s, 'indirect'])
              })
              s.addEventListener('open', () => {
                console.log('ws open 3!')
              })
            })
            .catch(err => {
              console.log('# couldnt parse json response', err)
            })
        })
        .catch(err => {
          console.log('# couldnt fetch webgram.json', err)
        })
    })
  }

  sleep (n) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, n)
    })
  }

  whenOpen (onOpen) {
    if (this.socket) {
      switch (this.socket.readyState) {
        case 0:
          this.socket.addEventListener('open', onOpen)
          break
        case 1:
          onOpen()
          break
        case 2:
        case 3:
          throw Error('passed socket thats already closed')
      }
    } else if (!this.address) {
      Promise.race([this.tryRoot(), this.tryViaConf(), this.sleep(10)])
        .then(arg => {
          console.log('# race resolved %o', arg)
          if (arg) {
            [this.address, this.socket] = arg
            onOpen()
          } else {
            throw Error('cant connect')
          }
        })
    } else {
      this.socket = new window.WebSocket(this.address)
      this.socket.addEventListener('open', onOpen)
    }
  }
}

module.exports.Client = Client

/*

  connect (buffer) {
    this.socket = new window.WebSocket(this.address)

    this.socket.addEventListener('message', messageRaw => {
      this.connected = true
      messageRaw = messageRaw.data // IN BROWSER
      // debug('client sees new message', messageRaw)
      let message
      try {
        message = JSON.parse(messageRaw)
      } catch (e) {
        console.error('badly formatted message ignored', messageRaw)
        return
      }
      // debug('emitting', message[0], ...message.slice(1))
      this.emit(...message)
    })
    this.socket.addEventListener('open', () => {
      console.log('$online')
      this.emit('$online')
      while (true) {
        let item = this.buffer.shift()
        if (!item) break
        this.socket.send(item)
      }
      this.connected = true
    })
    this.socket.addEventListener('close', () => {
      this.connected = false
      console.log('websocket closed; retrying ...')
      window.setTimeout(() => { this.connect(this.buffer) }, 5000)
      // indicate upstream that we're offline?
      this.emit('$offline')
      console.log('$offline')
    })
    this.socket.addEventListener('error', (e) => {
      this.connected = false
      console.log('websocket error; retrying in 1s', e)
      // window.setTimeout(() => { this.connect() }, 1000)
    })
  }

  send (...args) {
    if (this.connected) {
      this.socket.send(JSON.stringify(args))
    } else {
      this.buffer.push(JSON.stringify(args))
    }
  }

  close () {
    this.connected = false
    this.socket.close()
  }
}

*/
