'use strict'

const test = require('tape')
const webgram = require('.')
const fetch = require('node-fetch')

async function pair () {
  const server = new webgram.Server()
  await server.start()
  const client = new webgram.Client(server.address)
  return [server, client]
}

test('sync ask', async (t) => {
  t.plan(1)
  const [server, client] = await pair()

  server.answer.incr = (conn, x) => x + 1
  t.equal(await client.ask('incr', 51), 52)

  client.close()
  await server.stop()
  t.end()
})

test('async ask', async (t) => {
  t.plan(1)
  const [server, client] = await pair()

  server.answer.fetch = async (conn, ...args) => {
    const res = await fetch(...args)
    const text = await res.text()
    return text
  }

  let url = 'https://www.w3.org/People/Sandro/ping'
  const text = await client.ask('fetch', url)
  t.equal(text, 'pong\n')

  client.close()
  await server.stop()
  t.end()
})
