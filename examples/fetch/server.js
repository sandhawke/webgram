const fetch = require('node-fetch')
const webgram = require('webgram')

const server = new webgram.Server({port: 6004})
server.answer.fetch = async (...args) => {
  const res = await fetch(...args)
  const text = await res.text()
  return text
}
