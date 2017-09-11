An opinionated wrapper for websockets.

My opinion:
* The reliable-stream socket metaphor gets in the way, because it's not truly reliable, given the reality of the internet and remote issues. It's simpler the just think in terms of sending and receiving messages on a best-effort basis
* The server recognizes clients that have visited before (if they choose, using a bearer token in localStorage), and persists data about each client for you, using levelDB.  Actually identifying human users is left to you.
* We wrap the httpServer stuff, but hopefully expose the parts you need, for your own express routes, etc.  (Still needs https, with easy/automatic letsEncrypt usage when running as root.)

Typical client can be very simple:

```js
const webgram = require('webgram')

const c = new webgram.Client('ws://localhost:5678')
c.on('test-response', (plus, minus) => {
  console.log('responses was', plus, minus)
  c.close()
})
c.send('test', 123, 456)
```

Note that we don't need to pay attention to whether we're connected or
not.  The message will be sent as soon as it can be.  The response
handler will be run whenever a response like that arrives (which might
be never or repeatedly).

The server is also quite simple:

```js
const webgram = require('webgram')

const s = new webgram.Server({port: 5678})
s.on('test', (client, a, b) => {
  client.send('test-response', a + b, a - b)
})
s.app.get('/hello', (req, res) => {
  res.send('Hello, World')
})
s.app.post('/shutdown', (req, res) => {
  res.send('Done')
  s.stop()
})
s.start()
```

```sh
# stop server, in this silly example, with
curl -X POST http://localhost:5678/shutdown
```

