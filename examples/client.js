const webgram = require('webgram')

const c = new webgram.Client('ws://localhost:5678')
c.on('test-response', (plus, minus) => {
  console.log('responses was', plus, minus)
  c.close()
})
c.send('test', 123, 456)
