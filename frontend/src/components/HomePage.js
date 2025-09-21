import React from 'react';
import Dashboard from './Dashboard';

const HomePage = ({ socket }) => {
  return <Dashboard socket={socket} />;
};

export default HomePage;