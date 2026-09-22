import { setBaseUrl, setAuthTokenGetter } from '@workspace/api-client-react';

export * from '@workspace/api-client-react';

// Initialize the API client base URL
// The API is served through the proxy at /api in development and production
setBaseUrl('/api');

// Auth token will be set via Clerk's getToken in a hook or component
