const webgram = require('webgram')

const c = new webgram.Client('ws://localhost:5678')
c.on('added-one', x => {
  console.log('responses was', x)
  c.close()
})
c.send('add-one', 999)
