# static
Database backed static file serve

## static
The default export.

### static.sendFile(path, req, res) => Promise<boolean>
`if (await static.sendFind(path, req, res)) ...`

Sends a file, returning a promise (true/false) saying whether the file was found and sent.

### static.serveFiles(root, opts) => middlewareFunction

Create a middleware function which servers static files
options are:
- `single` - if set, then any unknown paths are served by this file (or `/index.html` if it simply `true`)
- `except` - an optional array of path prefixes. If the path matches any of these, we do not try to serve these, but fall through.

### static.cache

The `filecache` object sitting behind this. Can then be used to `.prefetch` known static files.
