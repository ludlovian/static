import { createServer } from 'node:http'

import staticFiles from '../src/index.mjs'

const middleware = staticFiles.serveFiles('.')

const server = createServer()
server.on('listening', async () => {
  console.log(`Listening on ${server.address().port}`)
  staticFiles.cache.reset()
  console.log('prefetching...')
  await staticFiles.cache.prefetch('src')
  console.log('prefetching...done')
})

server.on('request', (req, res) => {
  middleware(req, res, err => {
    if (err) {
      res.writeHead(500)
      return res.end(err.message)
    }
    res.writeHead(404)
    return res.end('Not found')
  })
})

server.listen(3456, '0.0.0.0')
