import { useParams, useSearchParams } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import ConversationalChat from '../components/agents/ConversationalChat';
import AutopilotFlow from '../components/agents/AutopilotFlow';
import MLExperimenter from '../components/agents/MLExperimenter';

export default function Session() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const agentType = searchParams.get('agent') || '01';

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
