import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import { config } from '../config'

export interface StorageService {
  upload(key: string, buffer: Buffer, mimeType: string): Promise<string>
  getUrl(key: string): string
  delete(key: string): Promise<void>
  exists(key: string): Promise<boolean>
}

class LocalStorageService implements StorageService {
  private baseDir: string
  private baseUrl: string

  constructor(baseDir: string, baseUrl: string) {
    this.baseDir = baseDir
    this.baseUrl = baseUrl
  }

  async upload(key: string, buffer: Buffer, _mimeType: string): Promise<string> {
    const { promises: fs } = await import('fs')
    const path = await import('path')
    const fullPath = path.join(this.baseDir, key)
    await fs.mkdir(path.dirname(fullPath), { recursive: true })
    await fs.writeFile(fullPath, buffer)
    return this.getUrl(key)
  }

  getUrl(key: string): string {
    return `${this.baseUrl}/uploads/${key}`
  }

  async delete(key: string): Promise<void> {
    const { promises: fs } = await import('fs')
    const path = await import('path')
    const fullPath = path.join(this.baseDir, key)
    await fs.unlink(fullPath).catch(() => {})
  }

  async exists(key: string): Promise<boolean> {
    const { promises: fs } = await import('fs')
    const path = await import('path')
    const fullPath = path.join(this.baseDir, key)
    return fs.access(fullPath).then(() => true).catch(() => false)
  }
}

class S3StorageService implements StorageService {
  private bucket: string
  private region: string
  private client: unknown

  constructor() {
    this.bucket = config.AWS_S3_BUCKET!
    this.region = config.AWS_REGION
  }

  private async getClient() {
    if (!this.client) {
      const AWS = await import('aws-sdk')
      this.client = new AWS.S3({
        accessKeyId: config.AWS_ACCESS_KEY_ID,
        secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
        region: this.region,
      })
    }
    return this.client as import('aws-sdk').S3
  }

  async upload(key: string, buffer: Buffer, mimeType: string): Promise<string> {
    const s3 = await this.getClient()
    await s3.putObject({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      ACL: 'private',
    }).promise()
    return this.getUrl(key)
  }

  getUrl(key: string): string {
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`
  }

  async delete(key: string): Promise<void> {
    const s3 = await this.getClient()
    await s3.deleteObject({ Bucket: this.bucket, Key: key }).promise()
  }

  async exists(key: string): Promise<boolean> {
    const s3 = await this.getClient()
    try {
      await s3.headObject({ Bucket: this.bucket, Key: key }).promise()
      return true
    } catch {
      return false
    }
  }
}

export const storagePlugin = fp(async (app: FastifyInstance) => {
  let storage: StorageService

  if (config.STORAGE_PROVIDER === 's3') {
    storage = new S3StorageService()
  } else {
    const { promises: fs } = await import('fs')
    await fs.mkdir(config.UPLOAD_DIR, { recursive: true })
    storage = new LocalStorageService(config.UPLOAD_DIR, config.API_URL)
  }

  app.decorate('storage', storage)
})

declare module 'fastify' {
  interface FastifyInstance {
    storage: StorageService
  }
}
