import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class PrivateStorageService {
  private readonly bucket = process.env.S3_BUCKET ?? '';
  private readonly region = process.env.S3_REGION ?? 'us-east-1';
  private readonly endpoint = process.env.S3_ENDPOINT?.trim() || undefined;
  private readonly accessKeyId = process.env.S3_ACCESS_KEY_ID ?? '';
  private readonly secretAccessKey = process.env.S3_SECRET_ACCESS_KEY ?? '';
  private readonly forcePathStyle =
    process.env.S3_FORCE_PATH_STYLE !== 'false' && Boolean(this.endpoint);
  private client: S3Client | null = null;

  get configured() {
    return Boolean(this.bucket && this.accessKeyId && this.secretAccessKey);
  }

  async putObject(input: {
    key: string;
    body: Buffer;
    contentType: string;
    sha256: string;
    uploadedBy: string;
  }) {
    const client = this.getClient();
    await client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
      Metadata: {
        sha256: input.sha256,
        uploadedBy: input.uploadedBy,
      },
    }));
  }

  async deleteObject(key: string) {
    const client = this.getClient();
    await client.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    }));
  }

  async signedDownloadUrl(key: string, expiresInSeconds = 300) {
    const client = this.getClient();
    return getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expiresInSeconds },
    );
  }

  private getClient() {
    if (!this.configured) {
      throw new ServiceUnavailableException({ code: 'STORAGE_NOT_CONFIGURED' });
    }
    this.client ??= new S3Client({
      region: this.region,
      endpoint: this.endpoint,
      forcePathStyle: this.forcePathStyle,
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      },
    });
    return this.client;
  }
}
