import React, { useState } from 'react';
import './Comunicacao.css';
import ChatView from './ChatView';
import ComunicadosView from './ComunicadosView';
import ChamadosView from './ChamadosView';

const Comunicacao = () => {
    const [activeTab, setActiveTab] = useState('chats');

    const renderContent = () => {
        switch (activeTab) {
            case 'chats':
                return <ChatView />;
            case 'comunicados':
                return <ComunicadosView />;
            case 'chamados':
                return <ChamadosView />;
            default:
                return null;
        }
    };

    return (
        <div className="comunicacao-container">
            <div className="comunicacao-header">
                <h1>Central de Comunicação</h1>
                <div className="comunicacao-tabs">
                    <button
                        className={`tab-btn ${activeTab === 'chats' ? 'active' : ''}`}
                        onClick={() => setActiveTab('chats')}
                    >
                        <i className="fas fa-comments"></i> Chats
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'comunicados' ? 'active' : ''}`}
                        onClick={() => setActiveTab('comunicados')}
                    >
                        <i className="fas fa-bullhorn"></i> Comunicados
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'chamados' ? 'active' : ''}`}
                        onClick={() => setActiveTab('chamados')}
                    >
                        <i className="fas fa-headset"></i> Chamados
                    </button>
                </div>
            </div>
            <div className="comunicacao-body">
                {renderContent()}
            </div>
        </div>
    );
};

export default Comunicacao;
