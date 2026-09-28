import React from 'react'
import ReactDOM from 'react-dom/client'

import App from './App.jsx'

import { AuthProvider } from './context/AuthContext.jsx'

import './index.css'
import {SidebarProvider} from "./context/SidebarContext.jsx";


ReactDOM.createRoot(
  document.getElementById('root')
).render(

  <React.StrictMode>

    <AuthProvider>

    <SidebarProvider>

    <App/>

    </SidebarProvider>

    </AuthProvider>

  </React.StrictMode>

)