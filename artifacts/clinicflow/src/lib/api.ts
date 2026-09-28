import { setBaseUrl, setCsrfTokenGetter } from '@workspace/api-client-react';
import { csrfToken } from './csrf';

export * from '@workspace/api-client-react';

// Generated browser URLs already start with /api; do not prepend it again.
setBaseUrl(null);
setCsrfTokenGetter(csrfToken);
