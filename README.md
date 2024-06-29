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
- `filter` - an optional `path => bool` function to filter out paths we do not wish to serve

### static.cache

The `filecache` object sitting behind this. You can `.reset`, `.findFile` or even `.readFile` to prefetch`
