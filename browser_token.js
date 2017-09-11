'use strict'

function doToken (client) {
  let token
  if (!token) {
    token = window.localStorage.getItem('clientToken')
  }
  client.send('clientToken', token || 'requested')

  client.on('setClientToken', token => {
    window.localStorage.setItem('clientToken', token)
  })
}

module.exports = doToken
