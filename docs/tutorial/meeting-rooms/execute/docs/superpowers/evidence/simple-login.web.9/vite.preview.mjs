// Serves web/dist on 5179 and proxies /api to a backend on 3109, so the
// browser check stays off ports 3000 and 5173 (the integration lane's).
export default {
  root: '<repo>/web',
  preview: {
    host: '127.0.0.1',
    port: 5179,
    strictPort: true,
    proxy: { '/api': { target: 'http://127.0.0.1:3109' } },
  },
}
