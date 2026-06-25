import { useState, useEffect } from 'react';

export function useSession(sessionId) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // TODO: Fetch session data from API
    setLoading(false);
  }, [sessionId]);

  return { session, loading, error };
}
