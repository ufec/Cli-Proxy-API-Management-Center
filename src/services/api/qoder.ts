import { apiClient } from './client';

export const qoderApi = {
  usage: (authIndex: string): Promise<unknown> =>
    apiClient.get('/qoder/usage', { params: { auth_index: authIndex } }),
};
