An opinionated wrapper for websockets.

My opinion:
* From the perspective of client code or server code, every network is "unreliable".  So might as well code in terms of sending messages and receiving message, which might or might not arrive.  Much simpler state, really.  When things are working well, these are just websocket frames
* Clients can easily authenticate themselves, just using a bearer token, so we handle that.  Actually identifying human users is left to you.
* On the server, we store client-associated data in levelDB for you
* We wrap all the webserver stuff, but hopefully expose the parts you need, for your own express routes, etc.  Haven't thought much about interactions with middleware.

So client is very simple:

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
# stop server with
curl -X POST http://localhost:5678/shutdown
```

