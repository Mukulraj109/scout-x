import React, { createContext, useContext, useState, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';


const lightTheme = createTheme({
  palette: {
    primary: {
      main: "#023345",
      contrastText: "#ffffff",
    },
  },
  components: {
    MuiTableContainer: {
      styleOverrides: {
        root: {
          overflow: 'auto',
          /* Firefox */
          scrollbarWidth: 'thin',
          scrollbarColor: 'gray transparent',

          /* WebKit (Chrome, Edge, Safari) */
          '&::-webkit-scrollbar': {
            width: '5px',
            height: '5px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'gray',
            borderRadius: '8px',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          // Default styles for all buttons (optional)
          textTransform: "none",
        },
        containedPrimary: {
          "&:hover": {
            backgroundColor: "#0c4a6e",
          },
        },
        outlined: {
          // Apply white background for all 'outlined' variant buttons
          backgroundColor: "#ffffff",
          "&:hover": {
            backgroundColor: "#f0f0f0", // Optional lighter background on hover
          },
        },
      },
    },
    MuiLink: {
      styleOverrides: {
        root: {
          "&:hover": {
            color: "#0e7490",
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          // '&:hover': {
          //   color: "#ff66d9",
          // },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
         minHeight: 60, 
         textTransform: "none",
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        outlinedInfo: {
          color: 'rgb(0, 0, 0)',
          border: 'none',
          "& .MuiAlert-icon": {
            color: "#000000",
          },
        },
        standardInfo: {
          backgroundColor: "#e0f2fe",
          color: "#0369a1",
          "& .MuiAlert-icon": {
            color: "#0369a1",
          },
        },
      },
    },
  },
});

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: "#0e7490",
      contrastText: "#ffffff",
    },
    error: {
      main: '#f44336',
      light: '#e57373',
      dark: '#d32f2f',
      contrastText: '#ffffff',
    },
    background: {
      default: '#000000ff',
      paper: '#000000ff',
    },
    text: {
      primary: '#ffffff',
      secondary: '#b3b3b3',
    },
  },
  components: {
    MuiTableContainer: {
      styleOverrides: {
        root: {
          overflow: 'auto',
          /* Firefox */
          scrollbarWidth: 'thin',
          scrollbarColor: 'currentColor transparent',

          /* WebKit (Chrome, Edge, Safari) */
          '&::-webkit-scrollbar': {
            width: '5px',
            height: '5px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'currentColor',
            borderRadius: '8px',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          color: '#ffffff',
          '&.MuiButton-outlined': {
            borderColor: '#ffffff',
            color: '#ffffff',
            "&:hover": {
              borderColor: '#ffffff',
              backgroundColor: 'inherit',
            },
          },
        },
        containedPrimary: {
          "&:hover": {
            backgroundColor: "#155e75",
          },
        },
        outlined: {
          borderColor: '#0e7490',
          color: '#0e7490',
          "&:hover": {
            borderColor: '#22d3ee',
          },
          '&.MuiButton-outlinedError': {
            borderColor: '#f44336',
            color: '#f44336',
            "&:hover": {
              // backgroundColor: 'rgba(244, 67, 54, 0.08)',
              borderColor: '#d32f2f',
            },
          },
        },
      },
    },
    MuiLink: {
      styleOverrides: {
        root: {
          color: '#22d3ee',
          "&:hover": {
            color: "#67e8f9",
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: '#ffffff',
          // "&:hover": {
          //   backgroundColor: 'rgba(255, 0, 195, 0.08)',
          // },
          '&.MuiIconButton-colorError': {
            color: '#f44336',
            // "&:hover": {
            //   backgroundColor: 'rgba(244, 67, 54, 0.08)',
            // },
          },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 60, 
          textTransform: "none",
          color: '#ffffff',
          "&.Mui-selected": {
            color: '#22d3ee',
          },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        outlinedInfo: {
          color: '#ffffff',
          border: 'none',
          "& .MuiAlert-icon": {
            color: "#ffffff",
          },
        },
        standardInfo: {
          backgroundColor: "#082f49",
          color: "#e0f2fe",
          "& .MuiAlert-icon": {
            color: "#22d3ee",
          },
        },
      },
    },
    // Additional dark mode specific components
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: '#000000ff',
          border: '1px solid #080808ff',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#080808ff',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#080808ff',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid #080808ff',
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: '#494949ff',
        },
      },
    },
    //   MuiTextField:{
    //     styleOverrides: {
    //       root: {
    //         '& .MuiInputBase-root': {
    //           backgroundColor: '#1d1c1cff',
    //         },
    //   }
    // }}
  },
});

const ThemeModeContext = createContext({
  toggleTheme: () => { },
  darkMode: false,
});

export const useThemeMode = () => useContext(ThemeModeContext);

const ThemeModeProvider = ({ children }: { children: React.ReactNode }) => {
  // Load saved mode from localStorage or default to light mode
  const [darkMode, setDarkMode] = useState(() => {
    const savedMode = localStorage.getItem('darkMode');
    return savedMode ? JSON.parse(savedMode) : false;
  });

  const toggleTheme = () => {
    setDarkMode((prevMode: any) => {
      const newMode = !prevMode;
      localStorage.setItem('darkMode', JSON.stringify(newMode)); // Save new mode to localStorage
      return newMode;
    });
  };

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode)); // Save initial mode
  }, [darkMode]);

  return (
    <ThemeModeContext.Provider value={{ toggleTheme, darkMode }}>
      <ThemeProvider theme={darkMode ? darkTheme : lightTheme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
};

export default ThemeModeProvider;