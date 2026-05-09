import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

const Popup = () => {
  const [address, setAddress] = useState('0x5DE6...5238');
  const [balance, setBalance] = useState('0.0000 ETH');

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #7B61FF, #00C9FF)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', marginRight: '12px' }}>
          KN
        </div>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>KryptoNow</h2>
      </div>

      {/* Main Dashboard */}
      <div style={{ background: '#111118', border: '1px solid #1E1E2E', borderRadius: '16px', padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '12px', color: '#6B6B8A', marginBottom: '8px', fontFamily: 'monospace' }}>{address}</div>
        <div style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '8px' }}>.00</div>
        <div style={{ fontSize: '14px', color: '#00E5A0' }}>{balance} <span style={{ background: 'rgba(0,229,160,0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>+0.00%</span></div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
        <button style={{ flex: 1, padding: '12px', background: '#7B61FF', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Send</button>
        <button style={{ flex: 1, padding: '12px', background: '#1E1E2E', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Receive</button>
      </div>

    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<Popup />);
