import { AuditProvider, useAudit } from './state/AuditContext';
import { SetupScreen } from './components/SetupScreen';
import { SwipeScreen } from './components/SwipeScreen';
import { ResultsScreen } from './components/ResultsScreen';

function Router() {
  const audit = useAudit();
  if (audit.phase === 'setup') return <SetupScreen />;
  if (audit.phase === 'swiping') return <SwipeScreen />;
  return <ResultsScreen />;
}

export default function App() {
  return (
    <AuditProvider>
      <Router />
    </AuditProvider>
  );
}
