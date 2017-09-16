const webgram = require('webgram')

const c = new webgram.Client('ws://localhost:5678')

let counter = 0
let max = 100000

for (let i = 1; i <= max; i++) {
  // console.log('sending', i)
  c.send('echo-in', i)
}
c.on('echo-out', i => {
  counter++
  // console.log(i, counter)
  if (counter < max) {
    //
  } else {
    console.log(counter, 'streaming pings received')
    c.close()
  }
})
