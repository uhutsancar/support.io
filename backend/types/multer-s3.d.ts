// multer-s3 ships no types of its own. This declares the surface this project
// actually uses: the storage factory, its resolver callbacks and the two
// content-type helpers.
declare module 'multer-s3' {
  import type { Request } from 'express';
  import type { StorageEngine } from 'multer';
  import type { S3Client } from '@aws-sdk/client-s3';

  type ResolverCallback<TValue> = (error: Error | null, value?: TValue) => void;

  /** Every per-file option is either a constant or resolved per request. */
  type Resolver<TValue> = (
    req: Request,
    file: Express.Multer.File,
    cb: ResolverCallback<TValue>
  ) => void;

  type ContentTypeResolver = (
    req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, mime?: string, stream?: NodeJS.ReadableStream) => void
  ) => void;

  interface MulterS3Options {
    s3: S3Client;
    bucket: string | Resolver<string>;
    key?: Resolver<string>;
    acl?: string | Resolver<string>;
    contentType?: ContentTypeResolver;
    contentDisposition?: string | Resolver<string>;
    cacheControl?: string | Resolver<string>;
    metadata?: Resolver<Record<string, string>>;
    serverSideEncryption?: string;
  }

  interface MulterS3 {
    (options: MulterS3Options): StorageEngine;
    /** Sniffs the type from the stream instead of trusting the client. */
    AUTO_CONTENT_TYPE: ContentTypeResolver;
    DEFAULT_CONTENT_TYPE: ContentTypeResolver;
  }

  const multerS3: MulterS3;
  export = multerS3;
}

// multer-s3 adds its own fields to the uploaded file, and the routes read them.
// Declared globally (not inside `declare global`, which needs a module) so it
// merges with the Express.Multer.File that @types/multer declares.
declare namespace Express {
  namespace Multer {
    interface File {
      /** The object key the file was stored under. */
      key?: string;
      /** The public URL of the stored object. */
      location?: string;
      bucket?: string;
      etag?: string;
      contentType?: string;
    }
  }
}
