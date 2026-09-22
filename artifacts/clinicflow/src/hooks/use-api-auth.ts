import { useAuth } from '@clerk/react';
import { useEffect } from 'react';
import { setAuthTokenGetter } from '@/lib/api';

export function useApiAuth() {
  const { getToken } = useAuth();
  
  useEffect(() => {
    // Configure the API client to use Clerk's token
    setAuthTokenGetter(async () => {
      try {
        return await getToken();
      } catch (err) {
        return null;
      }
    });
  }, [getToken]);
}
