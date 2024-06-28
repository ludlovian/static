import { pipeline } from 'node:stream/promises'
import { join, resolve } from 'node:path'
import { lookup } from 'mrmime'
import FileCache from '@ludlovian/filecache'
import config from './config.mjs'

const cache = new FileCache(config.cacheFile)
const ENCODINGS = [['.gz', 'gzip']]

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

  res.writeHead(200, headers)
  if (req.method === 'HEAD') {
    res.end()
    return true
  }

  await pipeline(cache.readFileStream(stats.path), res)
  return true
}

async function findEncodedFile (path, acceptEncodings) {
  const paths = [path]
  for (const [ext, enc] of ENCODINGS) {
    if (acceptEncodings.includes(enc)) paths.unshift(path + ext)
  }
  for (const path of paths) {
    const stats = await cache.findFile(path)
    if (stats) return stats
  }
}

function serveFiles (root, opts = {}) {
  let { single, except = [] } = opts
  if (single) {
    single = addIndexToPath(single === true ? '/' : single)
  }
  except = except.map(stripLeadingSlash)
  const isException = path => except.some(e => path.startsWith(e))

  root = resolve(root)

  return handler

  async function handler (req, res, next) {
    let path = new URL(`http://localhost${req.url}`).pathname
    path = stripLeadingSlash(addIndexToPath(path))
    const paths = [path]
    if (single && !isException(path)) paths.push(single)

    for (path of paths) {
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

function addIndexToPath (path) {
  return path.endsWith('/') ? path + 'index.html' : path
}

function stripLeadingSlash (path) {
  return path.startsWith('/') ? path.slice(1) : path
}

export default {
  sendFile,
  serveFiles,
  cache
}
