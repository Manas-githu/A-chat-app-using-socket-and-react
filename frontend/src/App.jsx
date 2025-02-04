import { useEffect } from 'react'
import { Routes,Route, Navigate } from 'react-router-dom'
import {Loader} from 'lucide-react';
import { Toaster } from "react-hot-toast";
// import axios from 'axios';

import Navbar from './components/Navbar'
import HomePage from './pages/HomePage';
import SignupPage from './pages/SignupPage';
import LoginPage from './pages/LoginPage';
import SettingPage from './pages/SettingPage';
import ProfilePage from './pages/ProfilePage';
// import { axiosInstance } from './lib/axios';
import { useAuthStore } from './store/useAuthStore';
import { useTheme } from './store/useThemeStore';
import { useVideoStore } from './store/useVideoStore';


function App() {

  const { authUser,checkAuth,isCheckingAuth,onlineUsers, socket } = useAuthStore();
  const { theme } = useTheme();
  const { handleIncomingCall, callStatus } = useVideoStore();

  useEffect(() => {
    checkAuth()
  },[checkAuth,onlineUsers ]);
  
  useEffect(() => {
    if (!socket) return;

    socket.on("incoming-call", (callData) => {
      if (callStatus) return; // If already in a call, ignore
      handleIncomingCall(callData);
    });

    socket.on("call-ended", () => {
      if (callStatus) {
        useVideoStore.getState().endCall();
      }
    });

    return () => {
      socket.off("incoming-call");
      socket.off("call-ended");
    };
  }, [socket, callStatus]);
  
  if(isCheckingAuth && !authUser){
    return (
      <div className='h-screen inset-y-0 flex items-center align-middle justify-center'>
        <Loader className="size-10 animate-spin" />
      </div>

    )
  };


  // console.log({authUser});

  return (
    <div data-theme={theme}>
      <Navbar />
      <Routes>
        <Route path='/' element={authUser?<HomePage />:<Navigate to={"/login"} />} />
        <Route path='/signup' element={!authUser? <SignupPage />: <Navigate to={"/"} />} />
        <Route path='/login' element={!authUser?<LoginPage />:<Navigate to={"/"} />} />
        <Route path='/settings' element={<SettingPage />} />
        <Route path='/profile' element={authUser?<ProfilePage />:<Navigate to={"/login"} />} />
      </Routes>

      <Toaster />
    </div>
  )
}

export default App
