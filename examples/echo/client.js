const webgram = require('webgram')

const c = new webgram.Client('ws://localhost:5678')
c.on('echo-out', (...args) => {
  console.log('responses was:', ...args, '(', args.length, 'arguments )')
  c.close()
})
c.send('echo-in', 1, 2, 3)
