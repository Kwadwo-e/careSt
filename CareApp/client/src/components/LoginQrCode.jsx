import { useEffect, useMemo, useState } from 'react';
import QrCode from './QrCode.jsx';
import { API_BASE } from '../services/api.js';

const localHostnames = new Set(['localhost', '127.0.0.1', '::1']);

const browserUrl = () => `${window.location.origin}/`;

export default function LoginQrCode() {
  const [loginUrl, setLoginUrl] = useState(browserUrl);

  useEffect(() => {
    let cancelled = false;

    const loadNetworkUrl = async () => {
      if (!localHostnames.has(window.location.hostname)) {
        setLoginUrl(browserUrl());
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/network-info`);
        if (!response.ok) throw new Error('Network URL unavailable.');
        const payload = await response.json();
        if (!cancelled && payload.url) setLoginUrl(payload.url);
      } catch {
        if (!cancelled) setLoginUrl(browserUrl());
      }
    };

    loadNetworkUrl();
    return () => {
      cancelled = true;
    };
  }, []);

  const displayUrl = useMemo(() => loginUrl.replace(/\/$/, ''), [loginUrl]);

  return (
    <section className="login-qr" aria-label="Scan app address">
      <QrCode value={loginUrl} label={`QR code for ${displayUrl}`} />
      <div>
        <strong>Scan to open</strong>
        <span>{displayUrl}</span>
      </div>
    </section>
  );
}
