const webgram = require('webgram')
const client = new webgram.Client('ws://localhost:6004')
main()

async function main () {
  let url = 'https://www.w3.org/People/Sandro/ping'
  console.log('asking for', url)
  console.log('response %j', await client.ask('fetch', url))
  client.close()
}
