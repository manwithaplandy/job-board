import React from 'react';
import {createRoot} from 'react-dom/client';
import {FunnelSection} from '@/components/analytics/FunnelSection';
createRoot(document.getElementById('root')!).render(<FunnelSection funnel={{companies:{tracked:10,discovery_sourced:8,reviewed:6,include:4,exclude:1,unknown:1,backlog:2},jobs:{ever_seen:100,open:4,reviewed:3,approved:2,applied:10,gate_rejected:0,denied:1,manual_rejected:0,errors:0,unreviewed:1}}}/>);
