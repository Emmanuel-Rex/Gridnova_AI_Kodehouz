import { configureApplication, configuredApiClient } from '@msflib/core';
// Official KodeHauz presentation API. Configure once before using client.
configureApplication({
  baseURL: '/api/v1',
  accessTokenKey: 'access_token',
});
export const { apiClient } = configuredApiClient({ isWorkspaceScoped: false });
