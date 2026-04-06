// Polyfill Web API globals required by Next.js route handlers in a Node test environment
const {
  Request,
  Response,
  Headers,
  fetch,
  ReadableStream,
  WritableStream,
  TransformStream,
  TextEncoder,
  TextDecoder,
  URL,
  URLSearchParams,
  FormData,
  Blob,
  File,
} = require('next/dist/compiled/@edge-runtime/primitives')

Object.assign(global, {
  Request,
  Response,
  Headers,
  fetch,
  ReadableStream,
  WritableStream,
  TransformStream,
  TextEncoder,
  TextDecoder,
  URL,
  URLSearchParams,
  FormData,
  Blob,
  File,
})
