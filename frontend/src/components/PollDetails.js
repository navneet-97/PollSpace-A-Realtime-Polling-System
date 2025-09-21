import React from 'react';
import PollView from './PollView';

const PollDetails = ({ socket }) => {
  return <PollView socket={socket} />;
};

export default PollDetails;