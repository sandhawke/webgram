'use strict'

const fs = require('fs')

function doToken (client) {
  let token = process.env.TOKEN
  if (!token) {
    try {
      token = fs.readFileSync('./clientToken.txt', 'utf8')
    } catch (e) {
    }
  }
  client.send('clientToken', token || 'requested')

  client.on('setClientToken', token => {
    fs.writeFileSync('./clientToken.txt', token, {
      encoding: 'utf8',
      mode: 0o600})
  })
}

module.exports = doToken
