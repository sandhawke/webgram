const webgram = require('webgram')

// port defaults to new-random-port if not specified (good for testing)
const server = new webgram.Server({port: 5678})
server.on('$opened', conn => {
  console.log('connection opened from', conn.address)
  conn.on('$closed', () => {
    console.log('connection closed from', conn.address)
  })

  conn.on('add-one', x => {
    console.log('handling request to increment', x)
    conn.send('added-one', x + 1)
  })
})

server.start().then(() => {
  console.log(`In another window, try sending:\n   ["add-one", 50]\nusing:\n   wscat -c ${server.address}`)
})
