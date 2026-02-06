import React from 'react';
import { VERSAO_SISTEMA } from '../../config/versao';
import './MarcaDagua.css';

const MarcaDagua = ({ version = VERSAO_SISTEMA }) => {
  return (
    <div className="marca-dagua">
      <span className="marca-dagua-texto">v{version}</span>
    </div>
  );
};

export default MarcaDagua;

