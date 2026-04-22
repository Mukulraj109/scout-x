import React from 'react';
import { createRoot } from 'react-dom/client';
import { DataTableApp } from './DataTableApp';

const root = createRoot(document.getElementById('root')!);
root.render(<DataTableApp />);
