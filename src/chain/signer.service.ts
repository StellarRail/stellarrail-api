import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'crypto';
export interface Signer { signEnvelope(xdr: string): Promise<string>; }
class LocalSigner implements Signer {
  async signEnvelope(xdr: string): Promise<string> { return `SIGNED-LOCAL:${xdr}:${randomUUID().slice(0, 6)}`; }
}
class KmsSigner implements Signer {
  async signEnvelope(_x: string): Promise<string> {
    if (!process.env.AWS_KMS_KEY_ID) throw new ServiceUnavailableException({ code: 'NOT_CONFIGURED', message: 'KMS not configured' });
    return `SIGNED-KMS:${_x}`;
  }
}
class VaultSigner implements Signer {
  async signEnvelope(_x: string): Promise<string> {
    if (!process.env.VAULT_ADDR) throw new ServiceUnavailableException({ code: 'NOT_CONFIGURED', message: 'Vault not configured' });
    return `SIGNED-VAULT:${_x}`;
  }
}
@Injectable()
export class SignerService implements Signer {
  private inner: Signer;
  provider: string;
  constructor() {
    this.provider = process.env.KMS_PROVIDER || 'local';
    if (this.provider === 'aws') this.inner = new KmsSigner();
    else if (this.provider === 'vault') this.inner = new VaultSigner();
    else this.inner = new LocalSigner();
    if (process.env.NODE_ENV === 'production' && this.provider === 'local' && process.env.ALLOW_LOCAL_SIGNER !== 'true') {
      throw new Error('FATAL: local signer forbidden in production');
    }
    if (process.env.NODE_ENV === 'production' && this.provider === 'local') {
      // eslint-disable-next-line no-console
      console.warn('WARN: using local signer in production (dev only)');
    }
  }
  signEnvelope(xdr: string): Promise<string> { return this.inner.signEnvelope(xdr); }
}
