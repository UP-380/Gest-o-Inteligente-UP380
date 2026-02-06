
import React from 'react';
import Layout from '../../components/layout/Layout';

const CommunicationLauncher = () => {
    return (
        <Layout>
            <div style={{
                height: 'calc(100vh - 64px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#f8fafc',
                color: '#94a3b8'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <i className="fas fa-comments" style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.2 }}></i>
                    <p>Carregando Central de Comunicação...</p>
                </div>
            </div>
        </Layout>
    );
};

export default CommunicationLauncher;
