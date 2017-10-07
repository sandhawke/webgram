'use strict'

/*

  This is basically a re-implementation of tape-run, because I felt like it.

  (Like, I was getting stuck on some bugs about process shutdown, and
  I kinda wanted to see how to make the whole stack work anyway.)

*/

const browserify = require('browserify')
const webgram = require('.')
const launcher = require('james-browser-launcher')
const util = require('util')
// const wtf = require('wtfnode')
const debug = require('debug')('webgram_browsertester')

let count = 0

class Server extends webgram.Server {
  constructor (module, options = {}) {
    // the current sessions server end isn't happy ("LOCK: already held
    // by process") running multiple times in the same process because
    // of leveldb.  Workaround by having a new tmp db per process if
    // necessary, but do you really want sessions for unit tests?
    //
    // NEEDS to be disable in client, too, session setup just hangs!!
    //
    if (options.useSessions === undefined) options.useSessions = false
    if (options.quiet === undefined) options.quiet = true
    super(options)   // does: Object.assign(this, options)

    debug(`creating TestServer to run ${module} in browsers`)
    this.mine = browserify('callhome')
    this.b = browserify(module)

    this.app.get('/', (req, res) => {
      res.send(
        `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Testing</title>
<script type="text/javascript">
window.serverAddress='${this.address}'
console.log('# running webgram TestServer client, server=', window.serverAddress)
</script>
<script type="text/javascript" src="/callhome.js"></script>
<script type="text/javascript" src="/bundle.js"></script>
</head>
<body>
<p>js not working?</p>
</body>`)
    })

    this.app.get('/bundle.js', (req, res) => {
      this.b.bundle().pipe(res)
    })

    this.app.get('/callhome.js', (req, res) => {
      this.mine.bundle().pipe(res)
    })

    this.on('output', (conn, ...parts) => {
      debug('output was: ', parts)
      let line = util.format(...parts)

      // keep our own count, since we're running them once in each browser

      if (line.startsWith('TAP version')) return
      if (line.startsWith('1..')) return
      if (line.startsWith('ok') || line.startsWith('not ok')) {
        count++
        const m = line.match(/^((not )?ok) (\d+) (.*)/)
        if (m) {
          // console.log('# match ', m)
          line = m[1] + ' ' + count + ' ' + m[4]
        } else {
          throw Error('bad TAP format line: ' + JSON.stringify(line))
        }
      }

      console.log(line)
    })

    this.on('end', async () => {
      debug('client said END')
      debug('killing browser, which should also kill server')
      await this.browserInstance.stop()
      debug('browser reported killed')
    })
  }

  runClient (browserName) {
    return new Promise((resolve, reject) => {
      launcher((err, launch) => {
        if (err) { reject(err); return }

        launch(this.siteURL, browserName, (err, instance) => {
          if (err) { reject(err); return }

          this.browserInstance = instance

          console.log('# Instance started with PID:', instance.pid)

          instance.on('stop', code => {
            console.log('# Instance stopped with exit code:', code)
            if (this.stopped) {
              console.log('# and server already stopped')
              resolve()
            } else {
              console.log('# and server still running, so stop it')
              this.stop().then(resolve)
            }
          })
        })
      })
    })
  }
}

async function run (module, options) {
  console.log('TAP version 13')
  launcher.detect(async (avail) => {
    debug('avail %O', avail)
    for (const browser of avail) {
      console.log('# running tests in browser %j', browser)
      // debug('trying in %o', browser)
      const s = new Server(module, options)
      await s.start()
      await s.runClient(browser.name)
      console.log('# done running tests in browser %s', browser.name)
    }
    console.log('# done running browser tests, servers should shut down')
    console.log('1..' + count)

    // is there a way to run this if we don't shut down, but not keep process alive
    // waiting to find out?    For now, if you're having problems, uncomment this.
    //
    // wtf.dump()
  })
}

module.exports.run = run
