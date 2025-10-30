import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navigation from '@/components/Navigation';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { saveBlynkConfig, getBlynkConfig, type BlynkDevice } from '@/lib/blynk';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Trash2 } from 'lucide-react';

const BlynkSetup = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [devices, setDevices] = useState<BlynkDevice[]>([]);
  const [testingDeviceId, setTestingDeviceId] = useState<string | null>(null);
  const [connectedDevices, setConnectedDevices] = useState<Set<string>>(new Set());

  useEffect(() => {
    const savedConfig = getBlynkConfig();
    if (savedConfig.devices.length > 0) {
      setDevices(savedConfig.devices);
    } else {
      addNewDevice();
    }
  }, []);

  const addNewDevice = () => {
    const classNames = ['5th A', '5th B', '5th C', '5th D', '5th E'];
    const defaultName = classNames[devices.length] || `Class ${devices.length + 1}`;
    
    const newDevice: BlynkDevice = {
      id: Date.now().toString(),
      authToken: '',
      templateId: '',
      templateName: '',
      deviceName: defaultName,
      virtualPin: `V${devices.length}`,
    };
    setDevices([...devices, newDevice]);
  };

  const removeDevice = (id: string) => {
    setDevices(devices.filter(device => device.id !== id));
  };

  const updateDevice = (id: string, field: keyof BlynkDevice, value: string) => {
    setDevices(devices.map(device => 
      device.id === id ? { ...device, [field]: value } : device
    ));
  };

  const testConnection = async (device: BlynkDevice) => {
    if (!device.authToken || !device.templateId || !device.deviceName || !device.virtualPin) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setTestingDeviceId(device.id);
    try {
      const { data, error } = await supabase.functions.invoke('blynk-proxy', {
        body: {
          authToken: device.authToken,
          method: 'GET',
          endpoint: '/device/info',
        },
      });

      if (error) throw error;

      setConnectedDevices(prev => new Set(prev).add(device.id));
      toast({
        title: "Connection Successful",
        description: `${device.deviceName} is connected!`,
      });
    } catch (error) {
      console.error('Connection error:', error);
      setConnectedDevices(prev => {
        const newSet = new Set(prev);
        newSet.delete(device.id);
        return newSet;
      });
      toast({
        title: "Connection Failed",
        description: "Unable to connect to Blynk. Please check your credentials.",
        variant: "destructive",
      });
    } finally {
      setTestingDeviceId(null);
    }
  };

  const handleSaveAll = () => {
    const hasInvalidDevices = devices.some(
      device => !device.authToken || !device.templateId || !device.deviceName || !device.virtualPin
    );
    
    if (hasInvalidDevices) {
      toast({
        title: "Invalid Configuration",
        description: "Please fill in all fields for each device",
        variant: "destructive",
      });
      return;
    }

    saveBlynkConfig({ devices });
    toast({
      title: "Configuration Saved",
      description: `${devices.length} device(s) configured successfully.`,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Navigation />
      <div className="container mx-auto px-4 py-8 pt-28">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card className="shadow-hover">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Blynk Cloud Setup</CardTitle>
                  <CardDescription>Configure multiple ESP32 device connections</CardDescription>
                </div>
                <Button onClick={addNewDevice} size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Device
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {devices.map((device, index) => (
                <Card key={device.id} className="border-2">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{device.deviceName || `ESP32 Device ${index + 1}`}</CardTitle>
                      <div className="flex items-center gap-2">
                        <StatusBadge connected={connectedDevices.has(device.id)} />
                        {devices.length > 1 && (
                          <Button
                            onClick={() => removeDevice(device.id)}
                            size="sm"
                            variant="ghost"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor={`deviceName-${device.id}`}>Device Name</Label>
                      <Input
                        id={`deviceName-${device.id}`}
                        type="text"
                        placeholder="e.g., 5th Sem A"
                        value={device.deviceName}
                        onChange={(e) => updateDevice(device.id, 'deviceName', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`authToken-${device.id}`}>Auth Token</Label>
                      <Input
                        id={`authToken-${device.id}`}
                        type="text"
                        placeholder="Enter Blynk auth token"
                        value={device.authToken}
                        onChange={(e) => updateDevice(device.id, 'authToken', e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`templateId-${device.id}`}>Template ID</Label>
                        <Input
                          id={`templateId-${device.id}`}
                          type="text"
                          placeholder="Template ID"
                          value={device.templateId}
                          onChange={(e) => updateDevice(device.id, 'templateId', e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`templateName-${device.id}`}>Template Name</Label>
                        <Input
                          id={`templateName-${device.id}`}
                          type="text"
                          placeholder="Template name"
                          value={device.templateName}
                          onChange={(e) => updateDevice(device.id, 'templateName', e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`virtualPin-${device.id}`}>Virtual Pin</Label>
                      <Input
                        id={`virtualPin-${device.id}`}
                        type="text"
                        placeholder="e.g., V0, V1, V3"
                        value={device.virtualPin}
                        onChange={(e) => updateDevice(device.id, 'virtualPin', e.target.value.toUpperCase())}
                      />
                    </div>

                    <Button
                      onClick={() => testConnection(device)}
                      disabled={testingDeviceId === device.id}
                      className="w-full"
                      variant="secondary"
                    >
                      {testingDeviceId === device.id ? "Testing..." : "Test Connection"}
                    </Button>
                  </CardContent>
                </Card>
              ))}

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={handleSaveAll}
                  className="flex-1"
                >
                  Save All Configurations
                </Button>
                <Button
                  onClick={() => navigate('/')}
                  variant="outline"
                  className="flex-1"
                >
                  Go to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default BlynkSetup;
