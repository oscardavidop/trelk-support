/**
 * Socket Hook
 * Provides access to Socket.IO client
 */

import { useMemo } from 'react';
import { getSocket } from '../services/socket';

export function useSocket() {
  const socket = useMemo(() => getSocket(), []);
  
  return { socket };
}
