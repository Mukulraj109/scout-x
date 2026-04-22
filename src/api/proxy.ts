import { default as axios } from "axios";
import { apiUrl } from "../apiConfig";

interface ProxyMutationResponse {
    ok: boolean;
    error?: string;
}

export const sendProxyConfig = async (proxyConfig: { server_url: string, username?: string, password?: string }): Promise<ProxyMutationResponse> => {
    try {
        const response = await axios.post(`${apiUrl}/proxy/config`, proxyConfig, { withCredentials: true });
        if (response.status === 200) {
            return response.data;
        } else {
            throw new Error(`Failed to submit proxy configuration. Status code: ${response.status}`);
        }
    } catch (error: any) {
        console.error('Error sending proxy configuration:', error.message || error);
        return { ok: false, error: error?.response?.data?.error || error?.message || 'Failed to submit proxy configuration' };
    }
}

export const getProxyConfig = async (): Promise<{ proxy_url: string, auth: boolean }> => {
    try {
        const response = await axios.get(`${apiUrl}/proxy/config`, { withCredentials: true });
        if (response.status === 200) {
            return response.data;
        } else {
            throw new Error(`Failed to fetch proxy configuration. Try again.`);
        }
    } catch (error: any) {
        console.log(error);
        return { proxy_url: '', auth: false };
    }
}

export const testProxyConfig = async (): Promise<{ success: boolean }> => {
    try {
        const response = await axios.get(`${apiUrl}/proxy/test`, { withCredentials: true });
        if (response.status === 200) {
            return response.data;
        } else {
            throw new Error(`Failed to test proxy configuration. Try again.`);
        }
    } catch (error: any) {
        console.log(error);
        return { success: false };
    }
}

export const deleteProxyConfig = async (): Promise<ProxyMutationResponse> => {
    try {
        const response = await axios.delete(`${apiUrl}/proxy/config`, { withCredentials: true });
        if (response.status === 200) {
            return response.data;
        } else {
            throw new Error(`Failed to delete proxy configuration. Try again.`);
        }
    } catch (error: any) {
        console.log(error);
        return { ok: false, error: error?.response?.data?.error || error?.message || 'Failed to delete proxy configuration' };
    }
}