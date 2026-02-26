import { v7 as uuidv7 } from 'uuid';

export function generateId(): string {
  return uuidv7();
}

let _deviceId: string | null = null;

export function getDeviceId(): string {
  if (_deviceId) return _deviceId;
  const stored = localStorage.getItem('deviceId');
  if (stored) {
    _deviceId = stored;
    return stored;
  }
  const id = generateId();
  localStorage.setItem('deviceId', id);
  _deviceId = id;
  return id;
}
