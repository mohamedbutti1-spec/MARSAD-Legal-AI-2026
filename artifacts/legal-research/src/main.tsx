import { createRoot } from 'react-dom/client';
import { setRoleGetter, setUserIdGetter } from '@workspace/api-client-react';
import App from './App';
import './index.css';

// Wire up role + userId getters so every API request carries X-User-Role and X-User-Id headers.
// The role is stored in localStorage and updated by UserContext whenever the user switches roles.
setRoleGetter(() => localStorage.getItem('userRole') || 'owner');
setUserIdGetter(() => localStorage.getItem('userId') || '1');

createRoot(document.getElementById('root')!).render(<App />);
