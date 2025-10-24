export interface BlynkDevice {
  id: string;
  authToken: string;
  templateId: string;
  templateName: string;
  deviceName: string;
  virtualPin: string;
}

export interface BlynkConfig {
  devices: BlynkDevice[];
}

export interface BlynkMessage {
  id: string;
  message: string;
  recipient: string;
  sender: string;
  timestamp: Date;
}

export const saveBlynkConfig = (config: BlynkConfig) => {
  localStorage.setItem('blynk_config', JSON.stringify(config));
};

export const getBlynkConfig = (): BlynkConfig => {
  const config = localStorage.getItem('blynk_config');
  if (!config) return { devices: [] };
  
  const parsedConfig = JSON.parse(config);
  // Add default virtualPin to devices that don't have it (backward compatibility)
  parsedConfig.devices = parsedConfig.devices.map((device: BlynkDevice, index: number) => ({
    ...device,
    virtualPin: device.virtualPin || `V${index}`,
  }));
  
  return parsedConfig;
};

export const saveMessage = (message: BlynkMessage) => {
  const messages = getMessages();
  messages.unshift(message);
  localStorage.setItem('blynk_messages', JSON.stringify(messages.slice(0, 50))); // Keep last 50
};

export const getMessages = (): BlynkMessage[] => {
  const messages = localStorage.getItem('blynk_messages');
  return messages ? JSON.parse(messages) : [];
};
