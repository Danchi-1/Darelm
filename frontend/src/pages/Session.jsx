import { useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import ConversationalChat from '../components/agents/ConversationalChat';
import AutopilotFlow from '../components/agents/AutopilotFlow';
import MLExperimenter from '../components/agents/MLExperimenter';

export default function Session() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const agentType = searchParams.get('agent') || '01';

  useEffect(() => {
    if (agentType === '04') {
      navigate('/cleaner', { replace: true });
    }
  }, [agentType, navigate]);

  const renderAgent = () => {
    switch (agentType) {
      case '01':
        return <ConversationalChat />;
      case '02':
        return <AutopilotFlow />;
      case '03':
        return <MLExperimenter />;
      default:
        return <ConversationalChat />;
    }
  };

  return (
    <AppLayout>
      {renderAgent()}
    </AppLayout>
  );
}
