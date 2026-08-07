declare module 'ioredis-mock' {
  import type Redis from 'ioredis'
  export default class RedisMock extends Redis {}
}
