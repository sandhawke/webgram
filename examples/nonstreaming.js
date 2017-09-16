const webgram = require('webgram')

const c = new webgram.Client('ws://localhost:5678')

let counter = 0
let max = 100000

c.send('echo-in')
c.on('echo-out', () => {
  counter++
  if (counter < max) {
    c.send('echo-in')
  } else {
    console.log(counter, 'non-streaming pings received')
    c.close()
  }
})
