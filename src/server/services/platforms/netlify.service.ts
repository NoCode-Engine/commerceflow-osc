import crypto from 'crypto';
import axios, { AxiosInstance } from 'axios';
import PlatformService from './base';
import envs from '../../../../config/envs';
import { NetlifyAccount, NetlifyEnvVar, NetlifySite, NetlifyUser } from '../../../types/platforms/netlify';
import { SystemSecrets } from '../../../types/platforms/secrets';
import { SYSTEM_SECRETS } from '../../../types/constants';

class NetlifyService implements PlatformService {
  private client: AxiosInstance;
  private baseURL = 'https://api.netlify.com/api/v1/';

  private urls = {
    listSites: '/sites',
    accounts: '/accounts/',
    user: '/user',
  };

  constructor() {
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        Authorization: `Bearer ${envs.netlifyToken}`,
      },
    });
  }

  async createSystemSecrets(secrets: SystemSecrets): Promise<PromiseSettledResult<void>[]> {
    const {
      airtableToken,
      githubToken,
      platformToken,
      platformSiteMeta: { accountId, siteId },
      webflowTokens,
    } = secrets;
    const { GITHUB_TOKEN, AIRTABLE_TOKEN, PLATFORM_META, PLATFORM_TOKEN, NEXTAUTH_SECRET, WEBFLOW_TOKENS } = SYSTEM_SECRETS;

    try {
      const accountInfo = { accountId, siteId };
      const jwtSecret = crypto.randomBytes(32).toString('hex');
      return Promise.allSettled([
        this.storeSecret(GITHUB_TOKEN, githubToken, accountInfo),
        this.storeSecret(AIRTABLE_TOKEN, airtableToken, accountInfo),
        this.storeSecret(PLATFORM_TOKEN, platformToken, accountInfo),
        this.storeSecret(PLATFORM_META, JSON.stringify(accountInfo), accountInfo),
        this.storeSecret(NEXTAUTH_SECRET, jwtSecret, accountInfo),
        this.storeSecret(WEBFLOW_TOKENS, webflowTokens, accountInfo),
      ]);
    } catch (e: any) {
      // console.log(e.data, e.response.data);
      throw e;
    }
  }

  verifySystemSecretsExist(): Promise<{}> {
    throw new Error('Method not implemented.');
  }

  async verifyApiKey(): Promise<boolean> {
    const response = await this.client.get<NetlifyUser>(this.urls.user);
    return response.data?.id != null;
  }

  async listSites(): Promise<NetlifySite[]> {
    const response = await this.client.get<NetlifySite[]>(this.urls.listSites);
    return response.data;
  }

  async listAccounts(): Promise<NetlifyAccount[]> {
    const response = await this.client.get<NetlifyAccount[]>(this.urls.accounts);
    return response.data;
  }

  async storeSecret(key: string, value: string, { accountId, siteId }: { accountId: string; siteId: string }): Promise<void> {
    await this.client.post(`${this.urls.accounts}${accountId}/env?site_id=${siteId}`, [
      {
        key,
        values: [
          {
            value,
          },
        ],
      },
    ]);
  }

  async getSecret(key: string, { accountId, siteId }: { accountId: string; siteId: string }): Promise<string> {
    const response = await this.client.get<NetlifyEnvVar>(`${this.urls.accounts}${accountId}/env/${key}?site_id=${siteId}`);

    if (response.data.values.length < 1) throw new Error('Invalid key provided, no value was found for this key');

    return response.data.values[0].value;
  }
}

export default NetlifyService;
