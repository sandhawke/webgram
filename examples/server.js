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
