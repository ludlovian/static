import { pipeline } from 'node:stream/promises'
import { join, resolve } from 'node:path'
import { lookup } from 'mrmime'
import FileCache from '@ludlovian/filecache'
import config from './config.mjs'

// SQLite based file cache for static files
//

const cache = new FileCache(config.cacheFile)

// Supported encodings
//
// Will use an encoded file if supplied
//
const ENCODINGS = [['.gz', 'gzip']]

//
// sendFile
//
// Sends a static file => Promise<Boolean>
//
// Returns true/false saying if it managed to find the file

async function sendFile (path, req, res) {
  const reqEnc = req.headers['accept-encoding'] ?? ''

  // Find the actual (possibly encoded) version of this file
  // If no version exists, then return
  const stats = await findEncodedFile(path, reqEnc)
  if (!stats) return false

  let ctype = lookup(path) ?? ''
  if (ctype === 'text/html') ctype += ';charset=utf-8'

  // Create the headers
  const headers = {
    'Content-Length': stats.size,
    'Content-Type': ctype,
    'Last-Modified': new Date(stats.mtime).toUTCString(),
    ETag: `W/"${stats.size}-${stats.mtime}"`
  }

  for (const [ext, enc] of ENCODINGS) {
    if (stats.path.endsWith(ext)) {
      headers['Content-Encoding'] = enc
      break
    }
  }

  // Overwrite with any response headers already given
  for (const k of Object.keys(headers)) {
    if (res.getHeader(k)) headers[k] = res.getHeader(k)
  }

  // If the ETag's match, then send a 304
  if (req.headers['if-none-match'] === headers.ETag) {
    res.writeHead(304)
    res.end()
    return true
  }

  // If it's a HEAD, just send the headers
  res.writeHead(200, headers)
  if (req.method === 'HEAD') {
    res.end()
    return true
  }

  // get a stream of the file and send it
  await pipeline(cache.streamFile(stats.path), res)
  return true
}

async function findEncodedFile (path, acceptEncodings) {
  const paths = [path]
  for (const [ext, enc] of ENCODINGS) {
    if (acceptEncodings.includes(enc)) paths.unshift(path + ext)
  }
  for (const path of paths) {
    const stats = await cache.findFile(path)
    if (!stats.missing) return stats
  }
}

// Create a static-serving middleware
//
// root   - the base directory
// options
//    - filter  - a path => boolean which tells us which requests to
//                immediately ignore
//
//    - single  - the file to be served for all unknown paths
//                (or /index.html if set to true)

function serveFiles (root, opts = {}) {
  const filter = opts.filter
  const single =
    opts.single && absPathToRelFile(opts.single === true ? '/' : opts.single)

  root = resolve(root)

  return handler

  async function handler (req, res, next) {
    const path = new URL(`http://localhost${req.url}`).pathname
    if (filter && filter(path)) return next()
    const paths = [absPathToRelFile(path), single].filter(Boolean)

    for (let path of paths) {
      path = join(root, path)
      try {
        if (await sendFile(path, req, res)) return
      } catch (err) {
        console.error(err)
        return next(err)
      }
    }
    next()
  }
}

function absPathToRelFile (path) {
  return (
    path
      // add index to directories
      .replace(/\/$/, '/index.html')
      // strip leading slash
      .replace(/^\//, '')
  )
}

export default {
  sendFile,
  serveFiles,
  cache
}
