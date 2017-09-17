const webgram = require('webgram')
const client = new webgram.Client('ws://localhost:6004')
main()

async function main () {
  const x = 22
  console.log('asking', x)
  console.log('response', await client.ask('incr', x))
  client.close()
}
