import { useState, useEffect } from 'react';

export function useAgent(agentType) {
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // TODO: Fetch agent configuration from API
    setLoading(false);
  }, [agentType]);

  return { agent, loading, error };
}
