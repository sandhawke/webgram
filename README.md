An opinionated wrapper for websockets.

My opinion on websockets:
* The reliable-stream socket metaphor gets in the way, because it's not truly reliable, given the reality of the internet and remote issues. It's simpler to just think in terms of sending and receiving messages on a best-effort basis
* We wrap the httpServer stuff, but hopefully expose the parts you need, for your own express routes, etc.  (TODO: https, with easy/automatic letsEncrypt usage when running as root.)

Session state is managed by a separate package [webgram-sessions](../webgram-sessions).

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

Running in the browser, we can omit the address, and it'll figure it out
from the page URL.

Note that we don't need to pay attention to whether we're connected or
not.  The message will be sent as soon as it can be.  The response
handler will be run whenever a response like that arrives (which might
be never or repeatedly).

The server is also quite simple:

```js
const webgram = require('webgram')

// port defaults to new-random-port if not specified, good for testing
const s = new webgram.Server({port: 5678})

// If you want to pay attention to connections (but you probably
// want to use sessions instead)
server.on('$opened', conn => {
   conn.on('$closed', () => {
    ...
   })
   conn.on('whatever-message-you-want', ...)
})

// or without tracking clients:
s.on('test', (client, a, b) => {
  client.send('test-response', a + b, a - b)
})

// it's also a normal express web server

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

## Future work

* document ask()
* integrate documentation with sessions
* bring in user authentication, maybe
* improve retry
* let binary frames be authstreams style (encrypted cbor); support binary data
* TLS of course
* explain why this is better than shoe+dgram

## Credits and Disclaimer

This material is based upon work supported by the National Science Foundation under Grant No. 1313789.  Any opinions, findings, and conclusions or recommendations expressed in this material are those of the author(s) and do not necessarily reflect the views of the National Science Foundation.