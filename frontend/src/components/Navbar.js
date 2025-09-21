import React from 'react';
import Header from './Header';

const Navbar = ({ user, onLogout }) => {
  return <Header user={user} onLogout={onLogout} />;
};

export default Navbar;