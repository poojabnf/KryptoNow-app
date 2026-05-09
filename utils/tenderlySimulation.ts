import { Platform } from 'react-native';

const TENDERLY_USER = process.env.EXPO_PUBLIC_TENDERLY_USER || '';
const TENDERLY_PROJECT = process.env.EXPO_PUBLIC_TENDERLY_PROJECT || '';
const TENDERLY_ACCESS_KEY = process.env.EXPO_PUBLIC_TENDERLY_ACCESS_KEY || '';

export interface SimulationParams {
  network_id: string; // e.g. "1" for mainnet, "137" for polygon
  from: string;
  to: string;
  input: string;
  value: string;
  save?: boolean;
}

export interface SimulationResult {
  success: boolean;
  status: boolean;
  gas_used: number;
  asset_changes: any[];
  error_message?: string;
}

export async function simulateTransaction(params: SimulationParams): Promise<SimulationResult> {
  try {
    if (!TENDERLY_ACCESS_KEY || !TENDERLY_USER || !TENDERLY_PROJECT) {
      console.warn('[Tenderly] API credentials missing, skipping simulation.');
      return { success: false, status: false, gas_used: 0, asset_changes: [], error_message: 'API Credentials missing' };
    }

    const url = "https://api.tenderly.co/api/v1/account/${TENDERLY_USER}/project/${TENDERLY_PROJECT}/simulate";
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Access-Key': TENDERLY_ACCESS_KEY,
      },
      body: JSON.stringify({
        network_id: params.network_id,
        from: params.from,
        to: params.to,
        input: params.input || '0x',
        value: params.value || '0',
        save: params.save || false,
        save_if_fails: true,
        generate_access_list: false,
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || 'Simulation API request failed');
    }

    return {
      success: true,
      status: data.simulation.status,
      gas_used: data.simulation.gas_used,
      asset_changes: data.transaction?.asset_changes || [],
      error_message: data.simulation.error_message,
    };
  } catch (error: any) {
    console.error('[Tenderly] Simulation Error:', error);
    return {
      success: false,
      status: false,
      gas_used: 0,
      asset_changes: [],
      error_message: error?.message || 'Unknown simulation error',
    };
  }
}