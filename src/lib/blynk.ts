export interface BlynkDevice {
  id: string;
  authToken: string;
  templateId: string;
  templateName: string;
  deviceName: string;
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
  return config ? JSON.parse(config) : { devices: [] };
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
