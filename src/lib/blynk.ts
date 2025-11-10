export interface BlynkDevice {
  id: string;
  authToken: string;
  templateId: string;
  templateName: string;
  deviceName: string;
  virtualPin: string; // Kept for backward compatibility
  // Virtual pin mapping:
  // V0 - Message text (string)
  // V1 - Sender name (string)
  // V2 - Urgency flag (0=normal, 1=urgent)
  // V3 - Acknowledgment flag (0=not ack, 1=ack)
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
  // Ensure devices array exists
  if (!parsedConfig.devices || !Array.isArray(parsedConfig.devices)) {
    return { devices: [] };
  }
  
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
