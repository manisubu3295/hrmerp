import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Box } from '@mui/material';
import { Sidebar } from './Sidebar';
import { AppBar } from './AppBar';
import { SIDEBAR_WIDTH } from '@/theme';

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', bgcolor: '#f8fafc' }}>
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <Box
        component="main"
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          ml: { xs: 0, lg: `${SIDEBAR_WIDTH}px` },
          minWidth: 0,
        }}
      >
        <AppBar onMenuClick={() => setMobileOpen(true)} />
        <Box
          sx={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            p: { xs: 2, sm: 2.5, md: 3, lg: 3.5 },
            '&::-webkit-scrollbar': { width: '5px' },
            '&::-webkit-scrollbar-thumb': { background: 'rgba(148,163,184,0.5)', borderRadius: '99px' },
            '&::-webkit-scrollbar-thumb:hover': { background: '#94a3b8' },
            '&::-webkit-scrollbar-track': { background: 'transparent' },
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
